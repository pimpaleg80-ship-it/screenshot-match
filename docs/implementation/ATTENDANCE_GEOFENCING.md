# FlowPeople HRMS — Attendance & Background Geofencing Architecture

**Core Philosophy**:
1. GPS ONLY controls Check-in and Check-out button eligibility.
2. Employee must manually press both attendance buttons.
3. No automatic attendance marking.
4. Native background geofence detection.
5. Check-out disabled when outside assigned geofence.

---

## 1. Mathematical Geofencing Engine

Distance between the employee's current GPS coordinate $(lat_1, lon_1)$ and assigned office location $(lat_2, lon_2)$ is computed via the Haversine formula:

$$\Delta\phi = \text{radians}(lat_2 - lat_1)$$
$$\Delta\lambda = \text{radians}(lon_2 - lon_1)$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\text{radians}(lat_1))\cos(\text{radians}(lat_2))\sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}(\sqrt{a}, \sqrt{1 - a})$$
$$d = R \cdot c \quad (R = 6,371,000\text{ meters})$$

Implemented both in client-side TypeScript (`src/lib/geofence.ts`) and database PostgreSQL RPC (`public.calculate_haversine_distance`).

---

## 2. Attendance RPC: `verify_and_record_attendance`

- **Parameters**: `p_action` ('check_in' | 'check_out'), `p_lat`, `p_lon`, `p_accuracy`, `p_device_id`.
- **Accuracy Verification**: Rejects GPS payloads with horizontal accuracy $> 150\text{m}$.
- **Geofence Enforcement**:
  - Calculates distance $d$ to assigned work location.
  - If $d > \text{radius\_meters}$, raises an exception specifying the exact distance and rejects the action.
  - Logs out-of-bounds attempt into `geofence_events`.
- **Check-in Processing**:
  - Validates no active check-in exists for today.
  - Evaluates shift schedule: flags as `'late'` if time exceeds work start + grace minutes.
  - Creates attendance record with `status = 'present'`, `method = 'manual_geofence'`, coordinates, and timestamp.
- **Check-out Processing**:
  - Validates employee has checked in today and has not already checked out.
  - Enforces that employee is physically inside geofence.
  - Calculates total elapsed hours (`total_hours`) and records check-out timestamp and coordinates.

---

## 3. Rolling 90-Day Temporary GPS Retention

- Raw GPS telemetry and geofence transitions (`geofence_events`) are retained for **90 days by default** (configurable per organization in `organizations.gps_retention_days`).
- Cleaned up safely via scheduled database function `public.cleanup_expired_gps_logs()`.
- Canonical attendance records (`attendance`) and monthly summaries (`attendance_monthly_summaries`) are permanent and never deleted.
