import { describe, it, expect } from "vitest";
import {
  MONTH_NAMES,
  INDIAN_STATES,
  formatINR,
  numberToWordsIndian,
  calculateStatutoryComponents,
} from "../lib/payroll";
import {
  EXIT_REASON_CATEGORIES,
  CLEARANCE_DEPARTMENTS,
  EXIT_STATUS_CONFIG,
  calculateFnFSettlement,
  ExitStatus,
} from "../lib/offboarding";

describe("Phase 08: Payroll Management & Employee Offboarding", () => {
  describe("Module 1: Payroll Management", () => {
    describe("Indian Currency Formatting & Word Representation", () => {
      it("formats amounts in Indian Rupees (INR) correctly", () => {
        expect(formatINR(0)).toMatch(/₹\s?0\.00/);
        expect(formatINR(null)).toMatch(/₹\s?0\.00/);
        expect(formatINR(undefined)).toMatch(/₹\s?0\.00/);
        expect(formatINR(50000)).toMatch(/₹\s?50,000\.00/);
        expect(formatINR(150000)).toMatch(/₹\s?1,50,000\.00/);
        expect(formatINR(1250000.5)).toMatch(/₹\s?12,50,000\.50/);
      });

      it("converts numbers to Indian currency words format accurately", () => {
        expect(numberToWordsIndian(0)).toBe("Rupees Zero Only");
        expect(numberToWordsIndian(-100)).toBe("Rupees Zero Only");
        expect(numberToWordsIndian(500)).toBe("Rupees Five Hundred Only");
        expect(numberToWordsIndian(1500)).toBe("Rupees One Thousand Five Hundred Only");
        expect(numberToWordsIndian(48000)).toBe("Rupees Forty Eight Thousand Only");
        expect(numberToWordsIndian(150000)).toBe("Rupees One Lakh Fifty Thousand Only");
        expect(numberToWordsIndian(10000000)).toBe("Rupees One Crore Only");
        expect(numberToWordsIndian(1234.56)).toBe(
          "Rupees One Thousand Two Hundred and Thirty Four and Fifty Six Paise Only"
        );
      });

      it("defines all standard calendar months and Indian states", () => {
        expect(MONTH_NAMES).toHaveLength(12);
        expect(MONTH_NAMES[0]).toBe("January");
        expect(MONTH_NAMES[11]).toBe("December");

        expect(INDIAN_STATES).toContain("Karnataka");
        expect(INDIAN_STATES).toContain("Maharashtra");
        expect(INDIAN_STATES).toContain("Tamil Nadu");
        expect(INDIAN_STATES).toContain("Telangana");
      });
    });

    describe("Statutory Deductions & Salary Calculations", () => {
      it("calculates Employee Provident Fund (EPF) with statutory ₹15,000 wage ceiling", () => {
        // Basic ₹25,000, capped at ₹15,000 ceiling: 15,000 * 12% = ₹1,800
        const resultCapped = calculateStatutoryComponents({
          monthlyGross: 50000,
          basic: 25000,
          pfApplicable: true,
          pfCapAtCeiling: true,
          esiApplicable: false,
          ptApplicable: false,
        });
        expect(resultCapped.pfEmployee).toBe(1800);
        expect(resultCapped.pfEmployer).toBe(1800);

        // Basic ₹10,000 (below ceiling): 10,000 * 12% = ₹1,200
        const resultBelow = calculateStatutoryComponents({
          monthlyGross: 20000,
          basic: 10000,
          pfApplicable: true,
          pfCapAtCeiling: true,
          esiApplicable: false,
          ptApplicable: false,
        });
        expect(resultBelow.pfEmployee).toBe(1200);
        expect(resultBelow.pfEmployer).toBe(1200);

        // Uncapped PF: Basic ₹30,000 * 12% = ₹3,600
        const resultUncapped = calculateStatutoryComponents({
          monthlyGross: 60000,
          basic: 30000,
          pfApplicable: true,
          pfCapAtCeiling: false,
          esiApplicable: false,
          ptApplicable: false,
        });
        expect(resultUncapped.pfEmployee).toBe(3600);
      });

      it("handles Employees' State Insurance (ESI) eligibility and gross ceiling of ₹21,000", () => {
        // Monthly gross ₹20,000 (≤ ₹21,000): Eligible for ESI
        // Employee: 0.75% of 20,000 = 150
        // Employer: 3.25% of 20,000 = 650
        const eligible = calculateStatutoryComponents({
          monthlyGross: 20000,
          basic: 10000,
          esiApplicable: true,
          pfApplicable: false,
          ptApplicable: false,
        });
        expect(eligible.esiEmployee).toBe(150);
        expect(eligible.esiEmployer).toBe(650);

        // Monthly gross ₹25,000 (> ₹21,000): Ineligible for ESI
        const ineligible = calculateStatutoryComponents({
          monthlyGross: 25000,
          basic: 12500,
          esiApplicable: true,
          pfApplicable: false,
          ptApplicable: false,
        });
        expect(ineligible.esiEmployee).toBe(0);
        expect(ineligible.esiEmployer).toBe(0);
      });

      it("calculates state-specific Professional Tax (PT) correctly", () => {
        // Karnataka: Gross >= ₹15,000 -> ₹200; Gross < ₹15,000 -> ₹0
        const ktHigh = calculateStatutoryComponents({
          monthlyGross: 35000,
          basic: 17500,
          ptApplicable: true,
          ptState: "Karnataka",
          pfApplicable: false,
          esiApplicable: false,
        });
        expect(ktHigh.professionalTax).toBe(200);

        const ktLow = calculateStatutoryComponents({
          monthlyGross: 12000,
          basic: 6000,
          ptApplicable: true,
          ptState: "Karnataka",
          pfApplicable: false,
          esiApplicable: false,
        });
        expect(ktLow.professionalTax).toBe(0);

        // Maharashtra: Gross > 10000 -> ₹200; > 7500 -> ₹175; <= 7500 -> 0
        const mhTier1 = calculateStatutoryComponents({
          monthlyGross: 15000,
          basic: 7500,
          ptApplicable: true,
          ptState: "Maharashtra",
          pfApplicable: false,
          esiApplicable: false,
        });
        expect(mhTier1.professionalTax).toBe(200);

        const mhTier2 = calculateStatutoryComponents({
          monthlyGross: 9000,
          basic: 4500,
          ptApplicable: true,
          ptState: "Maharashtra",
          pfApplicable: false,
          esiApplicable: false,
        });
        expect(mhTier2.professionalTax).toBe(175);

        const mhTier3 = calculateStatutoryComponents({
          monthlyGross: 7000,
          basic: 3500,
          ptApplicable: true,
          ptState: "Maharashtra",
          pfApplicable: false,
          esiApplicable: false,
        });
        expect(mhTier3.professionalTax).toBe(0);
      });

      it("calculates Loss of Pay (LOP) and Overtime additions accurately", () => {
        // Monthly gross: ₹60,000, 30 days -> ₹2,000/day. LOP 2 days = ₹4,000
        // Basic: ₹30,000, 30 days -> ₹1,000/day / 8hrs = ₹125/hr. Overtime 10 hrs * 1.5x = ₹1,875
        const result = calculateStatutoryComponents({
          monthlyGross: 60000,
          basic: 30000,
          workingDays: 30,
          lopDays: 2,
          overtimeHours: 10,
          overtimeMultiplier: 1.5,
          pfApplicable: false,
          esiApplicable: false,
          ptApplicable: false,
          tdsMonthly: 0,
        });

        expect(result.lopDeduction).toBe(4000);
        expect(result.overtimePay).toBe(1875);
        expect(result.grossPayable).toBe(61875); // 60,000 + 1,875
        expect(result.totalDeductions).toBe(4000);
        expect(result.netPayable).toBe(57875); // 61,875 - 4,000
      });

      it("computes complete net take-home salary including TDS and all deductions", () => {
        const fullComp = calculateStatutoryComponents({
          monthlyGross: 80000,
          basic: 40000,
          workingDays: 30,
          lopDays: 1, // (80000 / 30) = 2666.67
          pfApplicable: true,
          pfCapAtCeiling: true, // 1800
          esiApplicable: false, // gross > 21000
          ptApplicable: true,
          ptState: "Karnataka", // 200
          tdsMonthly: 5000,
        });

        expect(fullComp.pfEmployee).toBe(1800);
        expect(fullComp.esiEmployee).toBe(0);
        expect(fullComp.professionalTax).toBe(200);
        expect(fullComp.tdsMonthly).toBe(5000);
        expect(fullComp.lopDeduction).toBeCloseTo(2666.67, 1);

        const expectedTotalDeductions = 1800 + 0 + 200 + 5000 + 2666.67;
        expect(fullComp.totalDeductions).toBeCloseTo(expectedTotalDeductions, 1);
        expect(fullComp.netPayable).toBeCloseTo(80000 - expectedTotalDeductions, 1);
      });
    });
  });

  describe("Module 2: Employee Offboarding & Exit Management", () => {
    describe("Separation Configuration & Status Workflow", () => {
      it("defines the standard resignation reasons", () => {
        expect(EXIT_REASON_CATEGORIES).toContain("Better Opportunity");
        expect(EXIT_REASON_CATEGORIES).toContain("Higher Studies");
        expect(EXIT_REASON_CATEGORIES).toContain("Relocation");
        expect(EXIT_REASON_CATEGORIES).toContain("Personal & Family");
        expect(EXIT_REASON_CATEGORIES).toContain("Compensation & Benefits");
      });

      it("defines all four required clearance departments", () => {
        expect(CLEARANCE_DEPARTMENTS).toHaveLength(4);
        expect(CLEARANCE_DEPARTMENTS).toContain("Reporting Manager");
        expect(CLEARANCE_DEPARTMENTS).toContain("IT & Security");
        expect(CLEARANCE_DEPARTMENTS).toContain("Finance & Accounts");
        expect(CLEARANCE_DEPARTMENTS).toContain("HR & Admin");
      });

      it("maps the full exit lifecycle in progression", () => {
        const progression: ExitStatus[] = [
          "submitted",
          "manager_approved",
          "in_clearance",
          "clearance_completed",
          "fnf_settled",
          "relieved",
        ];

        progression.forEach((status, idx) => {
          expect(EXIT_STATUS_CONFIG[status]).toBeDefined();
          expect(EXIT_STATUS_CONFIG[status].step).toBe(idx + 1);
          expect(EXIT_STATUS_CONFIG[status].label).toBeTruthy();
        });

        // Non-progress terminal states
        expect(EXIT_STATUS_CONFIG["rejected"].step).toBe(0);
        expect(EXIT_STATUS_CONFIG["withdrawn"].step).toBe(0);
      });
    });

    describe("Full & Final (FnF) Settlement Calculations", () => {
      it("calculates unpaid salary and leave encashment earnings accurately", () => {
        // Monthly Gross: ₹60,000 (₹2,000/day for 30 days), worked 15 days = ₹30,000
        // Basic: ₹30,000 (₹1,000/day for 30 days), 10 days leave encashment = ₹10,000
        const fnf = calculateFnFSettlement({
          monthlyGross: 60000,
          basicSalaryRate: 30000,
          workingDaysInFinalMonth: 30,
          payableDaysInFinalMonth: 15,
          leaveEncashmentDays: 10,
        });

        expect(fnf.unpaidSalaryAmount).toBe(30000);
        expect(fnf.leaveEncashmentAmount).toBe(10000);
        expect(fnf.totalEarnings).toBe(40000);
        expect(fnf.netPayable).toBe(40000);
      });

      it("recovers notice period shortfall from earnings", () => {
        // Monthly Gross: ₹90,000 (₹3,000/day for 30 days)
        // Payable days: 30 -> ₹90,000
        // Notice shortfall: 10 days -> 10 * 3000 = ₹30,000 deduction
        const fnf = calculateFnFSettlement({
          monthlyGross: 90000,
          basicSalaryRate: 45000,
          workingDaysInFinalMonth: 30,
          payableDaysInFinalMonth: 30,
          noticeShortfallDays: 10,
        });

        expect(fnf.unpaidSalaryAmount).toBe(90000);
        expect(fnf.noticeRecoveryAmount).toBe(30000);
        expect(fnf.totalDeductions).toBe(30000);
        expect(fnf.netPayable).toBe(60000);
      });

      it("includes gratuity, bonuses, pending expenses, and asset deductions", () => {
        const fnf = calculateFnFSettlement({
          monthlyGross: 75000,
          basicSalaryRate: 37500,
          workingDaysInFinalMonth: 30,
          payableDaysInFinalMonth: 20, // 20 * 2500 = ₹50,000
          leaveEncashmentDays: 5, // 5 * 1250 = ₹6,250
          gratuityAmount: 150000,
          bonusIncentives: 25000,
          pendingExpenseClaims: 8000,
          noticeShortfallDays: 0,
          assetDeductions: 5000, // Damaged monitor
          statutoryDeductions: 3600, // PF/PT
          otherDeductions: 1000,
        });

        const expectedEarnings = 50000 + 6250 + 150000 + 25000 + 8000;
        const expectedDeductions = 5000 + 3600 + 1000;

        expect(fnf.unpaidSalaryAmount).toBe(50000);
        expect(fnf.leaveEncashmentAmount).toBe(6250);
        expect(fnf.totalEarnings).toBe(expectedEarnings);
        expect(fnf.totalDeductions).toBe(expectedDeductions);
        expect(fnf.netPayable).toBe(expectedEarnings - expectedDeductions);
      });

      it("enforces non-negative net payable boundary when deductions exceed earnings", () => {
        const fnf = calculateFnFSettlement({
          monthlyGross: 30000,
          basicSalaryRate: 15000,
          payableDaysInFinalMonth: 5, // 5 * 1000 = ₹5,000
          assetDeductions: 25000, // Lost MacBook
        });

        expect(fnf.totalEarnings).toBe(50000 / 10); // 5000
        expect(fnf.totalDeductions).toBe(25000);
        expect(fnf.netPayable).toBe(0); // Clamped at 0
      });
    });
  });
});
