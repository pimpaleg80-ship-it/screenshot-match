# FlowPeople HRMS — API & RPC Function Documentation

**Protocol**: PostgreSQL Stored Procedures / Supabase PostgREST Data API  
**Authentication**: Supabase JWT (`Bearer <access_token>`)  

---

## 1. Remote Procedure Calls (RPCs)

### `public.verify_and_record_attendance`
Gated manual attendance submission with horizontal GPS accuracy and geofence perimeter validation.

- **Endpoint**: `POST /rest/v1/rpc/verify_and_record_attendance`
- **Caller Role**: `authenticated`
- **Request Body**:
  ```json
  {
    "p_action": "check_in",
    "p_lat": 18.52041,
    "p_lon": 73.85671,
    "p_accuracy": 8.5,
    "p_device_id": "device-uuid-string"
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "action": "check_in",
    "attendance_id": "36b4ef97-9c87-4c2f-a839-f0b83bf08fdc",
    "time": "2026-11-06T09:30:00Z",
    "status": "present",
    "location_name": "Fluxora HQ - Innovation Campus",
    "distance_meters": 1.5
  }
  ```

---

### `public.get_employee_geofence_context`
Queries the active employee's assigned work location, shift boundaries, and today's attendance status.

- **Endpoint**: `POST /rest/v1/rpc/get_employee_geofence_context`
- **Caller Role**: `authenticated`
- **Success Response**:
  ```json
  {
    "employee": {
      "id": "3f214792-1e6e-4d22-b336-cc8be6ea15e9",
      "name": "Admin Pimpale",
      "organization_id": "00000000-0000-0000-0000-000000000001"
    },
    "location": {
      "id": "00000000-0000-0000-0000-000000000002",
      "name": "Fluxora HQ - Innovation Campus",
      "address": "Senapati Bapat Road, Shivaji Nagar, Pune",
      "latitude": 18.5204,
      "longitude": 73.8567,
      "radius_meters": 150
    },
    "today_attendance": null,
    "shift": {
      "name": "General Shift (09:00 - 18:00)",
      "start_time": "09:00:00",
      "end_time": "18:00:00"
    }
  }
  ```

---

### `public.calculate_haversine_distance`
Calculates distance in meters between two coordinate pairs.

- **Parameters**: `lat1`, `lon1`, `lat2`, `lon2` (`double precision`)
- **Returns**: `double precision` (distance in meters)
