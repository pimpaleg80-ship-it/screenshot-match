import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type Coordinates,
  type GeofenceContext,
  type GeofenceEvaluationResult,
  GeolocationAcquisitionError,
  evaluateGeofenceState,
  fetchEmployeeGeofenceContext,
  getCurrentDevicePosition,
} from "@/lib/geofence";
import {
  checkMobileLocationPermission,
  isNativeMobile,
  notifyGeofenceTransition,
  registerAppResumeListener,
} from "@/lib/mobile-geofence";

export type RealtimeSyncStatus = "connecting" | "connected" | "reconnecting" | "offline";

const orgBroadcastSubscribers = new Map<
  string,
  {
    callbacks: Set<() => void>;
    channel: ReturnType<typeof supabase.channel>;
  }
>();

function subscribeOrgGeofenceBroadcast(orgId: string, onChange: () => void): () => void {
  let entry = orgBroadcastSubscribers.get(orgId);
  if (!entry) {
    const callbacks = new Set<() => void>();
    const channel = supabase
      .channel(`org:${orgId}:geofence`)
      .on("broadcast", { event: "geofence_changed" }, () => {
        for (const cb of callbacks) cb();
      })
      .subscribe();
    entry = { callbacks, channel };
    orgBroadcastSubscribers.set(orgId, entry);
  }
  entry.callbacks.add(onChange);

  return () => {
    const current = orgBroadcastSubscribers.get(orgId);
    if (!current) return;
    current.callbacks.delete(onChange);
    if (current.callbacks.size === 0) {
      orgBroadcastSubscribers.delete(orgId);
      void supabase.removeChannel(current.channel);
    }
  };
}

export interface UseGeofenceSyncOptions {
  employeeId?: string | undefined;
  enabled?: boolean | undefined;
  nowMs?: number | undefined;
}

export interface UseGeofenceSyncResult {
  context: GeofenceContext | undefined;
  contextLoading: boolean;
  contextError: Error | null;
  refetchContext: () => Promise<unknown>;
  coords: Coordinates | null;
  locating: boolean;
  locationError: string | null;
  permissionDenied: boolean;
  gpsDisabled: boolean;
  permissionState: "granted" | "denied" | "prompt" | "unknown";
  isOffline: boolean;
  realtimeStatus: RealtimeSyncStatus;
  evaluation: GeofenceEvaluationResult;
  refreshLocation: (showLoading?: boolean) => Promise<void>;
}

export function useGeofenceSync({
  employeeId,
  enabled = true,
  nowMs,
}: UseGeofenceSyncOptions): UseGeofenceSyncResult {
  const queryClient = useQueryClient();
  const instanceIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [gpsDisabled, setGpsDisabled] = useState(false);
  const [permissionState, setPermissionState] = useState<
    "granted" | "denied" | "prompt" | "unknown"
  >("unknown");
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeSyncStatus>("connecting");

  const previouslyInsideRef = useRef(false);
  const prevTransitionRef = useRef<"inside" | "outside" | null>(null);

  const {
    data: context,
    isLoading: contextLoading,
    error: queryError,
    refetch: refetchContext,
  } = useQuery({
    queryKey: ["employee-geofence-context", employeeId],
    queryFn: fetchEmployeeGeofenceContext,
    enabled: enabled && Boolean(employeeId),
    staleTime: 1000 * 10,
    refetchOnWindowFocus: true,
    refetchInterval: realtimeStatus === "connected" ? false : 30_000,
  });

  const syncLocation = useCallback(async (showLoading = false) => {
    if (showLoading) setLocating(true);
    setLocationError(null);
    setPermissionDenied(false);
    setGpsDisabled(false);

    try {
      const perm = await checkMobileLocationPermission();
      setPermissionState(perm);
      if (perm === "denied") {
        setPermissionDenied(true);
        setCoords(null);
        setLocationError("Location permission denied. Enable location access to continue.");
        return;
      }

      const position = await getCurrentDevicePosition();
      setCoords(position);
      setPermissionDenied(false);
      setGpsDisabled(false);
      setPermissionState("granted");
    } catch (err: unknown) {
      setCoords(null);
      if (err instanceof GeolocationAcquisitionError) {
        if (err.code === "PERMISSION_DENIED") {
          setPermissionDenied(true);
          setPermissionState("denied");
        } else if (err.code === "GPS_DISABLED" || err.code === "UNSUPPORTED") {
          setGpsDisabled(true);
        }
        setLocationError(err.message);
      } else {
        setLocationError(
          err instanceof Error ? err.message : "Unable to detect your location.",
        );
      }
    } finally {
      if (showLoading) setLocating(false);
    }
  }, []);

  const refreshLocation = useCallback(
    async (showLoading = true) => {
      await Promise.all([refetchContext(), syncLocation(showLoading)]);
    },
    [refetchContext, syncLocation],
  );

  // Track browser online / offline status for graceful error gating
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      setIsOffline(false);
      void refetchContext();
    };
    const handleOffline = () => {
      setIsOffline(true);
      setRealtimeStatus("offline");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refetchContext]);

  // Initial GPS acquisition + continuous local watch + native Capacitor foreground resume listener
  useEffect(() => {
    if (!enabled) return;

    void syncLocation(true);

    let browserWatchId: number | null = null;
    let nativeWatchId: string | null = null;
    let cancelled = false;

    const startWatch = async () => {
      if (isNativeMobile()) {
        try {
          const { Geolocation } = await import("@capacitor/geolocation");
          nativeWatchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
            (pos, watchErr) => {
              if (cancelled) return;
              if (watchErr) {
                if (/denied|permission/i.test(watchErr.message ?? "")) {
                  setPermissionDenied(true);
                  setPermissionState("denied");
                }
                return;
              }
              if (pos) {
                setLocationError(null);
                setPermissionDenied(false);
                setGpsDisabled(false);
                const rawPos = pos as unknown as {
                  mock?: boolean;
                  isMock?: boolean;
                  coords: { mock?: boolean; isMock?: boolean };
                };
                setCoords({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  timestamp: pos.timestamp || Date.now(),
                  isMock:
                    rawPos.mock === true ||
                    rawPos.isMock === true ||
                    rawPos.coords?.mock === true ||
                    rawPos.coords?.isMock === true,
                  source: "native_gps",
                });
              }
            },
          );
          return;
        } catch {
          // Fall back to browser geolocation watcher if available
        }
      }

      if (typeof navigator !== "undefined" && navigator.geolocation?.watchPosition) {
        browserWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (cancelled) return;
            setLocationError(null);
            setPermissionDenied(false);
            setGpsDisabled(false);
            setPermissionState("granted");
            setCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp || Date.now(),
              isMock: false,
              source: "browser_gps",
            });
          },
          (err) => {
            if (cancelled) return;
            if (err.code === 1) {
              setPermissionDenied(true);
              setPermissionState("denied");
              setCoords(null);
              setLocationError("Location permission denied.");
            } else if (err.code === 2) {
              setGpsDisabled(true);
              setLocationError("Location signal unavailable.");
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 15000,
          },
        );
      }
    };

    void startWatch();

    const cleanupResume = registerAppResumeListener(() => {
      void refetchContext();
      void syncLocation(false);
    });

    return () => {
      cancelled = true;
      cleanupResume();
      if (
        browserWatchId !== null &&
        typeof navigator !== "undefined" &&
        navigator.geolocation?.clearWatch
      ) {
        navigator.geolocation.clearWatch(browserWatchId);
      }
      if (nativeWatchId !== null && isNativeMobile()) {
        void import("@capacitor/geolocation").then(({ Geolocation }) =>
          Geolocation.clearWatch({ id: nativeWatchId as string }),
        );
      }
    };
  }, [enabled, refetchContext, syncLocation]);

  // Supabase Realtime organization-scoped subscription for work_locations & own attendance
  const orgId = context?.employee?.organization_id;

  useEffect(() => {
    if (!enabled || !orgId || !employeeId) return;

    setRealtimeStatus(isOffline ? "offline" : "connecting");

    const invalidateGeofence = () => {
      void refetchContext();
      void queryClient.invalidateQueries({ queryKey: ["work-locations-geofence", orgId] });
    };

    const dbChannel = supabase
      .channel(`geofence-db:${orgId}:${instanceIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_locations",
          filter: `organization_id=eq.${orgId}`,
        },
        invalidateGeofence,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `employee_id=eq.${employeeId}`,
        },
        () => {
          void refetchContext();
          void queryClient.invalidateQueries({ queryKey: ["my-today-attendance-geofence"] });
          void queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          void refetchContext();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus(isOffline ? "offline" : "reconnecting");
        } else if (status === "CLOSED") {
          setRealtimeStatus("reconnecting");
        }
      });

    // Reference-counted shared broadcast listener ensures deactivations/deletions sync without multi-mount conflicts
    const unsubscribeBroadcast = subscribeOrgGeofenceBroadcast(orgId, invalidateGeofence);

    return () => {
      void supabase.removeChannel(dbChannel);
      unsubscribeBroadcast();
    };
  }, [enabled, orgId, employeeId, isOffline, queryClient, refetchContext]);

  // Evaluate geofence compliance with hysteresis
  const evaluation = useMemo(() => {
    return evaluateGeofenceState({
      location: context?.location ?? null,
      coords,
      permissionDenied,
      gpsDisabled,
      previouslyInside: previouslyInsideRef.current,
      ...(nowMs !== undefined ? { nowMs } : {}),
    });
  }, [context?.location, coords, permissionDenied, gpsDisabled, nowMs]);

  useEffect(() => {
    if (evaluation.status === "inside") {
      previouslyInsideRef.current = true;
      if (prevTransitionRef.current === "outside" && context?.location?.name) {
        void notifyGeofenceTransition("ENTER", context.location.name);
      }
      prevTransitionRef.current = "inside";
    } else if (evaluation.status === "outside") {
      previouslyInsideRef.current = false;
      if (prevTransitionRef.current === "inside" && context?.location?.name) {
        void notifyGeofenceTransition("EXIT", context.location.name);
      }
      prevTransitionRef.current = "outside";
    } else if (evaluation.status === "inactive" || evaluation.status === "unconfigured") {
      previouslyInsideRef.current = false;
      prevTransitionRef.current = null;
    }
  }, [evaluation.status, context?.location?.name]);

  return {
    context,
    contextLoading,
    contextError: queryError instanceof Error ? queryError : null,
    refetchContext,
    coords,
    locating,
    locationError,
    permissionDenied,
    gpsDisabled,
    permissionState,
    isOffline,
    realtimeStatus,
    evaluation,
    refreshLocation,
  };
}
