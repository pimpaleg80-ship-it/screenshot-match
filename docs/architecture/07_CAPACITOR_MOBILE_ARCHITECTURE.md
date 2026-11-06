# 07. Capacitor Mobile Hybrid Architecture & Native Geofencing

**Target Platforms**: Android (API level 29–35 / Android 10–15), iOS (iOS 15–18)  
**Hybrid Container**: Capacitor 6+ with React 19 Client SPA  
**Core Purpose**: Native background geofence detection, hardware device identification, and secure manual attendance gating without high battery drain.  

---

## 1. Capacitor Architecture & Runtime Container

The mobile application embeds the existing FlowPeople React client inside a native Capacitor `WebView`, augmented with native background location services:

```
┌─────────────────────────────────────────────────────────────┐
│                 FLOWPEOPLE MOBILE APPLICATION               │
├─────────────────────────────────────────────────────────────┤
│  [ React 19 Client Application (dist/assets) ]              │
│  • TanStack Router SPA navigation                           │
│  • Employee Self-Service Dashboard                          │
│  • [ Check-in ] / [ Check-out ] Touch Buttons               │
│  • Live Geofence Eligibility Indicator                      │
├─────────────────────────────────────────────────────────────┤
│  [ Capacitor Bridge Layer (@capacitor/core) ]               │
├──────────────────────────────┬──────────────────────────────┤
│       ANDROID RUNTIME        │          iOS RUNTIME         │
├──────────────────────────────┼──────────────────────────────┤
│ • Google Play Services       │ • Core Location Framework    │
│   GeofencingClient           │ • CLLocationManager Region   │
│ • GeofenceBroadcastReceiver  │   Monitoring                 │
│ • BootCompletedReceiver      │ • Background Location Mode   │
│ • Android 14 Foreground Svc  │ • Significant Motion Monitor │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 2. Android Native Geofencing Implementation Requirements

### 1. Required Manifest Permissions (`AndroidManifest.xml`)
```xml
<!-- Foreground location access -->
<uses-permission android:name="android.intent.action.BOOT_COMPLETED" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Background location access (Android 10+ / API 29+) -->
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Foreground service requirements (Android 14+ / API 34+) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Reboot recovery -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### 2. Native Geofence Registration (`GeofencingClient`)
- Work locations are retrieved from `GET /api/v1/locations` and registered via Google Play Services `GeofencingClient.addGeofences()`:
  - `setExpirationDuration(NEVER_EXPIRE)`
  - `setTransitionTypes(GEOFENCE_TRANSITION_ENTER | GEOFENCE_TRANSITION_EXIT | GEOFENCE_TRANSITION_DWELL)`
  - `setLoiteringDelay(30000)` (30-second dwell time to eliminate boundary bounce jitter)
  - `setNotificationResponsiveness(60000)` (Optimized for low battery consumption)

### 3. Broadcast Receiver & Reboot Recovery
- **`GeofenceBroadcastReceiver`**: Woken by the operating system when the employee crosses the office threshold. Updates local storage flag `is_inside_geofence = true`, updates app badge, and triggers local notification.
- **`BootCompletedReceiver`**: Because Android OS clears active geofences upon system shutdown or reboot, this receiver listens for `android.intent.action.BOOT_COMPLETED`, reads cached office coordinates from encrypted preferences, and re-registers the geofences immediately upon phone boot.

### 4. Battery Optimization & Power Management
- Uses Google Play Services hardware-assisted geofencing (WiFi scanning + cell tower triangulation + low-power GPS geofencing chip).
- No continuous GPS streaming is used. High-accuracy GPS is only activated for 3 seconds when the employee presses the [ Check-in ] or [ Check-out ] button.

---

## 3. iOS Core Location Region Monitoring Requirements

### 1. Required Capabilities & Permissions (`Info.plist`)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>FlowPeople requires location access to enable attendance check-in buttons when you arrive at your office.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>FlowPeople monitors office geofences in the background to verify attendance eligibility without requiring you to open the app.</string>

<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>remote-notification</string>
</array>
```

### 2. Native Region Monitoring (`CLLocationManager`)
- Registers `CLCircularRegion` objects for each assigned office location:
  - `region.notifyOnEntry = true`
  - `region.notifyOnExit = true`
  - Radius: clamped to minimum $100\text{m}$ per Apple Core Location guidelines for battery efficiency.
- **App Termination Recovery**: If the iOS app is terminated by the user or purged by the system, Core Location relaunches the app in the background when an entry/exit event occurs. The app delegate inspects `launchOptions[UIApplicationLaunchOptionsKey.location]` and restores region state.

---

## 4. Identified Architectural Blockers in Existing Codebase

1. **Browser Printing API**:
   - `src/lib/attendance.ts` uses `window.open()` and `window.print()`.
   - *Fix*: In Capacitor native builds, integrate `@capacitor/filesystem` and `@capacitor/share` to save generated PDFs to device storage and open the native system sharing sheet.
2. **Missing Native Bridge**:
   - The current codebase directly instantiates `navigator.geolocation.getCurrentPosition()`.
   - *Fix*: Abstract location queries through a unified `LocationService` that uses `@capacitor/geolocation` on mobile and HTML5 Geolocation on desktop browsers.
3. **Face Recognition Camera Drain**:
   - The current face-api loop consumes ~30% CPU continuously on mobile devices.
   - *Resolution*: Strictly isolate the webcam facial scanner to the office Smart Kiosk tablet mode (`/kiosk`). Mobile personal devices rely 100% on native geofencing + manual button tapping, preserving mobile battery life.

