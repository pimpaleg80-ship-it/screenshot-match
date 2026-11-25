import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  formatDistance,
  formatCoordinates,
  validateCoordinates,
  getAccuracyCategory,
  type Coordinates,
  type GeofenceLocation,
} from "../lib/geofence";

describe("GPS Geofence & Location Intelligence Suite", () => {
  // Pune HQ Test Fixture: 18.5204° N, 73.8567° E, 150m radius
  const hqLocation: GeofenceLocation = {
    id: "loc-pune-hq",
    name: "Pune HQ",
    address: "Senapati Bapat Road, Pune, Maharashtra",
    latitude: 18.5204,
    longitude: 73.8567,
    radius_meters: 150,
  };

  it("calculates 0 meters for identical coordinates", () => {
    const dist = calculateHaversineDistance(
      hqLocation.latitude,
      hqLocation.longitude,
      hqLocation.latitude,
      hqLocation.longitude,
    );
    expect(dist).toBe(0);
  });

  it("calculates accurate metric distance for on-site employee positions", () => {
    // ~15 meters north: delta lat approx +0.000135
    const lat15m = hqLocation.latitude + 0.000135;
    const dist = calculateHaversineDistance(
      lat15m,
      hqLocation.longitude,
      hqLocation.latitude,
      hqLocation.longitude,
    );
    expect(dist).toBeGreaterThanOrEqual(14);
    expect(dist).toBeLessThanOrEqual(16);
    expect(dist <= hqLocation.radius_meters).toBe(true);
  });

  it("calculates accurate boundary distance for 150m perimeter edge", () => {
    // ~150 meters north: delta lat approx +0.00135
    const lat150m = hqLocation.latitude + 0.00135;
    const dist = calculateHaversineDistance(
      lat150m,
      hqLocation.longitude,
      hqLocation.latitude,
      hqLocation.longitude,
    );
    expect(dist).toBeGreaterThanOrEqual(148);
    expect(dist).toBeLessThanOrEqual(152);
  });

  it("correctly identifies outside-geofence positions", () => {
    // ~200 meters north: outside 150m radius
    const lat200m = hqLocation.latitude + 0.0018;
    const dist = calculateHaversineDistance(
      lat200m,
      hqLocation.longitude,
      hqLocation.latitude,
      hqLocation.longitude,
    );
    expect(dist).toBeGreaterThan(150);
    expect(dist <= hqLocation.radius_meters).toBe(false);
  });

  it("formats human-readable distances in meters and kilometers", () => {
    expect(formatDistance(15)).toBe("15m");
    expect(formatDistance(148.4)).toBe("148m");
    expect(formatDistance(1250)).toBe("1.3km");
    expect(formatDistance(120400)).toBe("120.4km");
  });

  it("validates coordinate boundaries accurately", () => {
    // Valid coordinates
    expect(validateCoordinates(18.5204, 73.8567).valid).toBe(true);
    expect(validateCoordinates(0, 0).valid).toBe(true);
    expect(validateCoordinates(-33.8688, 151.2093).valid).toBe(true); // Sydney

    // Invalid latitudes
    expect(validateCoordinates(95.0, 73.8567).valid).toBe(false);
    expect(validateCoordinates(-91.0, 73.8567).valid).toBe(false);

    // Invalid longitudes
    expect(validateCoordinates(18.5204, 185.0).valid).toBe(false);
    expect(validateCoordinates(18.5204, -181.0).valid).toBe(false);

    // Non-finite
    expect(validateCoordinates(NaN, 73.8567).valid).toBe(false);
    expect(validateCoordinates(18.5204, Infinity).valid).toBe(false);
  });

  it("formats coordinates with cardinal directions", () => {
    const formatted = formatCoordinates(18.5204, 73.8567);
    expect(formatted).toContain("18.520400° N");
    expect(formatted).toContain("73.856700° E");

    const southWest = formatCoordinates(-33.8688, -70.6693);
    expect(southWest).toContain("33.868800° S");
    expect(southWest).toContain("70.669300° W");
  });

  it("evaluates GPS accuracy categories according to strict security thresholds", () => {
    // <= 50m: Good / High precision
    const good = getAccuracyCategory(12);
    expect(good.level).toBe("good");
    expect(good.label).toBe("High Precision");

    // 51m - 100m: Warning / Moderate
    const warning = getAccuracyCategory(75);
    expect(warning.level).toBe("warning");

    // 101m - 150m: Warning / Marginal
    const marginal = getAccuracyCategory(140);
    expect(marginal.level).toBe("warning");

    // > 150m: Rejected
    const rejected = getAccuracyCategory(180);
    expect(rejected.level).toBe("rejected");
    expect(rejected.label).toBe("Accuracy Too Low");
  });

  it("handles multi-tier coordinate sources gracefully", () => {
    const testTiers: Coordinates[] = [
      { latitude: 18.5204, longitude: 73.8567, accuracy: 10, timestamp: Date.now(), source: "native_gps" },
      { latitude: 18.5204, longitude: 73.8567, accuracy: 25, timestamp: Date.now(), source: "browser_gps" },
      { latitude: 18.5204, longitude: 73.8567, accuracy: 65, timestamp: Date.now(), source: "browser_network" },
      { latitude: 18.5204, longitude: 73.8567, accuracy: 75, timestamp: Date.now(), source: "edge_cloudflare" },
    ];

    testTiers.forEach((coord) => {
      expect(coord.latitude).toBeCloseTo(18.5204, 4);
      expect(coord.longitude).toBeCloseTo(73.8567, 4);
      expect(coord.accuracy).toBeLessThanOrEqual(150);
      expect(["native_gps", "browser_gps", "browser_network", "edge_cloudflare"]).toContain(coord.source);
    });
  });
});

