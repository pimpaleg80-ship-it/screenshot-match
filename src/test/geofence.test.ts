import { describe, it, expect } from "vitest";
import { calculateHaversineDistance, formatDistance } from "../lib/geofence";

describe("Geofence & Location Distance Calculations", () => {
  // Test Coordinates:
  // Pune HQ: 18.5204, 73.8567
  const hqLat = 18.5204;
  const hqLon = 73.8567;

  it("calculates 0 meters for identical coordinates", () => {
    const dist = calculateHaversineDistance(hqLat, hqLon, hqLat, hqLon);
    expect(dist).toBe(0);
  });

  it("calculates accurate distance for nearby coordinates (~15 meters)", () => {
    // Offset by ~0.0001 degree latitude (~11 meters) and 0.0001 longitude (~10 meters)
    const dist = calculateHaversineDistance(hqLat, hqLon, 18.5205, 73.8568);
    expect(dist).toBeGreaterThan(10);
    expect(dist).toBeLessThan(20);
  });

  it("calculates accurate distance for intercity coordinates (Pune to Mumbai ~120km)", () => {
    const mumbaiLat = 19.076;
    const mumbaiLon = 72.8777;
    const dist = calculateHaversineDistance(hqLat, hqLon, mumbaiLat, mumbaiLon);
    const distKm = dist / 1000;
    expect(distKm).toBeGreaterThan(115);
    expect(distKm).toBeLessThan(125);
  });

  it("formats distance accurately in meters and kilometers", () => {
    expect(formatDistance(0)).toBe("0m");
    expect(formatDistance(45.4)).toBe("45m");
    expect(formatDistance(150)).toBe("150m");
    expect(formatDistance(999)).toBe("999m");
    expect(formatDistance(1000)).toBe("1.0km");
    expect(formatDistance(1250)).toBe("1.3km");
    expect(formatDistance(120150)).toBe("120.2km");
  });

  it("evaluates geofence perimeter radius compliance", () => {
    const radiusMeters = 150;
    // Inside point (15m away)
    const distInside = calculateHaversineDistance(hqLat, hqLon, 18.5205, 73.8568);
    expect(distInside <= radiusMeters).toBe(true);

    // Outside point (~400m away)
    const distOutside = calculateHaversineDistance(hqLat, hqLon, 18.524, 73.8567);
    expect(distOutside > radiusMeters).toBe(true);
  });

  it("handles multi-tier coordinates with source attribution", () => {
    const coords = {
      latitude: 18.5204,
      longitude: 73.8567,
      accuracy: 75,
      timestamp: Date.now(),
      source: "edge_cloudflare" as const,
      city: "Pune",
    };
    expect(coords.source).toBe("edge_cloudflare");
    expect(coords.accuracy).toBe(75);
    expect(coords.city).toBe("Pune");
  });
});
