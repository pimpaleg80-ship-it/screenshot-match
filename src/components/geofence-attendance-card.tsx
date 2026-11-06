import { useState, useEffect, useCallback } from "react";
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
  submitGeofenceAttendance,
  type Coordinates,
  type GeofenceContext,
} from "@/lib/geofence";
import { formatTime, formatHours } from "@/lib/attendance";

interface GeofenceAttendanceCardProps {
  employeeId: string;
  onAttendanceUpdated?: () => void;
}

export function GeofenceAttendanceCard({ employeeId, onAttendanceUpdated }: GeofenceAttendanceCardProps) {
  const queryClient = useQueryClient();
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [regularizeOpen, setRegularizeOpen] = useState<boolean>(false);
  const [regularizeReason, setRegularizeReason] = useState<string>("");
  const [submittingRegularize, setSubmittingRegularize] = useState<boolean>(false);

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

  // Distance & Geofence evaluation
  const assignedLocation = context?.location;
  const todayAttendance = context?.today_attendance;

  const distanceMeters =
    coords && assignedLocation
      ? calculateHaversineDistance(
          coords.latitude,
          coords.longitude,
          assignedLocation.latitude,
          assignedLocation.longitude
        )
      : null;

  const isInside =
    distanceMeters !== null && assignedLocation
      ? distanceMeters <= assignedLocation.radius_meters
      : false;

  const isCheckedIn = !!todayAttendance?.check_in;
  const isCheckedOut = !!todayAttendance?.check_out;

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
          : `Checked Out Successfully! Total hours: ${data.total_hours ?? 0}h.`
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
        organization_id: context?.employee?.organization_id || "00000000-0000-0000-0000-000000000001",
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
          <span className="text-sm font-medium">Loading geofence radar & attendance status...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden border border-border shadow-sm">
        {/* Header with Assigned Location & Live Status */}
        <CardHeader className="bg-muted/30 pb-3 pt-4 px-4 sm:px-6 border-b">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary shrink-0" />
                  <span>Geofence Attendance Center</span>
                </CardTitle>
                {assignedLocation && (
                  <Badge variant="outline" className="text-[11px] font-normal border-primary/30 text-primary">
                    {assignedLocation.name}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Manual check-in and check-out is gated by your physical presence inside the assigned office geofence.
              </CardDescription>
            </div>

            {/* GPS Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshLocation}
              disabled={locating}
              className="h-8 gap-1.5 text-xs self-start sm:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${locating ? "animate-spin text-primary" : ""}`} />
              <span>{locating ? "Acquiring GPS..." : "Refresh Location"}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Geofence Radar / Eligibility Banner */}
          <div
            className={`rounded-xl p-3.5 sm:p-4 border transition-all ${
              isInside
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
                : coords
                ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
                : "bg-muted/50 border-border text-muted-foreground"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`p-2.5 rounded-full shrink-0 ${
                    isInside
                      ? "bg-emerald-500 text-white shadow-sm"
                      : coords
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isInside ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : coords ? (
                    <ShieldAlert className="h-5 w-5" />
                  ) : (
                    <Navigation className="h-5 w-5" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {isInside
                        ? "Inside Assigned Office Geofence"
                        : coords
                        ? "Outside Office Geofence"
                        : "GPS Signal Required"}
                    </span>
                    <Badge
                      className={`text-[10px] font-bold ${
                        isInside
                          ? "bg-emerald-600 text-white hover:bg-emerald-600"
                          : coords
                          ? "bg-amber-600 text-white hover:bg-amber-600"
                          : "bg-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      {isInside ? "ELIGIBLE TO MARK" : coords ? "LOCKED" : "DETECTING"}
                    </Badge>
                  </div>

                  <p className="text-xs opacity-90">
                    {assignedLocation ? (
                      distanceMeters !== null ? (
                        <>
                          You are <strong>{formatDistance(distanceMeters)}</strong> from{" "}
                          <strong>{assignedLocation.name}</strong> (Allowed radius: {assignedLocation.radius_meters}m
                          {coords?.accuracy ? ` • GPS Accuracy ±${Math.round(coords.accuracy)}m` : ""})
                        </>
                      ) : (
                        "Calculating distance to office perimeter..."
                      )
                    ) : (
                      "No assigned office geofence configured. Please contact HR administrator."
                    )}
                  </p>
                </div>
              </div>

              {/* Status details pill */}
              {assignedLocation?.address && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 self-start sm:self-auto sm:text-right">
                  <Building className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate max-w-[260px]">{assignedLocation.address}</span>
                </div>
              )}
            </div>

            {/* Warning when outside */}
            {!isInside && coords && (
              <div className="mt-2.5 pt-2.5 border-t border-amber-500/20 text-xs flex items-center justify-between gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Check-in and Check-out are disabled outside the office geofence.
                </span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setRegularizeOpen(true)}
                  className="h-auto p-0 text-xs font-semibold text-amber-900 dark:text-amber-100 hover:underline"
                >
                  Request Manager Regularization →
                </Button>
              </div>
            )}

            {locationError && (
              <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                ⚠️ {locationError}
              </div>
            )}
          </div>

          {/* Today's Metrics & Manual Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Left: Today's Summary */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Today's Work Ledger
              </span>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Check-in</span>
                  <p className="text-base font-mono font-bold text-foreground">
                    {isCheckedIn ? formatTime(todayAttendance.check_in!) : "--:--"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Check-out</span>
                  <p className="text-base font-mono font-bold text-foreground">
                    {isCheckedOut
                      ? formatTime(todayAttendance.check_out!)
                      : isCheckedIn
                      ? "Active On-Site"
                      : "--:--"}
                  </p>
                </div>
              </div>

              {isCheckedIn && isCheckedOut && (
                <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-between">
                  <span>Total Hours Logged:</span>
                  <strong className="font-mono text-foreground font-semibold">
                    {todayAttendance.total_hours
                      ? `${todayAttendance.total_hours} hrs`
                      : formatHours(todayAttendance.total_hours ?? 0)}
                  </strong>
                </div>
              )}
            </div>

            {/* Right: Manual Attendance Action Buttons */}
            <div className="flex flex-col gap-2.5">
              {!isCheckedIn ? (
                <Button
                  size="lg"
                  disabled={!isInside || attendanceMutation.isPending || locating}
                  onClick={() => attendanceMutation.mutate("check_in")}
                  className={`w-full h-13 text-sm sm:text-base font-bold shadow-md transition-all gap-2 ${
                    isInside
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {attendanceMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  <span>{isInside ? "Check In (Manual Press)" : "Check In (Disabled Outside Geofence)"}</span>
                </Button>
              ) : !isCheckedOut ? (
                <Button
                  size="lg"
                  disabled={!isInside || attendanceMutation.isPending || locating}
                  onClick={() => attendanceMutation.mutate("check_out")}
                  className={`w-full h-13 text-sm sm:text-base font-bold shadow-md transition-all gap-2 ${
                    isInside
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {attendanceMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                  <span>{isInside ? "Check Out (Manual Press)" : "Check Out (Disabled Outside Geofence)"}</span>
                </Button>
              ) : (
                <div className="flex items-center justify-center p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm font-semibold gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Work day completed! All logs recorded.
                </div>
              )}

              {/* Outside Geofence Assist note */}
              {isCheckedIn && !isCheckedOut && !isInside && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Notice: Check-out requires you to be physically inside the office geofence.
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
              If you worked off-site, experienced GPS signal failure, or were unable to check out inside the
              geofence, submit your reason for manager review.
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
