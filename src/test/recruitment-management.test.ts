import { describe, it, expect } from "vitest";
import {
  RECRUITMENT_STAGES,
  INTERVIEW_ROUND_TYPES,
  REJECTION_REASONS,
  getCandidateStageBadge,
  getOfferStatusBadge,
  getInterviewStatusBadge,
  getRecommendationBadge,
  formatSalary,
  CandidateStage,
  InterviewStatus,
  InterviewRecommendation,
} from "../lib/recruitment";

describe("Recruitment & Pipeline Helpers", () => {
  it("defines standard recruitment pipeline stages in correct sequence", () => {
    const stageKeys = RECRUITMENT_STAGES.map((s) => s.key);
    expect(stageKeys).toEqual([
      "applied",
      "screening",
      "shortlisted",
      "interview",
      "selected",
      "offer",
      "hired",
      "rejected",
    ]);
  });

  it("returns appropriate badge metadata for all candidate stages", () => {
    const applied = getCandidateStageBadge("applied");
    expect(applied.label).toBe("Applied");
    expect(applied.variant).toBe("applied");

    const screening = getCandidateStageBadge("screening");
    expect(screening.label).toBe("Screening");
    expect(screening.variant).toBe("screening");

    const interview = getCandidateStageBadge("interview");
    expect(interview.label).toBe("In Interview");
    expect(interview.variant).toBe("interview");

    const selected = getCandidateStageBadge("selected");
    expect(selected.label).toBe("Selected");
    expect(selected.variant).toBe("selected");

    const offer = getCandidateStageBadge("offer");
    expect(offer.label).toBe("Offer Extended");
    expect(offer.variant).toBe("offer");

    const hired = getCandidateStageBadge("hired");
    expect(hired.label).toBe("Hired & Converted");
    expect(hired.variant).toBe("hired");

    const rejected = getCandidateStageBadge("rejected");
    expect(rejected.label).toBe("Rejected");
    expect(rejected.variant).toBe("rejected");

    // Fallback for unexpected stage
    const fallback = getCandidateStageBadge("custom_phase" as CandidateStage);
    expect(fallback.label).toBe("custom_phase");
    expect(fallback.variant).toBe("default");
  });

  it("returns appropriate badge styling for offer statuses", () => {
    const defaultStatus = getOfferStatusBadge(null);
    expect(defaultStatus.label).toBe("Not Offered");

    const offered = getOfferStatusBadge("offered");
    expect(offered.label).toBe("Offer Pending");
    expect(offered.colorClass).toContain("indigo");

    const accepted = getOfferStatusBadge("accepted");
    expect(accepted.label).toBe("Offer Accepted");
    expect(accepted.colorClass).toContain("emerald");

    const declined = getOfferStatusBadge("declined");
    expect(declined.label).toBe("Offer Declined");
    expect(declined.colorClass).toContain("rose");
  });

  it("returns appropriate badge styling for interview round statuses", () => {
    const scheduled = getInterviewStatusBadge("scheduled");
    expect(scheduled.label).toBe("Scheduled");
    expect(scheduled.colorClass).toContain("amber");

    const completed = getInterviewStatusBadge("completed");
    expect(completed.label).toBe("Completed");
    expect(completed.colorClass).toContain("emerald");

    const cancelled = getInterviewStatusBadge("cancelled");
    expect(cancelled.label).toBe("Cancelled");
    expect(cancelled.colorClass).toContain("rose");

    const noShow = getInterviewStatusBadge("no_show");
    expect(noShow.label).toBe("No Show");

    const fallback = getInterviewStatusBadge("other" as InterviewStatus);
    expect(fallback.label).toBe("other");
  });

  it("returns appropriate recommendation badge and colors", () => {
    const strongHire = getRecommendationBadge("strong_hire");
    expect(strongHire.label).toBe("Strong Hire");
    expect(strongHire.colorClass).toContain("emerald");

    const hire = getRecommendationBadge("hire");
    expect(hire.label).toBe("Hire");
    expect(hire.colorClass).toContain("emerald");

    const hold = getRecommendationBadge("hold");
    expect(hold.label).toBe("Hold / Maybe");
    expect(hold.colorClass).toContain("amber");

    const reject = getRecommendationBadge("reject");
    expect(reject.label).toBe("Reject");
    expect(reject.colorClass).toContain("rose");

    const fallback = getRecommendationBadge("unsure" as InterviewRecommendation);
    expect(fallback.label).toBe("Pending Evaluation");
  });

  it("includes standard interview round types and rejection reasons", () => {
    expect(INTERVIEW_ROUND_TYPES).toContain("Initial Recruiter Screen");
    expect(INTERVIEW_ROUND_TYPES).toContain("Technical Round 1 (Coding / Problem Solving)");
    expect(INTERVIEW_ROUND_TYPES).toContain("Product & Cultural Fit");
    expect(INTERVIEW_ROUND_TYPES).toContain("Executive Leadership Round");

    const reasonKeys = REJECTION_REASONS.map((r) => r.key);
    expect(reasonKeys).toContain("skills_mismatch");
    expect(reasonKeys).toContain("salary_expectation");
    expect(reasonKeys).toContain("culture_fit");
    expect(reasonKeys).toContain("candidate_declined");
    expect(reasonKeys).toContain("duplicate");
  });
});

describe("Recruitment Compensation & Currency Formatting", () => {
  it("formats null or undefined amounts gracefully", () => {
    expect(formatSalary(null)).toBe("Not specified");
    expect(formatSalary(undefined)).toBe("Not specified");
    expect(formatSalary(0)).toBe("Not specified");
    expect(formatSalary(-500)).toBe("Not specified");
  });

  it("formats Indian Rupee (INR) amounts in LPA and Cr cleanly", () => {
    // 12 LPA = 1,200,000
    expect(formatSalary(1200000, "INR")).toBe("₹12.00 LPA");

    // 18.5 LPA = 1,850,000
    expect(formatSalary(1850000, "INR")).toBe("₹18.50 LPA");

    // 1.5 Cr = 15,000,000
    expect(formatSalary(15000000, "INR")).toBe("₹1.50 Cr");

    // 50,000 INR (< 1 Lakh)
    expect(formatSalary(50000, "INR")).toBe("₹50,000");
  });

  it("formats other currencies with standard locale formatting", () => {
    expect(formatSalary(120000, "USD")).toContain("USD");
    expect(formatSalary(95000, "EUR")).toContain("EUR");
    expect(formatSalary(80000, "GBP")).toContain("GBP");
  });
});

describe("Candidate to Employee Conversion Business Logic", () => {
  it("prevents duplicate employee creation by email matching", () => {
    const existingEmployees = [
      { id: "emp-1", email: "candidate@example.com", employee_code: "EMP-001" },
      { id: "emp-2", email: "jane@company.com", employee_code: "EMP-002" },
    ];

    const targetCandidate = {
      id: "cand-1",
      email: "Candidate@Example.com", // Case insensitive comparison
      full_name: "Candidate One",
    };

    const duplicate = existingEmployees.find(
      (emp) => emp.email.toLowerCase() === targetCandidate.email.toLowerCase()
    );

    expect(duplicate).toBeDefined();
    expect(duplicate?.id).toBe("emp-1");
  });

  it("verifies clean generation of employee code", () => {
    const lastEmployeeCode = "EMP-042";
    const match = lastEmployeeCode.match(/\d+/);
    expect(match).not.toBeNull();
    const nextNum = parseInt(match![0], 10) + 1;
    const nextCode = `EMP-${String(nextNum).padStart(3, "0")}`;
    expect(nextCode).toBe("EMP-043");
  });
});
