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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { MapLibreGeofenceMap, type MapCoordinates } from "@/components/map/maplibre-geofence-map";
import { searchAddressWithOSM, type GeocodingResult } from "@/lib/map-utils";
import { getCurrentDevicePosition } from "@/lib/geofence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RADIUS_PRESETS = [50, 100, 150, 200, 250, 300, 500];

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

  // Address Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // GPS auto-detect state
  const [detectingGps, setDetectingGps] = useState(false);

  // Staff Assignment Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [savingStaff, setSavingStaff] = useState(false);

  // Delete confirmation modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // 1. Fetch work locations with stats
  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["work-locations-stats", session.organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_location_stats" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) {
        // Fallback to base work_locations table if view not queried
        const { data: fallback, error: fbErr } = await supabase
          .from("work_locations")
          .select("*")
          .order("created_at", { ascending: true });
        if (fbErr) throw fbErr;
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

  // Select first location initially if none selected
  useEffect(() => {
    if (!selectedLocId && locations.length > 0 && !isCreatingNew) {
      const first = locations[0];
      if (first) {
        setSelectedLocId(first.id);
        setName(first.name);
        setAddress(first.address || "");
        updateCoords(first.latitude, first.longitude);
        setRadius(first.radius_meters);
        setIsActive(first.is_active);
        setIsDirty(false);
      }
    }
  }, [isCreatingNew, locations, selectedLocId, updateCoords]);

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
  }, [updateCoords]);

  // Start new office creation
  const handleStartCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedLocId(null);
    setName("");
    setAddress("");
    // Default to existing HQ coordinates or current user position
    const firstLoc = locations[0];
    if (firstLoc) {
      updateCoords(firstLoc.latitude + 0.005, firstLoc.longitude + 0.005);
    }
    setRadius(150);
    setIsActive(true);
    setIsDirty(true);
  };

  // Sync coordinates when map marker moves
  const handleMapCoordinatesChange = useCallback((coords: MapCoordinates) => {
    updateCoords(coords.lat, coords.lng);
    setIsDirty(true);
  }, [updateCoords]);

  // Handle address search
  const handleExecuteSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchAddressWithOSM(searchQuery);
    setSearchResults(results);
    setSearching(false);
    setShowSearchDropdown(results.length > 0);
    if (results.length === 0) {
      toast.info("No matching locations found for that address query.");
    }
  };

  const handleSelectSearchResult = (res: GeocodingResult) => {
    updateCoords(res.latitude, res.longitude);
    if (!address) {
      setAddress(res.displayName);
    }
    setIsDirty(true);
    setShowSearchDropdown(false);
    setSearchQuery("");
    toast.success(`Positioned map to: ${res.displayName.split(",")[0]}`);
  };

  // Handle detect device GPS
  const handleDetectCurrentGps = async () => {
    setDetectingGps(true);
    try {
      const pos = await getCurrentDevicePosition();
      updateCoords(pos.latitude, pos.longitude);
      setIsDirty(true);
      toast.success(`Acquired current coordinates (±${Math.round(pos.accuracy)}m accuracy)`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to detect location");
    } finally {
      setDetectingGps(false);
    }
  };

  // Save Mutation (Insert or Update)
  const saveLocationMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Office location name is required");
      if (!isFinite(lat) || !isFinite(lng)) throw new Error("Valid coordinates are required");

      const orgId = session.organizationId || "00000000-0000-0000-0000-000000000001";

      if (isCreatingNew || !selectedLocId) {
        // Insert
        const { data, error } = await supabase
          .from("work_locations")
          .insert({
            organization_id: orgId,
            name: name.trim(),
            address: address.trim() || null,
            latitude: lat,
            longitude: lng,
            radius_meters: radius,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        return { id: data.id, action: "created" };
      } else {
        // Update
        const { error } = await supabase
          .from("work_locations")
          .update({
            name: name.trim(),
            address: address.trim() || null,
            latitude: lat,
            longitude: lng,
            radius_meters: radius,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedLocId);
        if (error) throw error;
        return { id: selectedLocId, action: "updated" };
      }
    },
    onSuccess: (data) => {
      toast.success(
        data.action === "created"
          ? "New office location registered successfully!"
          : "Office location and geofence updated!",
      );
      setIsDirty(false);
      setIsCreatingNew(false);
      setSelectedLocId(data.id);
      queryClient.invalidateQueries({ queryKey: ["work-locations-stats"] });
      queryClient.invalidateQueries({ queryKey: ["work-locations-settings"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save office location");
    },
  });

  // Delete Mutation
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Office location removed");
      setDeleteConfirmOpen(false);
      setSelectedLocId(null);
      setIsCreatingNew(false);
      queryClient.invalidateQueries({ queryKey: ["work-locations-stats"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove office location");
    },
  });

  // Staff Assignment Handlers
  const handleOpenStaffModal = () => {
    if (!selectedLocId) return;
    // Pre-populate with currently assigned staff IDs
    const assignedIds = allEmployees
      .filter((e) => e.work_location_id === selectedLocId)
      .map((e) => e.id);
    setSelectedStaffIds(assignedIds);
    setStaffModalOpen(true);
  };

  const handleToggleStaffSelection = (empId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId],
    );
  };

  const handleSaveStaffAssignments = async () => {
    if (!selectedLocId) return;
    setSavingStaff(true);
    try {
      const { error } = await supabase.rpc("assign_employees_to_work_location", {
        p_location_id: selectedLocId,
        p_employee_ids: selectedStaffIds,
      });
      if (error) throw error;
      toast.success(`Assigned ${selectedStaffIds.length} employees to this office location!`);
      setStaffModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["work-locations-stats"] });
      queryClient.invalidateQueries({ queryKey: ["all-organization-employees"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update employee assignments");
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
        (e.departments?.name && e.departments.name.toLowerCase().includes(q)),
    );
  }, [allEmployees, staffSearch]);

  const selectedLocation = locations.find((l) => l.id === selectedLocId);

  return (
    <div className="space-y-5">
      {/* Top Bar: Office Switcher & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Branch Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {locationsLoading ? (
            <Skeleton className="h-9 w-48 rounded-xl" />
          ) : (
            locations.map((loc) => {
              const isSelected = !isCreatingNew && loc.id === selectedLocId;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSelectLocation(loc)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card text-muted-foreground hover:bg-accent border-border"
                  }`}
                >
                  <Building className="h-3.5 w-3.5 shrink-0" />
                  <span>{loc.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1 py-0 h-4 border-none ${
                      isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {loc.assigned_employee_count ?? 0} staff
                  </Badge>
                </button>
              );
            })
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStartCreateNew}
            className={`h-8 gap-1.5 text-xs rounded-xl shrink-0 ${
              isCreatingNew ? "border-primary bg-primary/10 text-primary font-bold" : ""
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Office</span>
          </Button>
        </div>

        {/* Address Search Box */}
        <div className="relative w-full lg:w-80">
          <div className="flex items-center gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search city, address or landmark..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExecuteSearch()}
                className="pl-8 h-8 text-xs rounded-xl"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleExecuteSearch}
              disabled={searching || !searchQuery.trim()}
              className="h-8 text-xs px-2.5 rounded-xl"
            >
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Go"}
            </Button>
          </div>

          {/* Search Results Dropdown */}
          {showSearchDropdown && (
            <div className="absolute top-10 left-0 right-0 z-50 bg-popover border border-border rounded-xl shadow-lg p-1.5 space-y-1 max-h-56 overflow-y-auto text-xs">
              {searchResults.map((res) => (
                <button
                  key={res.placeId}
                  type="button"
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full text-left p-2 rounded-lg hover:bg-accent hover:text-accent-foreground text-xs flex items-start gap-2"
                >
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{res.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Grid: Interactive Map + Configuration Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Interactive Map (Left / Top on Mobile) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-2">
          <MapLibreGeofenceMap
            center={[lng, lat]}
            radiusMeters={radius}
            interactive={true}
            markerDraggable={true}
            onCoordinatesChange={handleMapCoordinatesChange}
            officeLocations={locations}
            selectedLocationId={selectedLocId}
            onSelectLocation={(id) => {
              const target = locations.find((l) => l.id === id);
              if (target) handleSelectLocation(target);
            }}
            height="55vh"
            className="shadow-sm border-primary/20"
          />

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 text-primary" />
              Click anywhere on the map or drag the indigo marker to position your office.
            </span>
            <span className="hidden sm:inline font-mono">
              Center: {lat.toFixed(5)}°, {lng.toFixed(5)}°
            </span>
          </div>
        </div>

        {/* Location Details & Geofence Editor (Right / Bottom on Mobile) */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                <span>{isCreatingNew ? "Create Office Location" : name || "Office Details"}</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isCreatingNew
                  ? "Configure coordinates and circular geofence"
                  : "Edit coordinates, radius and assigned staff"}
              </p>
            </div>

            {selectedLocation && !isCreatingNew && (
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                }`}
              >
                {isActive ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs">Office Campus Name *</Label>
              <Input
                placeholder="e.g. Pune Innovation Tower B"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setIsDirty(true);
                }}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Address / Floor Description</Label>
              <Input
                placeholder="e.g. 4th Floor, Senapati Bapat Road, Shivaji Nagar"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setIsDirty(true);
                }}
                className="h-9 text-xs"
              />
            </div>

            {/* Coordinates Section with GPS auto-detect */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-primary" />
                  Exact GPS Coordinates
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDetectCurrentGps}
                  disabled={detectingGps}
                  className="h-7 text-[11px] gap-1 px-2 rounded-lg"
                >
                  <Navigation
                    className={`h-3 w-3 ${detectingGps ? "animate-spin text-primary" : ""}`}
                  />
                  {detectingGps ? "Detecting..." : "Use My GPS"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Latitude (° N)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={latStr}
                    onChange={(e) => handleLatInputChange(e.target.value)}
                    placeholder="e.g. 18.520400"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Longitude (° E)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={lngStr}
                    onChange={(e) => handleLngInputChange(e.target.value)}
                    placeholder="e.g. 73.856700"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Geofence Radius Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label className="font-semibold text-xs flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-primary" />
                  Geofence Radius
                </Label>
                <span className="font-mono font-bold text-primary text-xs">{radius} meters</span>
              </div>

              {/* Radius Preset Pills */}
              <div className="flex flex-wrap gap-1.5">
                {RADIUS_PRESETS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setRadius(r);
                      setIsDirty(true);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      radius === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground hover:bg-accent border-border"
                    }`}
                  >
                    {r}m
                  </button>
                ))}
              </div>

              <div className="pt-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={20}
                  max={2000}
                  step={10}
                  value={radius}
                  onChange={(e) => {
                    setRadius(parseInt(e.target.value) || 150);
                    setIsDirty(true);
                  }}
                  className="h-8 text-xs font-mono w-28"
                />
                <span className="text-[11px] text-muted-foreground">Custom radius (50m–1000m)</span>
              </div>
            </div>

            {/* Location Status Switch */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium">Operational Status</Label>
                <p className="text-[11px] text-muted-foreground">
                  Allow employees to check in at this office
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(val) => {
                  setIsActive(val);
                  setIsDirty(true);
                }}
              />
            </div>

            {/* Staff Assignment Summary Button */}
            {!isCreatingNew && selectedLocation && (
              <div className="pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenStaffModal}
                  className="w-full justify-between h-9 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>Assigned Workforce</span>
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedLocation.assigned_employee_count ?? 0} assigned
                  </Badge>
                </Button>
              </div>
            )}
          </div>

          {/* Action Buttons: Save, Cancel & Delete */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
            {!isCreatingNew && selectedLocation ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                className="h-9 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              {isDirty && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedLocation) {
                      handleSelectLocation(selectedLocation);
                    } else {
                      setIsCreatingNew(false);
                    }
                  }}
                  disabled={saveLocationMutation.isPending}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                onClick={() => saveLocationMutation.mutate()}
                disabled={saveLocationMutation.isPending || !name.trim()}
                className="h-9 text-xs gap-1.5 shadow-sm"
              >
                {saveLocationMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>{isCreatingNew ? "Save New Office" : "Save Changes"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Assign Employees to Location */}
      <Dialog open={staffModalOpen} onOpenChange={setStaffModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              <span>Assign Staff to {name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select employees permitted to mark attendance within this office geofence.
            </DialogDescription>
          </DialogHeader>

          {/* Search Box */}
          <div className="py-2">
            <Input
              placeholder="Filter by employee name, code, or department..."
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Employees List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60 border rounded-xl max-h-72">
            {employeesLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                Loading employee directory...
              </div>
            ) : filteredStaffList.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No matching employees found.
              </div>
            ) : (
              filteredStaffList.map((emp) => {
                const isAssigned = selectedStaffIds.includes(emp.id);
                return (
                  <div
                    key={emp.id}
                    onClick={() => handleToggleStaffSelection(emp.id)}
                    className="flex items-center justify-between p-2.5 hover:bg-muted/40 cursor-pointer text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span>{emp.full_name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {emp.employee_code}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {emp.designation || "Staff"} • {emp.departments?.name || "General"}
                      </p>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isAssigned
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border bg-background"
                      }`}
                    >
                      {isAssigned && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-muted-foreground">
                {selectedStaffIds.length} of {allEmployees.length} employees selected
              </span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStaffModalOpen(false)}
                  disabled={savingStaff}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveStaffAssignments}
                  disabled={savingStaff}
                  className="text-xs gap-1.5"
                >
                  {savingStaff && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Assignments
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Delete Location Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Remove Office Location</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to remove <strong>"{name}"</strong>? Any employees assigned to
              this location will need to be reassigned to another active branch.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleteLocationMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => selectedLocId && deleteLocationMutation.mutate(selectedLocId)}
              disabled={deleteLocationMutation.isPending}
              className="gap-1.5"
            >
              {deleteLocationMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Yes, Remove Office
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
