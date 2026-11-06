import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Building,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Navigation,
  Compass,
  Users,
  Search,
  Check,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Info,
  Sliders,
  Radio,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  getCurrentDevicePosition,
  validateCoordinates,
  formatCoordinates,
  getAccuracyCategory,
  type Coordinates,
} from "@/lib/geofence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RADIUS_PRESETS = [
  { value: 50, label: "50m (Floor/Room)" },
  { value: 100, label: "100m (Building)" },
  { value: 150, label: "150m (Standard Default)" },
  { value: 200, label: "200m (Campus)" },
  { value: 300, label: "300m (Facility)" },
  { value: 500, label: "500m (Large Area)" },
];

export interface WorkLocationEntity {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  assigned_employee_count?: number;
}

export function AdminLocationStudio() {
  const session = useSession();
  const queryClient = useQueryClient();

  // Active office selection
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form Editor State
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number>(18.5204);
  const [lng, setLng] = useState<number>(73.8567);
  const [latStr, setLatStr] = useState<string>("18.520400");
  const [lngStr, setLngStr] = useState<string>("73.856700");
  const [radius, setRadius] = useState<number>(150);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isDirty, setIsDirty] = useState(false);

  // Live GPS capture telemetry for Option B
  const [capturedGps, setCapturedGps] = useState<Coordinates | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);

  // Save Confirmation Dialog
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  // Staff Assignment Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [savingStaff, setSavingStaff] = useState(false);

  // Delete confirmation modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [locToDelete, setLocToDelete] = useState<WorkLocationEntity | null>(null);

  const updateCoords = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
    setLatStr(newLat.toFixed(6));
    setLngStr(newLng.toFixed(6));
  }, []);

  const handleLatInputChange = (value: string) => {
    setLatStr(value);
    setIsDirty(true);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= -90 && parsed <= 90) {
      setLat(parsed);
    }
  };

  const handleLngInputChange = (value: string) => {
    setLngStr(value);
    setIsDirty(true);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= -180 && parsed <= 180) {
      setLng(parsed);
    }
  };

  // 1. Fetch work locations from base table
  const { data: rawLocations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["work-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_locations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) {
        const { data: fallback, error: fbErr } = await supabase
          .from("work_location_stats" as any)
          .select("*")
          .order("created_at", { ascending: true });
        if (fbErr) throw error;
        return (fallback ?? []) as unknown as WorkLocationEntity[];
      }
      return (data ?? []) as unknown as WorkLocationEntity[];
    },
  });

  // 2. Fetch all employees for assignment modal
  const { data: allEmployees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["all-organization-employees", session.organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, full_name, employee_code, email, designation, work_location_id, departments(name)",
        )
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string;
        full_name: string;
        employee_code: string;
        email: string;
        designation: string | null;
        work_location_id: string | null;
        departments: { name: string } | null;
      }>;
    },
  });

  // Calculate live employee count per office
  const locations: WorkLocationEntity[] = useMemo(() => {
    return rawLocations.map((loc) => ({
      ...loc,
      assigned_employee_count: allEmployees.filter((e) => e.work_location_id === loc.id).length,
    }));
  }, [rawLocations, allEmployees]);

  // Sync form with selected location or select first office initially
  useEffect(() => {
    if (isCreatingNew) return;

    if (!selectedLocId && locations.length > 0) {
      const first = locations[0];
      if (first) {
        setSelectedLocId(first.id);
        setName(first.name);
        setAddress(first.address || "");
        updateCoords(first.latitude, first.longitude);
        setRadius(first.radius_meters);
        setIsActive(first.is_active);
        setIsDirty(false);
        setCapturedGps(null);
      }
      return;
    }

    if (selectedLocId && !isDirty) {
      const current = locations.find((l) => l.id === selectedLocId);
      if (current) {
        setName(current.name);
        setAddress(current.address || "");
        updateCoords(current.latitude, current.longitude);
        setRadius(current.radius_meters);
        setIsActive(current.is_active);
      }
    }
  }, [isCreatingNew, locations, selectedLocId, isDirty, updateCoords]);

  // Load selected location into editor
  const handleSelectLocation = useCallback((loc: WorkLocationEntity) => {
    setIsCreatingNew(false);
    setSelectedLocId(loc.id);
    setName(loc.name);
    setAddress(loc.address || "");
    updateCoords(loc.latitude, loc.longitude);
    setRadius(loc.radius_meters);
    setIsActive(loc.is_active);
    setIsDirty(false);
    setCapturedGps(null);
  }, [updateCoords]);

  // Start new office creation
  const handleStartCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedLocId(null);
    setName("");
    setAddress("");
    const firstLoc = locations[0];
    if (firstLoc) {
      updateCoords(firstLoc.latitude, firstLoc.longitude);
    } else {
      updateCoords(18.5204, 73.8567);
    }
    setRadius(150);
    setIsActive(true);
    setIsDirty(false);
    setCapturedGps(null);
  };

  // Option B: Capture Current Office Location live
  const handleCaptureCurrentLocation = async () => {
    setDetectingGps(true);
    try {
      const pos = await getCurrentDevicePosition();
      setCapturedGps(pos);
      updateCoords(pos.latitude, pos.longitude);
      setIsDirty(true);
      toast.success(
        `Captured Exact Office Coordinates: ${pos.latitude.toFixed(6)}°, ${pos.longitude.toFixed(6)}°`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to capture current location");
    } finally {
      setDetectingGps(false);
    }
  };

  // Validation
  const validationError = useMemo(() => {
    if (!name.trim()) return "Office name is required.";
    const coordVal = validateCoordinates(lat, lng);
    if (!coordVal.valid) return coordVal.reason;
    if (radius < 50 || radius > 500) return "Radius must be between 50m and 500m.";
    return null;
  }, [name, lat, lng, radius]);

  // Save Mutation with RPC + direct table fallback
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (validationError) throw new Error(validationError);

      const targetId = isCreatingNew ? null : selectedLocId;

      // 1. Try secure save_office_location RPC
      try {
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
          "save_office_location",
          {
            p_id: targetId || undefined,
            p_name: name.trim(),
            p_address: address.trim() || undefined,
            p_lat: lat,
            p_lon: lng,
            p_radius: radius,
            p_is_active: isActive,
          },
        );

        if (!rpcError && rpcData?.id) {
          return rpcData as WorkLocationEntity;
        }
        if (rpcError) {
          console.warn("[save_office_location RPC warn, using direct table fallback]", rpcError);
        }
      } catch (rpcEx) {
        console.warn("[save_office_location RPC catch, using direct table fallback]", rpcEx);
      }

      // 2. Direct table fallback if RPC fails
      const orgId = session.organizationId || "00000000-0000-0000-0000-000000000001";
      const payload = {
        organization_id: orgId,
        name: name.trim(),
        address: address.trim() || null,
        latitude: lat,
        longitude: lng,
        radius_meters: radius,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (isCreatingNew || !selectedLocId) {
        const { data, error } = await supabase
          .from("work_locations")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (error) throw new Error(error.message || "Failed to save location");
        return data as WorkLocationEntity;
      } else {
        const { data, error } = await supabase
          .from("work_locations")
          .update(payload)
          .eq("id", selectedLocId)
          .select()
          .single();
        if (error) throw new Error(error.message || "Failed to update location");
        return data as WorkLocationEntity;
      }
    },
    onSuccess: (savedLoc: any) => {
      const locId = savedLoc?.id || selectedLocId;
      toast.success(
        isCreatingNew
          ? `Created office location "${savedLoc.name}" with ${savedLoc.radius_meters}m geofence.`
          : `Updated office location "${savedLoc.name}".`,
      );
      setIsDirty(false);
      setConfirmSaveOpen(false);
      setIsCreatingNew(false);
      setCapturedGps(null);

      const normalized: WorkLocationEntity = {
        id: locId,
        organization_id: savedLoc.organization_id || session.organizationId || "00000000-0000-0000-0000-000000000001",
        name: savedLoc.name || name.trim(),
        address: savedLoc.address ?? (address.trim() || null),
        latitude: Number(savedLoc.latitude ?? lat),
        longitude: Number(savedLoc.longitude ?? lng),
        radius_meters: Number(savedLoc.radius_meters ?? radius),
        is_active: Boolean(savedLoc.is_active ?? isActive),
        created_at: savedLoc.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setSelectedLocId(locId);
      setName(normalized.name);
      setAddress(normalized.address || "");
      updateCoords(normalized.latitude, normalized.longitude);
      setRadius(normalized.radius_meters);
      setIsActive(normalized.is_active);

      queryClient.setQueryData<WorkLocationEntity[]>(["work-locations"], (old = []) => {
        const idx = old.findIndex((l) => l.id === locId);
        if (idx >= 0) {
          const next = [...old];
          next[idx] = { ...next[idx], ...normalized };
          return next;
        }
        return [...old, normalized];
      });

      queryClient.invalidateQueries({ queryKey: ["work-locations"] });
      queryClient.invalidateQueries({ queryKey: ["work-locations-stats"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save location");
    },
  });

  // Delete Mutation with RPC + direct fallback
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
          "delete_office_location",
          { p_id: id },
        );
        if (!rpcError && rpcData?.success) {
          return id;
        }
        if (rpcError) {
          console.warn("[delete_office_location RPC warn, using direct delete fallback]", rpcError);
        }
      } catch (rpcEx) {
        console.warn("[delete_office_location RPC catch, using direct delete fallback]", rpcEx);
      }

      const { error } = await supabase.from("work_locations").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      toast.success("Office location removed successfully.");
      setDeleteConfirmOpen(false);
      setLocToDelete(null);

      queryClient.setQueryData<WorkLocationEntity[]>(["work-locations"], (old = []) =>
        old.filter((l) => l.id !== deletedId),
      );
      queryClient.invalidateQueries({ queryKey: ["work-locations"] });
      queryClient.invalidateQueries({ queryKey: ["work-locations-stats"] });

      if (selectedLocId === deletedId) {
        setSelectedLocId(null);
        setIsCreatingNew(false);
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete location");
    },
  });

  // Open staff assignment modal
  const handleOpenStaffModal = () => {
    if (!selectedLocId) return;
    const currentlyAssigned = allEmployees
      .filter((e) => e.work_location_id === selectedLocId)
      .map((e) => e.id);
    setSelectedStaffIds(currentlyAssigned);
    setStaffSearch("");
    setStaffModalOpen(true);
  };

  // Save staff assignments
  const handleSaveStaffAssignments = async () => {
    if (!selectedLocId) return;
    setSavingStaff(true);
    try {
      const currentlyAssigned = allEmployees
        .filter((e) => e.work_location_id === selectedLocId)
        .map((e) => e.id);

      const toAdd = selectedStaffIds.filter((id) => !currentlyAssigned.includes(id));
      const toRemove = currentlyAssigned.filter((id) => !selectedStaffIds.includes(id));

      if (toAdd.length > 0) {
        const { error: addErr } = await supabase
          .from("employees")
          .update({ work_location_id: selectedLocId })
          .in("id", toAdd);
        if (addErr) throw addErr;
      }

      if (toRemove.length > 0) {
        const { error: remErr } = await supabase
          .from("employees")
          .update({ work_location_id: null })
          .in("id", toRemove);
        if (remErr) throw remErr;
      }

      toast.success(`Assigned ${selectedStaffIds.length} employees to this office location.`);
      setStaffModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["work-locations-stats"] });
      queryClient.invalidateQueries({ queryKey: ["all-organization-employees"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update staff assignments");
    } finally {
      setSavingStaff(false);
    }
  };

  const filteredStaffList = useMemo(() => {
    if (!staffSearch.trim()) return allEmployees;
    const q = staffSearch.toLowerCase();
    return allEmployees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.designation && e.designation.toLowerCase().includes(q)),
    );
  }, [allEmployees, staffSearch]);

  const selectedLocation = locations.find((l) => l.id === selectedLocId);

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Navigation className="h-6 w-6 text-primary" />
            <span>GPS Office Geofencing Studio</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure physical office coordinates and perimeter radii for backend-verified employee attendance. Zero map API dependency.
          </p>
        </div>

        <Button
          onClick={handleStartCreateNew}
          className="gap-1.5 shadow-xs text-xs font-semibold self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Office</span>
        </Button>
      </div>

      {/* Main Grid: Office List (Left) + Geofence Configuration Studio (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configured Offices Directory */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Offices ({locations.length})
            </span>
            <span className="text-[11px] text-muted-foreground">Select to edit</span>
          </div>

          {locationsLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : locations.length === 0 && !isCreatingNew ? (
            <Card className="border-dashed p-6 text-center text-muted-foreground">
              <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">No offices configured</p>
              <p className="text-xs mt-1">Add your organization's primary office to start geofencing.</p>
              <Button size="sm" onClick={handleStartCreateNew} className="mt-3 text-xs">
                Create First Office
              </Button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {isCreatingNew && (
                <div className="p-3.5 rounded-xl border-2 border-primary bg-primary/5 shadow-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      New Office (Draft)
                    </span>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                      Unsaved
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate font-medium">
                    {name || "Untitled Office"}
                  </p>
                </div>
              )}

              {locations.map((loc) => {
                const isSelected = !isCreatingNew && selectedLocId === loc.id;
                return (
                  <div
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left space-y-1.5 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20"
                        : "border-border hover:border-border/80 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <Building className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-xs font-bold text-foreground truncate">{loc.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={loc.is_active ? "secondary" : "outline"}
                          className={`text-[10px] font-medium ${
                            loc.is_active
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {loc.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {loc.radius_meters}m
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocToDelete(loc);
                            setDeleteConfirmOpen(true);
                          }}
                          className="h-6 w-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md p-0"
                          title={`Delete ${loc.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground truncate">
                      {loc.address || "No descriptive address"}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
                      <span>{loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°</span>
                      <span className="flex items-center gap-1 font-sans">
                        <Users className="h-3 w-3" />
                        {loc.assigned_employee_count ?? 0} staff
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: GPS Geofence Configuration Studio */}
        <div className="lg:col-span-8">
          <Card className="border border-border shadow-xs">
            <CardHeader className="bg-muted/30 pb-3 pt-4 px-4 sm:px-6 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Compass className="h-5 w-5 text-primary" />
                    <span>{isCreatingNew ? "Create New Office Geofence" : `Configuring: ${name || "Office"}`}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Set precise GPS coordinates and geofence perimeter radius.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {!isCreatingNew && selectedLocId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const cur = locations.find((l) => l.id === selectedLocId);
                        setLocToDelete(cur || null);
                        setDeleteConfirmOpen(true);
                      }}
                      className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => setConfirmSaveOpen(true)}
                    disabled={saveMutation.isPending || !!validationError}
                    className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>Save Location</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Office Name *</Label>
                  <Input
                    placeholder="e.g. Pune Headquarters, Mumbai Branch"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setIsDirty(true);
                    }}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Address / Landmark</Label>
                  <Input
                    placeholder="e.g. Senapati Bapat Road, Tower B, Level 4"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setIsDirty(true);
                    }}
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Coordinates Setting Section (Two Options) */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      Office Coordinates Configuration
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Choose between capturing your physical coordinates on-site or entering them manually.
                    </p>
                  </div>

                  {/* Option B: Capture Current Office Location Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCaptureCurrentLocation}
                    disabled={detectingGps}
                    className="h-8 text-xs gap-1.5 bg-background shadow-xs hover:bg-primary/5 hover:text-primary hover:border-primary/40 shrink-0"
                  >
                    <Radio className={`h-3.5 w-3.5 text-primary ${detectingGps ? "animate-spin" : ""}`} />
                    <span>{detectingGps ? "Acquiring GPS..." : "📍 Capture Current Office Location"}</span>
                  </Button>
                </div>

                {/* Live Capture Telemetry Feedback Banner */}
                {capturedGps && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100 flex items-center justify-between text-xs gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Live Coordinates Locked: <strong>{formatCoordinates(capturedGps.latitude, capturedGps.longitude)}</strong>
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-mono">
                      Exact Position Verified
                    </Badge>
                  </div>
                )}

                {/* Option A: Manual Coordinate Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Latitude (-90.0° to +90.0°)</span>
                      <span className="text-[10px] text-muted-foreground font-mono">WGS-84</span>
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 18.520430"
                      value={latStr}
                      onChange={(e) => handleLatInputChange(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center justify-between">
                      <span>Longitude (-180.0° to +180.0°)</span>
                      <span className="text-[10px] text-muted-foreground font-mono">WGS-84</span>
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 73.856743"
                      value={lngStr}
                      onChange={(e) => handleLngInputChange(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                  <span>Formatted Coordinates:</span>
                  <strong className="font-mono text-foreground">
                    {formatCoordinates(lat, lng)}
                  </strong>
                </div>
              </div>

              {/* Geofence Perimeter Radius Configuration */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-primary" />
                      Geofence Radius ({radius} meters)
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Allowed circular perimeter around the office coordinates. Employees must be inside to punch.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={50}
                      max={500}
                      step={10}
                      value={radius}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setRadius(Math.max(50, Math.min(500, val)));
                          setIsDirty(true);
                        }
                      }}
                      className="w-20 h-8 text-xs font-mono font-bold text-right"
                    />
                    <span className="text-xs text-muted-foreground">m</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                  {RADIUS_PRESETS.map((preset) => {
                    const isSelected = radius === preset.value;
                    return (
                      <Button
                        key={preset.value}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setRadius(preset.value);
                          setIsDirty(true);
                        }}
                        className={`h-8 text-xs font-medium ${
                          isSelected ? "shadow-xs" : "hover:bg-muted"
                        }`}
                      >
                        {preset.value}m
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Active Status & Staff Assignment Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/70">
                {/* Active Toggle */}
                <div className="p-3.5 rounded-xl border border-border flex items-center justify-between bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold cursor-pointer" htmlFor="active-switch">
                      Office Active Status
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Inactive offices reject all attendance punches.
                    </p>
                  </div>
                  <Switch
                    id="active-switch"
                    checked={isActive}
                    onCheckedChange={(val) => {
                      setIsActive(val);
                      setIsDirty(true);
                    }}
                  />
                </div>

                {/* Staff Assignment Trigger */}
                <div className="p-3.5 rounded-xl border border-border flex items-center justify-between bg-card">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Assigned Employees</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedLocation?.assigned_employee_count ?? 0} employees assigned to this office.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isCreatingNew || !selectedLocId}
                    onClick={handleOpenStaffModal}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Manage Staff</span>
                  </Button>
                </div>
              </div>

              {/* Validation Warning Alert */}
              {validationError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pre-Save Confirmation Dialog (Phase 4 Requirement) */}
      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>Confirm Office Geofence Configuration</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please review the coordinates and geofence parameters before saving to the production database.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2">
              <div className="flex justify-between py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Office Name:</span>
                <span className="font-bold text-foreground">{name.trim() || "--"}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-medium text-foreground truncate max-w-[200px]">
                  {address.trim() || "Not specified"}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Latitude:</span>
                <span className="font-mono font-bold text-foreground">{lat.toFixed(6)}°</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Longitude:</span>
                <span className="font-mono font-bold text-foreground">{lng.toFixed(6)}°</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Geofence Radius:</span>
                <Badge variant="outline" className="font-mono font-bold">
                  {radius} meters
                </Badge>
              </div>
              <div className="flex justify-between py-0.5 border-b border-border/40">
                <span className="text-muted-foreground">Coordinates Mode:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 font-semibold">
                  {capturedGps ? "Exact Live GPS Capture" : "Exact Manual Entry"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={isActive ? "bg-emerald-600 text-white" : "bg-muted"}>
                  {isActive ? "Active (Accepting Punches)" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmSaveOpen(false)}
              disabled={saveMutation.isPending}
            >
              Back to Edit
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-1.5"
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Assignment Modal */}
      <Dialog open={staffModalOpen} onOpenChange={setStaffModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span>Assign Staff to {name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select employees who are physically authorized to mark attendance inside this office geofence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search staff by name, code, email, or designation..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
              {filteredStaffList.map((emp) => {
                const isChecked = selectedStaffIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => {
                      if (isChecked) {
                        setSelectedStaffIds(selectedStaffIds.filter((id) => id !== emp.id));
                      } else {
                        setSelectedStaffIds([...selectedStaffIds, emp.id]);
                      }
                    }}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      isChecked
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="space-y-0.5 truncate">
                      <p className="font-semibold text-foreground truncate">{emp.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {emp.employee_code} • {emp.designation || "Staff"}
                      </p>
                    </div>

                    <div className="shrink-0 ml-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Controlled by row click
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStaffModalOpen(false)}
              disabled={savingStaff}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveStaffAssignments}
              disabled={savingStaff}
              className="gap-1.5"
            >
              {savingStaff && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Assignments ({selectedStaffIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Location Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Delete Office Location</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete <strong>{locToDelete?.name || name || "this office"}</strong>? Assigned employees will lose their office geofence assignment.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setLocToDelete(null);
              }}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const targetId = locToDelete?.id || selectedLocId;
                if (targetId) deleteMutation.mutate(targetId);
              }}
              disabled={deleteMutation.isPending}
              className="gap-1.5"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
