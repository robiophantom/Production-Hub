import { describe, expect, it } from "vitest";
import {
  calculateOrderHealth,
  calculateStageDelay,
  DEFAULT_RISK_SETTINGS,
  type DelayInput,
  type DelayMilestoneInput,
  type DelayUpdateInput,
} from "@/lib/business/delay";
import { latestWorkingDays } from "@/lib/business/working-days";

const TODAY = "2026-11-09"; // Monday

function milestone(overrides: Partial<DelayMilestoneInput> = {}): DelayMilestoneInput {
  return {
    id: "milestone-1",
    stage_id: "stage-stitching",
    stage_name: "Stitching",
    sequence: 5,
    planned_date: "2026-11-21",
    target_quantity: 1000,
    status: "in_progress",
    is_active: true,
    ...overrides,
  };
}

function dailyUpdates(quantity: number, days = 7): DelayUpdateInput[] {
  return latestWorkingDays(TODAY, days).map((date) => ({ update_date: date, quantity }));
}

function calculate(overrides: Partial<DelayInput> = {}) {
  return calculateStageDelay({
    milestone: milestone(),
    updates: dailyUpdates(100),
    today: TODAY,
    ...overrides,
  });
}

describe("stage delay engine", () => {
  it("marks sustainable output on schedule as green", () => {
    const result = calculate();
    expect(result.cumulativeQuantity).toBe(700);
    expect(result.remainingQuantity).toBe(300);
    expect(result.workingDaysLeft).toBe(11);
    expect(result.requiredDaily).toBeCloseTo(27.27, 1);
    expect(result.actualDaily).toBe(100);
    expect(result.projectedWorkingDays).toBe(3);
    expect(result.projectedCompletionDate).toBe("2026-11-12");
    expect(result.bufferDays).toBe(8);
    expect(result.health).toBe("green");
    expect(result.warningWindow).toBe("14_day");
    expect(result.hasSufficientData).toBe(true);
  });

  it("counts missing scheduled reports as zero output", () => {
    const updates = [
      { update_date: "2026-11-02", quantity: 100 },
      { update_date: "2026-11-03", quantity: 100 },
      { update_date: "2026-11-04", quantity: 100 },
      { update_date: "2026-11-09", quantity: 100 },
    ];
    const result = calculate({ updates });
    expect(result.dataDays).toBe(4);
    expect(result.actualDaily).toBeCloseTo(57.14, 1);
    expect(result.projectedCompletionDate).toBe("2026-11-21");
    expect(result.bufferDays).toBe(0);
    expect(result.health).toBe("amber");
    expect(result.formula.join(" ")).toContain("missing reports count as 0");
  });

  it("treats a stage with too few reported days as amber, never green", () => {
    const updates = [
      { update_date: "2026-11-06", quantity: 100 },
      { update_date: "2026-11-09", quantity: 100 },
    ];
    const result = calculate({ updates });
    expect(result.dataDays).toBe(2);
    expect(result.hasSufficientData).toBe(false);
    expect(result.health).toBe("amber");
    expect(result.formula.join(" ")).toContain("insufficient history");
  });

  it("marks an overdue stage with remaining quantity as red", () => {
    const result = calculate({ milestone: milestone({ planned_date: "2026-11-06" }) });
    expect(result.workingDaysLeft).toBe(0);
    expect(result.health).toBe("red");
    expect(result.warningWindow).toBe("overdue");
    expect(result.formula.join(" ")).toContain("planned milestone date has passed");
  });

  it("marks an active stage with no output at all as red", () => {
    const result = calculate({ updates: [] });
    expect(result.projectedCompletionDate).toBeNull();
    expect(result.actualDaily).toBe(0);
    expect(result.hasSufficientData).toBe(false);
    expect(result.health).toBe("red");
    expect(result.formula.join(" ")).toContain("production has not started");
  });

  it("keeps a not-yet-started future stage neutral and non-active", () => {
    const result = calculate({
      milestone: milestone({ status: "pending", planned_date: "2026-11-21" }),
      updates: [],
    });
    expect(result.isActive).toBe(false);
    expect(result.isStarted).toBe(false);
    expect(result.health).toBe("green");
    expect(result.projectedCompletionDate).toBeNull();
    expect(result.requiredDaily).toBe(0);
  });

  it("is complete when cumulative output meets the target", () => {
    const result = calculate({ updates: dailyUpdates(200, 5) }); // 1000 of 1000
    expect(result.remainingQuantity).toBe(0);
    expect(result.isComplete).toBe(true);
    expect(result.health).toBe("green");
    expect(result.requiredDaily).toBe(0);
  });

  it("never marks an unfinished stage as complete", () => {
    const result = calculate({ updates: dailyUpdates(100, 6) });
    expect(result.remainingQuantity).toBe(400);
    expect(result.isComplete).toBe(false);
  });

  it("ignores updates dated after the business date", () => {
    const result = calculate({
      updates: [...dailyUpdates(100), { update_date: "2026-11-10", quantity: 5000 }],
    });
    expect(result.cumulativeQuantity).toBe(700);
    expect(result.remainingQuantity).toBe(300);
  });

  it("uses configured risk thresholds", () => {
    const result = calculate({
      settings: { ...DEFAULT_RISK_SETTINGS, criticalDays: 20 },
    });
    expect(result.warningWindow).toBe("3_day");
  });
});

describe("order health roll-up", () => {
  const completed = calculate({
    milestone: milestone({ planned_date: "2026-11-05" }),
    updates: dailyUpdates(200, 5),
  });
  const healthy = calculate();
  const late = calculate({
    milestone: milestone({ planned_date: "2026-11-06" }),
  });

  it("uses the most critical active milestone", () => {
    const health = calculateOrderHealth([healthy, late], "2026-11-21", TODAY);
    expect(health.health).toBe("red");
    expect(health.criticalStage).toBe("Stitching");
    expect(health.plannedDate).toBe("2026-11-06");
  });

  it("stays green when every active milestone is healthy and shipping has room", () => {
    const health = calculateOrderHealth([healthy], "2026-11-21", TODAY);
    expect(health.health).toBe("green");
    expect(health.daysRemaining).toBe(11);
  });

  it("downgrades to amber when the ex-factory date is inside the buffer", () => {
    const health = calculateOrderHealth([healthy], "2026-11-11", TODAY);
    expect(health.health).toBe("amber");
    expect(health.basis).toContain("inside the healthy buffer");
  });

  it("marks the order red when the ex-factory date has passed", () => {
    const health = calculateOrderHealth([healthy], "2026-11-06", TODAY);
    expect(health.health).toBe("red");
    expect(health.basis).toContain("ex-factory date has passed");
    expect(health.daysRemaining).toBe(0);
  });

  it("reports green when all active milestones are complete", () => {
    const health = calculateOrderHealth([completed], "2026-11-21", TODAY);
    expect(health.health).toBe("green");
    expect(health.criticalStage).toBe("Completed");
    expect(health.projectedDate).toBeNull();
  });
});
