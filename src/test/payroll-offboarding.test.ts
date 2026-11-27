import { describe, it, expect } from "vitest";
import {
  MONTH_NAMES,
  INDIAN_STATES,
  formatINR,
  numberToWordsIndian,
  calculateStatutoryComponents,
} from "../lib/payroll";

describe("Phase 08: Payroll Management", () => {
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
});
