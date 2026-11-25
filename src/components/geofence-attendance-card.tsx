import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Navigation,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  FileQuestion,
  Building,
  Radio,
  Compass,
  Calendar,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGeofenceSync } from "@/hooks/use-geofence-sync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDistance,
  formatCoordinates,
  getAccuracyCategory,
  submitGeofenceAttendance,
} from "@/lib/geofence";
import { formatTime, formatHours } from "@/lib/attendance";

interface GeofenceAttendanceCardProps {
  employeeId: string;
  onAttendanceUpdated?: () => void;
}

export function GeofenceAttendanceCard({
  employeeId,
  onAttendanceUpdated,
}: GeofenceAttendanceCardProps) {
  const queryClient = useQueryClient();
  const [regularizeOpen, setRegularizeOpen] = useState(false);
  const [regularizeReason, setRegularizeReason] = useState("");
  const [submittingRegularize, setSubmittingRegularize] = useState(false);

  // Live Digital Clock state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    context,
    contextLoading,
    refetchContext,
    coords,
    locating,
    isOffline,
    realtimeStatus,
    evaluation,
    refreshLocation,
  } = useGeofenceSync({ employeeId });

  const assignedLocation = context?.location ?? null;
  const todayAttendance = context?.today_attendance ?? null;

  const isInside = evaluation.isInside;
  const isOutside = evaluation.isOutside;
  const isCheckedIn = Boolean(todayAttendance?.check_in);
  const isCheckedOut = Boolean(todayAttendance?.check_out);

  const hasLocationIssue =
    evaluation.status === "permission_denied" ||
    evaluation.status === "gps_disabled" ||
    evaluation.status === "poor_accuracy" ||
    evaluation.status === "stale_reading" ||
    evaluation.status === "mock_detected" ||
    evaluation.status === "unavailable";

  const accuracyInfo = useMemo(() => {
    if (!coords) return null;
    return getAccuracyCategory(coords.accuracy);
  }, [coords]);

  const elapsedLiveHours = useMemo(() => {
    if (!isCheckedIn || isCheckedOut || !todayAttendance?.check_in) return null;
    const checkInTime = new Date(todayAttendance.check_in).getTime();
    return Math.max(0, (currentTime.getTime() - checkInTime) / (1000 * 60 * 60));
  }, [isCheckedIn, isCheckedOut, todayAttendance?.check_in, currentTime]);

  const attendanceMutation = useMutation({
    mutationFn: async (action: "check_in" | "check_out") => {
      if (isOffline) {
        throw new Error("You appear to be offline. Reconnect to submit verified attendance.");
      }
      if (!coords) {
        throw new Error("GPS position not acquired. Please tap 'Retry Location'.");
      }
      return await submitGeofenceAttendance(action, coords);
    },
    onSuccess: (data) => {
      const isCheckIn = data.action === "check_in";
      toast.success(
        isCheckIn
          ? `Checked in at ${data.location_name}`
          : `Checked out successfully (${data.total_hours ?? 0} hrs)`,
      );
      void refetchContext();
      void queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      void queryClient.invalidateQueries({ queryKey: ["my-attendance-records"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-today-status"] });
      void queryClient.invalidateQueries({ queryKey: ["employee-today-attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["my-today-attendance-geofence"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-today-attendance"] });
      onAttendanceUpdated?.();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to record attendance");
    },
  });

  const handleRegularizeSubmit = async () => {
    if (!regularizeReason.trim()) {
      toast.error("Please provide a reason for the regularization request.");
      return;
    }
    if (!context?.employee?.organization_id) {
      toast.error("Organization context is missing.");
      return;
    }
    setSubmittingRegularize(true);
    try {
      const { error } = await supabase.from("attendance_exceptions").insert({
        organization_id: context.employee.organization_id,
        employee_id: employeeId,
        session_id: todayAttendance?.id ?? null,
        exception_type: isCheckedIn ? "OUTSIDE_GEOFENCE" : "MISSED_CHECKOUT",
        reason: regularizeReason.trim(),
        regularization_status: "pending",
      });
      if (error) throw error;
      toast.success("Attendance regularization request submitted for manager review.");
      setRegularizeOpen(false);
      setRegularizeReason("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmittingRegularize(false);
    }
  };

  if (contextLoading) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-sm font-medium">Syncing office geofence & GPS status...</span>
        </CardContent>
      </Card>
    );
  }

  const locationStatusTitle = locating && !coords ? "Detecting your location..." : evaluation.headline;

  const canTapCheckIn = !isCheckedIn && !isCheckedOut && evaluation.canCheckIn && !isOffline;
  const canTapCheckOut =
    isCheckedIn && !isCheckedOut && evaluation.canCheckOutWhenCheckedIn && !isOffline;

  return (
    <>
      <Card className="overflow-hidden border border-border/40 bg-card shadow-sm rounded-xl">
        <CardHeader className="bg-muted/20 pb-3.5 pt-4 px-4 sm:px-6 border-b border-border/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary shrink-0" />
                  <span>GPS Geofence Attendance</span>
                </CardTitle>

                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium gap-1 ${
                    isOffline || realtimeStatus === "offline"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : realtimeStatus === "connected"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isOffline || realtimeStatus === "offline"
                        ? "bg-rose-500"
                        : realtimeStatus === "connected"
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-amber-500 animate-pulse"
                    }`}
                  />
                  {isOffline
                    ? "Offline"
                    : realtimeStatus === "connected"
                      ? "Realtime Geofence Sync"
                      : realtimeStatus === "reconnecting"
                        ? "Reconnecting..."
                        : "Connecting Sync..."}
                </Badge>

                {assignedLocation && (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-medium border-primary/30 text-primary bg-primary/5"
                  >
                    <Building className="h-3 w-3 mr-1" />
                    {assignedLocation.name}
                  </Badge>
                )}

                {isCheckedOut ? (
                  <Badge className="bg-slate-700 text-white text-[10px]">SHIFT COMPLETED</Badge>
                ) : isCheckedIn ? (
                  <Badge className="bg-emerald-600 text-white text-[10px]">CHECKED IN</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">NOT CHECKED IN</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Automatic GPS check with server-side Edge Function verification. Manual tap required for Check In & Check Out.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border shadow-xs text-xs">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-mono font-bold text-foreground">
                  {currentTime.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshLocation(true)}
                disabled={locating}
                className="h-8 gap-1.5 text-xs bg-background hover:bg-muted"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${locating ? "animate-spin text-primary" : ""}`} />
                <span>{locating ? "Locating..." : "Retry Location"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {isOffline && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-800 dark:text-rose-200">
              <WifiOff className="h-4 w-4 shrink-0 text-rose-600" />
              <span>
                You are currently offline. Live geofence updates and attendance submission require an active connection.
              </span>
            </div>
          )}

          {/* Main Geofence Status Banner */}
          <div
            className={`rounded-xl p-4 border transition-all ${
              isInside
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                : isOutside
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100"
                  : hasLocationIssue
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100"
                    : "bg-muted/50 border-border text-muted-foreground"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`p-2.5 rounded-full shrink-0 shadow-xs ${
                    isInside
                      ? "bg-emerald-600 text-white"
                      : isOutside || hasLocationIssue
                        ? "bg-rose-600 text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isInside ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : isOutside ? (
                    <ShieldAlert className="h-5 w-5" />
                  ) : hasLocationIssue ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <Radio className="h-5 w-5 animate-pulse" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{locationStatusTitle}</span>
                    <Badge
                      className={`text-[10px] font-bold ${
                        isInside
                          ? "bg-emerald-600 text-white"
                          : isOutside
                            ? "bg-rose-600 text-white"
                            : hasLocationIssue
                              ? "bg-rose-600 text-white"
                              : "bg-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      {isInside
                        ? "INSIDE"
                        : isOutside
                          ? "OUTSIDE"
                          : evaluation.status.toUpperCase().replace(/_/g, " ")}
                    </Badge>

                    {accuracyInfo && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          accuracyInfo.level === "good"
                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                            : accuracyInfo.level === "warning"
                              ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                              : "border-rose-500/40 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        ±{Math.round(coords?.accuracy ?? 0)}m ({accuracyInfo.label})
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs opacity-90 leading-relaxed">{evaluation.reason}</p>
                </div>
              </div>

              {hasLocationIssue && (
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshLocation(true)}
                    disabled={locating}
                    className="h-8 text-xs bg-background hover:bg-muted"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${locating ? "animate-spin" : ""}`} />
                    Retry Location
                  </Button>
                </div>
              )}
            </div>

            {isOutside && !isCheckedIn && (
              <div className="mt-3 pt-3 border-t border-rose-500/20 text-xs flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-rose-900 dark:text-rose-100">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                  Move within {assignedLocation?.radius_meters ?? 150}m of {assignedLocation?.name ?? "office"} to enable Check In.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setRegularizeOpen(true)}
                  className="h-auto p-0 text-xs font-semibold text-rose-950 dark:text-rose-50 underline"
                >
                  Request Exception →
                </Button>
              </div>
            )}
          </div>

          {/* GPS Telemetry Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-primary" />
                  Device GPS
                </span>
                {coords && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(coords.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono font-bold text-foreground">
                {coords ? formatCoordinates(coords.latitude, coords.longitude) : "No verified fix"}
              </p>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                <span>Precision:</span>
                <span className="font-mono font-medium text-foreground">
                  {coords ? `±${Math.round(coords.accuracy)}m (${coords.source ?? "gps"})` : "--"}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Office Geofence
                </span>
                {assignedLocation && (
                  <Badge variant="outline" className="text-[10px] py-0 font-mono">
                    {assignedLocation.radius_meters}m radius
                  </Badge>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground truncate">
                {assignedLocation ? assignedLocation.name : "Not configured"}
              </p>
              <div className="text-[11px] text-muted-foreground font-mono truncate pt-1 border-t border-border/50">
                {assignedLocation
                  ? formatCoordinates(assignedLocation.latitude, assignedLocation.longitude)
                  : "Awaiting HR configuration"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Distance to Center
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    isInside ? "text-emerald-600" : isOutside ? "text-rose-600" : "text-muted-foreground"
                  }`}
                >
                  {isInside ? "INSIDE" : isOutside ? "OUTSIDE" : "--"}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-foreground">
                  {evaluation.distanceMeters !== null
                    ? formatDistance(evaluation.distanceMeters)
                    : "--"}
                </span>
                {assignedLocation && (
                  <span className="text-[11px] text-muted-foreground">
                    (Limit: {assignedLocation.radius_meters}m
                    {evaluation.hysteresisMeters > 0 ? `, +${evaluation.hysteresisMeters}m buffer` : ""})
                  </span>
                )}
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${isInside ? "bg-emerald-500" : "bg-rose-500"}`}
                  style={{
                    width: `${
                      evaluation.distanceMeters !== null && assignedLocation
                        ? Math.min(
                            100,
                            Math.max(
                              5,
                              (assignedLocation.radius_meters /
                                Math.max(evaluation.distanceMeters, 1)) *
                                100,
                            ),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Today's Ledger & Manual Attendance Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-1">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Today&apos;s Attendance Ledger
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {currentTime.toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">First Check-in</span>
                  <p className="text-base font-mono font-bold text-foreground">
                    {isCheckedIn ? formatTime(todayAttendance!.check_in!) : "--:--"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Last Check-out</span>
                  <p className="text-base font-mono font-bold text-foreground">
                    {isCheckedOut
                      ? formatTime(todayAttendance!.check_out!)
                      : isCheckedIn
                        ? "Active Shift"
                        : "--:--"}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
                <span>Working Duration:</span>
                <strong className="font-mono text-foreground font-semibold">
                  {isCheckedOut
                    ? formatHours(todayAttendance?.total_hours ?? 0)
                    : elapsedLiveHours !== null
                      ? `${formatHours(elapsedLiveHours)} (Live)`
                      : "0 hrs"}
                </strong>
              </div>
            </div>

            {/* Manual Check In (inside) & Check Out (upon leaving office geofence) */}
            <div className="flex flex-col gap-2.5">
              {isCheckedOut ? (
                <div className="flex items-center justify-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-sm font-semibold gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Work day completed! All logs recorded.
                </div>
              ) : !isCheckedIn ? (
                <>
                  <Button
                    size="lg"
                    disabled={!canTapCheckIn || attendanceMutation.isPending}
                    onClick={() => attendanceMutation.mutate("check_in")}
                    className={`w-full h-14 text-sm sm:text-base font-bold shadow-md transition-all gap-2 rounded-xl ${
                      canTapCheckIn
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-98"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    {attendanceMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    <span>Check In</span>
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    {canTapCheckIn
                      ? "Tap Check In manually to verify your GPS position and clock in."
                      : evaluation.reason}
                  </p>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    disabled={!canTapCheckOut || attendanceMutation.isPending}
                    onClick={() => attendanceMutation.mutate("check_out")}
                    className={`w-full h-14 text-sm sm:text-base font-bold shadow-md transition-all gap-2 rounded-xl ${
                      canTapCheckOut
                        ? "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-98"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    {attendanceMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                    <span>Check Out</span>
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    {canTapCheckOut
                      ? "You left the office perimeter. Tap Check Out manually to end your shift."
                      : isInside
                        ? "Check Out becomes available when you leave the office area."
                        : evaluation.reason}
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Regularization / Exception Modal */}
      <Dialog open={regularizeOpen} onOpenChange={setRegularizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-primary" />
              <span>Attendance Regularization Request</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              If you worked off-site or experienced GPS hardware issues, submit a reason for HR/Manager review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Exception</Label>
              <Textarea
                placeholder="e.g. Client site visit, GPS malfunction, or off-site duty..."
                value={regularizeReason}
                onChange={(e) => setRegularizeReason(e.target.value)}
                rows={4}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRegularizeOpen(false)}
              disabled={submittingRegularize}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRegularizeSubmit}
              disabled={submittingRegularize || !regularizeReason.trim()}
              className="gap-1.5"
            >
              {submittingRegularize && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
