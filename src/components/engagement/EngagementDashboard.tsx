import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  Newspaper,
  ClipboardList,
  Lightbulb,
  BarChart2,
  Plus,
  Search,
  Pin,
  Clock,
  Eye,
  CheckCircle2,
  Lock,
  ThumbsUp,
  Share2,
  Trash2,
  ExternalLink,
  Smile,
  ShieldCheck,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Announcement,
  EngagementSurvey,
  EmployeeSuggestion,
  ANNOUNCEMENT_CATEGORY_CONFIG,
  ANNOUNCEMENT_PRIORITY_CONFIG,
  SURVEY_TYPE_CONFIG,
  SURVEY_STATUS_CONFIG,
  SUGGESTION_STATUS_CONFIG,
  calculateENPS,
} from "@/lib/engagement";
import { AnnouncementManagementModal } from "./AnnouncementManagementModal";
import { AnnouncementReadDialog } from "./AnnouncementReadDialog";
import { SurveyCreationModal } from "./SurveyCreationModal";
import { SurveyResponseModal } from "./SurveyResponseModal";
import { SurveyAnalyticsModal } from "./SurveyAnalyticsModal";
import { SuggestionBoxModal } from "./SuggestionBoxModal";
import { SuggestionDetailModal } from "./SuggestionDetailModal";

interface EngagementDashboardProps {
  organizationId: string;
  userId: string;
  employeeId?: string | null;
  userRole?: string | null;
  userDepartmentId?: string | null;
}

export function EngagementDashboard({
  organizationId,
  userId,
  employeeId,
  userRole = "employee",
  userDepartmentId,
}: EngagementDashboardProps) {
  const queryClient = useQueryClient();
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const isManager = userRole === "manager";

  const [activeTab, setActiveTab] = useState("announcements");

  // Modal States
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [selectedAnnForEdit, setSelectedAnnForEdit] = useState<Announcement | null>(null);
  const [selectedAnnForRead, setSelectedAnnForRead] = useState<Announcement | null>(null);

  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [selectedSurveyForResp, setSelectedSurveyForResp] = useState<EngagementSurvey | null>(null);
  const [selectedSurveyForAnalytics, setSelectedSurveyForAnalytics] = useState<EngagementSurvey | null>(null);

  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<EmployeeSuggestion | null>(null);

  // Filters
  const [annSearch, setAnnSearch] = useState("");
  const [annCategoryFilter, setAnnCategoryFilter] = useState("all");
  const [surveyFilter, setSurveyFilter] = useState("all");
  const [sugCategoryFilter, setSugCategoryFilter] = useState("all");

  // Supabase Realtime Subscriptions
  useEffect(() => {
    if (!organizationId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      supabase.getChannels().forEach((ch) => {
        if (ch.topic.includes("org-engagement-")) {
          supabase.removeChannel(ch);
        }
      });
      const channelName = `org-engagement-${organizationId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      channel = supabase.channel(channelName);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "announcements",
            filter: `organization_id=eq.${organizationId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["announcements-engagement"] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "engagement_surveys",
            filter: `organization_id=eq.${organizationId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["engagement-surveys"] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "employee_suggestions",
            filter: `organization_id=eq.${organizationId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["employee-suggestions"] });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Realtime engagement subscription error:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn("Error removing engagement channel:", e);
        }
      }
    };
  }, [organizationId, queryClient]);

  // 1. Fetch Announcements with read receipts
  const { data: announcements = [], isLoading: annLoading } = useQuery({
    queryKey: ["announcements-engagement", organizationId, employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select(`
          *,
          department:departments(id, name)
        `)
        .eq("organization_id", organizationId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data || []) as any[];

      // Fetch read receipts by this employee
      if (employeeId && list.length > 0) {
        const { data: myReads } = await supabase
          .from("announcement_reads")
          .select("announcement_id")
          .eq("employee_id", employeeId);

        const readSet = new Set((myReads || []).map((r) => r.announcement_id));

        // Fetch counts for each announcement
        const { data: allReads } = await supabase
          .from("announcement_reads")
          .select("announcement_id");

        const countMap: Record<string, number> = {};
        (allReads || []).forEach((r) => {
          countMap[r.announcement_id] = (countMap[r.announcement_id] || 0) + 1;
        });

        return list.map((a) => ({
          ...a,
          read_by_me: readSet.has(a.id),
          read_count: countMap[a.id] || 0,
        })) as Announcement[];
      }

      return list as Announcement[];
    },
    enabled: !!organizationId,
  });

  // 2. Fetch Surveys
  const { data: surveys = [], isLoading: surveyLoading } = useQuery({
    queryKey: ["engagement-surveys", organizationId, employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("engagement_surveys")
        .select(`
          *,
          target_department:departments(id, name)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data || []) as any[];

      // Check participation if employeeId is known
      if (employeeId && list.length > 0) {
        const { data: myResponses } = await supabase
          .from("engagement_responses")
          .select("survey_id")
          .eq("employee_id", employeeId);

        const participatedSet = new Set((myResponses || []).map((r) => r.survey_id));

        return list.map((s) => ({
          ...s,
          has_participated: participatedSet.has(s.id),
        })) as EngagementSurvey[];
      }

      return list as EngagementSurvey[];
    },
    enabled: !!organizationId,
  });

  // 3. Fetch Suggestions
  const { data: suggestions = [], isLoading: sugLoading } = useQuery({
    queryKey: ["employee-suggestions", organizationId, employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_suggestions")
        .select(`
          *,
          employee:employees(
            id,
            full_name,
            employee_code,
            department:departments(name)
          )
        `)
        .eq("organization_id", organizationId)
        .order("upvotes_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data || []) as any[];

      if (employeeId && list.length > 0) {
        const { data: myUpvotes } = await supabase
          .from("employee_suggestion_upvotes")
          .select("suggestion_id")
          .eq("employee_id", employeeId);

        const upvoteSet = new Set((myUpvotes || []).map((u) => u.suggestion_id));

        return list.map((s) => ({
          ...s,
          upvoted_by_me: upvoteSet.has(s.id),
        })) as EmployeeSuggestion[];
      }

      return list as EmployeeSuggestion[];
    },
    enabled: !!organizationId,
  });

  // Mark announcement as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!employeeId) return;
      const { data, error } = await supabase.rpc("mark_announcement_read" as any, {
        _announcement_id: announcementId,
        _employee_id: employeeId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-engagement"] });
    },
  });

  // Delete announcement (admin only)
  const deleteAnnMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-engagement"] });
      toast.success("Announcement deleted.");
    },
  });

  // Filtered Announcements
  const filteredAnnouncements = announcements.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(annSearch.toLowerCase()) ||
      a.message.toLowerCase().includes(annSearch.toLowerCase()) ||
      (a.summary || "").toLowerCase().includes(annSearch.toLowerCase());
    const matchesCat = annCategoryFilter === "all" || a.category === annCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const pinnedAnnouncements = filteredAnnouncements.filter((a) => a.pinned);
  const regularAnnouncements = filteredAnnouncements.filter((a) => !a.pinned);

  // Filtered Surveys
  const filteredSurveys = surveys.filter((s) => {
    if (surveyFilter === "all") return true;
    if (surveyFilter === "active") return s.status === "active";
    if (surveyFilter === "closed") return s.status === "closed";
    return s.type === surveyFilter;
  });

  // Filtered Suggestions
  const filteredSuggestions = suggestions.filter((s) => {
    if (sugCategoryFilter === "all") return true;
    return s.category === sugCategoryFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> Internal Communication & Engagement
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Broadcast organization circulars, launch team polls, conduct anonymous surveys, and triage employee innovation ideas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setSelectedAnnForEdit(null);
                setIsAnnModalOpen(true);
              }}
              className="gap-1.5 text-xs shadow-sm"
            >
              <Plus className="h-4 w-4" /> Broadcast Notice
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSuggestionModalOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Lightbulb className="h-4 w-4 text-amber-500" /> Share Idea
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsSurveyModalOpen(true)}
              className="gap-1.5 text-xs"
            >
              <ClipboardList className="h-4 w-4 text-primary" /> New Survey
            </Button>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid grid-cols-3 sm:w-[480px]">
          <TabsTrigger value="announcements" className="text-xs gap-1.5">
            <Newspaper className="h-3.5 w-3.5" /> Notices & News
          </TabsTrigger>
          <TabsTrigger value="surveys" className="text-xs gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Surveys & Polls
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="text-xs gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Innovation Box
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ANNOUNCEMENTS & INTERNAL NEWS */}
        <TabsContent value="announcements" className="space-y-5">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search circulars, news, and policies..."
                value={annSearch}
                onChange={(e) => setAnnSearch(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={annCategoryFilter} onValueChange={setAnnCategoryFilter}>
                <SelectTrigger className="text-xs h-9 w-[160px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(ANNOUNCEMENT_CATEGORY_CONFIG).map(([k, cfg]) => (
                    <SelectItem key={k} value={k}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pinned Announcements Carousel/Stack */}
          {pinnedAnnouncements.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Pin className="h-3.5 w-3.5" /> Pinned Announcements
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pinnedAnnouncements.map((ann) => (
                  <Card
                    key={ann.id}
                    className="border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-bl-full flex items-start justify-end p-2">
                      <Pin className="h-4 w-4 text-amber-600" />
                    </div>

                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={ANNOUNCEMENT_CATEGORY_CONFIG[ann.category]?.badgeClass}
                        >
                          {ANNOUNCEMENT_CATEGORY_CONFIG[ann.category]?.label || ann.category}
                        </Badge>
                        {ann.priority === "urgent" && (
                          <Badge variant="destructive" className="text-[10px]">
                            URGENT
                          </Badge>
                        )}
                        {!ann.read_by_me && (
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            NEW
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-bold text-foreground">
                        {ann.title}
                      </CardTitle>
                      {ann.summary && (
                        <CardDescription className="text-xs line-clamp-2">
                          {ann.summary}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      <p className="text-xs text-foreground/80 line-clamp-3 leading-relaxed">
                        {ann.message}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(ann.created_at).toLocaleDateString()}
                          {ann.target === "department" && ann.department?.name && (
                            <> • <Building2 className="h-3.5 w-3.5" /> {ann.department.name}</>
                          )}
                        </span>

                        <div className="flex items-center gap-2">
                          {!ann.read_by_me && employeeId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-emerald-600 gap-1"
                              onClick={() => markReadMutation.mutate(ann.id)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Read
                            </Button>
                          )}

                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() => setSelectedAnnForRead(ann)}
                            >
                              <Eye className="h-3.5 w-3.5" /> {ann.read_count || 0} Reads
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Regular Announcements Stream */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Corporate Feed ({regularAnnouncements.length})
            </h4>

            {annLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Loading company newsfeed...
              </div>
            ) : regularAnnouncements.length === 0 && pinnedAnnouncements.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
                No company notices or news found.
              </div>
            ) : (
              <div className="space-y-3">
                {regularAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className={`p-4 rounded-lg border transition-all ${
                      ann.read_by_me ? "bg-card" : "bg-primary/5 border-primary/30"
                    } space-y-2.5`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={ANNOUNCEMENT_CATEGORY_CONFIG[ann.category]?.badgeClass}
                          >
                            {ANNOUNCEMENT_CATEGORY_CONFIG[ann.category]?.label || ann.category}
                          </Badge>
                          {ann.priority !== "normal" && (
                            <Badge
                              variant="outline"
                              className={ANNOUNCEMENT_PRIORITY_CONFIG[ann.priority]?.badgeClass}
                            >
                              {ANNOUNCEMENT_PRIORITY_CONFIG[ann.priority]?.label}
                            </Badge>
                          )}
                          {!ann.read_by_me && (
                            <Badge className="bg-emerald-600 text-white text-[10px]">
                              UNREAD
                            </Badge>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-foreground">
                          {ann.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => setSelectedAnnForRead(ann)}
                            >
                              <Eye className="h-3.5 w-3.5" /> {ann.read_count || 0} Reads
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-rose-500 hover:text-rose-600"
                              onClick={() => {
                                if (confirm("Delete this announcement?")) {
                                  deleteAnnMutation.mutate(ann.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {ann.message}
                    </p>

                    {ann.attachment_url && (
                      <div className="pt-1">
                        <a
                          href={ann.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> View Attached Media / Document
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(ann.created_at).toLocaleDateString()}
                        {ann.target === "department" && ann.department?.name && (
                          <> • Target: {ann.department.name} Department</>
                        )}
                      </span>

                      {!ann.read_by_me && employeeId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-emerald-600 gap-1"
                          onClick={() => markReadMutation.mutate(ann.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge & Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: SURVEYS, POLLS & SATISFACTION */}
        <TabsContent value="surveys" className="space-y-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Select value={surveyFilter} onValueChange={setSurveyFilter}>
                <SelectTrigger className="text-xs h-9 w-[180px]">
                  <SelectValue placeholder="All Surveys" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Engagement Forms</SelectItem>
                  <SelectItem value="poll">Quick Polls</SelectItem>
                  <SelectItem value="survey">Comprehensive Surveys</SelectItem>
                  <SelectItem value="satisfaction">eNPS & Satisfaction</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="closed">Closed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {surveyLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading active surveys and polls...
            </div>
          ) : filteredSurveys.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
              No surveys or polls found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSurveys.map((survey) => {
                const typeCfg = SURVEY_TYPE_CONFIG[survey.type];
                const statusCfg = SURVEY_STATUS_CONFIG[survey.status];

                return (
                  <Card key={survey.id} className="shadow-xs flex flex-col justify-between">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="outline" className={typeCfg?.badgeClass}>
                          {typeCfg?.label || survey.type}
                        </Badge>
                        <Badge variant="outline" className={statusCfg?.badgeClass}>
                          {statusCfg?.label || survey.status}
                        </Badge>
                      </div>

                      <CardTitle className="text-sm font-bold text-foreground">
                        {survey.title}
                      </CardTitle>

                      {survey.description && (
                        <CardDescription className="text-xs line-clamp-2">
                          {survey.description}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      <div className="p-2.5 rounded-lg border bg-muted/30 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Audience:</span>
                          <span className="font-medium text-foreground">
                            {survey.target_audience === "department"
                              ? survey.target_department?.name || "Department"
                              : "Organization-wide"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Anonymity:</span>
                          <span className="font-medium text-emerald-600 flex items-center gap-1">
                            {survey.is_anonymous ? (
                              <>
                                <Lock className="h-3 w-3" /> Anonymous
                              </>
                            ) : (
                              "Named"
                            )}
                          </span>
                        </div>
                        {survey.end_date && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Deadline:</span>
                            <span className="font-medium text-foreground">
                              {survey.end_date}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {survey.status === "active" && (
                          <Button
                            size="sm"
                            className="flex-1 text-xs gap-1"
                            onClick={() => setSelectedSurveyForResp(survey)}
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            {survey.has_participated ? "View My Response" : "Participate / Vote"}
                          </Button>
                        )}

                        {(isAdmin || survey.show_live_results) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1"
                            onClick={() => setSelectedSurveyForAnalytics(survey)}
                          >
                            <BarChart2 className="h-3.5 w-3.5" /> Results
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: INNOVATION & SUGGESTIONS BOX */}
        <TabsContent value="suggestions" className="space-y-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Select value={sugCategoryFilter} onValueChange={setSugCategoryFilter}>
                <SelectTrigger className="text-xs h-9 w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Idea Categories</SelectItem>
                  <SelectItem value="Workplace Culture">Workplace Culture</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Technology & Tools">Technology & Tools</SelectItem>
                  <SelectItem value="Cost Saving">Cost Saving</SelectItem>
                  <SelectItem value="Wellness">Wellness</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm"
              onClick={() => setIsSuggestionModalOpen(true)}
              className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
            >
              <Lightbulb className="h-4 w-4" /> Share an Idea
            </Button>
          </div>

          {sugLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading ideas repository...
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
              No employee ideas shared yet. Be the first to submit a suggestion!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSuggestions.map((sug) => {
                const statusCfg = SUGGESTION_STATUS_CONFIG[sug.status];

                return (
                  <Card
                    key={sug.id}
                    className="shadow-xs hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between"
                    onClick={() => setSelectedSuggestion(sug)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {sug.category}
                        </Badge>
                        <Badge variant="outline" className={statusCfg?.badgeClass}>
                          {statusCfg?.label || sug.status}
                        </Badge>
                      </div>

                      <CardTitle className="text-sm font-bold text-foreground">
                        {sug.title}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0">
                      <p className="text-xs text-foreground/80 line-clamp-3 leading-relaxed">
                        {sug.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-1.5">
                          {sug.is_anonymous ? (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <Lock className="h-3 w-3" /> Anonymous
                            </span>
                          ) : (
                            <span>{sug.employee?.full_name || "Employee"}</span>
                          )}
                          <span>•</span>
                          <span>{new Date(sug.created_at).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <ThumbsUp className="h-3.5 w-3.5 fill-primary/20" />
                          {sug.upvotes_count} Upvotes
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals & Dialogs */}
      <AnnouncementManagementModal
        open={isAnnModalOpen}
        onOpenChange={setIsAnnModalOpen}
        organizationId={organizationId}
        userId={userId}
        announcement={selectedAnnForEdit}
      />

      <AnnouncementReadDialog
        open={!!selectedAnnForRead}
        onOpenChange={(open) => !open && setSelectedAnnForRead(null)}
        announcement={selectedAnnForRead}
        organizationId={organizationId}
      />

      <SurveyCreationModal
        open={isSurveyModalOpen}
        onOpenChange={setIsSurveyModalOpen}
        organizationId={organizationId}
        userId={userId}
      />

      <SurveyResponseModal
        open={!!selectedSurveyForResp}
        onOpenChange={(open) => !open && setSelectedSurveyForResp(null)}
        survey={selectedSurveyForResp}
        employeeId={employeeId || ""}
      />

      <SurveyAnalyticsModal
        open={!!selectedSurveyForAnalytics}
        onOpenChange={(open) => !open && setSelectedSurveyForAnalytics(null)}
        survey={selectedSurveyForAnalytics}
        organizationId={organizationId}
      />

      <SuggestionBoxModal
        open={isSuggestionModalOpen}
        onOpenChange={setIsSuggestionModalOpen}
        organizationId={organizationId}
        employeeId={employeeId || ""}
        userId={userId}
      />

      <SuggestionDetailModal
        open={!!selectedSuggestion}
        onOpenChange={(open) => !open && setSelectedSuggestion(null)}
        suggestion={selectedSuggestion}
        employeeId={employeeId || ""}
        isAdmin={isAdmin}
        userId={userId}
      />
    </div>
  );
}
