import { useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScanFace,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ArrowRight,
  ShieldCheck,
  User,
  RefreshCw,
  Sliders,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { loadFaceApi, detectOptions, averageDescriptors } from "@/lib/face";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/enroll")({
  head: () => ({
    meta: [
      { title: "Face Enrollment — Flowpeople by Fluxora" },
      { name: "description", content: "Biometric facial profile enrollment studio." },
    ],
  }),
  component: FaceEnrollPage,
});

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
  department: string;
  designation: string;
  photo_url: string | null;
  has_face: boolean;
}

function FaceEnrollPage() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [modelLoading, setModelLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [capturedThumb, setCapturedThumb] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch employees list
  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ["enroll-employees-list"],
    queryFn: async () => {
      const [{ data: emps }, { data: faces }] = await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, employee_code, designation, photo_url, departments(name)")
          .eq("status", "active")
          .order("full_name"),
        supabase.from("face_descriptors").select("person_id"),
      ]);

      const faceSet = new Set((faces || []).map((f) => f.person_id));

      return (emps || []).map((e: any) => ({
        id: e.id,
        full_name: e.full_name,
        employee_code: e.employee_code,
        department: e.departments?.name || "General",
        designation: e.designation || "Staff",
        photo_url: e.photo_url,
        has_face: faceSet.has(e.id),
      })) as EmployeeOption[];
    },
  });

  const selectedEmployee = employees.find((e) => e.id === selectedEmpId);

  // Initialize face-api models and webcam stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number;
    let isMounted = true;

    async function initCamera() {
      try {
        setModelLoading(true);
        const faceapi = await loadFaceApi();
        if (!isMounted) return;
        setModelLoading(false);

        if (!navigator.mediaDevices?.getUserMedia) {
          toast.error("Camera access is not supported or requires HTTPS/localhost.");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
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

          const renderLoop = async () => {
            if (!isMounted) return;

            if (videoRef.current && canvasRef.current && !videoRef.current.paused && !videoRef.current.ended) {
              try {
                const detection = await faceapi
                  .detectSingleFace(videoRef.current, options)
                  .withFaceLandmarks()
                  .withFaceDescriptor();

                if (detection) {
                  setFaceDetected(true);
                  const displaySize = {
                    width: videoRef.current.videoWidth || 640,
                    height: videoRef.current.videoHeight || 480,
                  };
                  faceapi.matchDimensions(canvasRef.current, displaySize);
                  const resized = faceapi.resizeResults(detection, displaySize);
                  const ctx = canvasRef.current.getContext("2d");
                  if (ctx) {
                    ctx.clearRect(0, 0, displaySize.width, displaySize.height);
                    faceapi.draw.drawDetections(canvasRef.current, resized);
                  }
                } else {
                  setFaceDetected(false);
                  const ctx = canvasRef.current?.getContext("2d");
                  if (ctx && canvasRef.current) {
                    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  }
                }
              } catch (e) {
                // Ignore transient frame skips
              }
            }

            animId = requestAnimationFrame(renderLoop);
          };

          animId = requestAnimationFrame(renderLoop);
        }
      } catch (err: any) {
        console.error("Camera init error:", err);
        toast.error("Unable to access camera or load biometric models: " + (err.message || ""));
        setModelLoading(false);
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Capture face vector sample
  async function handleCapture() {
    if (!videoRef.current || detecting) return;
    if (!selectedEmpId) {
      toast.warning("Please select an employee first.");
      return;
    }

    try {
      setDetecting(true);
      const faceapi = await loadFaceApi();
      const options = detectOptions(faceapi, 320);
      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        toast.error("No face detected! Center your face in the camera frame.");
        return;
      }

      // Create snapshot thumbnail
      const snapCanvas = document.createElement("canvas");
      snapCanvas.width = videoRef.current.videoWidth || 320;
      snapCanvas.height = videoRef.current.videoHeight || 240;
      const snapCtx = snapCanvas.getContext("2d");
      if (snapCtx) {
        snapCtx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
        setCapturedThumb(snapCanvas.toDataURL("image/jpeg", 0.85));
      }

      const descriptorArr = Array.from(result.descriptor);
      setSamples((prev) => [...prev, descriptorArr]);
      toast.success(`Face Sample ${samples.length + 1} captured!`);
    } catch (e: any) {
      toast.error("Failed to capture face sample: " + e.message);
    } finally {
      setDetecting(false);
    }
  }

  // Save biometric profile to database
  async function handleSaveProfile() {
    if (!selectedEmpId) {
      toast.error("Please select an employee.");
      return;
    }
    if (samples.length === 0) {
      toast.error("Capture at least 1 face sample before saving.");
      return;
    }

    try {
      setSaving(true);
      const avgDesc = averageDescriptors(samples);

      // 1. Save to face_descriptors
      await supabase.from("face_descriptors").upsert({
        person_id: selectedEmpId,
        descriptor: avgDesc,
        samples: samples.length,
        updated_at: new Date().toISOString(),
      });

      // 2. Save to face_data for kiosk compatibility
      await supabase.from("face_data").upsert(
        {
          employee_id: selectedEmpId,
          descriptor: avgDesc,
        },
        { onConflict: "employee_id" },
      );

      // 3. Update photo thumbnail in employees table
      if (capturedThumb) {
        await Promise.all([
          supabase.from("employees").update({ photo_url: capturedThumb }).eq("id", selectedEmpId),
          supabase.from("people").update({ photo_url: capturedThumb }).eq("id", selectedEmpId),
        ]);
      }

      toast.success(`Biometric face profile saved for ${selectedEmployee?.full_name}!`);
      setSamples([]);
      setCapturedThumb(null);
      queryClient.invalidateQueries({ queryKey: ["enroll-employees-list"] });
      queryClient.invalidateQueries({ queryKey: ["kiosk-enrolled-descriptors"] });
      queryClient.invalidateQueries({ queryKey: ["people-list"] });
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error("Failed to save biometric profile: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ScanFace className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Face Enrollment Studio</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture biometric face samples to enable instant recognition at the smart kiosk terminal.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate({ to: "/kiosk" })}
          className="gap-2 text-xs"
        >
          Open Smart Kiosk <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Camera Viewport */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="card-soft overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Camera className="h-4 w-4 text-primary" /> Live Biometric Viewfinder
                </CardTitle>
                {faceDetected ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 gap-1 text-[11px]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Face Locked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-muted text-muted-foreground text-[11px]">
                    Searching for face...
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lg">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="h-full w-full object-cover scale-x-[-1]"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none scale-x-[-1] h-full w-full object-cover"
                />

                {/* Loading state */}
                {modelLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white z-10">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="mt-3 text-xs text-white/80">Loading Biometric Recognition Models...</p>
                  </div>
                )}

                {/* Target Alignment Overlay Guide */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-56 w-56 rounded-full border-2 border-dashed border-white/40 shadow-glow" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Samples Captured: <strong className="text-foreground">{samples.length}</strong> / 3 recommended
                </div>

                <div className="flex items-center gap-2">
                  {samples.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSamples([]);
                        setCapturedThumb(null);
                      }}
                      className="text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                    </Button>
                  )}

                  <Button
                    onClick={handleCapture}
                    disabled={detecting || modelLoading || !cameraActive || !selectedEmpId}
                    className="gap-2 bg-primary shadow-glow hover:bg-primary/90 text-xs"
                  >
                    {detecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                    Capture Face Sample
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Employee Selection & Review */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="card-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Select Employee
              </CardTitle>
              <CardDescription>
                Choose the team member you wish to enroll.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={selectedEmpId} onValueChange={(val) => {
                  setSelectedEmpId(val);
                  setSamples([]);
                  setCapturedThumb(null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) {emp.has_face ? "✓" : "— Not Enrolled"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedEmployee && (
                <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    {selectedEmployee.has_face ? (
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px] gap-1">
                        <Check className="h-3 w-3" /> Already Enrolled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning-foreground text-[10px]">
                        Not Enrolled
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-semibold text-foreground">{selectedEmployee.department}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Designation:</span>
                    <span className="font-semibold text-foreground">{selectedEmployee.designation}</span>
                  </div>
                </div>
              )}

              {/* Sample preview thumbnails */}
              {capturedThumb && (
                <div className="space-y-2 border-t pt-3">
                  <Label className="text-xs">Latest Captured Profile Photo</Label>
                  <div className="flex items-center gap-3">
                    <img
                      src={capturedThumb}
                      alt="Captured Preview"
                      className="h-16 w-16 rounded-xl object-cover border-2 border-primary shadow-sm"
                    />
                    <div className="text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">Snapshot Ready</p>
                      <p>{samples.length} vector mathematical sample(s) registered.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="border-t pt-4">
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving || samples.length === 0 || !selectedEmpId}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-glow"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  Save Biometric Face Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
