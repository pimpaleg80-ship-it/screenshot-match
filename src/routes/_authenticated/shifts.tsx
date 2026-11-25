import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Clock,
  Calendar,
  ArrowLeftRight,
  PlusCircle,
  Users,
  Building2,
  CalendarDays,
} from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftRosterList } from "@/components/shifts/ShiftRosterList";
import { ShiftCalendarView } from "@/components/shifts/ShiftCalendarView";
import { ShiftSwapManager } from "@/components/shifts/ShiftSwapManager";
import { ShiftAssignmentModal } from "@/components/shifts/ShiftAssignmentModal";

export const Route = createFileRoute("/_authenticated/shifts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shift Management — Flowpeople by Fluxora" },
      { name: "description", content: "Workforce shift schedules, rotational rosters, department assignments, and shift swaps." },
    ],
  }),
  component: ShiftsPage,
});

function ShiftsPage() {
  const session = useSession();

  const [activeTab, setActiveTab] = useState<string>("roster");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetShiftId, setTargetShiftId] = useState<string | null>(null);

  function handleAssignShift(shift: { id: string }) {
    setTargetShiftId(shift.id);
    setAssignModalOpen(true);
  }

  return (
    <PageContainer maxWidth="wide">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Shift Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure morning, general, evening, and night shifts, manage roster allocations, and approve shift swaps.
          </p>
        </div>

        {(session.isAdmin || session.isManager) && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setTargetShiftId(null);
                setAssignModalOpen(true);
              }}
              className="gap-1.5 text-xs h-8"
            >
              <Users className="h-3.5 w-3.5" />
              Assign Shift
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted/60 p-1 text-muted-foreground">
            <TabsTrigger
              value="roster"
              className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <Clock className="h-3.5 w-3.5" />
              Shifts & Timings
            </TabsTrigger>

            <TabsTrigger
              value="calendar"
              className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Roster Calendar
            </TabsTrigger>

            <TabsTrigger
              value="swaps"
              className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Shift Swap Approvals
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Shift Presets & Custom Shifts */}
        <TabsContent value="roster" className="mt-0 outline-none">
          <ShiftRosterList onAssignShift={handleAssignShift} />
        </TabsContent>

        {/* Tab 2: Calendar Schedule */}
        <TabsContent value="calendar" className="mt-0 outline-none">
          <ShiftCalendarView />
        </TabsContent>

        {/* Tab 3: Shift Swap Requests */}
        <TabsContent value="swaps" className="mt-0 outline-none">
          <ShiftSwapManager />
        </TabsContent>
      </Tabs>

      {/* Shift Assignment Dialog */}
      <ShiftAssignmentModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        defaultShiftId={targetShiftId}
      />
    </PageContainer>
  );
}