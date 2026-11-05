import { useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Camera,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Edit2,
  Trash2,
  ScanFace,
  History,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Upload,
  RefreshCw,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  loadFaceApi,
  detectOptions,
  averageDescriptors,
} from "@/lib/face";
import {
  formatDate,
  formatTime,
  formatHours,
  totalHours,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/people")({
  head: () => ({
    meta: [
      { title: "Employees & Face Enrollment — Flowpeople by Fluxora" },
      { name: "description", content: "Manage employee roster and biometric face profiles." },
    ],
  }),
  component: PeoplePage,
});

interface PersonRow {
  id: string;
  name: string;
  person_code: string;
  department: string;
  email: string | null;
  phone: string | null;
  consent: boolean;
  active: boolean;
  photo_url: string | null;
  created_at: string;
}

interface FaceDescriptorRow {
  person_id: string;
  samples: number;
  updated_at: string;
}

function PeoplePage() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedFaceStatus, setSelectedFaceStatus] = useState("all");

  // Add / Edit Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    person_code: "",
    department: "General",
    email: "",
    password: "",
    phone: "",
    consent: true,
    active: true,
  });

  // Face Enrollment Modal state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollingPerson, setEnrollingPerson] = useState<PersonRow | null>(null);

  // History Sheet state
  const [historyPerson, setHistoryPerson] = useState<PersonRow | null>(null);

  // Query People
  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ["people-list", session.department],
    queryFn: async () => {
      let query = supabase.from("people").select("*").order("name");
      if (session.isManager && session.department) {
        query = query.eq("department", session.department);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });

  // Query Face Descriptors
  const { data: descriptors = [], isLoading: descLoading } = useQuery({
    queryKey: ["face-descriptors-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("face_descriptors")
        .select("person_id, samples, updated_at");
      if (error) throw error;
      return (data ?? []) as FaceDescriptorRow[];
    },
  });

  const descriptorMap = new Map(descriptors.map((d) => [d.person_id, d]));

  // Departments list
  const departments = Array.from(new Set(people.map((p) => p.department || "General"))).sort();

  // Filtered people
  const filteredPeople = people.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.person_code.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      p.department.toLowerCase().includes(q);

    const matchesDept = selectedDept === "all" || p.department === selectedDept;

    const hasFace = descriptorMap.has(p.id);
    const matchesFace =
      selectedFaceStatus === "all" ||
      (selectedFaceStatus === "enrolled" && hasFace) ||
      (selectedFaceStatus === "missing" && !hasFace);

    return matchesSearch && matchesDept && matchesFace;
  });

  // Save Person Mutation
  const savePersonMutation = useMutation({
    mutationFn: async () => {
      if (!formData.name.trim()) throw new Error("Name is required");

      if (editingPerson) {
        const { error } = await supabase
          .from("people")
          .update({
            name: formData.name.trim(),
            person_code: formData.person_code.trim(),
            department: formData.department,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            consent: formData.consent,
            active: formData.active,
          })
          .eq("id", editingPerson.id);
        if (error) throw error;
      } else {
        if (!formData.email.trim()) throw new Error("Email address is required for employee account");
        if (!formData.password || formData.password.trim().length < 6) {
          throw new Error("Password must be at least 6 characters for employee login");
        }

        const { data, error } = await supabase.rpc("admin_create_employee", {
          p_email: formData.email.trim().toLowerCase(),
          p_password: formData.password.trim(),
          p_full_name: formData.name.trim(),
          p_department: formData.department.trim() || "General",
          p_phone: formData.phone.trim() || null,
          p_person_code: formData.person_code.trim() || null,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast.success(editingPerson ? "Person updated" : `Personnel ${formData.name} added with login credentials`);
      setEditModalOpen(false);
      setEditingPerson(null);
      queryClient.invalidateQueries({ queryKey: ["people-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save person");
    },
  });

  // Delete Person Mutation
  const deletePersonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Person removed");
      queryClient.invalidateQueries({ queryKey: ["people-list"] });
      queryClient.invalidateQueries({ queryKey: ["face-descriptors-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove person");
    },
  });

  function openCreateModal() {
    setEditingPerson(null);
    setFormData({
      name: "",
      person_code: `EMP${String(people.length + 1).padStart(3, "0")}`,
      department: session.department || "General",
      email: "",
      password: "",
      phone: "",
      consent: true,
      active: true,
    });
    setEditModalOpen(true);
  }

  function openEditModal(person: PersonRow) {
    setEditingPerson(person);
    setFormData({
      name: person.name,
      person_code: person.person_code,
      department: person.department,
      email: person.email || "",
      password: "",
      phone: person.phone || "",
      consent: person.consent,
      active: person.active,
    });
    setEditModalOpen(true);
  }

  if (!session.loading && !session.isStaff) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-3" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Personnel directory and biometric face enrollment is restricted to administrative and management staff.
        </p>
        <Button className="mt-4" onClick={() => navigate({ to: "/dashboard" })}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Personnel & Faces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage employee rosters, facial biometric profiles, and consent.
          </p>
        </div>

        {session.isStaff && (
          <Button onClick={openCreateModal} className="gap-2 bg-primary shadow-glow hover:bg-primary/90">
            <UserPlus className="h-4 w-4" />
            Add Person
          </Button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID code, department, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedFaceStatus} onValueChange={setSelectedFaceStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Face Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Face Statuses</SelectItem>
              <SelectItem value="enrolled">Face Enrolled</SelectItem>
              <SelectItem value="missing">Missing Face</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Personnel Grid */}
      {peopleLoading || descLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : filteredPeople.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold">No personnel found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || selectedDept !== "all" || selectedFaceStatus !== "all"
              ? "Try adjusting your filters or search term."
              : "Get started by adding your first employee or student."}
          </p>
          {session.isStaff && (
            <Button onClick={openCreateModal} className="mt-4 gap-2">
              <UserPlus className="h-4 w-4" />
              Add Person
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((person) => {
            const faceDesc = descriptorMap.get(person.id);
            const isEnrolled = !!faceDesc;
            const initials = person.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <Card
                key={person.id}
                className="card-soft flex flex-col justify-between border-border/80 transition-all hover:border-primary/40"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {person.photo_url ? (
                        <img
                          src={person.photo_url}
                          alt={person.name}
                          className="h-12 w-12 rounded-2xl object-cover border"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-base font-bold text-primary">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base font-semibold">
                          {person.name}
                        </CardTitle>
                        <CardDescription className="truncate text-xs font-mono">
                          {person.person_code} • {person.department}
                        </CardDescription>
                      </div>
                    </div>

                    {session.isStaff && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEnrollingPerson(person);
                              setEnrollModalOpen(true);
                            }}
                          >
                            <ScanFace className="mr-2 h-4 w-4 text-primary" />
                            Enroll Face
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setHistoryPerson(person)}>
                            <History className="mr-2 h-4 w-4" />
                            Attendance History
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(person)}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm(`Remove ${person.name} from the system?`)) {
                                deletePersonMutation.mutate(person.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {person.email && <p className="truncate">✉️ {person.email}</p>}
                    {person.phone && <p className="truncate">📞 {person.phone}</p>}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    {/* Face status badge */}
                    {isEnrolled ? (
                      <Badge variant="outline" className="gap-1 border-success/30 bg-success/10 text-success text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Face Enrolled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-warning/30 bg-warning/10 text-warning-foreground text-[11px]">
                        <XCircle className="h-3.5 w-3.5" />
                        Not Enrolled
                      </Badge>
                    )}

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => {
                          setEnrollingPerson(person);
                          setEnrollModalOpen(true);
                        }}
                      >
                        <ScanFace className="h-3.5 w-3.5 text-primary" />
                        {isEnrolled ? "Re-scan" : "Enroll"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Person Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editingPerson ? "Edit Personnel" : "Add Personnel"}</DialogTitle>
            <DialogDescription>
              Enter individual details for attendance roster and biometric profile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input
                placeholder="e.g. Diya Patel"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Personnel Code / ID *</Label>
                <Input
                  placeholder="e.g. EMP002"
                  value={formData.person_code}
                  onChange={(e) => setFormData({ ...formData, person_code: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input
                  placeholder="e.g. Engineering"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{editingPerson ? "Email" : "Login Email *"}</Label>
                <Input
                  type="email"
                  placeholder="diya@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required={!editingPerson}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 98100 00000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            {!editingPerson && (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  <span>Portal Login Account Credentials</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Password * (min 6 characters)</Label>
                  <Input
                    type="password"
                    placeholder="Enter password for employee portal"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    The employee will sign in at /auth using this email & password to access their dedicated self-service portal.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="consent"
                checked={formData.consent}
                onCheckedChange={(c) => setFormData({ ...formData, consent: !!c })}
              />
              <label htmlFor="consent" className="text-xs text-muted-foreground leading-none">
                Biometric Consent: Person agrees to face recognition for attendance purposes.
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => savePersonMutation.mutate()} disabled={savePersonMutation.isPending}>
              {savePersonMutation.isPending ? "Saving..." : "Save Personnel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Face Enrollment Dialog */}
      {enrollingPerson && (
        <FaceEnrollmentDialog
          person={enrollingPerson}
          open={enrollModalOpen}
          onOpenChange={(open) => {
            setEnrollModalOpen(open);
            if (!open) setEnrollingPerson(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["face-descriptors-list"] });
            queryClient.invalidateQueries({ queryKey: ["people-list"] });
          }}
        />
      )}

      {/* Person Attendance History Sheet */}
      {historyPerson && (
        <PersonHistorySheet
          person={historyPerson}
          open={!!historyPerson}
          onOpenChange={(open) => {
            if (!open) setHistoryPerson(null);
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Face Enrollment Dialog Component
// ----------------------------------------------------------------------------
function FaceEnrollmentDialog({
  person,
  open,
  onOpenChange,
  onSuccess,
}: {
  person: PersonRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [streamActive, setStreamActive] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [capturedThumb, setCapturedThumb] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize face-api and camera
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animId: number;

    async function init() {
      try {
        setModelLoading(true);
        const faceapi = await loadFaceApi();
        setModelLoading(false);

        // Start video stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamActive(true);

          // Detection loop
          const options = detectOptions(faceapi);
          const loop = async () => {
            if (videoRef.current && canvasRef.current && !videoRef.current.paused) {
              const result = await faceapi
                .detectSingleFace(videoRef.current, options)
                .withFaceLandmarks()
                .withFaceDescriptor();

              if (result) {
                setFaceDetected(true);
                // Draw detection overlay
                const displaySize = {
                  width: videoRef.current.videoWidth || 480,
                  height: videoRef.current.videoHeight || 360,
                };
                faceapi.matchDimensions(canvasRef.current, displaySize);
                const resized = faceapi.resizeResults(result, displaySize);
                const ctx = canvasRef.current.getContext("2d");
                if (ctx) {
                  ctx.clearRect(0, 0, displaySize.width, displaySize.height);
                  faceapi.draw.drawDetections(canvasRef.current, resized);
                }
              } else {
                setFaceDetected(false);
                const ctx = canvasRef.current.getContext("2d");
                if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              }
            }
            animId = requestAnimationFrame(loop);
          };
          loop();
        }
      } catch (err) {
        console.error(err);
        toast.error("Could not access camera or load face recognition models");
        setModelLoading(false);
      }
    }

    if (open) {
      init();
    }

    return () => {
      cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  // Capture face sample
  async function captureSample() {
    if (!videoRef.current || detecting) return;
    try {
      setDetecting(true);
      const faceapi = await loadFaceApi();
      const options = detectOptions(faceapi);
      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        toast.warning("No face detected! Center your face in the camera frame.");
        setDetecting(false);
        return;
      }

      // Capture snapshot thumbnail
      const snapCanvas = document.createElement("canvas");
      snapCanvas.width = videoRef.current.videoWidth || 320;
      snapCanvas.height = videoRef.current.videoHeight || 240;
      const snapCtx = snapCanvas.getContext("2d");
      if (snapCtx) {
        snapCtx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
        setCapturedThumb(snapCanvas.toDataURL("image/jpeg", 0.8));
      }

      const descriptorArr = Array.from(result.descriptor);
      setSamples((prev) => [...prev, descriptorArr]);
      toast.success(`Sample ${samples.length + 1} captured!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to capture face sample");
    } finally {
      setDetecting(false);
    }
  }

  // Save averaged descriptors
  async function handleSave() {
    if (samples.length === 0) {
      toast.error("Capture at least one face sample before saving.");
      return;
    }

    try {
      setSaving(true);
      const avgDesc = averageDescriptors(samples);

      // Save to face_descriptors table
      const { error: descError } = await supabase.from("face_descriptors").upsert({
        person_id: person.id,
        descriptor: avgDesc,
        samples: samples.length,
        updated_at: new Date().toISOString(),
      });
      if (descError) console.warn("face_descriptors upsert error:", descError);

      // Also save to face_data table for kiosk compatibility
      try {
        await supabase.from("face_data").upsert(
          {
            employee_id: person.id,
            descriptor: avgDesc,
          },
          { onConflict: "employee_id" },
        );
      } catch (e) {
        // Fallback
      }

      // Update photo thumbnail if captured in both people and employees
      if (capturedThumb) {
        await Promise.all([
          supabase.from("people").update({ photo_url: capturedThumb }).eq("id", person.id),
          supabase.from("employees").update({ photo_url: capturedThumb }).eq("id", person.id),
        ]);
      }

      toast.success(`Face enrolled successfully for ${person.name}!`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save biometric profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" />
            Biometric Face Enrollment — {person.name}
          </DialogTitle>
          <DialogDescription>
            Look directly into the camera. Capture 1 to 3 face samples to build an accurate profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Camera Viewport */}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full object-cover scale-x-[-1]"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none scale-x-[-1]"
            />

            {modelLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-xs">Loading AI Face Models...</p>
              </div>
            )}

            {!modelLoading && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <Badge
                  variant="outline"
                  className={`backdrop-blur text-xs ${
                    faceDetected
                      ? "bg-success/20 text-success border-success/40"
                      : "bg-warning/20 text-warning-foreground border-warning/40"
                  }`}
                >
                  {faceDetected ? "Face Detected" : "Align Face in Center"}
                </Badge>

                <Badge variant="secondary" className="backdrop-blur text-xs">
                  {samples.length} / 3 Samples
                </Badge>
              </div>
            )}
          </div>

          {/* Sample Thumbnails Preview */}
          {samples.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              <span className="text-xs text-muted-foreground font-medium">Samples:</span>
              {samples.map((_, i) => (
                <div
                  key={i}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-xs font-bold text-primary"
                >
                  #{i + 1}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSamples([])}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={captureSample}
              disabled={modelLoading || detecting}
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              {detecting ? "Scanning..." : "Capture Face"}
            </Button>

            <Button
              onClick={handleSave}
              disabled={saving || samples.length === 0}
              className="gap-2 bg-primary shadow-glow"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Save Profile
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Person Attendance History Sheet
// ----------------------------------------------------------------------------
function PersonHistorySheet({
  person,
  open,
  onOpenChange,
}: {
  person: PersonRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["person-attendance-history", person.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("person_id", person.id)
        .order("date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const presentDays = history.filter((h) => h.status === "present").length;
  const lateDays = history.filter((h) => h.status === "late").length;
  const totalDays = history.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">{person.name}</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {person.person_code} • {person.department}
          </SheetDescription>
        </SheetHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-2 my-4">
          <div className="rounded-xl border p-2.5 text-center bg-card">
            <p className="text-xs text-muted-foreground">Logged</p>
            <p className="text-lg font-bold">{totalDays}</p>
          </div>
          <div className="rounded-xl border p-2.5 text-center bg-card">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="text-lg font-bold text-success">{presentDays}</p>
          </div>
          <div className="rounded-xl border p-2.5 text-center bg-card">
            <p className="text-xs text-muted-foreground">Late</p>
            <p className="text-lg font-bold text-warning-foreground">{lateDays}</p>
          </div>
        </div>

        {/* Records list */}
        <div className="space-y-2 mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent 30 Records
          </h4>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No records logged yet.</p>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 text-xs"
              >
                <div>
                  <p className="font-semibold">{formatDate(record.date)}</p>
                  <p className="text-muted-foreground font-mono">
                    In: {formatTime(record.check_in)}
                    {record.check_out && ` • Out: ${formatTime(record.check_out)}`}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STATUS_COLORS[record.status] || ""}`}
                  >
                    {STATUS_LABELS[record.status] || record.status}
                  </Badge>
                  {record.check_in && record.check_out && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatHours(totalHours(record.check_in, record.check_out))}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

