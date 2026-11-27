import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  ClipboardList,
  CalendarDays,
  Clock,
  Receipt,
  LifeBuoy,
  FileText,
  FileSpreadsheet,
  Bell,
  Loader2,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SelfServiceProfile, EmployeeProfileData } from "@/components/self-service/SelfServiceProfile";
import { SelfServiceAttendance } from "@/components/self-service/SelfServiceAttendance";
import { SelfServiceLeaves } from "@/components/self-service/SelfServiceLeaves";
import { SelfServiceShiftHolidays } from "@/components/self-service/SelfServiceShiftHolidays";
import { SelfServiceExpenses } from "@/components/self-service/SelfServiceExpenses";
import { SelfServiceHrTickets } from "@/components/self-service/SelfServiceHrTickets";
import { SelfServiceDocuments } from "@/components/self-service/SelfServiceDocuments";
import { SelfServicePayslips } from "@/components/self-service/SelfServicePayslips";
import { SelfServiceNotifications } from "@/components/self-service/SelfServiceNotifications";
import { PerformanceGoalsManager } from "@/components/performance/PerformanceGoalsManager";
import { PerformanceAppraisalsManager } from "@/components/performance/PerformanceAppraisalsManager";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Employee Self-Service — Flowpeople by Fluxora" },
      { name: "description", content: "Self-service portal: manage profile, attendance, leaves, shifts, expenses, tickets, documents, payslips and notifications." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const session = useSession();

  // Initialize active tab from URL query param if present
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("tab");
      if (param) return param;
    }
    return "profile";
  });

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", val);
      window.history.replaceState(null, "", url.toString());
    }
  };

  // Fetch full employee profile
  const { data: employee, isLoading: empLoading } = useQuery({
    queryKey: ["my-employee-profile", session.user?.id],
    queryFn: async () => {
      if (!session.user?.id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select(`
          id,
          user_id,
          employee_code,
          full_name,
          email,
          phone,
          personal_email,
          gender,
          date_of_birth,
          marital_status,
          blood_group,
          nationality,
          current_address,
          permanent_address,
          emergency_contact_name,
          emergency_contact_phone,
          emergency_contact_relation,
          designation,
          joining_date,
          employment_type,
          work_location,
          notice_period_days,
          status,
          photo_url,
          department_id,
          manager_id,
          shift_id,
          departments(name),
          manager:employees!employees_manager_id_fkey(full_name),
          shifts(name, code, start_time, end_time, work_days)
        `)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as EmployeeProfileData) || null;
    },
    enabled: !!session.user?.id,
  });

  // Query Face Descriptor enrollment status
  const { data: faceData } = useQuery({
    queryKey: ["my-face-status", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data, error } = await supabase
        .from("face_data")
        .select("id, enrolled_at, consent")
        .eq("employee_id", employee.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  return (
    <PageContainer maxWidth="wide">
      {/* Page Header */}
      <PageHeader
        breadcrumbs={[{ label: "My Self-Service" }]}
        title="Employee Self-Service"
        description="Manage your personal profile, attendance, leave applications, expense claims, HR tickets, documents, and payslips."
      />

      {empLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : !employee ? (
        <div className="rounded-lg border p-12 text-center space-y-3 bg-card">
          <h2 className="text-lg font-bold">No Employee Record Linked</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your login account ({session.user?.email}) is not associated with an active employee roster profile. Please contact an organization administrator.
          </p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          {/* Scrollable / Responsive Tab List */}
          <div className="overflow-x-auto pb-1 scrollbar-none">
            <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted/60 p-1 text-muted-foreground">
              <TabsTrigger
                value="profile"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <User className="h-3.5 w-3.5" />
                Profile & Details
              </TabsTrigger>

              <TabsTrigger
                value="attendance"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                My Attendance
              </TabsTrigger>

              <TabsTrigger
                value="leaves"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Leave & Balances
              </TabsTrigger>

              <TabsTrigger
                value="shifts"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Clock className="h-3.5 w-3.5" />
                Shift & Holidays
              </TabsTrigger>

              <TabsTrigger
                value="expenses"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Receipt className="h-3.5 w-3.5" />
                Expense Claims
              </TabsTrigger>

              <TabsTrigger
                value="tickets"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                HR Tickets
              </TabsTrigger>

              <TabsTrigger
                value="documents"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <FileText className="h-3.5 w-3.5" />
                Documents
              </TabsTrigger>

              <TabsTrigger
                value="payslips"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Payslips
              </TabsTrigger>

              <TabsTrigger
                value="performance"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Target className="h-3.5 w-3.5" />
                Performance
              </TabsTrigger>

              <TabsTrigger
                value="notifications"
                className="gap-1.5 text-xs rounded-lg px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Bell className="h-3.5 w-3.5" />
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Profile & Details */}
          <TabsContent value="profile" className="mt-0 outline-none">
            <SelfServiceProfile
              employee={employee}
              faceEnrolled={!!faceData}
              userId={session.user?.id || ""}
            />
          </TabsContent>

          {/* Tab 2: Attendance */}
          <TabsContent value="attendance" className="mt-0 outline-none">
            <SelfServiceAttendance employeeId={employee.id} />
          </TabsContent>

          {/* Tab 3: Leaves */}
          <TabsContent value="leaves" className="mt-0 outline-none">
            <SelfServiceLeaves employeeId={employee.id} />
          </TabsContent>

          {/* Tab 4: Shift & Holidays */}
          <TabsContent value="shifts" className="mt-0 outline-none">
            <SelfServiceShiftHolidays shiftId={employee.shift_id} employeeId={employee.id} />
          </TabsContent>

          {/* Tab 5: Expenses */}
          <TabsContent value="expenses" className="mt-0 outline-none">
            <SelfServiceExpenses employeeId={employee.id} />
          </TabsContent>

          {/* Tab 6: HR Tickets */}
          <TabsContent value="tickets" className="mt-0 outline-none">
            <SelfServiceHrTickets employeeId={employee.id} />
          </TabsContent>

          {/* Tab 7: Documents */}
          <TabsContent value="documents" className="mt-0 outline-none">
            <SelfServiceDocuments employeeId={employee.id} />
          </TabsContent>

          {/* Tab 8: Payslips */}
          <TabsContent value="payslips" className="mt-0 outline-none">
            <SelfServicePayslips
              employeeId={employee.id}
              employeeName={employee.full_name}
              employeeCode={employee.employee_code}
              departmentName={employee.departments?.name}
              designation={employee.designation}
            />
          </TabsContent>

          {/* Tab 9: Notifications */}
          <TabsContent value="notifications" className="mt-0 outline-none">
            <SelfServiceNotifications userId={session.user?.id || ""} />
          </TabsContent>

          {/* Tab 11: Performance & Appraisals */}
          <TabsContent value="performance" className="mt-0 outline-none space-y-6">
            <PerformanceGoalsManager filterEmployeeId={employee.id} />
            <PerformanceAppraisalsManager filterEmployeeId={employee.id} />
          </TabsContent>
        </Tabs>
      )}
    </PageContainer>
  );
}