import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Geolocation } from "@capacitor/geolocation";

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

  const [idResult, infoResult] = await Promise.all([
    Device.getId(),
    Device.getInfo(),
  ]);

  return {
    uuid: idResult.identifier,
    model: infoResult.model,
    platform: infoResult.platform,
    osVersion: infoResult.osVersion,
  };
}

/**
 * Request native background location and notification permissions
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
    locationGranted = locStatus.location === "granted";
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
 * Trigger local notification when user crosses an office geofence threshold
 */
export async function notifyGeofenceTransition(
  transition: "ENTER" | "EXIT",
  officeName: string
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
            ? `You are inside ${officeName}. Check-in is now unlocked in FlowPeople.`
            : `You have left ${officeName}. Check-out is disabled outside office geofence.`,
          sound: "beep.wav",
          schedule: { at: new Date(Date.now() + 500) },
        },
      ],
    });
  } catch (err) {
    console.warn("Failed to schedule local notification:", err);
  }
}

