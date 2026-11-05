import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/holidays")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Company Holidays — Flowpeople by Fluxora" },
      { name: "description", content: "Official company holiday calendar and schedules." },
    ],
  }),
  component: HolidaysPage,
});

interface HolidayRow {
  id: string;
  date: string;
  name: string;
  is_optional: boolean;
  created_at: string;
}

function HolidaysPage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    name: "",
    is_optional: false,
  });

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["holidays-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HolidayRow[];
    },
  });

  const addHolidayMutation = useMutation({
    mutationFn: async () => {
      if (!formData.name.trim()) throw new Error("Holiday name is required");
      if (!formData.date) throw new Error("Holiday date is required");

      const { error } = await supabase.from("holidays").insert({
        name: formData.name.trim(),
        date: formData.date,
        is_optional: formData.is_optional,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Holiday added to corporate calendar");
      setAddModalOpen(false);
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        name: "",
        is_optional: false,
      });
      queryClient.invalidateQueries({ queryKey: ["holidays-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add holiday");
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Holiday removed");
      queryClient.invalidateQueries({ queryKey: ["holidays-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete holiday");
    },
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  // Find upcoming holidays
  const upcomingHolidays = holidays.filter((h) => h.date >= todayStr);
  const nextHoliday = upcomingHolidays[0];

  // Filtering
  const filteredHolidays = holidays.filter((h) => {
    const matchesSearch = !search || h.name.toLowerCase().includes(search.toLowerCase());
    const matchesMonth =
      selectedMonth === "all" || h.date.startsWith(`2026-${selectedMonth}`);
    return matchesSearch && matchesMonth;
  });

  function getDaysUntil(dateStr: string) {
    const diffTime = new Date(dateStr).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 0) return `in ${diffDays} days`;
    return "Passed";
  }

  function formatHolidayDate(dateStr: string) {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Holidays</h1>
          <p className="text-sm text-muted-foreground">
            Official non-working days and optional observances for 2026.
          </p>
        </div>
        {session.isAdmin && (
          <Button onClick={() => setAddModalOpen(true)} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Add Holiday
          </Button>
        )}
      </div>

      {/* Next Upcoming Highlight */}
      {nextHoliday && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    Next Holiday
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {getDaysUntil(nextHoliday.date)}
                  </span>
                </div>
                <h3 className="text-lg font-bold">{nextHoliday.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatHolidayDate(nextHoliday.date)}
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Official paid holiday for all employees
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search holidays..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">All Months</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holidays List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Calendar Schedule ({filteredHolidays.length} Holidays)
          </CardTitle>
          <CardDescription>
            Leaves booked across these dates are automatically marked as holidays and not deducted
            from paid leave balances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredHolidays.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">No holidays found</p>
              <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredHolidays.map((holiday) => {
                const isPast = holiday.date < todayStr;
                const isNext = holiday.id === nextHoliday?.id;

                return (
                  <div
                    key={holiday.id}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-semibold ${isPast
                          ? "bg-muted text-muted-foreground"
                          : isNext
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-primary/10 text-primary"
                          }`}
                      >
                        <span className="text-[10px] uppercase">
                          {new Date(holiday.date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                          })}
                        </span>
                        <span className="text-base font-bold leading-none">
                          {holiday.date.split("-")[2]}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold ${isPast ? "text-muted-foreground" : ""}`}>
                            {holiday.name}
                          </p>
                          {holiday.is_optional && (
                            <Badge variant="secondary" className="text-[10px]">
                              Optional
                            </Badge>
                          )}
                          {isNext && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                              Upcoming
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatHolidayDate(holiday.date)} • {getDaysUntil(holiday.date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {session.isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remove holiday "${holiday.name}"?`)) {
                              deleteHolidayMutation.mutate(holiday.id);
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete Holiday"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Holiday Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Add a new official paid or optional holiday to the corporate calendar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="holiday-name">Holiday Name</Label>
              <Input
                id="holiday-name"
                placeholder="e.g. Independence Day"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="holiday-date">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="holiday-opt"
                checked={formData.is_optional}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_optional: !!checked }))
                }
              />
              <Label htmlFor="holiday-opt" className="text-sm font-normal">
                Optional / Restricted Holiday
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addHolidayMutation.mutate()}
              disabled={addHolidayMutation.isPending}
            >
              {addHolidayMutation.isPending ? "Adding..." : "Add to Calendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

