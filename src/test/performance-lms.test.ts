import { describe, it, expect } from "vitest";
import {
  calculateGoalCompletionStats,
  calculateWeightedScore,
  getGradeBadge,
  getReviewStageBadge,
  getGoalStatusBadge,
  getCourseLevelBadge,
  getEnrollmentStatusBadge,
  formatCourseDuration,
  PerformanceGoal,
} from "../lib/performance-lms";

describe("Phase 06: Performance Management & LMS", () => {
  describe("Goal Completion Statistics", () => {
    it("returns zero stats when goals list is empty", () => {
      const stats = calculateGoalCompletionStats([]);
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.inProgress).toBe(0);
      expect(stats.averageProgress).toBe(0);
    });

    it("calculates completion stats and average progress accurately", () => {
      const mockGoals: PerformanceGoal[] = [
        {
          id: "g1",
          employee_id: "e1",
          title: "Ship Q1 feature",
          goal_type: "individual",
          progress: 100,
          status: "achieved",
          created_at: new Date().toISOString(),
        },
        {
          id: "g2",
          employee_id: "e1",
          title: "Improve unit test coverage",
          goal_type: "kpi",
          progress: 50,
          status: "in_progress",
          created_at: new Date().toISOString(),
        },
        {
          id: "g3",
          employee_id: "e1",
          title: "Lead department workshop",
          goal_type: "department",
          progress: 0,
          status: "not_started",
          created_at: new Date().toISOString(),
        },
      ];

      const stats = calculateGoalCompletionStats(mockGoals);
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.inProgress).toBe(1);
      // (100 + 50 + 0) / 3 = 50%
      expect(stats.averageProgress).toBe(50);
    });

    it("counts exceeded and 100% goals as completed", () => {
      const mockGoals: PerformanceGoal[] = [
        {
          id: "g1",
          employee_id: "e1",
          title: "Revenue target",
          goal_type: "kpi",
          progress: 120,
          status: "exceeded",
          created_at: new Date().toISOString(),
        },
      ];

      const stats = calculateGoalCompletionStats(mockGoals);
      expect(stats.completed).toBe(1);
      expect(stats.averageProgress).toBe(120);
    });
  });

  describe("Weighted Performance Score Calculation", () => {
    it("computes standard weighted score (40% self, 60% manager)", () => {
      // Self: 4.0, Manager: 5.0 -> 4.0 * 0.4 + 5.0 * 0.6 = 1.6 + 3.0 = 4.6
      const score = calculateWeightedScore(4.0, 5.0, 0.4, 0.6);
      expect(score).toBe(4.6);
    });

    it("handles equal weighting correctly", () => {
      // Self: 3.0, Manager: 4.0 -> (3.0 + 4.0) * 0.5 = 3.5
      const score = calculateWeightedScore(3.0, 4.0, 0.5, 0.5);
      expect(score).toBe(3.5);
    });

    it("falls back gracefully when only manager rating exists", () => {
      const score = calculateWeightedScore(null, 4.2);
      expect(score).toBe(4.2);
    });

    it("falls back gracefully when only self rating exists", () => {
      const score = calculateWeightedScore(3.8, null);
      expect(score).toBe(3.8);
    });

    it("returns 0 if both ratings are missing", () => {
      const score = calculateWeightedScore(null, null);
      expect(score).toBe(0);
    });
  });

  describe("Grade and Badge Mappings", () => {
    it("returns correct badges for appraisal grades", () => {
      expect(getGradeBadge("Outstanding").label).toContain("Outstanding");
      expect(getGradeBadge("Exceeds Expectations").label).toContain("Exceeds Expectations");
      expect(getGradeBadge("Meets Expectations").label).toContain("Meets Expectations");
      expect(getGradeBadge("Needs Improvement").label).toContain("Needs Improvement");
    });

    it("maps review stages to sequential steps", () => {
      expect(getReviewStageBadge("self_review").step).toBe(1);
      expect(getReviewStageBadge("manager_review").step).toBe(2);
      expect(getReviewStageBadge("hr_calibration").step).toBe(3);
      expect(getReviewStageBadge("completed").step).toBe(4);
    });

    it("maps goal status badges correctly", () => {
      expect(getGoalStatusBadge("achieved").label).toBe("Achieved");
      expect(getGoalStatusBadge("exceeded").label).toBe("Exceeded Target");
      expect(getGoalStatusBadge("in_progress").label).toBe("In Progress");
      expect(getGoalStatusBadge("not_started").label).toBe("Not Started");
      expect(getGoalStatusBadge("cancelled").label).toBe("Cancelled");
    });
  });

  describe("LMS Course Duration & Badges", () => {
    it("formats minutes into readable hours and minutes", () => {
      expect(formatCourseDuration(45)).toBe("45 mins");
      expect(formatCourseDuration(60)).toBe("1 hr");
      expect(formatCourseDuration(90)).toBe("1h 30m");
      expect(formatCourseDuration(135)).toBe("2h 15m");
    });

    it("provides skill level badges", () => {
      expect(getCourseLevelBadge("beginner").label).toBe("Beginner");
      expect(getCourseLevelBadge("intermediate").label).toBe("Intermediate");
      expect(getCourseLevelBadge("advanced").label).toBe("Advanced");
      expect(getCourseLevelBadge("all_levels").label).toBe("All Levels");
    });

    it("detects completed and overdue enrollment states", () => {
      // Completed status
      expect(getEnrollmentStatusBadge("completed").label).toBe("Completed");

      // Past due date with incomplete status -> Overdue
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      expect(getEnrollmentStatusBadge("in_progress", pastDate).label).toBe("Overdue");

      // Future due date -> Active status
      const futureDate = new Date(Date.now() + 86400000 * 7).toISOString();
      expect(getEnrollmentStatusBadge("in_progress", futureDate).label).toBe("In Progress");
      expect(getEnrollmentStatusBadge("enrolled", futureDate).label).toBe("Enrolled / Not Started");
    });
  });
});
