/**
 * Face recognition helpers built on @vladmandic/face-api.
 * Models are loaded from a CDN on first use (browser only).
 */

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

type FaceApiModule = typeof import("@vladmandic/face-api");

let loadPromise: Promise<FaceApiModule> | null = null;

export async function loadFaceApi(): Promise<FaceApiModule> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const faceapi = await import("@vladmandic/face-api");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return faceapi;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

export function detectOptions(faceapi: FaceApiModule, inputSize = 320) {
  return new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.5 });
}

/** Euclidean distance between two 128-d face descriptors. */
export function descriptorDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Element-wise mean of descriptors, then L2-normalized. */
export function averageDescriptors(list: number[][]): number[] {
  if (list.length === 0) throw new Error("No descriptors to average");
  const len = list[0].length;
  const mean = new Array<number>(len).fill(0);
  for (const d of list) for (let i = 0; i < len; i++) mean[i] += d[i] / list.length;
  const norm = Math.sqrt(mean.reduce((s, v) => s + v * v, 0)) || 1;
  return mean.map((v) => v / norm);
}

// --- Liveness helpers -------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

// 68-landmark eye index groups (face-api FaceLandmarks68 order).
export const LEFT_EYE_IDX = [36, 37, 38, 39, 40, 41];
export const RIGHT_EYE_IDX = [42, 43, 44, 45, 46, 47];

/** Eye aspect ratio: low when the eye is closed (blink). */
export function eyeAspectRatio(points: Point[], idx: number[]): number {
  const p = idx.map((i) => points[i]);
  const v1 = dist(p[1], p[5]);
  const v2 = dist(p[2], p[4]);
  const h = dist(p[0], p[3]);
  if (h === 0) return 1;
  return (v1 + v2) / (2 * h);
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Horizontal offset of the nose tip relative to the eye midpoint,
 * normalized by inter-eye distance. ~0 when looking straight,
 * larger magnitude when the head is turned.
 */
export function headYawRatio(points: Point[]): number {
  const left = points[36];
  const right = points[45];
  const nose = points[30];
  const eyeMid = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const interEye = dist(left, right) || 1;
  return (nose.x - eyeMid.x) / interEye;
}
