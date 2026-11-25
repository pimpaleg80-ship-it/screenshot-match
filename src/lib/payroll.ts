import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PayrollSettings {
  id: string;
  organization_id: string;
  pf_enabled: boolean;
  pf_employee_rate: number;
  pf_employer_rate: number;
  pf_wage_ceiling: number;
  pf_ceiling_enabled: boolean;
  esi_enabled: boolean;
  esi_employee_rate: number;
  esi_employer_rate: number;
  esi_gross_ceiling: number;
  pt_enabled: boolean;
  pt_default_state: string;
  pt_rules: any;
  working_days_method: string;
  overtime_multiplier: number;
  tds_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSalaryStructure {
  id: string;
  employee_id: string;
  organization_id?: string | null;
  effective_from: string;
  ctc_annual: number;
  ctc_monthly: number;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  conveyance_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  pf_applicable: boolean;
  pf_cap_at_ceiling: boolean;
  esi_applicable: boolean;
  pt_applicable: boolean;
  pt_state: string;
  tds_monthly: number;
  uan_number?: string | null;
  pf_number?: string | null;
  esi_number?: string | null;
  pan_number?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc_code?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    email: string;
    designation?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface PayrollRun {
  id: string;
  organization_id: string;
  month: number;
  year: number;
  title: string;
  status: "draft" | "in_review" | "approved" | "locked" | "paid";
  total_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_pf_employee: number;
  total_pf_employer: number;
  total_esi_employee: number;
  total_esi_employer: number;
  total_pt: number;
  total_tds: number;
  total_lop_deductions: number;
  processed_by?: string | null;
  processed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  locked_by?: string | null;
  locked_at?: string | null;
  payment_date?: string | null;
  payment_reference?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayslipItem {
  id: string;
  employee_id: string;
  organization_id?: string | null;
  payroll_run_id?: string | null;
  month: number;
  year: number;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  conveyance_allowance: number;
  medical_allowance: number;
  other_allowances: number;
  allowances: number;
  bonus: number;
  overtime_hours: number;
  overtime_pay: number;
  gross_salary: number;
  pf_employee: number;
  pf_employer: number;
  esi_employee: number;
  esi_employer: number;
  professional_tax: number;
  tds: number;
  lop_days: number;
  lop_deduction: number;
  other_deductions: number;
  deductions: number;
  total_deductions: number;
  net_salary: number;
  working_days: number;
  present_days: number;
  leave_days: number;
  bank_name?: string | null;
  account_number?: string | null;
  pan_number?: string | null;
  uan_number?: string | null;
  pdf_url?: string | null;
  status: string;
  earnings_breakdown?: any;
  deductions_breakdown?: any;
  payment_method?: string | null;
  payment_date?: string | null;
  notes?: string | null;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_code: string;
    email: string;
    designation?: string | null;
    joining_date?: string | null;
    department?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface PayrollHistory {
  id: string;
  payroll_run_id: string;
  organization_id?: string | null;
  changed_by_user_id?: string | null;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  notes?: string | null;
  created_at: string;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const INDIAN_STATES = [
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Telangana",
  "Delhi",
  "Andhra Pradesh",
  "Gujarat",
  "West Bengal",
  "Kerala",
  "Haryana",
  "Uttar Pradesh",
] as const;

export function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Converts a positive number to Indian currency words format.
 * E.g., 48000 -> "Rupees Forty-Eight Thousand Only"
 */
export function numberToWordsIndian(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return "Rupees Zero Only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen ",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(num: number): string {
    if (num.toString().length > 9) return "Overflow";
    const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "";
    let str = "";
    const n1 = Number(n[1] || 0);
    const n2 = Number(n[2] || 0);
    const n3 = Number(n[3] || 0);
    const n4 = Number(n[4] || 0);
    const n5 = Number(n[5] || 0);

    str += n1 !== 0 ? (a[n1] || (b[Number(n[1]?.[0] || 0)] + " " + a[Number(n[1]?.[1] || 0)])) + "Crore " : "";
    str += n2 !== 0 ? (a[n2] || (b[Number(n[2]?.[0] || 0)] + " " + a[Number(n[2]?.[1] || 0)])) + "Lakh " : "";
    str += n3 !== 0 ? (a[n3] || (b[Number(n[3]?.[0] || 0)] + " " + a[Number(n[3]?.[1] || 0)])) + "Thousand " : "";
    str += n4 !== 0 ? (a[n4] || (b[Number(n[4]?.[0] || 0)] + " " + a[Number(n[4]?.[1] || 0)])) + "Hundred " : "";
    str += n5 !== 0 ? ((str !== "") ? "and " : "") + (a[n5] || (b[Number(n[5]?.[0] || 0)] + " " + a[Number(n[5]?.[1] || 0)])) : "";
    return str.trim();
  }

  const intPart = Math.floor(amount);
  const paisePart = Math.round((amount - intPart) * 100);

  let result = "Rupees " + inWords(intPart);
  if (paisePart > 0) {
    result += " and " + inWords(paisePart) + " Paise";
  }
  return result + " Only";
}

/**
 * Standard Indian Statutory Calculator
 */
export function calculateStatutoryComponents({
  monthlyGross,
  basic,
  lopDays = 0,
  workingDays = 30,
  pfApplicable = true,
  pfCapAtCeiling = true,
  esiApplicable = true,
  ptApplicable = true,
  ptState = "Karnataka",
  tdsMonthly = 0,
  overtimeHours = 0,
  overtimeMultiplier = 1.5,
}: {
  monthlyGross: number;
  basic: number;
  lopDays?: number;
  workingDays?: number;
  pfApplicable?: boolean;
  pfCapAtCeiling?: boolean;
  esiApplicable?: boolean;
  ptApplicable?: boolean;
  ptState?: string;
  tdsMonthly?: number;
  overtimeHours?: number;
  overtimeMultiplier?: number;
}) {
  const safeWorkingDays = workingDays > 0 ? workingDays : 30;
  
  // Overtime pay
  const hourlyRate = (basic / safeWorkingDays) / 8.0;
  const overtimePay = Math.round(overtimeHours * hourlyRate * overtimeMultiplier * 100) / 100;

  // LOP Deduction
  const dailyGross = monthlyGross / safeWorkingDays;
  const lopDeduction = Math.round(dailyGross * lopDays * 100) / 100;

  // PF
  let pfEmployee = 0;
  let pfEmployer = 0;
  if (pfApplicable) {
    const pfBase = pfCapAtCeiling ? Math.min(basic, 15000) : basic;
    pfEmployee = Math.round(pfBase * 0.12);
    pfEmployer = Math.round(pfBase * 0.12);
  }

  // ESI (applies if gross <= 21000)
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (esiApplicable && monthlyGross <= 21000) {
    esiEmployee = Math.round(monthlyGross * 0.0075 * 100) / 100;
    esiEmployer = Math.round(monthlyGross * 0.0325 * 100) / 100;
  }

  // PT (State specific standard slabs, e.g., Karnataka)
  let professionalTax = 0;
  if (ptApplicable) {
    if (ptState === "Karnataka") {
      professionalTax = monthlyGross >= 15000 ? 200 : 0;
    } else if (ptState === "Maharashtra") {
      professionalTax = monthlyGross > 10000 ? 200 : monthlyGross > 7500 ? 175 : 0;
    } else {
      professionalTax = monthlyGross >= 15000 ? 200 : 0;
    }
  }

  const totalDeductions = pfEmployee + esiEmployee + professionalTax + tdsMonthly + lopDeduction;
  const grossPayable = monthlyGross + overtimePay;
  const netPayable = Math.max(0, grossPayable - totalDeductions);

  return {
    overtimePay,
    lopDeduction,
    pfEmployee,
    pfEmployer,
    esiEmployee,
    esiEmployer,
    professionalTax,
    tdsMonthly,
    totalDeductions,
    grossPayable,
    netPayable,
  };
}

/**
 * Client-side Payslip PDF Generator using jsPDF + autoTable
 */
export function generatePayslipPDF({
  payslip,
  employee,
  organizationName = "FlowPeople Organization",
}: {
  payslip: PayslipItem;
  employee: {
    full_name: string;
    employee_code: string;
    designation?: string | null | undefined;
    department_name?: string | null | undefined;
    joining_date?: string | null | undefined;
    bank_name?: string | null | undefined;
    account_number?: string | null | undefined;
    pan_number?: string | null | undefined;
    uan_number?: string | null | undefined;
  };
  organizationName?: string | undefined;
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const monthName = MONTH_NAMES[(payslip.month - 1) % 12] || "Current";
  const titleText = `${organizationName.toUpperCase()}`;
  const periodText = `PAYSLIP FOR THE MONTH OF ${monthName.toUpperCase()} ${payslip.year}`;

  // Header Box
  doc.setFillColor(245, 247, 250);
  doc.rect(14, 12, 182, 28, "F");
  doc.setDrawColor(220, 225, 230);
  doc.rect(14, 12, 182, 28, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(titleText, 105, 22, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(periodText, 105, 30, { align: "center" });

  // Employee Information Grid
  autoTable(doc, {
    startY: 44,
    theme: "plain",
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, textColor: [71, 85, 105] },
      1: { cellWidth: 50 },
      2: { fontStyle: "bold", cellWidth: 45, textColor: [71, 85, 105] },
      3: { cellWidth: 42 },
    },
    body: [
      [
        "Employee Name:", employee.full_name,
        "Employee ID:", employee.employee_code,
      ],
      [
        "Designation:", employee.designation || "Not Specified",
        "Department:", employee.department_name || "General",
      ],
      [
        "Joining Date:", employee.joining_date || "N/A",
        "PAN Number:", payslip.pan_number || employee.pan_number || "N/A",
      ],
      [
        "Bank Name:", payslip.bank_name || employee.bank_name || "HDFC Bank",
        "Account Number:", payslip.account_number || employee.account_number || "N/A",
      ],
      [
        "UAN Number:", payslip.uan_number || employee.uan_number || "N/A",
        "Payment Mode:", (payslip.payment_method || "Bank Transfer").toUpperCase(),
      ],
      [
        "Working Days in Month:", String(payslip.working_days || 30),
        "Days Worked (Paid):", String(payslip.present_days || 30),
      ],
      [
        "Approved Leaves:", String(payslip.leave_days || 0),
        "Loss of Pay (LOP) Days:", String(payslip.lop_days || 0),
      ],
    ],
  });

  const finalEmpY = (doc as any).lastAutoTable.finalY + 6;

  // Earnings & Deductions Table
  const earningsRows = [
    ["Basic Salary", formatINR(payslip.basic_salary)],
    ["House Rent Allowance (HRA)", formatINR(payslip.hra)],
    ["Special Allowance", formatINR(payslip.special_allowance)],
    ["Conveyance Allowance", formatINR(payslip.conveyance_allowance)],
    ["Medical Allowance", formatINR(payslip.medical_allowance)],
  ];
  if (payslip.other_allowances > 0) {
    earningsRows.push(["Other Allowances", formatINR(payslip.other_allowances)]);
  }
  if (payslip.bonus > 0) {
    earningsRows.push(["Performance Bonus / Incentives", formatINR(payslip.bonus)]);
  }
  if (payslip.overtime_pay > 0) {
    earningsRows.push([`Overtime (${payslip.overtime_hours} hrs)`, formatINR(payslip.overtime_pay)]);
  }

  const deductionsRows = [
    ["Provident Fund (Employee EPF)", formatINR(payslip.pf_employee)],
    ["Employee State Insurance (ESI)", formatINR(payslip.esi_employee)],
    ["Professional Tax (PT)", formatINR(payslip.professional_tax)],
    ["TDS / Income Tax", formatINR(payslip.tds)],
  ];
  if (payslip.lop_deduction > 0) {
    deductionsRows.push([`Loss of Pay (${payslip.lop_days} days)`, formatINR(payslip.lop_deduction)]);
  }
  if (payslip.other_deductions > 0) {
    deductionsRows.push(["Other Deductions", formatINR(payslip.other_deductions)]);
  }

  // Pad the rows to be equal length
  const maxRows = Math.max(earningsRows.length, deductionsRows.length);
  const tableBody: string[][] = [];
  for (let i = 0; i < maxRows; i++) {
    const earn = earningsRows[i] || ["", ""];
    const ded = deductionsRows[i] || ["", ""];
    tableBody.push([earn[0] || "", earn[1] || "", ded[0] || "", ded[1] || ""]);
  }

  autoTable(doc, {
    startY: finalEmpY,
    theme: "grid",
    head: [["Earnings (A)", "Amount (₹)", "Deductions (B)", "Amount (₹)"]],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 36, halign: "right" },
      2: { cellWidth: 55 },
      3: { cellWidth: 36, halign: "right" },
    },
    body: tableBody,
    foot: [
      [
        "Total Gross Earnings",
        formatINR(payslip.gross_salary),
        "Total Deductions",
        formatINR(payslip.total_deductions),
      ],
    ],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 9,
    },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY + 6;

  // Net Pay Highlight Box
  doc.setFillColor(238, 242, 255);
  doc.rect(14, finalTableY, 182, 22, "F");
  doc.setDrawColor(199, 210, 254);
  doc.rect(14, finalTableY, 182, 22, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 27, 75);
  doc.text("NET TAKE-HOME SALARY:", 20, finalTableY + 9);
  doc.setFontSize(13);
  doc.setTextColor(67, 56, 202);
  doc.text(formatINR(payslip.net_salary), 175, finalTableY + 9, { align: "right" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`In Words: ${numberToWordsIndian(payslip.net_salary)}`, 20, finalTableY + 16);

  // Footer & Disclaimer
  const pageHeight = doc.internal.pageSize.height;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This is a system-generated compensation statement and does not require a physical signature.",
    105,
    pageHeight - 16,
    { align: "center" }
  );
  doc.text(
    `Generated by FlowPeople HRMS on ${new Date().toLocaleDateString("en-IN", { dateStyle: "long" })}`,
    105,
    pageHeight - 11,
    { align: "center" }
  );

  return doc;
}
