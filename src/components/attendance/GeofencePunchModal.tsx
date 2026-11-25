import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Loader2,
  LogIn,
  LogOut,
  Building2,
  Radio,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  formatTime,
  formatHours,
  totalHours,
  formatDistance,
  verifyGeofenceLocation,
  GeofenceZoneItem,
  toDateKey,
} from "@/lib/attendance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GeofencePunchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface UserCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export function GeofencePunchModal({
  open,
  onOpenChange,
  onSuccess,
}: GeofencePunchModalProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // 1. Fetch active work locations (geofence zones) for organization
  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ["work-locations-geofence", session.organizationId],
    queryFn: async () => {
      let q = supabase
        .from("work_locations")
        .select("id, name, address, latitude, longitude, radius_meters, is_active")
        .eq("is_active", true);

      if (session.organizationId) {
        q = q.eq("organization_id", session.organizationId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as GeofenceZoneItem[];
    },
    enabled: open,
  });

  // 2. Fetch employee's today record to know if checked in or out
  const { data: todayRecord, isLoading: recordLoading } = useQuery({
    queryKey: ["my-today-attendance-geofence", session.employeeId, todayKey],
    queryFn: async () => {
      if (!session.employeeId) return null;
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", session.employeeId)
        .eq("date", todayKey)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: open && !!session.employeeId,
  });

  // 3. Request Browser Geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: pos.timestamp,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError("Location permission denied. Please allow location access in your browser settings to verify geofence attendance.");
            break;
          case err.POSITION_UNAVAILABLE:
            setGeoError("Position unavailable. Please ensure GPS / location services are turned on.");
            break;
          case err.TIMEOUT:
            setGeoError("GPS request timed out. Please try refreshing location.");
            break;
          default:
            setGeoError(err.message || "Failed to obtain GPS coordinates.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      }
    );
  }, []);

  // Trigger location check on modal open
  useEffect(() => {
    if (open) {
      requestLocation();
    } else {
      setCoords(null);
      setGeoError(null);
    }
  }, [open, requestLocation]);

  // 4. Verify geofence compliance
  const verification = coords
    ? verifyGeofenceLocation(coords.latitude, coords.longitude, zones)
    : { isInside: false, distanceMeters: 0 };

  const isCheckedIn = !!todayRecord?.check_in;
  const isCheckedOut = !!todayRecord?.check_out;

  // 5. Punch Mutation via RPC
  const punchMutation = useMutation({
    mutationFn: async () => {
      if (!coords) throw new Error("No GPS coordinates detected");

      const { data, error } = await supabase.rpc("record_geofence_punch", {
        p_latitude: coords.latitude,
        p_longitude: coords.longitude,
        p_accuracy: coords.accuracy,
        p_work_location_id: verification.nearestZone?.id || null,
      });

      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        throw new Error(res?.error || "Failed to record geofence attendance");
      }
      return res;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["my-today-attendance-geofence"] });
      queryClient.invalidateQueries({ queryKey: ["my-attendance-records"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      queryClient.invalidateQueries({ queryKey: ["employee-today-attendance"] });
      queryClient.invalidateQueries({ queryKey: ["admin-today-attendance"] });

      if (res.action === "check_in") {
        toast.success(`Clock-in recorded at ${res.time}!`, {
          description: `Location: ${res.location_name} (${res.distance_meters}m from office center)`,
        });
      } else {
        toast.success(`Clock-out recorded at ${res.time}!`, {
          description: `Total logged: ${res.total_hours} hrs`,
        });
      }

      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to punch attendance");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/40 bg-card rounded-2xl shadow-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight">
                Geofence Attendance
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                GPS-verified workplace check-in and check-out.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Office Zone Card */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Authorized Work Location
              </span>
              {verification.nearestZone && (
                <Badge variant="outline" className="text-[10px] border-border/40">
                  Radius: {verification.nearestZone.radius_meters}m
                </Badge>
              )}
            </div>

            {zonesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching office geofence data...
              </div>
            ) : verification.nearestZone ? (
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {verification.nearestZone.name}
                </p>
                {verification.nearestZone.address && (
                  <p className="text-xs text-muted-foreground truncate">
                    {verification.nearestZone.address}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No active geofence location specified. Defaulting to open workplace.
              </p>
            )}
          </div>

          {/* Live GPS Status Card */}
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Compass className="h-3.5 w-3.5 text-primary" />
                Live GPS Position
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={requestLocation}
                disabled={locating}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${locating ? "animate-spin" : ""}`} />
                {locating ? "Locating..." : "Refresh"}
              </Button>
            </div>

            {locating ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-2 text-center">
                <Radio className="h-6 w-6 text-primary animate-pulse" />
                <p className="text-xs font-medium text-foreground">Acquiring high-accuracy GPS coordinates...</p>
                <p className="text-[11px] text-muted-foreground">Please ensure location permissions are enabled.</p>
              </div>
            ) : geoError ? (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Location Access Failed</p>
                  <p className="text-[11px] leading-relaxed text-destructive/90">{geoError}</p>
                </div>
              </div>
            ) : coords ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Coordinates:</span>
                  <span className="font-mono text-foreground font-medium text-[11px]">
                    {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">GPS Accuracy:</span>
                  <span className="text-foreground font-medium text-[11px]">
                    ±{coords.accuracy} meters
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Distance to Office:</span>
                  <span className="font-semibold text-foreground">
                    {formatDistance(verification.distanceMeters)}
                  </span>
                </div>

                {/* Geofence Status Badge Banner */}
                <div
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-medium border ${
                    verification.isInside
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                  }`}
                >
                  {verification.isInside ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>Inside Office Geofence — Check-in Authorized</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>
                        Outside Geofence ({formatDistance(verification.distanceMeters)} away). Must be within{" "}
                        {verification.nearestZone?.radius_meters || 100}m.
                      </span>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Today's Punch Summary */}
          {todayRecord && (
            <div className="rounded-xl border border-border/25 bg-muted/10 p-3 text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Check-In Today:</span>
                <span className="font-mono font-medium text-foreground">
                  {todayRecord.check_in ? formatTime(todayRecord.check_in) : "None"}
                </span>
              </div>
              {todayRecord.check_out && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Check-Out Today:</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatTime(todayRecord.check_out)}
                  </span>
                </div>
              )}
              {todayRecord.check_in && !todayRecord.check_out && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Logged So Far:</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatHours(totalHours(todayRecord.check_in, new Date().toISOString()))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs h-9"
          >
            Cancel
          </Button>

          <Button
            onClick={() => punchMutation.mutate()}
            disabled={
              locating ||
              !coords ||
              !verification.isInside ||
              punchMutation.isPending ||
              (isCheckedIn && isCheckedOut)
            }
            className={`w-full sm:w-auto text-xs h-9 gap-1.5 font-semibold text-white ${
              isCheckedIn
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {punchMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isCheckedIn ? (
              <LogOut className="h-3.5 w-3.5" />
            ) : (
              <LogIn className="h-3.5 w-3.5" />
            )}
            {isCheckedIn ? "Clock Out with GPS" : "Clock In with GPS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
