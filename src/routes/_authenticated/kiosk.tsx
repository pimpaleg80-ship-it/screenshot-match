import { useState, useRef, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScanFace,
  CheckCircle2,
  ArrowLeft,
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
  LogOut,
  LogIn,
  Sliders,
  Flame,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  loadFaceApi,
  detectOptions,
  descriptorDistance,
} from "@/lib/face";
import {
  toDateKey,
  formatTime,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
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
      { title: "Smart Kiosk — Flowpeople by Fluxora" },
      { name: "description", content: "Self-service facial recognition check-in/out kiosk terminal." },
    ],
  }),
  component: KioskPage,
});

interface EnrolledPerson {
  employee_id: string;
  descriptor: number[];
  name: string;
  employee_code: string;
  department: string;
  designation: string;
  photo_url: string | null;
}

interface ScanNotification {
  id: string;
  name: string;
  employee_code: string;
  department: string;
  photo_url: string | null;
  time: string;
  type: "in" | "out" | "cooldown_in" | "cooldown_out";
  status: string;
  confidence: number;
  message?: string | undefined;
  cooldownRemainingSec?: number | undefined;
}

// Play pleasant web audio chimes tailored for check-in vs check-out vs notice
function playKioskChime(type: "in" | "out" | "cooldown" | "error") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "in") {
      // Melodic high ascent (Check-In)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === "out") {
      // Melodic gentle descent (Check-Out)
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.14); // D5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === "cooldown") {
      // Soft gentle dual notice beep
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Low buzz error
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context may be restricted by browser before first interaction
  }
}

// Draw high-tech HUD targeting frame directly on canvas
function drawFaceHUD(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; width: number; height: number },
  isMatched: boolean,
  label: string,
  distance: number
) {
  ctx.save();
  const { x, y, width: w, height: h } = box;
  const len = Math.max(16, Math.min(32, w * 0.2));

  // Stroke color: Emerald when verified, Cyan when searching
  ctx.lineWidth = isMatched ? 3.5 : 2;
  ctx.strokeStyle = isMatched ? "#10b981" : "#06b6d4";
  ctx.shadowColor = isMatched ? "rgba(16, 185, 129, 0.6)" : "rgba(6, 182, 212, 0.4)";
  ctx.shadowBlur = 8;

  // Bracket Top-Left
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.stroke();

  // Bracket Top-Right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  ctx.stroke();

  // Bracket Bottom-Left
  ctx.beginPath();
  ctx.moveTo(x, y + h - len);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + len, y + h);
  ctx.stroke();

  // Bracket Bottom-Right
  ctx.beginPath();
  ctx.moveTo(x + w - len, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - len);
  ctx.stroke();

  // Name pill header on face
  if (isMatched && label) {
    ctx.shadowBlur = 0;
    const tag = `${label} (${Math.round(Math.max(10, (1 - distance) * 100))}%)`;
    ctx.font = "bold 13px system-ui, sans-serif";
    const textWidth = ctx.measureText(tag).width;
    const pillH = 24;
    const pillW = textWidth + 18;
    const pillX = x + (w - pillW) / 2;
    const pillY = Math.max(8, y - pillH - 8);

    // Pill background
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 6);
    ctx.fill();

    // Pill border
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pill text
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.fillText(tag, pillX + 9, pillY + pillH / 2);
  }

  ctx.restore();
}

function KioskPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Kiosk Operating Mode: Auto (smart in/out detection), In only, Out only
  const [mode, setMode] = useState<"auto" | "in" | "out">("auto");
  const [thresholdPreset, setThresholdPreset] = useState<"strict" | "balanced" | "fast">("balanced");
  const [modelReady, setModelReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Pop-up Feedback state
  const [activeNotification, setActiveNotification] = useState<ScanNotification | null>(null);
  const [recentScans, setRecentScans] = useState<ScanNotification[]>([]);

  // Manual fallback dialog
  const [manualCodeOpen, setManualCodeOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualSearching, setManualSearching] = useState(false);

  // Cooldown safety: minimum difference between check-in and check-out (2.5 minutes)
  const COOLDOWN_MINUTES = 2.5;
  const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch settings from database (face match threshold, shift start, late grace)
  const { data: settings } = useQuery({
    queryKey: ["kiosk-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  // Calculate face match threshold based on user preset & DB settings
  const baseThreshold = Number(settings?.face_match_threshold ?? 0.48);
  const activeThreshold =
    thresholdPreset === "strict" ? 0.42 : thresholdPreset === "fast" ? 0.52 : baseThreshold;

  const workStart = settings?.work_start ?? "09:30:00";
  const lateGraceMinutes = Number(settings?.late_grace_minutes ?? 15);

  // 1. Load enrolled personnel face descriptors into memory
  const { data: enrolledPeople = [], isLoading: enrolledLoading } = useQuery({
    queryKey: ["kiosk-enrolled-descriptors"],
    queryFn: async () => {
      const list: EnrolledPerson[] = [];
      const seen = new Set<string>();

      try {
        // Query primary face_data table
        const { data: primaryData, error: primaryErr } = await supabase
          .from("face_data")
          .select(`
            id,
            employee_id,
            descriptor,
            employees!inner (
              id,
              full_name,
              employee_code,
              designation,
              photo_url,
              status,
              department_id,
              departments (name)
            )
          `);

        if (!primaryErr && primaryData) {
          for (const row of primaryData) {
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
              });
              seen.add(emp.id);
            }
          }
        }
      } catch (e) {
        console.warn("Primary face_data query skipped:", e);
      }

      // Compatibility fallback: query face_descriptors table for any legacy records
      try {
        const { data: legacyData } = await supabase
          .from("face_descriptors")
          .select("person_id, descriptor, people:people!inner(id, name, person_code, department, photo_url, active)");

        if (legacyData) {
          for (const row of legacyData) {
            if (seen.has(row.person_id)) continue;
            const p = (row as any).people;
            if (p && p.active && Array.isArray(row.descriptor) && row.descriptor.length >= 128) {
              list.push({
                employee_id: row.person_id,
                descriptor: row.descriptor as number[],
                name: p.name,
                employee_code: p.person_code,
                department: p.department || "General",
                designation: "Staff",
                photo_url: p.photo_url,
              });
              seen.add(row.person_id);
            }
          }
        }
      } catch (e) {
        // Ignored fallback
      }

      return list;
    },
    staleTime: 60 * 1000,
  });

  // Mutable refs to decouple camera loop from React re-renders (prevents camera restart lag)
  const enrolledPeopleRef = useRef<EnrolledPerson[]>([]);
  enrolledPeopleRef.current = enrolledPeople;

  const matchThresholdRef = useRef(activeThreshold);
  matchThresholdRef.current = activeThreshold;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const isProcessingRef = useRef(false);
  const isExecutingScanRef = useRef(false);

  // In-memory scan cooldown tracker: Map<employee_id, { time: number; type: "in" | "out" }>
  const recentScanMapRef = useRef<Map<string, { time: number; type: "in" | "out" }>>(new Map());

  // Core attendance execution logic: Auto Check-In & Auto Check-Out with 2-3 min difference
  const handleFaceMatched = useCallback(
    async (match: EnrolledPerson, confidenceScore: number) => {
      if (isExecutingScanRef.current) return;

      const now = Date.now();
      const localRecord = recentScanMapRef.current.get(match.employee_id);

      // Rapid-frame debounce: ignore frames within 4 seconds of last action for the exact same person
      if (localRecord && now - localRecord.time < 4000) {
        return;
      }

      isExecutingScanRef.current = true;

      try {
        const nowIso = new Date().toISOString();
        const dateKey = toDateKey(new Date());
        const currentMode = modeRef.current;

        // Fetch today's existing attendance record for this employee
        const { data: existing, error: fetchErr } = await supabase
          .from("attendance")
          .select("id, check_in, check_out, status")
          .eq("employee_id", match.employee_id)
          .eq("date", dateKey)
          .maybeSingle();

        if (fetchErr) {
          console.error("Attendance check error:", fetchErr);
        }

        let actionType: "in" | "out" | "cooldown_in" | "cooldown_out" = "in";
        let feedbackMessage = "";
        let remainingSeconds = 0;

        if (currentMode === "in") {
          // FORCED CHECK-IN MODE
          if (existing?.check_in) {
            actionType = "cooldown_in";
            feedbackMessage = `Already checked in at ${formatTime(existing.check_in)}`;
          } else {
            actionType = "in";
          }
        } else if (currentMode === "out") {
          // FORCED CHECK-OUT MODE
          if (!existing?.check_in) {
            actionType = "in";
            feedbackMessage = "No check-in found today. Checked in first.";
          } else if (existing?.check_out) {
            const msSinceOut = now - new Date(existing.check_out).getTime();
            if (msSinceOut < COOLDOWN_MS) {
              actionType = "cooldown_out";
              remainingSeconds = Math.ceil((COOLDOWN_MS - msSinceOut) / 1000);
              feedbackMessage = `Already checked out at ${formatTime(existing.check_out)}`;
            } else {
              actionType = "out";
            }
          } else {
            const msSinceIn = now - new Date(existing.check_in).getTime();
            if (msSinceIn < COOLDOWN_MS) {
              actionType = "cooldown_in";
              remainingSeconds = Math.ceil((COOLDOWN_MS - msSinceIn) / 1000);
              feedbackMessage = `Checked in at ${formatTime(existing.check_in)}. Check-out unlocks in ${remainingSeconds}s`;
            } else {
              actionType = "out";
            }
          }
        } else {
          // AUTO MODE (Smart Auto Log-In / Auto Log-Out)
          if (!existing || !existing.check_in) {
            // No record today -> AUTO CHECK IN
            actionType = "in";
          } else if (!existing.check_out) {
            // Already checked in, no check-out yet -> AUTO CHECK OUT
            const msSinceIn = now - new Date(existing.check_in).getTime();
            if (msSinceIn < COOLDOWN_MS) {
              // Within the 2-3 minute window: DO NOT log out! Protect from accidental immediate check-out
              actionType = "cooldown_in";
              remainingSeconds = Math.ceil((COOLDOWN_MS - msSinceIn) / 1000);
              feedbackMessage = `Already checked in at ${formatTime(existing.check_in)}. Check-out unlocks in ${remainingSeconds}s`;
            } else {
              // 2.5+ minutes have passed -> AUTO CHECK OUT
              actionType = "out";
            }
          } else {
            // Both check-in and check-out exist today
            const msSinceOut = now - new Date(existing.check_out).getTime();
            if (msSinceOut < COOLDOWN_MS) {
              actionType = "cooldown_out";
              remainingSeconds = Math.ceil((COOLDOWN_MS - msSinceOut) / 1000);
              feedbackMessage = `Already checked out at ${formatTime(existing.check_out)}`;
            } else {
              // Update departure time to the latest exit
              actionType = "out";
              feedbackMessage = "Check-out departure time updated";
            }
          }
        }

        // Execute Database Mutation: simply record check-in time without rigid shift constraints
        let finalStatus = "present";

        if (actionType === "in") {
          const { error: upsertErr } = await supabase.from("attendance").upsert(
            {
              employee_id: match.employee_id,
              date: dateKey,
              check_in: nowIso,
              status: "present",
              method: "face",
              confidence: Number((confidenceScore * 100).toFixed(1)),
            },
            { onConflict: "employee_id,date" },
          );

          if (upsertErr) throw upsertErr;

          recentScanMapRef.current.set(match.employee_id, { time: now, type: "in" });
          if (soundEnabled) playKioskChime("in");
          toast.success(`Welcome, ${match.name}! Checked In.`);
        } else if (actionType === "out") {
          const { error: updateErr } = await supabase
            .from("attendance")
            .update({
              check_out: nowIso,
            })
            .eq("id", existing!.id);

          if (updateErr) throw updateErr;

          recentScanMapRef.current.set(match.employee_id, { time: now, type: "out" });
          if (soundEnabled) playKioskChime("out");
          toast.info(`Goodbye, ${match.name}! Checked Out.`);
        } else {
          // Cooldown notice (already logged in or logged out within 2-3 minutes)
          recentScanMapRef.current.set(match.employee_id, { time: now, type: actionType === "cooldown_in" ? "in" : "out" });
          if (soundEnabled) playKioskChime("cooldown");
          toast.warning(feedbackMessage, { duration: 3000 });
        }

        // Create on-screen display notification
        const notificationObj: ScanNotification = {
          id: `${match.employee_id}-${now}`,
          name: match.name,
          employee_code: match.employee_code,
          department: match.department,
          photo_url: match.photo_url,
          time: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
          type: actionType,
          status: finalStatus,
          confidence: Math.round(confidenceScore * 100),
          message: feedbackMessage,
          cooldownRemainingSec: remainingSeconds > 0 ? remainingSeconds : undefined,
        };

        setActiveNotification(notificationObj);
        if (actionType === "in" || actionType === "out") {
          setRecentScans((prev) => [notificationObj, ...prev.slice(0, 9)]);
          // Invalidate attendance queries in background without freezing UI
          queryClient.invalidateQueries({ queryKey: ["admin-today-attendance"] });
          queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
        }

        // Clear active notification banner after 4.5 seconds
        setTimeout(() => {
          setActiveNotification((cur) => (cur?.id === notificationObj.id ? null : cur));
        }, 4500);
      } catch (err: any) {
        console.error("Attendance recording failed:", err);
        if (soundEnabled) playKioskChime("error");
        toast.error("Failed to record attendance: " + (err.message || "System connection error"));
      } finally {
        setTimeout(() => {
          isExecutingScanRef.current = false;
        }, 1500);
      }
    },
    [COOLDOWN_MS, workStart, lateGraceMinutes, soundEnabled, queryClient],
  );

  const handleFaceMatchedRef = useRef(handleFaceMatched);
  handleFaceMatchedRef.current = handleFaceMatched;

  // Single Camera & AI Detection Loop Lifecycle (Never restarts on scan!)
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number;
    let isMounted = true;

    async function startKioskHardware() {
      try {
        const faceapi = await loadFaceApi();
        if (!isMounted) return;
        setModelReady(true);

        if (!navigator.mediaDevices?.getUserMedia) {
          toast.error("Camera access requires HTTPS or localhost.");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: "user",
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);

          const options = detectOptions(faceapi, 320);
          let lastInferenceTimestamp = 0;

          const renderLoop = async () => {
            if (!isMounted) return;

            const now = performance.now();

            // Throttle inference: run every 110ms (achieves 9 detections/sec, silky smooth 60fps video, low CPU)
            if (
              now - lastInferenceTimestamp >= 110 &&
              !isProcessingRef.current &&
              videoRef.current &&
              canvasRef.current &&
              !videoRef.current.paused &&
              !videoRef.current.ended &&
              enrolledPeopleRef.current.length > 0
            ) {
              lastInferenceTimestamp = now;
              isProcessingRef.current = true;

              try {
                const detection = await faceapi
                  .detectSingleFace(videoRef.current, options)
                  .withFaceLandmarks()
                  .withFaceDescriptor();

                if (!isMounted) return;

                const displaySize = {
                  width: videoRef.current.videoWidth || 640,
                  height: videoRef.current.videoHeight || 480,
                };
                faceapi.matchDimensions(canvasRef.current, displaySize);
                const ctx = canvasRef.current.getContext("2d");
                if (ctx) ctx.clearRect(0, 0, displaySize.width, displaySize.height);

                if (detection && ctx) {
                  const resized = faceapi.resizeResults(detection, displaySize);
                  const box = resized.detection.box;

                  // Evaluate against enrolled personnel vectors in memory
                  const queryDesc = Array.from(detection.descriptor);
                  let bestMatch: EnrolledPerson | null = null;
                  let bestDist = Infinity;

                  for (const candidate of enrolledPeopleRef.current) {
                    const dist = descriptorDistance(queryDesc, candidate.descriptor);
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestMatch = candidate;
                    }
                  }

                  const threshold = matchThresholdRef.current;
                  const isMatched = bestDist <= threshold && bestMatch !== null;

                  // Render glowing HUD reticle on screen
                  drawFaceHUD(
                    ctx,
                    box,
                    isMatched,
                    isMatched ? bestMatch!.name : "Aligning face...",
                    bestDist,
                  );

                  // Trigger match handler if face is recognized and large enough (not background artifact)
                  if (isMatched && bestMatch && box.width >= 80) {
                    const confidence = Math.max(0.1, 1 - bestDist);
                    handleFaceMatchedRef.current(bestMatch, confidence);
                  }
                }
              } catch (e) {
                // Ignore transient frame buffer dropped exceptions
              } finally {
                isProcessingRef.current = false;
              }
            }

            animId = requestAnimationFrame(renderLoop);
          };

          animId = requestAnimationFrame(renderLoop);
        }
      } catch (err) {
        console.error("Camera/AI init error:", err);
        toast.error("Unable to activate camera or biometric scanner");
      }
    }

    startKioskHardware();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []); // Mounted once: Rock-solid, zero camera restarts on scan!

  // Manual fallback code submit handler
  async function handleManualSubmit() {
    if (!manualCode.trim()) return;
    try {
      setManualSearching(true);
      const code = manualCode.trim().toUpperCase();

      // Look up in employees table
      const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, designation, photo_url, department_id, departments(name)")
        .ilike("employee_code", code)
        .eq("status", "active")
        .maybeSingle();

      if (emp) {
        const dummy: EnrolledPerson = {
          employee_id: emp.id,
          descriptor: [],
          name: emp.full_name,
          employee_code: emp.employee_code,
          department: (emp as any).departments?.name || "General",
          designation: emp.designation || "Staff",
          photo_url: emp.photo_url,
        };
        await handleFaceMatched(dummy, 1.0);
        setManualCodeOpen(false);
        setManualCode("");
        return;
      }

      // Legacy fallback
      const { data: person } = await supabase
        .from("people")
        .select("*")
        .ilike("person_code", code)
        .eq("active", true)
        .maybeSingle();

      if (person) {
        const dummy: EnrolledPerson = {
          employee_id: person.id,
          descriptor: [],
          name: person.name,
          employee_code: person.person_code,
          department: person.department || "General",
          designation: "Staff",
          photo_url: person.photo_url,
        };
        await handleFaceMatched(dummy, 1.0);
        setManualCodeOpen(false);
        setManualCode("");
      } else {
        toast.error(`No active employee found with code "${code}"`);
      }
    } catch (e: any) {
      toast.error(e.message || "Manual check-in/out failed");
    } finally {
      setManualSearching(false);
    }
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-white select-none">
      {/* Top Header Bar */}
      <header className="z-20 flex items-center justify-between border-b border-white/10 bg-black/60 px-5 py-3 backdrop-blur-md">
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

          <div className="hidden sm:flex items-center gap-3 border-l border-white/10 pl-3">
            <BrandLogo variant="horizontal" size="sm" />
            <span className="text-[10px] text-emerald-400 font-medium tracking-wide bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Terminal
            </span>
          </div>
        </div>

        {/* Center Clock */}
        <div className="text-center">
          <div className="font-mono text-xl font-bold tracking-tight sm:text-2xl">
            {currentTime.toLocaleTimeString()}
          </div>
          <div className="text-[11px] text-white/60 uppercase tracking-widest font-medium">
            {currentTime.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Mode Selector, Threshold, & Sound */}
        <div className="flex items-center gap-2">
          {/* Smart In/Out Mode Toggle */}
          <div className="flex rounded-lg bg-white/10 p-1 border border-white/5">
            <Button
              size="sm"
              variant={mode === "auto" ? "secondary" : "ghost"}
              className={`h-7 px-2.5 text-xs transition-all ${
                mode === "auto"
                  ? "bg-emerald-500 text-white font-semibold shadow-sm hover:bg-emerald-600"
                  : "text-white/80 hover:bg-white/10"
              }`}
              onClick={() => setMode("auto")}
              title="Smart mode: automatically checks in on first scan, and checks out after 2-3 minutes"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Auto
            </Button>
            <Button
              size="sm"
              variant={mode === "in" ? "secondary" : "ghost"}
              className={`h-7 px-2.5 text-xs transition-all ${
                mode === "in"
                  ? "bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700"
                  : "text-white/80 hover:bg-white/10"
              }`}
              onClick={() => setMode("in")}
            >
              <LogIn className="h-3 w-3 mr-1" />
              Check In
            </Button>
            <Button
              size="sm"
              variant={mode === "out" ? "secondary" : "ghost"}
              className={`h-7 px-2.5 text-xs transition-all ${
                mode === "out"
                  ? "bg-indigo-600 text-white font-semibold shadow-sm hover:bg-indigo-700"
                  : "text-white/80 hover:bg-white/10"
              }`}
              onClick={() => setMode("out")}
            >
              <LogOut className="h-3 w-3 mr-1" />
              Check Out
            </Button>
          </div>

          {/* Accuracy Preset Toggle */}
          <div className="hidden lg:flex items-center rounded-lg bg-white/10 p-0.5 border border-white/5 text-[11px]">
            <button
              onClick={() => setThresholdPreset("strict")}
              className={`px-2 py-1 rounded font-medium ${
                thresholdPreset === "strict" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
              }`}
              title="Strict matching threshold (0.42)"
            >
              Strict
            </button>
            <button
              onClick={() => setThresholdPreset("balanced")}
              className={`px-2 py-1 rounded font-medium ${
                thresholdPreset === "balanced" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
              }`}
              title="Balanced threshold (0.48)"
            >
              Balanced
            </button>
            <button
              onClick={() => setThresholdPreset("fast")}
              className={`px-2 py-1 rounded font-medium ${
                thresholdPreset === "fast" ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
              }`}
              title="Fast threshold (0.52)"
            >
              Fast
            </button>
          </div>

          {/* Sound Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/80 hover:bg-white/10"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label="Toggle sound"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          {/* Manual ID fallback */}
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

        {/* Overlay Canvas for detection bounding boxes and targeting HUD */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none scale-x-[-1] h-full w-full object-cover"
        />

        {/* Hardware Initialization loading state */}
        {(!modelReady || !cameraActive) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 text-white z-10">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h3 className="mt-4 text-lg font-semibold tracking-tight">Initializing Biometric Terminal</h3>
            <p className="mt-1 text-xs text-white/60 max-w-xs text-center">
              Initializing camera and biometric scanner...
            </p>
          </div>
        )}

        {/* Center Target Reticle & Visual Guidance */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="relative h-72 w-72 sm:h-84 sm:w-84 rounded-3xl border border-white/20 shadow-glow transition-all">
            {/* Corner highlights */}
            <div className="absolute -top-1.5 -left-1.5 h-7 w-7 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl" />
            <div className="absolute -top-1.5 -right-1.5 h-7 w-7 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl" />
            <div className="absolute -bottom-1.5 -left-1.5 h-7 w-7 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl" />
            <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 border-b-3 border-r-3 border-emerald-400 rounded-br-xl" />

            {/* Scanning line animation */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-75 animate-bounce" />
          </div>

          <div className="mt-6 rounded-full bg-black/70 px-5 py-2 backdrop-blur-md border border-white/10 text-center shadow-lg">
            <p className="text-xs font-semibold tracking-wide text-white/90">
              Align your face inside the frame
            </p>
            <p className="text-[11px] text-white/60 mt-0.5">
              {enrolledPeople.length} verified employee faces enrolled
            </p>
          </div>
        </div>

        {/* Big Interactive Notification Pop-up */}
        {activeNotification && (
          <div className="absolute top-6 z-30 flex animate-in fade-in slide-in-from-top-6 duration-300">
            <div
              className={`flex items-center gap-4 rounded-2xl border px-6 py-4 backdrop-blur-2xl shadow-2xl ${
                activeNotification.type === "in"
                  ? "border-emerald-500/50 bg-black/85"
                  : activeNotification.type === "out"
                    ? "border-indigo-500/50 bg-black/85"
                    : "border-amber-500/50 bg-black/85"
              }`}
            >
              {/* Avatar / Icon */}
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md ${
                  activeNotification.type === "in"
                    ? "bg-emerald-500 text-white"
                    : activeNotification.type === "out"
                      ? "bg-indigo-600 text-white"
                      : "bg-amber-500 text-black"
                }`}
              >
                {activeNotification.type === "in" ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : activeNotification.type === "out" ? (
                  <LogOut className="h-8 w-8" />
                ) : (
                  <Clock className="h-8 w-8" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {activeNotification.name}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                      activeNotification.type === "in"
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                        : activeNotification.type === "out"
                          ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-400"
                          : "border-amber-500/50 bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {activeNotification.type === "in"
                      ? "CHECKED IN"
                      : activeNotification.type === "out"
                        ? "CHECKED OUT"
                        : "ALREADY LOGGED"}
                  </Badge>
                </div>

                <p className="text-xs text-white/70 mt-1">
                  <span className="font-mono font-medium text-white/90">
                    {activeNotification.employee_code}
                  </span>{" "}
                  • {activeNotification.department} • {activeNotification.time}
                </p>

                {activeNotification.message ? (
                  <p className="text-xs font-semibold text-amber-300 mt-1 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 inline shrink-0" />
                    {activeNotification.message}
                  </p>
                ) : (
                  <p
                    className={`text-[11px] font-medium mt-1 ${
                      activeNotification.type === "in" ? "text-emerald-400" : "text-indigo-400"
                    }`}
                  >
                    Biometrically verified ({activeNotification.confidence}% match confidence)
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile ID Fallback Button */}
        <div className="absolute bottom-20 sm:bottom-24 z-20 md:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setManualCodeOpen(true)}
            className="rounded-full shadow-lg gap-2 text-xs"
          >
            <Keyboard className="h-4 w-4" />
            Enter Employee ID
          </Button>
        </div>
      </div>

      {/* Bottom Live Scan Activity Ticker */}
      <footer className="z-20 border-t border-white/10 bg-black/80 px-6 py-2.5 backdrop-blur-md">
        <div className="flex items-center justify-between text-xs text-white/70">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">Live Kiosk Terminal</span>
            <span className="text-white/40">•</span>
            <span className="text-white/80">
              Mode: <strong className="text-emerald-400 uppercase">{mode}</strong> (2.5m anti-double-scan cooldown)
            </span>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto">
            {recentScans.slice(0, 4).map((scan) => (
              <div key={scan.id} className="flex items-center gap-2 whitespace-nowrap text-[11px]">
                <span className="font-semibold text-white">{scan.name}</span>
                <span className="text-white/50">{scan.time}</span>
                <Badge
                  variant="outline"
                  className={`px-1.5 text-[9px] uppercase font-bold ${
                    scan.type === "in"
                      ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                      : "border-indigo-500/40 text-indigo-400 bg-indigo-500/10"
                  }`}
                >
                  {scan.type === "in" ? "IN" : "OUT"}
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
            <DialogTitle>Enter Employee ID Code</DialogTitle>
            <DialogDescription className="text-white/60">
              Manual check-in/out without facial recognition.
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
              {manualSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
