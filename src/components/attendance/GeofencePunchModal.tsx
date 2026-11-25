import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  LogIn,
  LogOut,
  Building2,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { useGeofenceSync } from "@/hooks/use-geofence-sync";
import { formatTime, formatHours, totalHours, formatDistance } from "@/lib/attendance";
import { submitGeofenceAttendance } from "@/lib/geofence";
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

export function GeofencePunchModal({
  open,
  onOpenChange,
  onSuccess,
}: GeofencePunchModalProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const {
    context,
    contextLoading,
    refetchContext,
    coords,
    locating,
    isOffline,
    evaluation,
    refreshLocation,
  } = useGeofenceSync({
    employeeId: session.employeeId ?? undefined,
    enabled: open && Boolean(session.employeeId),
  });

  const activeLocation = context?.location ?? null;
  const todayRecord = context?.today_attendance ?? null;

  const isCheckedIn = Boolean(todayRecord?.check_in);
  const isCheckedOut = Boolean(todayRecord?.check_out);

  const canCheckIn = !isCheckedIn && !isCheckedOut && evaluation.canCheckIn && !isOffline;
  const canCheckOut =
    isCheckedIn && !isCheckedOut && evaluation.canCheckOutWhenCheckedIn && !isOffline;

  const punchMutation = useMutation({
    mutationFn: async (action: "check_in" | "check_out") => {
      if (isOffline) {
        throw new Error("Offline: cannot submit attendance verification.");
      }
      if (!coords) {
        throw new Error("No verified GPS coordinates detected.");
      }
      return await submitGeofenceAttendance(action, coords);
    },
    onSuccess: (res) => {
      void refetchContext();
      void queryClient.invalidateQueries({ queryKey: ["my-today-attendance-geofence"] });
      void queryClient.invalidateQueries({ queryKey: ["my-attendance-records"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-today-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-today-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-geofence-context"] });

      if (res.action === "check_in") {
        toast.success(`Checked in at ${res.location_name}`, {
          description: `Distance: ${res.distance_meters}m from office center`,
        });
      } else {
        toast.success(`Checked out (${res.total_hours ?? 0} hrs logged)`, {
          description: `Verified via ${res.location_name}`,
        });
      }

      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to verify attendance");
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
                Edge-verified GPS check-in and check-out.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border/30 bg-muted/20 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Authorized Work Location
              </span>
              {activeLocation && (
                <Badge variant="outline" className="text-[10px] border-border/40">
                  Radius: {activeLocation.radius_meters}m
                </Badge>
              )}
            </div>

            {contextLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Syncing office geofence...
              </div>
            ) : activeLocation ? (
              <div>
                <p className="text-sm font-semibold text-foreground">{activeLocation.name}</p>
                {activeLocation.address && (
                  <p className="text-xs text-muted-foreground truncate">{activeLocation.address}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No active office geofence configured by HR.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border/30 bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Compass className="h-3.5 w-3.5 text-primary" />
                Live GPS Position
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void refreshLocation(true)}
                disabled={locating}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${locating ? "animate-spin" : ""}`} />
                {locating ? "Locating..." : "Retry Location"}
              </Button>
            </div>

            {coords && (
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
                    ±{Math.round(coords.accuracy)} meters
                  </span>
                </div>
                {evaluation.distanceMeters !== null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Distance to Office:</span>
                    <span className="font-semibold text-foreground">
                      {formatDistance(evaluation.distanceMeters)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div
              className={`flex items-start gap-2 p-2.5 rounded-lg text-xs font-medium border ${
                evaluation.isInside
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
              }`}
            >
              {evaluation.isInside ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-semibold">{evaluation.headline}</p>
                <p className="text-[11px] opacity-90">{evaluation.reason}</p>
              </div>
            </div>
          </div>

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
            Close
          </Button>

          {!isCheckedOut && (
            <Button
              onClick={() => punchMutation.mutate(isCheckedIn ? "check_out" : "check_in")}
              disabled={
                locating ||
                !coords ||
                punchMutation.isPending ||
                (isCheckedIn ? !canCheckOut : !canCheckIn)
              }
              className={`w-full sm:w-auto text-xs h-9 gap-1.5 font-semibold text-white ${
                isCheckedIn
                  ? canCheckOut
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-muted text-muted-foreground"
                  : canCheckIn
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {punchMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isCheckedIn ? (
                <LogOut className="h-3.5 w-3.5" />
              ) : (
                <LogIn className="h-3.5 w-3.5" />
              )}
              {isCheckedIn ? "Check Out" : "Check In"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
