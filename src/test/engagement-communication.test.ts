import { describe, it, expect } from "vitest";
import {
  ANNOUNCEMENT_CATEGORY_CONFIG,
  ANNOUNCEMENT_PRIORITY_CONFIG,
  SURVEY_TYPE_CONFIG,
  SURVEY_STATUS_CONFIG,
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUS_CONFIG,
  calculateENPS,
  calculateAverageRating,
  calculateOptionDistribution,
  AnnouncementCategory,
  AnnouncementPriority,
  SurveyType,
  SurveyStatus,
  SuggestionStatus,
} from "../lib/engagement";

describe("Phase 09: Employee Engagement & Internal Communication", () => {
  describe("Module 1: Announcements & Internal News", () => {
    it("defines all standard announcement and news categories", () => {
      const categories: AnnouncementCategory[] = [
        "announcement",
        "news",
        "circular",
        "policy_update",
        "celebration",
      ];
      categories.forEach((cat) => {
        expect(ANNOUNCEMENT_CATEGORY_CONFIG[cat]).toBeDefined();
        expect(ANNOUNCEMENT_CATEGORY_CONFIG[cat].label).toBeTruthy();
        expect(ANNOUNCEMENT_CATEGORY_CONFIG[cat].badgeClass).toBeTruthy();
      });
    });

    it("configures urgency and priority levels accurately", () => {
      const priorities: AnnouncementPriority[] = ["low", "normal", "high", "urgent"];
      priorities.forEach((p) => {
        expect(ANNOUNCEMENT_PRIORITY_CONFIG[p]).toBeDefined();
        expect(ANNOUNCEMENT_PRIORITY_CONFIG[p].label).toBeTruthy();
      });
      // Urgent priority has distinctive pulse styling
      expect(ANNOUNCEMENT_PRIORITY_CONFIG["urgent"].badgeClass).toContain("animate-pulse");
    });
  });

  describe("Module 2: Surveys, Feedback Forms & Quick Polls", () => {
    it("defines all engagement survey formats", () => {
      const types: SurveyType[] = [
        "poll",
        "survey",
        "feedback_form",
        "suggestion_box",
        "satisfaction",
      ];
      types.forEach((type) => {
        expect(SURVEY_TYPE_CONFIG[type]).toBeDefined();
        expect(SURVEY_TYPE_CONFIG[type].label).toBeTruthy();
        expect(SURVEY_TYPE_CONFIG[type].description).toBeTruthy();
      });
    });

    it("supports all survey lifecycle statuses", () => {
      const statuses: SurveyStatus[] = ["draft", "active", "closed", "archived"];
      statuses.forEach((status) => {
        expect(SURVEY_STATUS_CONFIG[status]).toBeDefined();
        expect(SURVEY_STATUS_CONFIG[status].label).toBeTruthy();
      });
    });

    describe("Poll & Multiple Choice Distribution Analytics", () => {
      it("calculates percentage and count distribution for single choice poll answers", () => {
        const options = ["Option A", "Option B", "Option C"];
        const answers = [
          { answer_text: "Option A" },
          { answer_text: "Option A" },
          { answer_text: "Option A" },
          { answer_text: "Option B" },
        ]; // Total = 4. Option A = 3 (75%), Option B = 1 (25%), Option C = 0 (0%)

        const result = calculateOptionDistribution(answers, options);
        expect(result).toHaveLength(3);

        expect(result[0]).toEqual({ option: "Option A", count: 3, percentage: 75 });
        expect(result[1]).toEqual({ option: "Option B", count: 1, percentage: 25 });
        expect(result[2]).toEqual({ option: "Option C", count: 0, percentage: 0 });
      });

      it("calculates percentage distribution for multiple choice checkbox answers", () => {
        const options = ["Coffee", "Tea", "Water"];
        const answers = [
          { selected_options: ["Coffee", "Water"] },
          { selected_options: ["Tea", "Coffee"] },
          { selected_options: ["Water"] },
        ]; // Coffee=2, Tea=1, Water=2. Total votes = 5

        const result = calculateOptionDistribution(answers, options);
        expect(result).toHaveLength(3);

        const coffee = result.find((r) => r.option === "Coffee");
        const tea = result.find((r) => r.option === "Tea");
        const water = result.find((r) => r.option === "Water");

        expect(coffee?.count).toBe(2);
        expect(coffee?.percentage).toBe(40); // 2/5 = 40%

        expect(tea?.count).toBe(1);
        expect(tea?.percentage).toBe(20); // 1/5 = 20%

        expect(water?.count).toBe(2);
        expect(water?.percentage).toBe(40); // 2/5 = 40%
      });

      it("safely handles empty answers or missing options", () => {
        expect(calculateOptionDistribution([], [])).toEqual([]);
        expect(calculateOptionDistribution([], ["Yes", "No"])).toEqual([
          { option: "Yes", count: 0, percentage: 0 },
          { option: "No", count: 0, percentage: 0 },
        ]);
      });
    });
  });

  describe("Module 3: Employee Satisfaction & eNPS Metric", () => {
    describe("eNPS (Employee Net Promoter Score) Calculation", () => {
      it("calculates correct eNPS when ratings span promoters, passives, and detractors", () => {
        // 10 responses:
        // Promoters (9-10): 6 employees (60%)
        // Passives (7-8): 2 employees (20%)
        // Detractors (1-6): 2 employees (20%)
        // eNPS = 60% - 20% = +40
        const ratings = [10, 9, 10, 9, 9, 10, 8, 7, 5, 4];
        const res = calculateENPS(ratings);

        expect(res.total).toBe(10);
        expect(res.promoters).toBe(6);
        expect(res.passives).toBe(2);
        expect(res.detractors).toBe(2);
        expect(res.promoterPct).toBe(60);
        expect(res.passivePct).toBe(20);
        expect(res.detractorPct).toBe(20);
        expect(res.score).toBe(40);
      });

      it("returns +100 for unanimous promoter ratings", () => {
        const ratings = [10, 10, 9, 10, 9];
        const res = calculateENPS(ratings);
        expect(res.score).toBe(100);
        expect(res.promoterPct).toBe(100);
        expect(res.detractorPct).toBe(0);
      });

      it("returns -100 for unanimous detractor ratings", () => {
        const ratings = [1, 2, 3, 5, 6];
        const res = calculateENPS(ratings);
        expect(res.score).toBe(-100);
        expect(res.detractorPct).toBe(100);
        expect(res.promoterPct).toBe(0);
      });

      it("returns 0 for balanced promoter and detractor proportions", () => {
        const ratings = [10, 9, 5, 4]; // 2 promoters (50%), 2 detractors (50%)
        const res = calculateENPS(ratings);
        expect(res.score).toBe(0);
      });

      it("gracefully handles empty ratings array", () => {
        const res = calculateENPS([]);
        expect(res.score).toBe(0);
        expect(res.total).toBe(0);
      });
    });

    describe("Average Rating Calculation", () => {
      it("computes arithmetic average of 1-5 star ratings to one decimal place", () => {
        expect(calculateAverageRating([5, 5, 5])).toBe(5.0);
        expect(calculateAverageRating([5, 4, 4, 3])).toBe(4.0);
        expect(calculateAverageRating([1, 2, 3, 4, 5])).toBe(3.0);
        expect(calculateAverageRating([4, 5, 4, 5, 3])).toBe(4.2);
      });

      it("handles empty or invalid ratings", () => {
        expect(calculateAverageRating([])).toBe(0);
        expect(calculateAverageRating([NaN as any])).toBe(0);
      });
    });
  });

  describe("Module 4: Employee Suggestions & Innovation Box", () => {
    it("defines all standard suggestion categories", () => {
      expect(SUGGESTION_CATEGORIES).toContain("Operations");
      expect(SUGGESTION_CATEGORIES).toContain("Workplace Culture");
      expect(SUGGESTION_CATEGORIES).toContain("Technology & Tools");
      expect(SUGGESTION_CATEGORIES).toContain("Cost Saving");
      expect(SUGGESTION_CATEGORIES).toContain("Wellness");
    });

    it("maps suggestion triage statuses", () => {
      const statuses: SuggestionStatus[] = [
        "submitted",
        "under_review",
        "planned",
        "implemented",
        "declined",
      ];
      statuses.forEach((status) => {
        expect(SUGGESTION_STATUS_CONFIG[status]).toBeDefined();
        expect(SUGGESTION_STATUS_CONFIG[status].label).toBeTruthy();
      });
      expect(SUGGESTION_STATUS_CONFIG["implemented"].label).toBe("Implemented");
    });
  });
});
