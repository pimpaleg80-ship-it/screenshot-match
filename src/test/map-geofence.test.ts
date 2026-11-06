import { describe, it, expect } from "vitest";
import {
  OPENFREEMAP_LIBERTY_STYLE,
  createGeoJSONCircle,
  isWebGLSupported,
  searchAddressWithOSM,
} from "../lib/map-utils";

describe("OpenFreeMap & MapLibre Geofence Geometry Utilities", () => {
  it("uses the official free OpenFreeMap Liberty style URL without API keys", () => {
    expect(OPENFREEMAP_LIBERTY_STYLE).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(OPENFREEMAP_LIBERTY_STYLE).not.toContain("key=");
    expect(OPENFREEMAP_LIBERTY_STYLE).not.toContain("google");
  });

  it("generates a closed GeoJSON polygon ring with 65 coordinates for 64 segments", () => {
    const center: [number, number] = [73.8567, 18.5204]; // [lng, lat]
    const radiusMeters = 150;
    const geojson = createGeoJSONCircle(center, radiusMeters, 64);

    expect(geojson.type).toBe("Feature");
    expect(geojson.geometry.type).toBe("Polygon");
    expect(Array.isArray(geojson.geometry.coordinates)).toBe(true);

    const ring = geojson.geometry.coordinates[0]!;
    // 64 segments + 1 closing vertex = 65 points
    expect(ring.length).toBe(65);

    // Verify polygon ring is properly closed (first === last)
    const firstPoint = ring[0]!;
    const lastPoint = ring[ring.length - 1]!;
    expect(firstPoint[0]).toBeCloseTo(lastPoint[0], 6);
    expect(firstPoint[1]).toBeCloseTo(lastPoint[1], 6);
  });

  it("calculates accurate geographic dispersion for different radii", () => {
    const center: [number, number] = [73.8567, 18.5204];

    // 150m radius
    const geojson150 = createGeoJSONCircle(center, 150, 64);
    const ring150 = geojson150.geometry.coordinates[0]!;

    // Find max delta from center in degrees
    let maxDeltaLat150 = 0;
    let maxDeltaLng150 = 0;
    for (const [lng, lat] of ring150) {
      maxDeltaLat150 = Math.max(maxDeltaLat150, Math.abs(lat - center[1]));
      maxDeltaLng150 = Math.max(maxDeltaLng150, Math.abs(lng - center[0]));
    }

    // 150m is approximately 0.00135 degrees latitude
    expect(maxDeltaLat150).toBeGreaterThan(0.001);
    expect(maxDeltaLat150).toBeLessThan(0.002);

    // 300m radius should be approximately 2x delta
    const geojson300 = createGeoJSONCircle(center, 300, 64);
    const ring300 = geojson300.geometry.coordinates[0]!;
    let maxDeltaLat300 = 0;
    for (const [, lat] of ring300) {
      maxDeltaLat300 = Math.max(maxDeltaLat300, Math.abs(lat - center[1]));
    }

    expect(maxDeltaLat300).toBeCloseTo(maxDeltaLat150 * 2, 4);
  });

  it("provides safe fallback when searchAddressWithOSM is passed empty or whitespace queries", async () => {
    const emptyResult = await searchAddressWithOSM("");
    expect(emptyResult).toEqual([]);

    const whitespaceResult = await searchAddressWithOSM("   ");
    expect(whitespaceResult).toEqual([]);
  });

  it("handles WebGL detection without crashing in SSR or non-browser test environment", () => {
    // In Node / Bun environment without HTMLCanvasElement, it should return false cleanly
    const supported = isWebGLSupported();
    expect(typeof supported).toBe("boolean");
  });
});
