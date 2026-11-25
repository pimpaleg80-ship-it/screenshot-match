import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  LayoutGrid,
  List,
  Eye,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader, TableContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeeRegistrationDialog } from "@/components/employees/EmployeeRegistrationDialog";
import { EmployeeProfileDrawer } from "@/components/employees/EmployeeProfileDrawer";
import { CsvImportExport, CsvEmployeeRecord } from "@/components/employees/CsvImportExport";

export const Route = createFileRoute("/_authenticated/people")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Employee Management — Flowpeople by Fluxora" },
      { name: "description", content: "Manage employee roster, detailed 9-tab profiles, and geofence attendance." },
    ],
  }),
  component: PeoplePage,
});

interface PersonRow {
  id: string;
  name: string;
  person_code: string;
  department: string;
  designation?: string | null;
  email: string | null;
  phone: string | null;
  consent: boolean;
  active: boolean;
  status?: string;
  employment_type?: string | null;
  work_location?: string | null;
  joining_date?: string | null;
  photo_url: string | null;
  created_at: string;
}

function PeoplePage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Registration Dialog State
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  // 9-Tab Profile Drawer State
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Query People / Employees
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

  // Query Shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts-list"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("shifts").select("id, name");
      if (error) return [];
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  // Unique departments list
  const departments = Array.from(new Set(people.map((p) => p.department || "General"))).sort();

  // Existing employees list for manager dropdown
  const existingEmployeesList = people.map((p) => ({ id: p.id, name: `${p.name} (${p.person_code})` }));

  // Filtered people
  const filteredPeople = people.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.person_code.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.designation && p.designation.toLowerCase().includes(q)) ||
      p.department.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q));

    const matchesDept = selectedDept === "all" || p.department === selectedDept;

    const matchesType =
      selectedType === "all" ||
      (p.employment_type && p.employment_type.toLowerCase() === selectedType.toLowerCase());

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "active" && (p.status === "active" || p.active)) ||
      (selectedStatus === "inactive" && (p.status === "inactive" || !p.active)) ||
      (selectedStatus === "on_leave" && p.status === "on_leave");

    return matchesSearch && matchesDept && matchesType && matchesStatus;
  });

  // Bulk CSV Import Function
  async function handleBulkImport(records: CsvEmployeeRecord[]): Promise<{ imported: number; errors: string[] }> {
    let imported = 0;
    const errors: string[] = [];

    for (const rec of records) {
      try {
        const password = (rec as any).password || (Math.random().toString(36).slice(-8) + "Aa1!");
        const { error } = await (supabase.rpc as any)("admin_create_employee", {
          p_email: rec.email.trim().toLowerCase(),
          p_password: password,
          p_full_name: rec.full_name.trim(),
          p_department: rec.department || "General",
          p_phone: rec.phone || null,
          p_person_code: rec.employee_code || null,
        });

        if (error) {
          errors.push(`${rec.full_name} (${rec.email}): ${error.message}`);
        } else {
          imported++;
        }
      } catch (err: any) {
        errors.push(`${rec.full_name}: ${err.message}`);
      }
    }

    return { imported, errors };
  }

  // Delete Person Mutation
  const deletePersonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee removed successfully");
      queryClient.invalidateQueries({ queryKey: ["people-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove employee");
    },
  });

  return (
    <PageContainer maxWidth="wide">
      {/* Header Banner */}
      <PageHeader
        breadcrumbs={[{ label: "Employees Directory" }]}
        title="Employee Management"
        badge={
          <Badge variant="outline" className="font-mono text-xs">
            {filteredPeople.length} {filteredPeople.length === 1 ? "Employee" : "Employees"}
          </Badge>
        }
        description="Complete employee roster, 9-tab detailed profiles, CSV import/export, and face biometrics."
        actions={
          session.isStaff && (
            <>
              <CsvImportExport
                employees={people}
                onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ["people-list"] })}
                importFunction={handleBulkImport}
              />

              <Button
                onClick={() => setRegisterModalOpen(true)}
                className="gap-2 shadow-sm h-9 text-xs font-semibold"
              >
                <UserPlus className="h-4 w-4" />
                <span>Register Employee</span>
              </Button>
            </>
          )
        }
      />

      {/* Filter and Search Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, email, role, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Department Filter */}
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="h-9 text-xs">
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

          {/* Status Filter */}
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Second Row: View Mode Toggle & Active Filter Badges */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Showing {filteredPeople.length} of {people.length} records</span>
            {(search || selectedDept !== "all" || selectedStatus !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-primary"
                onClick={() => {
                  setSearch("");
                  setSelectedDept("all");
                  setSelectedStatus("all");
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => setViewMode("table")}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Roster Display */}
      {peopleLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredPeople.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center bg-card">
          <Users className="h-10 w-10 text-muted-foreground/50" />
          <h3 className="mt-3 text-base font-semibold">No employees match criteria</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {search || selectedDept !== "all"
              ? "Try adjusting your filters or search terms."
              : "Get started by registering your first employee."}
          </p>
          {session.isStaff && (
            <Button onClick={() => setRegisterModalOpen(true)} className="mt-4 gap-2 text-xs">
              <UserPlus className="h-4 w-4" />
              Register Employee
            </Button>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <TableContainer>
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                <tr>
                  <th className="p-3.5 pl-4">Employee</th>
                  <th className="p-3.5">Department & Role</th>
                  <th className="p-3.5">Contact</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Attendance Mode</th>
                  <th className="p-3.5 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPeople.map((person) => {
                  const initials = person.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={person.id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedProfileId(person.id)}
                    >
                      {/* Name & ID */}
                      <td className="p-3.5 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shrink-0 overflow-hidden text-sm">
                            {person.photo_url ? (
                              <img src={person.photo_url} alt={person.name} className="h-full w-full object-cover" />
                            ) : (
                              initials
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-foreground hover:text-primary transition-colors">
                              {person.name}
                            </p>
                            <p className="text-[11px] font-mono text-muted-foreground">{person.person_code}</p>
                          </div>
                        </div>
                      </td>

                      {/* Department & Designation */}
                      <td className="p-3.5">
                        <p className="font-semibold">{person.designation || "Employee"}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {person.department || "General"}
                        </Badge>
                      </td>

                      {/* Contact */}
                      <td className="p-3.5 space-y-0.5">
                        <p className="text-muted-foreground truncate max-w-[180px]">{person.email || "—"}</p>
                        <p className="text-muted-foreground font-mono text-[11px]">{person.phone || "—"}</p>
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            person.status === "active" || person.active
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                              : person.status === "on_leave"
                              ? "bg-amber-500/10 text-amber-600 border-amber-200"
                              : "bg-rose-500/10 text-rose-600 border-rose-200"
                          }`}
                        >
                          {person.status || (person.active ? "Active" : "Inactive")}
                        </Badge>
                      </td>

                      {/* Geofence Attendance Mode */}
                      <td className="p-3.5">
                        <Badge variant="outline" className="gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]">
                          <MapPin className="h-3 w-3" />
                          GPS Geofence
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => setSelectedProfileId(person.id)}
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden md:inline">Profile</span>
                          </Button>

                          {session.isStaff && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedProfileId(person.id)}>
                                  <Eye className="mr-2 h-4 w-4 text-primary" />
                                  View 9-Tab Profile
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete ${person.name} from FlowPeople?`)) {
                                      deletePersonMutation.mutate(person.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Employee
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </TableContainer>
      ) : (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPeople.map((person) => {
            const initials = person.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <Card
                key={person.id}
                className="flex flex-col justify-between hover:border-primary/50 transition-all cursor-pointer shadow-sm"
                onClick={() => setSelectedProfileId(person.id)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm overflow-hidden shrink-0">
                        {person.photo_url ? (
                          <img src={person.photo_url} alt={person.name} className="h-full w-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-bold truncate">{person.name}</CardTitle>
                        <CardDescription className="text-xs font-mono">{person.person_code}</CardDescription>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${
                        person.status === "active" || person.active
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                          : "bg-amber-500/10 text-amber-600 border-amber-200"
                      }`}
                    >
                      {person.status || (person.active ? "Active" : "Inactive")}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3">
                  <div className="text-xs space-y-1 text-muted-foreground border-y py-2.5">
                    <p className="flex items-center gap-1.5 truncate">
                      <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{person.designation || "Employee"} • {person.department}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{person.email || "No email"}</span>
                    </p>
                    {person.phone && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono">{person.phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Badge variant="outline" className="gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]">
                      <MapPin className="h-3 w-3" />
                      GPS Geofence
                    </Badge>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-primary font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProfileId(person.id);
                      }}
                    >
                      View Profile →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Employee Registration Dialog */}
      <EmployeeRegistrationDialog
        open={registerModalOpen}
        onOpenChange={setRegisterModalOpen}
        departments={departments}
        existingEmployees={existingEmployeesList}
        shifts={shifts}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["people-list"] })}
      />

      {/* 9-Tab Employee Profile Drawer */}
      <EmployeeProfileDrawer
        employeeId={selectedProfileId}
        open={!!selectedProfileId}
        onOpenChange={(open) => {
          if (!open) setSelectedProfileId(null);
        }}
        onProfileUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["people-list"] });
        }}
      />
    </PageContainer>
  );
}

// ----------------------------------------------------------------------------
