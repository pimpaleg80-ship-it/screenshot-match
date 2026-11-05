import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import {
  toDateKey,
  totalHours,
  formatHours,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/attendance";
import {
  descriptorDistance,
  averageDescriptors,
  eyeAspectRatio,
  dist,
  headYawRatio,
} from "@/lib/face";

describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    const matches = router.matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches authenticated routes correctly", () => {
    const routes = ["/dashboard", "/people", "/kiosk", "/attendance", "/reports", "/settings"];
    for (const r of routes) {
      const matches = router.matchRoutes(r);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it("matches auth and reset password routes", () => {
    expect(router.matchRoutes("/auth").at(-1)?.routeId).not.toBe(rootRouteId);
    expect(router.matchRoutes("/reset-password").at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

describe("Attendance helpers", () => {
  it("formats date keys in YYYY-MM-DD", () => {
    const d = new Date(2026, 10, 5); // Nov 5, 2026
    expect(toDateKey(d)).toBe("2026-11-05");
  });

  it("computes total hours between two timestamps", () => {
    const inTime = "2026-11-05T09:00:00.000Z";
    const outTime = "2026-11-05T17:30:00.000Z";
    expect(totalHours(inTime, outTime)).toBe(8.5);
  });

  it("returns null when checkIn or checkOut is missing", () => {
    expect(totalHours(null, "2026-11-05T17:00:00Z")).toBeNull();
    expect(totalHours("2026-11-05T09:00:00Z", null)).toBeNull();
  });

  it("formats hours into human readable string", () => {
    expect(formatHours(8.5)).toBe("8h 30m");
    expect(formatHours(4)).toBe("4h");
    expect(formatHours(null)).toBe("—");
  });

  it("defines standard attendance statuses and colors", () => {
    expect(STATUS_LABELS["present"]).toBe("Present");
    expect(STATUS_LABELS["late"]).toBe("Late");
    expect(STATUS_COLORS["present"]).toContain("success");
    expect(STATUS_COLORS["late"]).toContain("warning");
  });
});

describe("Face recognition helpers", () => {
  it("calculates Euclidean distance accurately", () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(descriptorDistance(a, b)).toBe(0);

    const c = [0, 0, 0];
    const d = [3, 4, 0];
    expect(descriptorDistance(c, d)).toBe(5);
  });

  it("calculates averaged normalized descriptor", () => {
    const d1 = [1, 0];
    const d2 = [0, 1];
    const avg = averageDescriptors([d1, d2]);
    expect(avg.length).toBe(2);
    // Norm should be ~1
    const norm = Math.hypot(avg[0]!, avg[1]!);
    expect(norm).toBeCloseTo(1, 4);
  });

  it("computes distance between 2D points", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("calculates eye aspect ratio", () => {
    // 6 eye landmarks in order
    const openEye = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 6, y: 0 },
      { x: 4, y: -2 },
      { x: 2, y: -2 },
    ];
    const ear = eyeAspectRatio(openEye, [0, 1, 2, 3, 4, 5]);
    expect(ear).toBeGreaterThan(0.3);
  });
});
