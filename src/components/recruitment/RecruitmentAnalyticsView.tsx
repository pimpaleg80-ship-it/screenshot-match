import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  DollarSign,
} from "lucide-react";
import { Candidate, JobOpening, RECRUITMENT_STAGES } from "@/lib/recruitment";

interface RecruitmentAnalyticsViewProps {
  candidates: Candidate[];
  jobOpenings: JobOpening[];
}

export function RecruitmentAnalyticsView({
  candidates,
  jobOpenings,
}: RecruitmentAnalyticsViewProps) {
  // Counts per stage
  const stageCounts: Record<string, number> = {};
  RECRUITMENT_STAGES.forEach((s) => {
    stageCounts[s.key] = candidates.filter((c) => c.stage === s.key).length;
  });

  const totalCandidates = candidates.length;
  const hiredCount = stageCounts["hired"] || 0;
  const offerCount = (stageCounts["offer"] || 0) + hiredCount;
  const interviewCount =
    (stageCounts["interview"] || 0) +
    (stageCounts["selected"] || 0) +
    offerCount;

  // Conversion rates
  const applicationToInterviewRate =
    totalCandidates > 0 ? Math.round((interviewCount / totalCandidates) * 100) : 0;

  const interviewToOfferRate =
    interviewCount > 0 ? Math.round((offerCount / interviewCount) * 100) : 0;

  const offerAcceptanceRate =
    offerCount > 0 ? Math.round((hiredCount / offerCount) * 100) : 0;

  // Source breakdown
  const sourceCounts: Record<string, number> = {};
  candidates.forEach((c) => {
    const src = c.source || "direct";
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Top Level Metric KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Total Candidates
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {totalCandidates}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Processed across all job pipelines
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Interview Conversion
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {applicationToInterviewRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Applicants qualifying for technical rounds
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Offer Acceptance Rate
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {offerAcceptanceRate}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Candidates accepting extended offers
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Hired & Converted
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {hiredCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Inducted into official employee roster
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recruitment Pipeline Funnel Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span>Recruitment Funnel & Drop-off Analysis</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Candidate distribution from initial submission through offer acceptance.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {RECRUITMENT_STAGES.map((stage) => {
              const count = stageCounts[stage.key] || 0;
              const pct = totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;

              return (
                <div key={stage.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      {stage.label}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Source Channels Breakdown */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Candidate Sources</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Top hiring channels delivering talent.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {Object.keys(sourceCounts).length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">
                No candidate sources recorded yet.
              </p>
            ) : (
              Object.entries(sourceCounts).map(([src, count]) => {
                const pct =
                  totalCandidates > 0 ? Math.round((count / totalCandidates) * 100) : 0;

                return (
                  <div key={src} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold capitalize text-foreground">
                        {src.replace("_", " ")}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
