import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  fetchEmployeeGeofenceContext,
  getCurrentDevicePosition,
  calculateHaversineDistance,
  formatDistance,
  formatCoordinates,
  getAccuracyCategory,
  submitGeofenceAttendance,
  type Coordinates,
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
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [regularizeOpen, setRegularizeOpen] = useState<boolean>(false);
  const [regularizeReason, setRegularizeReason] = useState<string>("");
  const [submittingRegularize, setSubmittingRegularize] = useState<boolean>(false);

  // Live Digital Clock state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch geofence context (assigned location, shift, today's attendance)
  const {
    data: context,
    isLoading: contextLoading,
    refetch: refetchContext,
  } = useQuery({
    queryKey: ["employee-geofence-context", employeeId],
    queryFn: fetchEmployeeGeofenceContext,
    staleTime: 1000 * 30, // 30 seconds
  });

  // Acquire GPS Coordinates
  const refreshLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const position = await getCurrentDevicePosition();
      setCoords(position);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to retrieve GPS coordinates";
      setLocationError(msg);
      toast.error(msg);
    } finally {
      setLocating(false);
    }
  }, []);

  // Auto-acquire location on mount
  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  // Assigned office & today's attendance
  const assignedLocation = context?.location;
  const todayAttendance = context?.today_attendance;

  // Real-time server-aligned Haversine distance calculation
  const distanceMeters = useMemo(() => {
    if (!coords || !assignedLocation) return null;
    return calculateHaversineDistance(
      coords.latitude,
      coords.longitude,
      assignedLocation.latitude,
      assignedLocation.longitude,
    );
  }, [coords, assignedLocation]);

  // Geofence perimeter check
  const isInside = useMemo(() => {
    if (distanceMeters === null || !assignedLocation) return false;
    return distanceMeters <= assignedLocation.radius_meters;
  }, [distanceMeters, assignedLocation]);

  const isCheckedIn = !!todayAttendance?.check_in;
  const isCheckedOut = !!todayAttendance?.check_out;

  // Accuracy evaluation
  const accuracyInfo = useMemo(() => {
    if (!coords) return null;
    return getAccuracyCategory(coords.accuracy);
  }, [coords]);

  const isPermissionDenied = Boolean(
    locationError && locationError.toLowerCase().includes("permission"),
  );
  const isGpsUnavailable = Boolean(
    locationError &&
      (locationError.toLowerCase().includes("unavailable") ||
        locationError.toLowerCase().includes("timed out") ||
        locationError.toLowerCase().includes("not supported")),
  );

  // Compute live elapsed time if checked in
  const elapsedLiveHours = useMemo(() => {
    if (!isCheckedIn || isCheckedOut || !todayAttendance?.check_in) return null;
    const checkInTime = new Date(todayAttendance.check_in).getTime();
    const now = currentTime.getTime();
    const diffHours = Math.max(0, (now - checkInTime) / (1000 * 60 * 60));
    return diffHours;
  }, [isCheckedIn, isCheckedOut, todayAttendance?.check_in, currentTime]);

  // Attendance Check-in / Check-out Mutations
  const attendanceMutation = useMutation({
    mutationFn: async (action: "check_in" | "check_out") => {
      if (!coords) {
        throw new Error("GPS position not acquired. Please tap 'Detect Location'.");
      }
      return await submitGeofenceAttendance(action, coords);
    },
    onSuccess: (data) => {
      const isCheckIn = data.action === "check_in";
      toast.success(
        isCheckIn
          ? `Checked In Successfully! Welcome to ${data.location_name}.`
          : `Checked Out Successfully! Total hours: ${data.total_hours ?? 0}h.`,
      );
      refetchContext();
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      queryClient.invalidateQueries({ queryKey: ["employee-today-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-today-attendance"] });
      onAttendanceUpdated?.();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to record attendance");
    },
  });

  // Submit regularization request for missed check-out or outside-geofence exception
  const handleRegularizeSubmit = async () => {
    if (!regularizeReason.trim()) {
      toast.error("Please provide a reason for the regularization request.");
      return;
    }
    setSubmittingRegularize(true);
    try {
      const { error } = await supabase.from("attendance_exceptions").insert({
        organization_id:
          context?.employee?.organization_id || "00000000-0000-0000-0000-000000000001",
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
          <span className="text-sm font-medium">Acquiring GPS telemetry & attendance state...</span>
        </CardContent>
      </Card>
    );
  }

  // Location status headline text
  const locationStatusTitle = isPermissionDenied
    ? "Location permission required"
    : isGpsUnavailable
      ? "Unable to detect location"
      : locating
        ? "Getting your location..."
        : accuracyInfo?.level === "rejected"
          ? "Location accuracy is too low"
          : isInside
            ? "You are inside your office zone"
            : coords
              ? "You are outside your office zone"
              : "Getting your location...";

  return (
    <>
      <Card className="overflow-hidden border border-border shadow-sm">
        {/* Header with Live Clock & Assigned Office */}
        <CardHeader className="bg-muted/30 pb-3.5 pt-4 px-4 sm:px-6 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-primary shrink-0" />
                  <span>GPS Geofence Attendance</span>
                </CardTitle>
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
                  <Badge className="bg-emerald-600 text-white text-[10px] animate-pulse">ON-DUTY</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">NOT CHECKED IN</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Backend-verified GPS geofencing. Attendance actions require physical presence inside your assigned office perimeter.
              </CardDescription>
            </div>

            {/* Live Clock & Location Refresh */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border shadow-xs text-xs">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-mono font-bold text-foreground">
                  {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={refreshLocation}
                disabled={locating}
                className="h-8 gap-1.5 text-xs bg-background hover:bg-muted"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${locating ? "animate-spin text-primary" : ""}`} />
                <span>{locating ? "Locating..." : "Refresh GPS"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Main Geofence Status Banner */}
          <div
            className={`rounded-xl p-4 border transition-all ${
              isPermissionDenied
                ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100"
                : isGpsUnavailable
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-950 dark:text-amber-100"
                  : isInside
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                    : coords
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
                      : "bg-muted/50 border-border text-muted-foreground"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`p-2.5 rounded-full shrink-0 shadow-xs ${
                    isPermissionDenied
                      ? "bg-rose-600 text-white"
                      : isGpsUnavailable
                        ? "bg-amber-600 text-white"
                        : isInside
                          ? "bg-emerald-600 text-white"
                          : coords
                            ? "bg-amber-600 text-white"
                            : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPermissionDenied ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : isGpsUnavailable ? (
                    <Radio className="h-5 w-5" />
                  ) : isInside ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : coords ? (
                    <ShieldAlert className="h-5 w-5" />
                  ) : (
                    <Navigation className="h-5 w-5 animate-spin" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{locationStatusTitle}</span>
                    <Badge
                      className={`text-[10px] font-bold ${
                        isPermissionDenied || isGpsUnavailable
                          ? "bg-rose-600 text-white"
                          : isInside
                            ? "bg-emerald-600 text-white"
                            : coords
                              ? "bg-amber-600 text-white"
                              : "bg-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      {isPermissionDenied
                        ? "PERMISSION BLOCKED"
                        : isGpsUnavailable
                          ? "SIGNAL OFFLINE"
                          : isInside
                            ? "ELIGIBLE TO MARK"
                            : coords
                              ? "OUTSIDE ZONE"
                              : "ACQUIRING"}
                    </Badge>

                    {coords?.source && (
                      <Badge variant="outline" className="text-[10px] bg-background/70 font-normal">
                        {coords.source === "native_gps" || coords.source === "browser_gps"
                          ? "🛰️ GPS Sensor"
                          : coords.source === "browser_network"
                            ? "📡 Network Positioning"
                            : "🌐 Edge Network"}
                      </Badge>
                    )}

                    {accuracyInfo && (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-medium ${
                          accuracyInfo.level === "good"
                            ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                            : accuracyInfo.level === "warning"
                              ? "text-amber-700 dark:text-amber-300 bg-amber-500/10"
                              : "text-rose-700 dark:text-rose-300 bg-rose-500/10"
                        }`}
                      >
                        Accuracy: {Math.round(coords!.accuracy)}m
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs opacity-90 leading-relaxed">
                    {isPermissionDenied ? (
                      "Location permission is blocked in your browser or operating system. Click the lock/tune icon 🔒 in your address bar and set Location to 'Allow', then tap Retry."
                    ) : isGpsUnavailable ? (
                      "GPS satellites and network positioning timed out. Please verify system location services are switched on, then tap Retry."
                    ) : assignedLocation ? (
                      distanceMeters !== null ? (
                        <>
                          You are <strong>{formatDistance(distanceMeters)}</strong> away from{" "}
                          <strong>{assignedLocation.name}</strong> (Allowed geofence radius:{" "}
                          {assignedLocation.radius_meters}m
                          {coords?.accuracy ? ` • Accuracy: ±${Math.round(coords.accuracy)}m` : ""})
                        </>
                      ) : (
                        "Calculating distance to office perimeter..."
                      )
                    ) : (
                      "No assigned office geofence configured. Please contact your HR administrator."
                    )}
                  </p>
                </div>
              </div>

              {/* Retry button */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                {(isPermissionDenied || isGpsUnavailable) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshLocation}
                    disabled={locating}
                    className="h-8 text-xs bg-background hover:bg-muted"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${locating ? "animate-spin" : ""}`} />
                    Retry Location
                  </Button>
                )}
              </div>
            </div>

            {/* Warning: Outside geofence action link */}
            {!isInside && coords && !isPermissionDenied && !isGpsUnavailable && (
              <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  Check-in and Check-out are disabled outside the office geofence perimeter.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setRegularizeOpen(true)}
                  className="h-auto p-0 text-xs font-semibold text-amber-950 dark:text-amber-50 underline hover:text-amber-700"
                >
                  Request Manager Regularization →
                </Button>
              </div>
            )}
          </div>

          {/* GPS Telemetry Grid (Map-Free Modern Visual Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* Card 1: GPS Coordinates & Accuracy */}
            <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-primary" />
                  Device Coordinates
                </span>
                {coords && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(coords.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono font-bold text-foreground">
                {coords ? formatCoordinates(coords.latitude, coords.longitude) : "Awaiting GPS Signal..."}
              </p>
              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                <span>Signal Accuracy:</span>
                <span className="font-medium text-foreground">
                  {coords ? `±${Math.round(coords.accuracy)}m (${accuracyInfo?.label || "Standard"})` : "--"}
                </span>
              </div>
            </div>

            {/* Card 2: Assigned Office & Perimeter */}
            <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-primary" />
                  Office Perimeter
                </span>
                {assignedLocation && (
                  <Badge variant="outline" className="text-[10px] py-0">
                    Radius: {assignedLocation.radius_meters}m
                  </Badge>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground truncate">
                {assignedLocation ? assignedLocation.name : "Unassigned"}
              </p>
              <div className="text-[11px] text-muted-foreground truncate pt-1 border-t border-border/50">
                {assignedLocation?.address ? assignedLocation.address : "No physical address specified"}
              </div>
            </div>

            {/* Card 3: Distance & Geofence Boundary Check */}
            <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-2xs space-y-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  Distance to Office
                </span>
                <span className={`text-[10px] font-bold ${isInside ? "text-emerald-600" : "text-amber-600"}`}>
                  {isInside ? "✓ WITHIN BOUNDARY" : "✗ OUTSIDE PERIMETER"}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-foreground">
                  {distanceMeters !== null ? formatDistance(distanceMeters) : "--"}
                </span>
                {assignedLocation && (
                  <span className="text-[11px] text-muted-foreground">
                    (Limit: {assignedLocation.radius_meters}m)
                  </span>
                )}
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${isInside ? "bg-emerald-500" : "bg-amber-500"}`}
                  style={{
                    width: `${
                      distanceMeters !== null && assignedLocation
                        ? Math.min(100, Math.max(5, (assignedLocation.radius_meters / Math.max(distanceMeters, 1)) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Today's Work Summary & Big Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-1">
            {/* Left: Today's Ledger */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Today's Attendance Ledger
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {currentTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">First Check-in</span>
                  <p className="text-base font-mono font-bold text-foreground">
                    {isCheckedIn ? formatTime(todayAttendance.check_in!) : "--:--"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Last Check-out</span>
                  <p className="text-base font-mono font-bold text-foreground">
                    {isCheckedOut
                      ? formatTime(todayAttendance.check_out!)
                      : isCheckedIn
                        ? "Active On-Site"
                        : "--:--"}
                  </p>
                </div>
              </div>

              {/* Working Duration Display */}
              <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
                <span>Working Duration:</span>
                <strong className="font-mono text-foreground font-semibold">
                  {isCheckedOut
                    ? todayAttendance.total_hours
                      ? `${todayAttendance.total_hours} hrs`
                      : formatHours(todayAttendance.total_hours ?? 0)
                    : elapsedLiveHours !== null
                      ? `${formatHours(elapsedLiveHours)} (Live)`
                      : "0 hrs"}
                </strong>
              </div>
            </div>

            {/* Right: Touch-Friendly Manual Punch Buttons */}
            <div className="flex flex-col gap-2.5">
              {!isCheckedIn ? (
                <Button
                  size="lg"
                  disabled={!isInside || attendanceMutation.isPending || locating}
                  onClick={() => attendanceMutation.mutate("check_in")}
                  className={`w-full h-14 text-sm sm:text-base font-bold shadow-md transition-all gap-2 rounded-xl ${
                    isInside
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-98"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                  }`}
                >
                  {attendanceMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  <span>
                    {isInside
                      ? "Check In (Manual Press)"
                      : locating
                        ? "Detecting Location..."
                        : "Check In (Disabled Outside Geofence)"}
                  </span>
                </Button>
              ) : !isCheckedOut ? (
                <Button
                  size="lg"
                  disabled={!isInside || attendanceMutation.isPending || locating}
                  onClick={() => attendanceMutation.mutate("check_out")}
                  className={`w-full h-14 text-sm sm:text-base font-bold shadow-md transition-all gap-2 rounded-xl ${
                    isInside
                      ? "bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-98"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                  }`}
                >
                  {attendanceMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                  <span>
                    {isInside
                      ? "Check Out (Manual Press)"
                      : locating
                        ? "Detecting Location..."
                        : "Check Out (Disabled Outside Geofence)"}
                  </span>
                </Button>
              ) : (
                <div className="flex items-center justify-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm font-semibold gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Work day completed! All logs recorded.
                </div>
              )}

              {/* Advisory note */}
              {isCheckedIn && !isCheckedOut && !isInside && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Notice: Check-out is gated by physical presence inside the office geofence.
                </p>
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
              If you worked off-site, experienced GPS signal failure, or were unable to check out
              inside the geofence, submit your reason for manager review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Exception</Label>
              <Textarea
                placeholder="e.g. Worked at client site, device GPS hardware malfunction, or urgent departure..."
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
