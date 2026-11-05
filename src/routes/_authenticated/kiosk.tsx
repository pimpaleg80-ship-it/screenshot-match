import { useState, useRef, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScanLine,
  ScanFace,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Settings,
  Keyboard,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Volume2,
  VolumeX,
  Camera,
  Loader2,
  Check,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  loadFaceApi,
  detectOptions,
  descriptorDistance,
  eyeAspectRatio,
  LEFT_EYE_IDX,
  RIGHT_EYE_IDX,
} from "@/lib/face";
import {
  toDateKey,
  formatTime,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/kiosk")({
  head: () => ({
    meta: [
      { title: "Face Attendance Kiosk — FaceTime Attendance" },
      { name: "description", content: "Self-service facial recognition check-in kiosk terminal." },
    ],
  }),
  component: KioskPage,
});

interface EnrolledPerson {
  person_id: string;
  descriptor: number[];
  name: string;
  person_code: string;
  department: string;
  photo_url: string | null;
}

interface RecentScan {
  id: string;
  name: string;
  person_code: string;
  department: string;
  time: string;
  type: "in" | "out";
  status: string;
  confidence: number;
}

// Play pleasant web audio chime on verification
function playChime(success = true) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (success) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context may be blocked before interaction
  }
}

function KioskPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<"auto" | "in" | "out">("auto");
  const [modelReady, setModelReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Verification popup feedback
  const [verifiedScan, setVerifiedScan] = useState<RecentScan | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [recentScanMap, setRecentScanMap] = useState<Map<string, number>>(new Map());

  // Manual fallback dialog
  const [manualCodeOpen, setManualCodeOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualSearching, setManualSearching] = useState(false);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch settings (face match threshold, duplicate cooldown, shift start)
  const { data: settings } = useQuery({
    queryKey: ["kiosk-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
      return data;
    },
  });

  const faceMatchThreshold = Number(settings?.face_match_threshold ?? 0.5);
  const duplicateCooldownMs = (settings?.duplicate_scan_minutes ?? 5) * 60 * 1000;
  const workStart = settings?.work_start ?? "09:00";
  const lateGraceMinutes = settings?.late_grace_minutes ?? 10;

  // Load enrolled people & face descriptors into memory
  const { data: enrolledPeople = [], isLoading: enrolledLoading } = useQuery({
    queryKey: ["kiosk-enrolled-descriptors"],
    queryFn: async () => {
      const { data: descriptors, error: descErr } = await supabase
        .from("face_descriptors")
        .select("person_id, descriptor, people!inner(id, name, person_code, department, photo_url, active)")
        .order("updated_at", { ascending: false });

      if (descErr) throw descErr;

      const list: EnrolledPerson[] = [];
      for (const d of descriptors ?? []) {
        const p = (d as any).people;
        if (p && p.active && Array.isArray(d.descriptor)) {
          list.push({
            person_id: d.person_id,
            descriptor: d.descriptor as number[],
            name: p.name,
            person_code: p.person_code,
            department: p.department || "General",
            photo_url: p.photo_url,
          });
        }
      }
      return list;
    },
  });

  // Handle successful match
  const handleFaceMatched = useCallback(
    async (match: EnrolledPerson, confidenceScore: number) => {
      const now = Date.now();
      const lastScan = recentScanMap.get(match.person_id) ?? 0;
      if (now - lastScan < duplicateCooldownMs) {
        return; // Skip duplicate scan within cooldown
      }

      // Update cooldown
      setRecentScanMap((prev) => new Map(prev).set(match.person_id, now));

      try {
        const nowIso = new Date().toISOString();
        const dateKey = toDateKey(new Date());

        // Check today's existing attendance
        const { data: existing } = await supabase
          .from("attendance")
          .select("*")
          .eq("person_id", match.person_id)
          .eq("date", dateKey)
          .maybeSingle();

        let scanType: "in" | "out" = "in";
        let status = "present";

        if (mode === "out" || (mode === "auto" && existing?.check_in && !existing?.check_out)) {
          // Check-out
          scanType = "out";
          await supabase
            .from("attendance")
            .update({
              check_out: nowIso,
              updated_at: nowIso,
            })
            .eq("id", existing!.id);
          status = existing?.status || "present";
        } else {
          // Check-in
          scanType = "in";
          // Check punctuality against shift start + grace
          const [wh, wm] = workStart.split(":").map(Number);
          const shiftDate = new Date();
          shiftDate.setHours(wh ?? 9, (wm ?? 0) + lateGraceMinutes, 0, 0);
          if (new Date() > shiftDate) {
            status = "late";
          }

          await supabase.from("attendance").upsert(
            {
              person_id: match.person_id,
              date: dateKey,
              check_in: nowIso,
              status,
              method: "face",
              confidence: confidenceScore,
              updated_at: nowIso,
            },
            { onConflict: "person_id,date" },
          );
        }

        const scanObj: RecentScan = {
          id: `${match.person_id}-${now}`,
          name: match.name,
          person_code: match.person_code,
          department: match.department,
          time: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
          type: scanType,
          status,
          confidence: Math.round(confidenceScore * 100),
        };

        if (soundEnabled) playChime(true);
        setVerifiedScan(scanObj);
        setRecentScans((prev) => [scanObj, ...prev.slice(0, 7)]);

        // Clear verification toast popup after 4 seconds
        setTimeout(() => {
          setVerifiedScan((cur) => (cur?.id === scanObj.id ? null : cur));
        }, 4000);
      } catch (err) {
        console.error(err);
        toast.error("Failed to record attendance");
      }
    },
    [
      mode,
      recentScanMap,
      duplicateCooldownMs,
      workStart,
      lateGraceMinutes,
      soundEnabled,
    ],
  );

  // Run camera & detection
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number;
    let isMounted = true;
    let isProcessing = false;

    async function startKiosk() {
      try {
        const faceapi = await loadFaceApi();
        if (!isMounted) return;
        setModelReady(true);

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });

        if (videoRef.current && isMounted) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);

          const options = detectOptions(faceapi, 320);

          const loop = async () => {
            if (!isMounted) return;

            if (
              videoRef.current &&
              canvasRef.current &&
              !videoRef.current.paused &&
              !videoRef.current.ended &&
              !isProcessing &&
              enrolledPeople.length > 0
            ) {
              isProcessing = true;
              try {
                const detection = await faceapi
                  .detectSingleFace(videoRef.current, options)
                  .withFaceLandmarks()
                  .withFaceDescriptor();

                const displaySize = {
                  width: videoRef.current.videoWidth || 640,
                  height: videoRef.current.videoHeight || 480,
                };
                faceapi.matchDimensions(canvasRef.current, displaySize);
                const ctx = canvasRef.current.getContext("2d");
                if (ctx) ctx.clearRect(0, 0, displaySize.width, displaySize.height);

                if (detection) {
                  const resized = faceapi.resizeResults(detection, displaySize);

                  // Find closest match among enrolled people
                  const queryDesc = Array.from(detection.descriptor);
                  let bestMatch: EnrolledPerson | null = null;
                  let bestDist = Infinity;

                  for (const candidate of enrolledPeople) {
                    const dist = descriptorDistance(queryDesc, candidate.descriptor);
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestMatch = candidate;
                    }
                  }

                  const box = resized.detection.box;

                  // Draw targeting box
                  if (ctx) {
                    ctx.save();
                    const isMatched = bestDist <= faceMatchThreshold && bestMatch !== null;
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = isMatched ? "#22c55e" : "#6366f1";

                    // Bracket corners
                    const len = 24;
                    const { x, y, width: w, height: h } = box;

                    // Top-Left
                    ctx.beginPath();
                    ctx.moveTo(x, y + len);
                    ctx.lineTo(x, y);
                    ctx.lineTo(x + len, y);
                    ctx.stroke();

                    // Top-Right
                    ctx.beginPath();
                    ctx.moveTo(x + w - len, y);
                    ctx.lineTo(x + w, y);
                    ctx.lineTo(x + w, y + len);
                    ctx.stroke();

                    // Bottom-Left
                    ctx.beginPath();
                    ctx.moveTo(x, y + h - len);
                    ctx.lineTo(x, y + h);
                    ctx.lineTo(x + len, y + h);
                    ctx.stroke();

                    // Bottom-Right
                    ctx.beginPath();
                    ctx.moveTo(x + w - len, y + h);
                    ctx.lineTo(x + w, y + h);
                    ctx.lineTo(x + w, y + h - len);
                    ctx.stroke();

                    ctx.restore();
                  }

                  if (bestMatch && bestDist <= faceMatchThreshold) {
                    const confidence = Math.max(0.1, 1 - bestDist);
                    handleFaceMatched(bestMatch, confidence);
                  }
                }
              } catch (e) {
                // Ignore transient frame errors
              } finally {
                isProcessing = false;
              }
            }

            animId = requestAnimationFrame(loop);
          };

          loop();
        }
      } catch (err) {
        console.error(err);
        toast.error("Unable to activate camera or face recognition models");
      }
    }

    startKiosk();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [enrolledPeople, faceMatchThreshold, handleFaceMatched]);

  // Handle manual code check-in fallback
  async function handleManualSubmit() {
    if (!manualCode.trim()) return;
    try {
      setManualSearching(true);
      const { data: person, error } = await supabase
        .from("people")
        .select("*")
        .ilike("person_code", manualCode.trim())
        .eq("active", true)
        .maybeSingle();

      if (error || !person) {
        toast.error(`No active personnel found with code "${manualCode}"`);
        setManualSearching(false);
        return;
      }

      const dummyMatch: EnrolledPerson = {
        person_id: person.id,
        descriptor: [],
        name: person.name,
        person_code: person.person_code,
        department: person.department,
        photo_url: person.photo_url,
      };

      await handleFaceMatched(dummyMatch, 1.0);
      setManualCodeOpen(false);
      setManualCode("");
      toast.success(`Check-in verified for ${person.name}`);
    } catch (e: any) {
      toast.error(e.message || "Manual check-in failed");
    } finally {
      setManualSearching(false);
    }
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-white select-none">
      {/* Top Bar */}
      <header className="z-20 flex items-center justify-between border-b border-white/10 bg-black/60 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/dashboard" })}
            className="text-white/80 hover:bg-white/10 hover:text-white gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit Kiosk
          </Button>

          <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanFace className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">FaceTime Attendance Terminal</span>
          </div>
        </div>

        {/* Center Clock */}
        <div className="text-center">
          <div className="font-mono text-xl font-bold tracking-tight sm:text-2xl">
            {currentTime.toLocaleTimeString()}
          </div>
          <div className="text-[11px] text-white/60 uppercase tracking-widest">
            {currentTime.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Mode Selector & Sound */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-white/10 p-1">
            <Button
              size="sm"
              variant={mode === "auto" ? "secondary" : "ghost"}
              className={`h-7 px-2.5 text-xs ${mode === "auto" ? "bg-white text-black font-semibold" : "text-white/80"}`}
              onClick={() => setMode("auto")}
            >
              Auto
            </Button>
            <Button
              size="sm"
              variant={mode === "in" ? "secondary" : "ghost"}
              className={`h-7 px-2.5 text-xs ${mode === "in" ? "bg-white text-black font-semibold" : "text-white/80"}`}
              onClick={() => setMode("in")}
            >
              In
            </Button>
            <Button
              size="sm"
              variant={mode === "out" ? "secondary" : "ghost"}
              className={`h-7 px-2.5 text-xs ${mode === "out" ? "bg-white text-black font-semibold" : "text-white/80"}`}
              onClick={() => setMode("out")}
            >
              Out
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/80 hover:bg-white/10"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label="Toggle sound"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setManualCodeOpen(true)}
            className="hidden md:flex border-white/20 bg-white/5 text-white hover:bg-white/15 gap-1.5 text-xs"
          >
            <Keyboard className="h-3.5 w-3.5" />
            Enter ID
          </Button>
        </div>
      </header>

      {/* Main Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        {/* Full-bleed video mirror */}
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
        />

        {/* Overlay Canvas for detection bounding boxes */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none scale-x-[-1] h-full w-full object-cover"
        />

        {/* Loading overlay */}
        {(!modelReady || !cameraActive) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <h3 className="mt-4 text-base font-semibold">Starting Biometric Terminal</h3>
            <p className="mt-1 text-xs text-white/60">
              Initializing AI face models and camera feed...
            </p>
          </div>
        )}

        {/* Scanning Reticle & Guidance */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="relative h-72 w-72 sm:h-80 sm:w-80 rounded-3xl border border-white/25 shadow-glow">
            {/* Corner highlights */}
            <div className="absolute -top-1 -left-1 h-6 w-6 border-t-2 border-l-2 border-primary rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 h-6 w-6 border-t-2 border-r-2 border-primary rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-2 border-l-2 border-primary rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-2 border-r-2 border-primary rounded-br-xl" />

            {/* Scanning line animation */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-80 animate-bounce" />
          </div>

          <div className="mt-6 rounded-full bg-black/60 px-5 py-2 backdrop-blur-md border border-white/10 text-center">
            <p className="text-xs font-semibold tracking-wide text-white/90">
              Align your face within the frame
            </p>
            <p className="text-[11px] text-white/60">
              {enrolledPeople.length} enrolled personnel in biometric database
            </p>
          </div>
        </div>

        {/* Floating Verified Scan Card */}
        {verifiedScan && (
          <div className="absolute top-8 z-30 flex animate-in fade-in slide-in-from-top-6 duration-300">
            <div className="flex items-center gap-4 rounded-2xl border border-success/40 bg-black/85 px-6 py-4 backdrop-blur-xl shadow-glow">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success text-success-foreground">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{verifiedScan.name}</h3>
                  <Badge variant="outline" className="border-success/40 bg-success/20 text-success text-[10px]">
                    {verifiedScan.type === "in" ? "CHECK-IN" : "CHECK-OUT"}
                  </Badge>
                </div>
                <p className="text-xs text-white/70">
                  {verifiedScan.person_code} • {verifiedScan.department} • {verifiedScan.time}
                </p>
                <p className="text-[11px] text-success font-medium mt-0.5">
                  Verified ({verifiedScan.confidence}% confidence)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Manual ID fallback trigger for mobile */}
        <div className="absolute bottom-20 sm:bottom-24 z-20 md:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setManualCodeOpen(true)}
            className="rounded-full shadow-lg gap-2 text-xs"
          >
            <Keyboard className="h-4 w-4" />
            Enter ID Code
          </Button>
        </div>
      </div>

      {/* Bottom Live Scan Ticker */}
      <footer className="z-20 border-t border-white/10 bg-black/75 px-6 py-2.5 backdrop-blur-md">
        <div className="flex items-center justify-between text-xs text-white/70">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="font-semibold text-white">Live Kiosk Terminal</span>
            <span className="text-white/40">•</span>
            <span>Mode: {mode.toUpperCase()}</span>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto">
            {recentScans.slice(0, 3).map((scan) => (
              <div key={scan.id} className="flex items-center gap-2 whitespace-nowrap text-[11px]">
                <span className="font-semibold text-white">{scan.name}</span>
                <span className="text-white/50">{scan.time}</span>
                <Badge
                  variant="outline"
                  className="px-1 text-[9px] border-white/20 text-white/80"
                >
                  {scan.type.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </footer>

      {/* Manual ID Entry Dialog */}
      <Dialog open={manualCodeOpen} onOpenChange={setManualCodeOpen}>
        <DialogContent className="sm:max-w-xs bg-neutral-900 text-white border-white/10">
          <DialogHeader>
            <DialogTitle>Enter Personnel Code</DialogTitle>
            <DialogDescription className="text-white/60">
              Manual attendance check-in without facial recognition.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Input
              placeholder="e.g. EMP001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              className="text-center font-mono text-lg tracking-widest bg-neutral-800 border-white/20 text-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualSubmit();
              }}
            />
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualCodeOpen(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleManualSubmit}
              disabled={manualSearching || !manualCode.trim()}
              className="bg-primary text-primary-foreground"
            >
              {manualSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Check In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
