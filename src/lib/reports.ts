import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface HeadcountData {
  total_employees: number;
  active_count: number;
  probation_count: number;
  notice_count: number;
  inactive_count: number;
}

export interface DepartmentDistItem {
  department: string;
  headcount: number;
}

export interface NewHireItem {
  id: string;
  full_name: string;
  employee_code: string;
  designation: string | null;
  joining_date: string;
}

export interface AttendanceData {
  present_count: number;
  late_count: number;
  half_day_count: number;
  absent_count: number;
  leave_count: number;
  total_records: number;
  total_overtime_hours: number;
}

export interface LeaveData {
  casual_leave: number;
  sick_leave: number;
  earned_leave: number;
  total_approved_days: number;
}

export interface ShiftItem {
  shift_name: string;
  assigned_employees: number;
}

export interface RecruitmentData {
  applied: number;
  screening: number;
  shortlisted: number;
  interview: number;
  selected: number;
  offer: number;
  hired: number;
  rejected: number;
}

export interface ExpenseData {
  total_amount: number;
  approved_amount: number;
  travel_amount: number;
  food_amount: number;
  claims_count: number;
}

export interface PayrollData {
  total_gross: number;
  total_net: number;
  total_pf: number;
  total_pt: number;
  total_tds: number;
  runs_count: number;
}

export interface TicketData {
  total_tickets: number;
  open_tickets: number;
  resolved_tickets: number;
  attendance_queries: number;
  leave_queries: number;
  payroll_queries: number;
}

export interface PerformanceData {
  total_reviews: number;
  completed_reviews: number;
  avg_rating: number;
}

export interface ReportsAnalyticsOverview {
  headcount: HeadcountData;
  department_distribution: DepartmentDistItem[];
  new_hires: NewHireItem[];
  attendance: AttendanceData;
  leaves: LeaveData;
  shifts: ShiftItem[];
  recruitment: RecruitmentData;
  expenses: ExpenseData;
  payroll: PayrollData;
  tickets: TicketData;
  performance: PerformanceData;
}

export type DatePresetKey =
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export function getDatePresetRange(
  preset: DatePresetKey,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const format = (d: Date) => d.toISOString().split("T")[0]!;

  if (preset === "7d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { startDate: format(start), endDate: format(now), label: "Last 7 Days" };
  }
  if (preset === "30d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    return { startDate: format(start), endDate: format(now), label: "Last 30 Days" };
  }
  if (preset === "90d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 89);
    return { startDate: format(start), endDate: format(now), label: "Last 90 Days" };
  }
  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: format(start), endDate: format(now), label: "This Month" };
  }
  if (preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: format(start), endDate: format(end), label: "Last Month" };
  }
  if (preset === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { startDate: format(start), endDate: format(now), label: "This Year" };
  }

  // Custom
  const start = customStart || format(new Date(now.getFullYear(), now.getMonth(), 1));
  const end = customEnd || format(now);
  return { startDate: start, endDate: end, label: `Custom (${start} to ${end})` };
}

// ---------------------------------------------------------------------------
// Calculation and Analytic Formulas
// ---------------------------------------------------------------------------

export function calculatePunctualityScore(present: number, late: number): number {
  const total = present + late;
  if (total <= 0) return 100;
  return Math.round((present / total) * 100);
}

export function calculateLeaveUtilizationRate(usedDays: number, totalAllocated: number): number {
  if (totalAllocated <= 0) return 0;
  return Math.round((usedDays / totalAllocated) * 100);
}

export function calculateRecruitmentConversionRate(hired: number, applied: number): number {
  if (applied <= 0) return 0;
  return Math.round((hired / applied) * 1000) / 10;
}

export function calculateTicketResolutionRate(resolved: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((resolved / total) * 100);
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportOverviewToCsv(
  overview: ReportsAnalyticsOverview,
  periodLabel: string
): void {
  const lines: string[] = [];
  lines.push(`FLOWPEOPLE ANALYTICS & REPORTS OVERVIEW`);
  lines.push(`Reporting Period: "${periodLabel}"`);
  lines.push(`Generated: "${new Date().toLocaleString()}"`);
  lines.push("");

  // Headcount Section
  lines.push(`"--- 1. HEADCOUNT & WORKFORCE STATUS ---"`);
  lines.push(`"Metric","Value"`);
  lines.push(`"Total Employees",${overview.headcount.total_employees}`);
  lines.push(`"Active Employees",${overview.headcount.active_count}`);
  lines.push(`"Probation",${overview.headcount.probation_count}`);
  lines.push(`"Notice Period",${overview.headcount.notice_count}`);
  lines.push(`"Inactive",${overview.headcount.inactive_count}`);
  lines.push("");

  // Department Distribution
  lines.push(`"--- 2. DEPARTMENT DISTRIBUTION ---"`);
  lines.push(`"Department","Headcount"`);
  overview.department_distribution.forEach((d) => {
    lines.push(`"${d.department.replace(/"/g, '""')}",${d.headcount}`);
  });
  lines.push("");

  // Attendance Metrics
  lines.push(`"--- 3. ATTENDANCE & PUNCTUALITY ---"`);
  lines.push(`"Metric","Value"`);
  lines.push(`"Present Check-ins",${overview.attendance.present_count}`);
  lines.push(`"Late Arrivals",${overview.attendance.late_count}`);
  lines.push(`"Half Days",${overview.attendance.half_day_count}`);
  lines.push(`"Absent Recorded",${overview.attendance.absent_count}`);
  lines.push(`"On Leave",${overview.attendance.leave_count}`);
  lines.push(`"Total Logs",${overview.attendance.total_records}`);
  lines.push(`"Total Overtime Hours",${overview.attendance.total_overtime_hours}`);
  lines.push(`"Punctuality Score %",${calculatePunctualityScore(overview.attendance.present_count, overview.attendance.late_count)}%`);
  lines.push("");

  // Leaves
  lines.push(`"--- 4. LEAVE UTILIZATION ---"`);
  lines.push(`"Leave Type","Requests / Utilization"`);
  lines.push(`"Casual Leave Requests",${overview.leaves.casual_leave}`);
  lines.push(`"Sick Leave Requests",${overview.leaves.sick_leave}`);
  lines.push(`"Earned Leave Requests",${overview.leaves.earned_leave}`);
  lines.push(`"Total Approved Leave Days",${overview.leaves.total_approved_days}`);
  lines.push("");

  // Recruitment
  lines.push(`"--- 5. RECRUITMENT PIPELINE ---"`);
  lines.push(`"Stage","Candidates"`);
  lines.push(`"Applied",${overview.recruitment.applied}`);
  lines.push(`"Screening",${overview.recruitment.screening}`);
  lines.push(`"Shortlisted",${overview.recruitment.shortlisted}`);
  lines.push(`"Interview",${overview.recruitment.interview}`);
  lines.push(`"Selected",${overview.recruitment.selected}`);
  lines.push(`"Offer",${overview.recruitment.offer}`);
  lines.push(`"Hired",${overview.recruitment.hired}`);
  lines.push(`"Rejected",${overview.recruitment.rejected}`);
  lines.push("");

  // Expenses & Payroll
  lines.push(`"--- 6. FINANCIALS (EXPENSES & PAYROLL) ---"`);
  lines.push(`"Category","Amount (INR)"`);
  lines.push(`"Total Expenses Claimed",${overview.expenses.total_amount}`);
  lines.push(`"Approved / Reimbursed Expenses",${overview.expenses.approved_amount}`);
  lines.push(`"Travel Expenses",${overview.expenses.travel_amount}`);
  lines.push(`"Food Expenses",${overview.expenses.food_amount}`);
  lines.push(`"Total Gross Payroll",${overview.payroll.total_gross}`);
  lines.push(`"Total Net Payroll",${overview.payroll.total_net}`);
  lines.push(`"Provident Fund (PF)",${overview.payroll.total_pf}`);
  lines.push(`"Professional Tax (PT)",${overview.payroll.total_pt}`);
  lines.push(`"TDS Tax",${overview.payroll.total_tds}`);
  lines.push("");

  // Helpdesk
  lines.push(`"--- 7. HELPDESK ---"`);
  lines.push(`"Metric","Value"`);
  lines.push(`"Total Tickets Raised",${overview.tickets.total_tickets}`);
  lines.push(`"Open / In Progress Tickets",${overview.tickets.open_tickets}`);
  lines.push(`"Resolved Tickets",${overview.tickets.resolved_tickets}`);
  lines.push(`"Resolution Rate %",${calculateTicketResolutionRate(overview.tickets.resolved_tickets, overview.tickets.total_tickets)}%`);

  const csv = lines.join("\n");
  downloadCsv(`FlowPeople-Analytics-Report-${Date.now()}.csv`, csv);
}

// ---------------------------------------------------------------------------
// PDF Executive Summary Export
// ---------------------------------------------------------------------------

export function exportExecutivePdfReport(
  overview: ReportsAnalyticsOverview,
  periodLabel: string,
  orgName = "FlowPeople Organization"
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  // Brand Header
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 595, 70, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("FlowPeople Executive HR & Analytics Report", 40, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(`${orgName} • Period: ${periodLabel} • Generated: ${new Date().toLocaleDateString()}`, 40, 54);

  let currentY = 90;

  // Key KPI Cards Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Executive KPI Scorecard", 40, currentY);
  currentY += 10;

  const kpiHeaders = ["Headcount", "Punctuality", "Overtime", "Approved Leaves", "Ticket Resolution", "Avg Performance"];
  const punctuality = calculatePunctualityScore(overview.attendance.present_count, overview.attendance.late_count);
  const ticketRes = calculateTicketResolutionRate(overview.tickets.resolved_tickets, overview.tickets.total_tickets);

  const kpiRow = [
    `${overview.headcount.active_count} Active`,
    `${punctuality}%`,
    `${overview.attendance.total_overtime_hours} hrs`,
    `${overview.leaves.total_approved_days} days`,
    `${ticketRes}%`,
    `${overview.performance.avg_rating} / 5.0`,
  ];

  autoTable(doc, {
    startY: currentY,
    head: [kpiHeaders],
    body: [kpiRow],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, halign: "center", cellPadding: 6 },
    margin: { left: 40, right: 40 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 25;

  // Department Breakdown Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Department Headcount Breakdown", 40, currentY);
  currentY += 10;

  const deptRows = overview.department_distribution.map((d) => [
    d.department,
    d.headcount.toString(),
    overview.headcount.total_employees > 0
      ? `${Math.round((d.headcount / overview.headcount.total_employees) * 100)}%`
      : "0%",
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [["Department", "Active Headcount", "% Share"]],
    body: deptRows.length > 0 ? deptRows : [["No departments recorded", "0", "0%"]],
    theme: "striped",
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 5 },
    margin: { left: 40, right: 40 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 25;

  // Financials & Recruitment
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Financial & Operational Summary", 40, currentY);
  currentY += 10;

  const finRows = [
    ["Gross Payroll Disbursed", `INR ${overview.payroll.total_gross.toLocaleString()}`],
    ["Net Payroll Disbursed", `INR ${overview.payroll.total_net.toLocaleString()}`],
    ["Statutory Deductions (PF + PT + TDS)", `INR ${(overview.payroll.total_pf + overview.payroll.total_pt + overview.payroll.total_tds).toLocaleString()}`],
    ["Approved Expense Claims", `INR ${overview.expenses.approved_amount.toLocaleString()}`],
    ["Recruitment Pipeline Conversion", `${overview.recruitment.hired} Hired of ${overview.recruitment.applied} Applicants`],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Metric Category", "Period Metric"]],
    body: finRows,
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 5 },
    margin: { left: 40, right: 40 },
  });

  // Footer on each page
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} • Confidential • Flowpeople HRMS by Fluxora`,
      40,
      820
    );
  }

  doc.save(`FlowPeople-Executive-Report-${Date.now()}.pdf`);
}
