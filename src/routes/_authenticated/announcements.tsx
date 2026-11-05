import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Pin,
  Plus,
  Trash2,
  Calendar,
  Building2,
  Users,
  Search,
  Filter,
  Sparkles,
  Clock,
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

export const Route = createFileRoute("/_authenticated/announcements")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Announcements — Flowpeople by Fluxora" },
      { name: "description", content: "Company notices, updates, and corporate circulars." },
    ],
  }),
  component: AnnouncementsPage,
});

interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  target: string;
  target_department_id: string | null;
  target_employee_ids: string[] | null;
  pinned: boolean;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
  departments?: { name: string } | null;
}

interface DepartmentRow {
  id: string;
  name: string;
}

function AnnouncementsPage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("all");
  const [postModalOpen, setPostModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    target: "all",
    target_department_id: session.departmentId || "",
    pinned: false,
    expires_at: "",
  });

  // Query departments for targeting
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as DepartmentRow[];
    },
  });

  // Query announcements
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*, departments(name)")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AnnouncementRow[];
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!formData.title.trim()) throw new Error("Title is required");
      if (!formData.message.trim()) throw new Error("Announcement content is required");

      const isDept = formData.target === "department";
      const targetDeptId = isDept
        ? formData.target_department_id || session.departmentId || null
        : null;

      const { error } = await supabase.from("announcements").insert({
        title: formData.title.trim(),
        message: formData.message.trim(),
        target: formData.target,
        target_department_id: targetDeptId,
        pinned: formData.pinned,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        created_by: session.user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement published");
      setPostModalOpen(false);
      setFormData({
        title: "",
        message: "",
        target: "all",
        target_department_id: session.departmentId || "",
        pinned: false,
        expires_at: "",
      });
      queryClient.invalidateQueries({ queryKey: ["announcements-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to post announcement");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement deleted");
      queryClient.invalidateQueries({ queryKey: ["announcements-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete announcement");
    },
  });

  const canPost = session.isAdmin || session.isManager;

  const filteredAnnouncements = announcements.filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q || a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
    const matchesTarget =
      selectedTarget === "all" ||
      (selectedTarget === "pinned" && a.pinned) ||
      (selectedTarget === "company" && a.target === "all") ||
      (selectedTarget === "department" && a.target === "department");
    return matchesSearch && matchesTarget;
  });

  const pinnedList = filteredAnnouncements.filter((a) => a.pinned);
  const unpinnedList = filteredAnnouncements.filter((a) => !a.pinned);

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6 p-3 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Announcements</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Official company news, policy updates, and team circulars.
          </p>
        </div>
        {canPost && (
          <Button onClick={() => setPostModalOpen(true)} className="gap-2 w-full sm:w-auto text-xs h-9">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {/* Filter and Search */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search announcements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                className="h-9 w-full sm:w-auto rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
              >
                <option value="all">All Bulletins</option>
                <option value="pinned">Pinned Only</option>
                <option value="company">Company-Wide</option>
                <option value="department">Department-Specific</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pinned Section */}
      {pinnedList.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Pin className="h-4 w-4 rotate-45" />
            <span>Pinned Announcements</span>
          </div>

          <div className="grid gap-4">
            {pinnedList.map((item) => (
              <Card key={item.id} className="border-primary/30 bg-primary/5 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                          <Pin className="h-3 w-3 rotate-45" /> Pinned
                        </Badge>
                        {item.target === "all" ? (
                          <Badge variant="outline" className="text-xs">
                            Company-Wide
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Dept: {item.departments?.name || "Team"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </div>

                    {session.isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this announcement?")) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Standard Announcements */}
      <div className="space-y-4">
        {pinnedList.length > 0 && (
          <h2 className="text-sm font-semibold text-muted-foreground">Recent Circulars</h2>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-2 text-sm font-medium">No announcements found</p>
              <p className="text-xs text-muted-foreground">
                All company bulletins and notices will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {unpinnedList.map((item) => (
              <Card key={item.id} className="transition-all hover:shadow-soft">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.target === "all" ? (
                          <Badge variant="outline" className="text-xs">
                            Company-Wide
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Dept: {item.departments?.name || "Team"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                    </div>

                    {session.isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this announcement?")) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {item.message}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Post Modal */}
      <Dialog open={postModalOpen} onOpenChange={setPostModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Publish Announcement</DialogTitle>
            <DialogDescription>
              Broadcast a notice to the entire company or a specific department.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                placeholder="e.g. Annual Company Offsite 2026"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-content">Message</Label>
              <textarea
                id="ann-content"
                rows={5}
                className="w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Write announcement details..."
                value={formData.message}
                onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={formData.target}
                  disabled={!session.isAdmin}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      target: e.target.value,
                    }))
                  }
                >
                  {session.isAdmin && <option value="all">Company-Wide (All)</option>}
                  <option value="department">Department Specific</option>
                </select>
              </div>

              {formData.target === "department" && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={formData.target_department_id}
                    disabled={!session.isAdmin && !!session.departmentId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        target_department_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="ann-pinned"
                checked={formData.pinned}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, pinned: !!checked }))
                }
              />
              <Label htmlFor="ann-pinned" className="text-sm font-normal">
                Pin to top of bulletin board
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPostModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
              {postMutation.isPending ? "Publishing..." : "Publish Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
