import { describe, it, expect } from "vitest";
import {
  timeToMinutes,
  getShiftScheduledMinutes,
  calculateShiftMetrics,
  calculateGeofenceDistance,
  verifyGeofenceLocation,
  formatDistance,
  ShiftConfig,
  GeofenceZoneItem,
} from "../lib/attendance";

describe("Shift Timing & Metric Calculations", () => {
  it("correctly converts time strings to minutes from midnight", () => {
    expect(timeToMinutes("00:00:00")).toBe(0);
    expect(timeToMinutes("09:00:00")).toBe(540);
    expect(timeToMinutes("18:30")).toBe(1110);
    expect(timeToMinutes("23:59:59")).toBe(1439);
  });

  it("calculates scheduled duration for standard day shift", () => {
    // 09:00 to 18:00 = 9 hours = 540 minutes
    const dayShift: ShiftConfig = {
      start_time: "09:00:00",
      end_time: "18:00:00",
      break_duration_minutes: 60,
    };
    expect(getShiftScheduledMinutes(dayShift)).toBe(540);
  });

  it("correctly calculates scheduled duration for overnight shift crossing midnight", () => {
    // 22:00 to 07:00 = 2 hours before midnight + 7 hours after = 9 hours = 540 minutes
    const nightShift: ShiftConfig = {
      start_time: "22:00:00",
      end_time: "07:00:00",
      is_night_shift: true,
      break_duration_minutes: 60,
    };
    expect(getShiftScheduledMinutes(nightShift)).toBe(540);
  });

  it("marks check-in within grace period as on-time", () => {
    const shift: ShiftConfig = {
      start_time: "09:00:00",
      end_time: "18:00:00",
      grace_period_minutes: 15,
      break_duration_minutes: 60,
      full_day_min_hours: 8.0,
      half_day_min_hours: 4.5,
    };

    // Checked in at 09:12 (within 15 min grace), checked out at 18:05
    const metrics = calculateShiftMetrics(
      "2026-11-24T09:12:00",
      "2026-11-24T18:05:00",
      shift
    );

    expect(metrics.is_late).toBe(false);
    expect(metrics.late_minutes).toBe(0);
    expect(metrics.status).toBe("present");
    expect(metrics.is_half_day).toBe(false);
    expect(metrics.working_hours).toBeGreaterThanOrEqual(7.8);
  });

  it("detects late check-in beyond grace period", () => {
    const shift: ShiftConfig = {
      start_time: "09:00:00",
      end_time: "18:00:00",
      grace_period_minutes: 15,
      break_duration_minutes: 60,
      full_day_min_hours: 8.0,
      half_day_min_hours: 4.5,
    };

    // Checked in at 09:28 (28 mins after start, grace was 15)
    const metrics = calculateShiftMetrics(
      "2026-11-24T09:28:00",
      "2026-11-24T18:00:00",
      shift
    );

    expect(metrics.is_late).toBe(true);
    expect(metrics.late_minutes).toBe(28);
    expect(metrics.status).toBe("late");
  });

  it("detects early departure beyond early departure grace period", () => {
    const shift: ShiftConfig = {
      start_time: "09:00:00",
      end_time: "18:00:00",
      grace_period_minutes: 15,
      early_departure_grace_minutes: 15,
      break_duration_minutes: 60,
      full_day_min_hours: 8.0,
      half_day_min_hours: 4.5,
    };

    // Left at 17:25 (35 mins before 18:00 end, grace was 15 mins)
    const metrics = calculateShiftMetrics(
      "2026-11-24T09:00:00",
      "2026-11-24T17:25:00",
      shift
    );

    expect(metrics.is_early_departure).toBe(true);
    expect(metrics.early_departure_minutes).toBe(35);
  });

  it("calculates overtime when worked duration exceeds scheduled shift duration", () => {
    const shift: ShiftConfig = {
      start_time: "09:00:00",
      end_time: "17:00:00", // 8 gross hours - 1 hr break = 7 net hours
      break_duration_minutes: 60,
      grace_period_minutes: 15,
      full_day_min_hours: 7.0,
      half_day_min_hours: 3.5,
    };

    // Checked in at 09:00, checked out at 19:30 (10.5 gross hrs - 1 hr break = 9.5 net hrs -> 2.5 hrs OT)
    const metrics = calculateShiftMetrics(
      "2026-11-24T09:00:00",
      "2026-11-24T19:30:00",
      shift
    );

    expect(metrics.working_hours).toBe(9.5);
    expect(metrics.overtime_hours).toBe(2.5);
  });

  it("detects half-day status when net worked hours are below threshold", () => {
    const shift: ShiftConfig = {
      start_time: "09:00:00",
      end_time: "18:00:00",
      break_duration_minutes: 60,
      grace_period_minutes: 15,
      full_day_min_hours: 8.0,
      half_day_min_hours: 4.5,
    };

    // Worked only 3 hours
    const metrics = calculateShiftMetrics(
      "2026-11-24T09:00:00",
      "2026-11-24T12:00:00",
      shift
    );

    expect(metrics.is_half_day).toBe(true);
    expect(metrics.status).toBe("half_day");
  });
});

describe("Geofence Distance & Location Verification", () => {
  const officeZone: GeofenceZoneItem = {
    id: "zone-1",
    name: "Fluxora HQ",
    latitude: 19.4871671,
    longitude: 74.9221559,
    radius_meters: 100,
  };

  it("calculates 0 meters for identical GPS coordinates", () => {
    const dist = calculateGeofenceDistance(19.4871671, 74.9221559, 19.4871671, 74.9221559);
    expect(dist).toBe(0);
  });

  it("calculates accurate distance for nearby coordinates within office radius", () => {
    // Offset by ~25 meters
    const dist = calculateGeofenceDistance(19.4871671, 74.9221559, 19.4873500, 74.9221559);
    expect(dist).toBeGreaterThan(15);
    expect(dist).toBeLessThan(30);
  });

  it("correctly identifies employee inside geofence radius", () => {
    // User at ~20m distance
    const verification = verifyGeofenceLocation(
      19.4873000,
      74.9221559,
      [officeZone]
    );

    expect(verification.isInside).toBe(true);
    expect(verification.distanceMeters).toBeLessThanOrEqual(100);
    expect(verification.nearestZone?.name).toBe("Fluxora HQ");
  });

  it("correctly rejects employee outside geofence radius", () => {
    // User ~450m away
    const verification = verifyGeofenceLocation(
      19.4910000,
      74.9221559,
      [officeZone]
    );

    expect(verification.isInside).toBe(false);
    expect(verification.distanceMeters).toBeGreaterThan(100);
  });

  it("formats distance clearly for display", () => {
    expect(formatDistance(45)).toBe("45m");
    expect(formatDistance(350.4)).toBe("350m");
    expect(formatDistance(1200)).toBe("1.2 km");
    expect(formatDistance(5430)).toBe("5.4 km");
  });
});
