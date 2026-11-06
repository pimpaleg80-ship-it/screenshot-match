# FlowPeople HRMS — Capacitor Mobile Hybrid Setup Guide

**Container**: Capacitor 8+  
**Native Targets**: Android (API 29–35), iOS (iOS 15–18)  
**Configuration File**: `capacitor.config.ts`  

---

## 1. Installed Core Plugins

- `@capacitor/core`: Core JavaScript-to-Native bridge.
- `@capacitor/geolocation`: High-accuracy device GPS tracking.
- `@capacitor/device`: Hardware identification for device binding.
- `@capacitor/local-notifications`: Local push alerts upon geofence crossing.
- `@capacitor/cli`: Command-line interface for native project scaffolding.

---

## 2. Project Build & Sync Instructions

### 1. Build the Web Application
```bash
bun run build
```
Generates production assets into `dist/client`.

### 2. Add Native Mobile Platforms
```bash
npx cap add android
npx cap add ios
```

### 3. Sync Web Assets to Native Containers
```bash
npx cap sync
```

### 4. Open and Run in Native IDEs
- **Android Studio**:
  ```bash
  npx cap open android
  ```
- **Xcode (macOS)**:
  ```bash
  npx cap open ios
  ```

---

## 3. Native Background Geofencing Architecture

- Android utilizes `GeofencingClient` registered in `mobile/android/AndroidManifest.xml` with `ACCESS_BACKGROUND_LOCATION` and `RECEIVE_BOOT_COMPLETED`.
- iOS utilizes `CLLocationManager` region monitoring configured in `mobile/ios/Info.plist` with `UIBackgroundModes` set to `location`.

