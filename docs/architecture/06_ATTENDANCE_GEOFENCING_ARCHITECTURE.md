# 06. Attendance & Geofencing Architecture

**Core Philosophy**: Strict Manual Action Gated by Native Background Geofence Eligibility.  
**Non-Negotiable Rule**: No automatic attendance marking. GPS events only control Check-in and Check-out button eligibility. The employee must manually press both buttons. Check-out is disabled when outside the assigned geofence.  

---

## 1. Attendance State Machine & Button Eligibility

The lifecycle of an employee work day is governed by the state machine below:

```
                      ┌────────────────────────────────────────┐
                      │          1. OUTSIDE GEOFENCE           │
                      │  • Check-in Button:  DISABLED          │
                      │  • Check-out Button: DISABLED          │
                      └──────────────────┬─────────────────────┘
                                         │
                    Native Geofence ENTER Event Detected
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    2. INSIDE GEOFENCE (NOT STARTED)    │
                      │  • Check-in Button:  ENABLED           │
                      │  • Check-out Button: DISABLED          │
                      └──────────────────┬─────────────────────┘
                                         │
                      Employee Manually Taps [ Check-in ]
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │   3. INSIDE GEOFENCE (CHECKED IN)      │
                      │  • Check-in Button:  DISABLED          │
                      │  • Check-out Button: ENABLED           │
                      └──────────┬───────────────────▲─────────┘
                                 │                   │
         Employee Leaves Geofence│                   │Employee Returns
                                 ▼                   │
    ┌────────────────────────────────────────┐       │
    │  4. OUTSIDE GEOFENCE (ACTIVE SESSION)  ├───────┘
    │  • Check-in Button:  DISABLED          │
    │  • Check-out Button: DISABLED (Gated)  │
    │  • Message: "Return to office to exit" │
    └──────────────────┬─────────────────────┘
                       │
                       │ If shift ends while outside:
                       ▼ Submit Regularization Request
    ┌────────────────────────────────────────┐
    │ 5. SHIFT END / HR REGULARIZATION FLOW  │
    └──────────────────┬─────────────────────┘
                       │
   (When inside) Employee Manually Taps [ Check-out ]
                       │
                       ▼
    ┌────────────────────────────────────────┐
    │       6. WORK DAY SESSION CLOSED       │
    │  • Check-in Button:  DISABLED          │
    │  • Check-out Button: DISABLED          │
    │  • Status: Day Completed (Hours Logged)│
    └────────────────────────────────────────┘
```

---

## 2. Geofence Boundary & Mathematical Validation

Each organization branch defines one or more work locations. Each location specifies:
- `latitude` (double precision, e.g., `18.5204303`)
- `longitude` (double precision, e.g., `73.8567437`)
- `radius_meters` (integer, typically $50\text{m} - 250\text{m}$, default $100\text{m}$)
- `polygon_coordinates` (optional GeoJSON array of `[lat, lon]` pairs for non-circular office complexes)
- `allowed_mock_location` (strictly `false` in production)

### 1. Distance Calculation (Haversine Formula)
Used by the backend to independently verify whether a coordinate `(lat1, lon1)` is within radius $R$ of the office `(lat2, lon2)`:

$$\Delta\phi = \phi_2 - \phi_1, \quad \Delta\lambda = \lambda_2 - \lambda_1$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right), \quad d = R_{\text{earth}} \cdot c$$

If $d \le \text{radius\_meters} + \text{accuracy\_meters}$, the coordinate is mathematically within the geofence boundary.

### 2. Ray-Casting Algorithm (Polygon Geofences)
For multi-point building campuses, the backend applies the point-in-polygon ray-casting algorithm: a horizontal ray is cast from the coordinate; if the ray intersects the polygon edges an odd number of times, the point lies inside the boundary.

---

## 3. End-to-End Attendance Verification Flow

1. **Native Background Monitoring**:
   - The native mobile app (Android Geofencing API / iOS Core Location) registers the employee's assigned office locations as background monitored regions.
   - When the employee crosses the geofence boundary, the operating system fires an `ENTER` or `EXIT` broadcast receiver.
   - The app updates its internal eligibility state and surfaces a local push notification: *"You have arrived at Pune HQ. Tap to Check-in."*

2. **Manual Button Press (Zero Automation)**:
   - The employee opens the app and manually presses the green **[ Check-in ]** button.
   - The app captures:
     - Fresh GPS coordinates `(latitude, longitude, horizontal_accuracy)`
     - Hardware device identifier (`device_uuid`, `device_model`, `is_mock_location`)
     - Timestamp

3. **Backend Cryptographic Validation**:
   - The payload is dispatched over HTTPS to `POST /api/v1/attendance/check-in`.
   - The backend performs 6 independent verification gates:
     1. **Mock GPS Gate**: Rejects payload if `is_mock_location == true` or if GPS accuracy $> 30\text{m}$.
     2. **Geofence Gate**: Computes Haversine distance against assigned office location. If distance $> \text{radius}$, request is rejected with `403 Geofence Violation`.
     3. **Device Binding Gate**: Verifies `device_uuid` against `registered_devices` to prevent buddy punching.
     4. **State Machine Gate**: Verifies no active session already exists for today.
     5. **Shift Gate**: Computes whether check-in is on-time or late based on organization grace minutes.
     6. **Session Creation**: Inserts into `attendance_sessions` and records raw GPS in temporary `geofence_events`.

4. **Strict Check-out Gating**:
   - When the employee is ready to leave, they must manually press **[ Check-out ]**.
   - If the employee has already left the building and is outside the geofence, the button is **disabled**, and an error alert is displayed: *"Check-out is only permitted inside the assigned office location."*
   - If an employee forgets to check out on site, the session remains open until automatic day-end closure, requiring the employee to submit an **HR Regularization Request** the next morning.

