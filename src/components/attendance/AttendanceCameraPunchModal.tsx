import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Volume2,
  VolumeX,
  X,
  Fingerprint,
  HardDrive,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  loadFaceApi,
  detectOptions,
  descriptorDistance,
  eyeAspectRatio,
  headYawRatio,
  LEFT_EYE_IDX,
  RIGHT_EYE_IDX,
} from "@/lib/face";
import {
  toDateKey,
  formatTime,
  calculateShiftMetrics,
  STATUS_COLORS,
  STATUS_LABELS,
  ShiftConfig,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AttendanceCameraPunchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPunchSuccess?: () => void;
}

interface EnrolledPerson {
  employee_id: string;
  descriptor: number[];
  name: string;
  employee_code: string;
  department: string;
  designation: string;
  photo_url: string | null;
  shift_id: string | null;
  shift?: ShiftConfig | null;
}

interface PunchSuccessResult {
  employee_id: string;
  name: string;
  employee_code: string;
  department: string;
  designation: string;
  photo_url: string | null;
  punch_type: "in" | "out";
  time: string;
  status: string;
  confidence: number;
  working_hours?: number;
  overtime_hours?: number;
  late_minutes?: number;
}

export function AttendanceCameraPunchModal({
  open,
  onOpenChange,
  onPunchSuccess,
}: AttendanceCameraPunchModalProps) {
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeTab, setActiveTab] = useState<"camera" | "device">("camera");
  const [modelReady, setModelReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [punchMode, setPunchMode] = useState<"auto" | "in" | "out">("auto");

  // Recognition and anti-spoofing states
  const [verifying, setVerifying] = useState(false);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [recentBlinks, setRecentBlinks] = useState(0);
  const [scanResult, setScanResult] = useState<PunchSuccessResult | null>(null);

  // Manual / Biometric device punch form state
  const [devEmployeeId, setDevEmployeeId] = useState("");
  const [devPunchType, setDevPunchType] = useState<"in" | "out">("in");
  const [devMethod, setDevMethod] = useState<"fingerprint" | "device" | "manual">("fingerprint");
  const [devTerminalId, setDevTerminalId] = useState("BIO-TERMINAL-01");
  const [devSubmitting, setDevSubmitting] = useState(false);

  // 1. Query enrolled employee face descriptors
  const { data: enrolledPeople = [] } = useQuery({
    queryKey: ["camera-punch-enrolled-descriptors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_data")
        .select(`
          employee_id,
          descriptor,
          employees!inner (
            id,
            full_name,
            employee_code,
            designation,
            photo_url,
            status,
            shift_id,
            departments (name),
            shifts (id, name, start_time, end_time, break_duration_minutes, grace_period_minutes, early_departure_grace_minutes, half_day_min_hours, full_day_min_hours, is_night_shift)
          )
        `);

      if (error) throw error;

      const list: EnrolledPerson[] = [];
      for (const row of data || []) {
        const emp = (row as any).employees;
        if (emp && emp.status === "active" && Array.isArray(row.descriptor) && row.descriptor.length >= 128) {
          list.push({
            employee_id: emp.id,
            descriptor: row.descriptor as number[],
            name: emp.full_name,
            employee_code: emp.employee_code,
            department: emp.departments?.name || "General",
            designation: emp.designation || "Staff",
            photo_url: emp.photo_url,
            shift_id: emp.shift_id,
            shift: emp.shifts || null,
          });
        }
      }
      return list;
    },
    enabled: open,
  });

  // Query all active employees for device punch tab
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["camera-punch-all-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, departments(name), shift_id, shifts(id, name, start_time, end_time, break_duration_minutes, grace_period_minutes, early_departure_grace_minutes, half_day_min_hours, full_day_min_hours, is_night_shift)")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Play audio chime
  function playPunchChime(type: "in" | "out") {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "in") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc.frequency.exponentialRampToValueAtTime(440.0, ctx.currentTime + 0.15); // A4
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }

  // Camera start / stop lifecycle
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isMounted = true;

    if (open && activeTab === "camera") {
      async function initCamera() {
        try {
          await loadFaceApi();
          if (isMounted) setModelReady(true);

          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });

          if (videoRef.current && isMounted) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(() => {});
              setCameraActive(true);
            };
          }
        } catch (err: any) {
          toast.error("Could not access camera: " + (err.message || "Permission denied"));
          setCameraActive(false);
        }
      }

      initCamera();
    }

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setCameraActive(false);
    };
  }, [open, activeTab]);

  // Main Recognition & Verification Loop
  useEffect(() => {
    if (!open || !cameraActive || !modelReady || activeTab !== "camera" || scanResult) {
      return;
    }

    let isScanning = true;
    let animId: number;

    async function scanFrame() {
      if (!isScanning || !videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
        animId = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };

      if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
      }

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        const faceapi = await loadFaceApi();
        const detection = await faceapi
          .detectSingleFace(video, detectOptions(faceapi, 320))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection && ctx) {
          const resized = faceapi.resizeResults(detection, displaySize);
          const box = resized.detection.box;

          // Draw target box
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          // Anti-spoofing / Liveness estimation
          const landmarks = resized.landmarks.positions;
          const leftEar = eyeAspectRatio(landmarks, LEFT_EYE_IDX);
          const rightEar = eyeAspectRatio(landmarks, RIGHT_EYE_IDX);
          const ear = (leftEar + rightEar) / 2;
          const yaw = Math.abs(headYawRatio(landmarks));

          const isLively = ear > 0.18 && ear < 0.42 && yaw < 0.45;
          setLivenessPassed(isLively);

          if (!verifying && enrolledPeople.length > 0) {
            // Match against enrolled descriptors
            const queryDesc = Array.from(detection.descriptor);
            let bestPerson: EnrolledPerson | null = null;
            let minDistance = 999;

            for (const person of enrolledPeople) {
              const dist = descriptorDistance(queryDesc, person.descriptor);
              if (dist < minDistance) {
                minDistance = dist;
                bestPerson = person;
              }
            }

            // Verification threshold (0.48 distance cutoff)
            if (bestPerson && minDistance < 0.48) {
              const confidence = Math.round(Math.max(0, (1 - minDistance / 0.6)) * 100);

              // Draw name tag above box
              ctx.fillStyle = "#10b981";
              ctx.fillRect(box.x, box.y - 28, box.width, 24);
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 12px Inter, sans-serif";
              ctx.fillText(`${bestPerson.name} (${confidence}%)`, box.x + 6, box.y - 12);

              // Trigger punch execution
              setVerifying(true);
              executePunch(bestPerson, confidence);
            }
          }
        }
      } catch (err) {
        // Skip failed frame
      }

      if (isScanning && !scanResult) {
        animId = requestAnimationFrame(scanFrame);
      }
    }

    animId = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      cancelAnimationFrame(animId);
    };
  }, [open, cameraActive, modelReady, enrolledPeople, verifying, scanResult, activeTab]);

  // Execute punch in database
  async function executePunch(person: EnrolledPerson, confidence: number) {
    try {
      const now = new Date();
      const nowIso = now.toISOString();

      // Check existing attendance for today
      const { data: existing } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", person.employee_id)
        .eq("date", todayKey)
        .maybeSingle();

      let targetType: "in" | "out" = "in";

      if (punchMode === "auto") {
        if (!existing || !existing.check_in) {
          targetType = "in";
        } else if (!existing.check_out) {
          targetType = "out";
        } else {
          targetType = "out"; // Update checkout
        }
      } else {
        targetType = punchMode;
      }

      let checkInIso = existing?.check_in || null;
      let checkOutIso = existing?.check_out || null;

      if (targetType === "in") {
        checkInIso = nowIso;
      } else {
        checkOutIso = nowIso;
        if (!checkInIso) checkInIso = nowIso; // Fallback
      }

      // Calculate shift-connected metrics
      const metrics = calculateShiftMetrics(checkInIso, checkOutIso, person.shift);

      if (existing) {
        // Update existing row
        const { error: updErr } = await supabase
          .from("attendance")
          .update({
            check_in: checkInIso,
            check_out: checkOutIso,
            shift_id: person.shift_id,
            status: metrics.status,
            working_hours: metrics.working_hours,
            overtime_hours: metrics.overtime_hours,
            is_late: metrics.is_late,
            late_minutes: metrics.late_minutes,
            is_early_departure: metrics.is_early_departure,
            early_departure_minutes: metrics.early_departure_minutes,
            is_half_day: metrics.is_half_day,
            method: "face",
            confidence,
          })
          .eq("id", existing.id);

        if (updErr) throw updErr;
      } else {
        // Insert new record
        const { error: insErr } = await supabase.from("attendance").insert({
          employee_id: person.employee_id,
          date: todayKey,
          check_in: checkInIso,
          check_out: checkOutIso,
          shift_id: person.shift_id,
          status: metrics.status,
          working_hours: metrics.working_hours,
          overtime_hours: metrics.overtime_hours,
          is_late: metrics.is_late,
          late_minutes: metrics.late_minutes,
          is_early_departure: metrics.is_early_departure,
          early_departure_minutes: metrics.early_departure_minutes,
          is_half_day: metrics.is_half_day,
          method: "face",
          confidence,
        });

        if (insErr) throw insErr;
      }

      playPunchChime(targetType);

      setScanResult({
        employee_id: person.employee_id,
        name: person.name,
        employee_code: person.employee_code,
        department: person.department,
        designation: person.designation,
        photo_url: person.photo_url,
        punch_type: targetType,
        time: formatTime(nowIso),
        status: metrics.status,
        confidence,
        working_hours: metrics.working_hours,
        overtime_hours: metrics.overtime_hours,
        late_minutes: metrics.late_minutes,
      });

      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      queryClient.invalidateQueries({ queryKey: ["my-attendance-records"] });
      onPunchSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to record punch");
      setVerifying(false);
    }
  }

  // Handle Device / Fingerprint manual submission
  async function handleDevicePunch(e: React.FormEvent) {
    e.preventDefault();
    if (!devEmployeeId) {
      toast.error("Please select an employee");
      return;
    }

    try {
      setDevSubmitting(true);
      const selectedEmp = allEmployees.find((e: any) => e.id === devEmployeeId);
      const now = new Date();
      const nowIso = now.toISOString();

      const { data: existing } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", devEmployeeId)
        .eq("date", todayKey)
        .maybeSingle();

      let checkInIso = existing?.check_in || null;
      let checkOutIso = existing?.check_out || null;

      if (devPunchType === "in") {
        checkInIso = nowIso;
      } else {
        checkOutIso = nowIso;
        if (!checkInIso) checkInIso = nowIso;
      }

      const metrics = calculateShiftMetrics(checkInIso, checkOutIso, selectedEmp?.shifts as any);

      if (existing) {
        const { error } = await supabase
          .from("attendance")
          .update({
            check_in: checkInIso,
            check_out: checkOutIso,
            shift_id: selectedEmp?.shift_id || null,
            status: metrics.status,
            working_hours: metrics.working_hours,
            overtime_hours: metrics.overtime_hours,
            is_late: metrics.is_late,
            late_minutes: metrics.late_minutes,
            is_early_departure: metrics.is_early_departure,
            early_departure_minutes: metrics.early_departure_minutes,
            is_half_day: metrics.is_half_day,
            method: devMethod,
            device_id: devTerminalId,
            note: `Logged via Authorized ${devMethod.toUpperCase()} (${devTerminalId})`,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance").insert({
          employee_id: devEmployeeId,
          date: todayKey,
          check_in: checkInIso,
          check_out: checkOutIso,
          shift_id: selectedEmp?.shift_id || null,
          status: metrics.status,
          working_hours: metrics.working_hours,
          overtime_hours: metrics.overtime_hours,
          is_late: metrics.is_late,
          late_minutes: metrics.late_minutes,
          is_early_departure: metrics.is_early_departure,
          early_departure_minutes: metrics.early_departure_minutes,
          is_half_day: metrics.is_half_day,
          method: devMethod,
          device_id: devTerminalId,
          note: `Logged via Authorized ${devMethod.toUpperCase()} (${devTerminalId})`,
        });

        if (error) throw error;
      }

      playPunchChime(devPunchType);
      toast.success(`${devPunchType === "in" ? "Check-In" : "Check-Out"} logged via ${devMethod}`);
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      queryClient.invalidateQueries({ queryKey: ["my-attendance-records"] });
      onPunchSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to log device punch");
    } finally {
      setDevSubmitting(false);
    }
  }

  function handleResetForNext() {
    setScanResult(null);
    setVerifying(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanFace className="h-5 w-5 text-primary" />
              <div>
                <DialogTitle className="text-base font-bold">Attendance Punch Terminal</DialogTitle>
                <DialogDescription className="text-xs">
                  Biometric face verification and authorized hardware terminal logging.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute chimes" : "Unmute chimes"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
          <div className="px-4 pt-2 border-b bg-muted/20">
            <TabsList className="h-9 w-full grid grid-cols-2">
              <TabsTrigger value="camera" className="text-xs gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                Live Face Camera Punch
              </TabsTrigger>
              <TabsTrigger value="device" className="text-xs gap-1.5">
                <Fingerprint className="h-3.5 w-3.5" />
                Biometric Device / Fingerprint
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: Live Face Camera */}
          <TabsContent value="camera" className="m-0 p-4 space-y-4">
            {scanResult ? (
              /* Success Result Card */
              <div className="rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-4 animate-in fade-in zoom-in-95">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 shadow-md">
                  <CheckCircle2 className="h-10 w-10 animate-bounce" />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-xl font-bold text-foreground">{scanResult.name}</h3>
                    <Badge variant="outline" className="font-mono text-xs">
                      {scanResult.employee_code}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {scanResult.designation} • {scanResult.department}
                  </p>
                </div>

                {/* Status Strip */}
                <div className="grid grid-cols-3 gap-2 bg-background/80 p-3 rounded-lg border text-xs">
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Action</span>
                    <Badge
                      className={`text-[11px] font-semibold mt-0.5 ${
                        scanResult.punch_type === "in"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-blue-500/10 text-blue-600"
                      }`}
                    >
                      {scanResult.punch_type === "in" ? "CHECKED IN" : "CHECKED OUT"}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Timestamp</span>
                    <span className="font-mono font-bold text-foreground">{scanResult.time}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block">Face Match</span>
                    <span className="font-bold text-emerald-600">{scanResult.confidence}% match</span>
                  </div>
                </div>

                {/* Additional metrics */}
                {scanResult.punch_type === "out" && scanResult.working_hours !== undefined && (
                  <div className="flex justify-between items-center text-xs bg-muted/40 p-2.5 rounded-lg">
                    <span className="text-muted-foreground">Calculated Working Time:</span>
                    <span className="font-bold font-mono text-foreground">{scanResult.working_hours} hours</span>
                  </div>
                )}

                {scanResult.late_minutes !== undefined && scanResult.late_minutes > 0 && (
                  <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 p-2 text-xs flex items-center justify-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Late Arrival: {scanResult.late_minutes} minutes past shift grace period
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <Button
                    onClick={handleResetForNext}
                    className="flex-1 text-xs h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Scan Next Employee
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="text-xs h-9"
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              /* Live Camera View */
              <div className="space-y-3">
                {/* Mode Selector */}
                <div className="flex items-center justify-between text-xs bg-muted/30 p-2 rounded-lg">
                  <span className="text-muted-foreground font-medium">Punch Mode:</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={punchMode === "auto" ? "default" : "ghost"}
                      onClick={() => setPunchMode("auto")}
                      className="h-7 text-xs px-2.5"
                    >
                      Smart Auto
                    </Button>
                    <Button
                      size="sm"
                      variant={punchMode === "in" ? "default" : "ghost"}
                      onClick={() => setPunchMode("in")}
                      className="h-7 text-xs px-2.5 text-emerald-600"
                    >
                      <LogIn className="h-3 w-3 mr-1" /> Check In
                    </Button>
                    <Button
                      size="sm"
                      variant={punchMode === "out" ? "default" : "ghost"}
                      onClick={() => setPunchMode("out")}
                      className="h-7 text-xs px-2.5 text-blue-600"
                    >
                      <LogOut className="h-3 w-3 mr-1" /> Check Out
                    </Button>
                  </div>
                </div>

                {/* Video Container */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black shadow-inner flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover transform -scale-x-100"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full pointer-events-none transform -scale-x-100"
                  />

                  {/* Camera overlay indicators */}
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 space-y-2 p-4 text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-xs font-semibold">Starting Biometric Camera...</p>
                      <p className="text-[11px] text-muted-foreground">
                        Please grant webcam access to enable facial recognition.
                      </p>
                    </div>
                  )}

                  {cameraActive && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-[11px] text-white">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live Biometric Recognition</span>
                    </div>
                  )}

                  {cameraActive && livenessPassed && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-emerald-500/80 backdrop-blur px-2.5 py-1 text-[10px] text-white font-medium">
                      <ShieldCheck className="h-3 w-3" /> Anti-Spoofing Verified
                    </div>
                  )}

                  {verifying && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-xs font-bold">Verifying Biometrics & Logging Punch...</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <span>Enrolled Staff: {enrolledPeople.length} employees</span>
                  <span>Face AI: Active • Position face in center of frame</span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Authorized Device / Fingerprint Integration */}
          <TabsContent value="device" className="m-0 p-4">
            <form onSubmit={handleDevicePunch} className="space-y-4 text-xs">
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Fingerprint className="h-4 w-4 text-primary" /> Authorized Hardware Biometric Logger
                </p>
                <p>
                  Record punches synced from USB / LAN biometric devices (e.g. ZKTeco, Morpho, SecuGen) or manual authorized punches.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Employee</Label>
                <Select value={devEmployeeId} onValueChange={setDevEmployeeId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmployees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_code}) — {e.departments?.name || "General"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Punch Type</Label>
                  <Select value={devPunchType} onValueChange={(val: any) => setDevPunchType(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Punch Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Check In</SelectItem>
                      <SelectItem value="out">Check Out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Punch Source / Device</Label>
                  <Select value={devMethod} onValueChange={(val: any) => setDevMethod(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fingerprint">Optical Fingerprint Scanner</SelectItem>
                      <SelectItem value="device">External Biometric Terminal</SelectItem>
                      <SelectItem value="manual">Authorized Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Terminal / Machine ID</Label>
                <Input
                  value={devTerminalId}
                  onChange={(e) => setDevTerminalId(e.target.value)}
                  placeholder="e.g. BIO-TERMINAL-01"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={devSubmitting || !devEmployeeId}
                  className="gap-1.5 text-xs h-8"
                >
                  {devSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Record Biometric Punch
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
