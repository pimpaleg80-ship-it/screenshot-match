import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";
import { App } from "@capacitor/app";

export interface MobileDeviceInfo {
  uuid: string;
  model: string;
  platform: string;
  osVersion: string;
}

/**
 * Check if the application is running in a native mobile environment (iOS or Android)
 */
export function isNativeMobile(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

/**
 * Retrieve unique hardware device information for device-binding security
 */
export async function getMobileDeviceInfo(): Promise<MobileDeviceInfo> {
  if (!isNativeMobile()) {
    return {
      uuid: "browser-client",
      model: "Web Browser",
      platform: "web",
      osVersion: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    };
  }

  const [idResult, infoResult] = await Promise.all([Device.getId(), Device.getInfo()]);

  return {
    uuid: idResult.identifier,
    model: infoResult.model,
    platform: infoResult.platform,
    osVersion: infoResult.osVersion,
  };
}

/**
 * Inspect current native/browser location permission status without mutating prompt state.
 */
export async function checkMobileLocationPermission(): Promise<
  "granted" | "denied" | "prompt" | "unknown"
> {
  if (isNativeMobile()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === "granted" || status.coarseLocation === "granted") {
        return "granted";
      }
      if (status.location === "denied" && status.coarseLocation === "denied") {
        return "denied";
      }
      return "prompt";
    } catch {
      return "unknown";
    }
  }

  if (typeof navigator !== "undefined" && navigator.permissions?.query) {
    try {
      const perm = await navigator.permissions.query({ name: "geolocation" });
      if (perm.state === "granted" || perm.state === "denied" || perm.state === "prompt") {
        return perm.state;
      }
    } catch {
      return "unknown";
    }
  }

  return "unknown";
}

/**
 * Request native location and local notification permissions (used for geofence entry/exit prompts).
 */
export async function requestMobilePermissions(): Promise<{
  locationGranted: boolean;
  notificationsGranted: boolean;
}> {
  if (!isNativeMobile()) {
    return { locationGranted: true, notificationsGranted: true };
  }

  let locationGranted = false;
  let notificationsGranted = false;

  try {
    const locStatus = await Geolocation.requestPermissions();
    locationGranted = locStatus.location === "granted" || locStatus.coarseLocation === "granted";
  } catch {
    locationGranted = false;
  }

  try {
    const notifStatus = await LocalNotifications.requestPermissions();
    notificationsGranted = notifStatus.display === "granted";
  } catch {
    notificationsGranted = false;
  }

  return { locationGranted, notificationsGranted };
}

/**
 * Register a lifecycle handler invoked when the native mobile app or browser tab returns to the foreground.
 * Triggers immediate geofence config & GPS refresh.
 */
export function registerAppResumeListener(onResume: () => void): () => void {
  const cleanups: Array<() => void> = [];

  if (typeof document !== "undefined") {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        onResume();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    cleanups.push(() => document.removeEventListener("visibilitychange", handleVisibility));
  }

  if (typeof window !== "undefined") {
    const handleOnline = () => onResume();
    window.addEventListener("online", handleOnline);
    cleanups.push(() => window.removeEventListener("online", handleOnline));
  }

  if (isNativeMobile()) {
    let removed = false;
    const handlePromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && !removed) {
        onResume();
      }
    });

    cleanups.push(() => {
      removed = true;
      void handlePromise.then((h) => h.remove()).catch(() => undefined);
    });
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}

/**
 * Trigger an informational local notification when user crosses an office geofence threshold.
 * Never triggers automatic Check In or Check Out.
 */
export async function notifyGeofenceTransition(
  transition: "ENTER" | "EXIT",
  officeName: string,
): Promise<void> {
  if (!isNativeMobile()) return;

  const isEnter = transition === "ENTER";
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Math.random() * 100000),
          title: isEnter ? "Arrived at Office" : "Left Office Geofence",
          body: isEnter
            ? `You are inside ${officeName}. Open FlowPeople to manually tap Check In.`
            : `You have left ${officeName}. Open FlowPeople to manually tap Check Out.`,
          sound: "beep.wav",
          schedule: { at: new Date(Date.now() + 500) },
        },
      ],
    });
  } catch (err) {
    console.warn("Failed to schedule local notification:", err);
  }
}
