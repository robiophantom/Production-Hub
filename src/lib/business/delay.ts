import type { DelayCalculation, Health, OrderHealth } from "@/types";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  addWorkingDays,
  DEFAULT_CALENDAR,
  latestWorkingDays,
  previousWorkingDay,
  workingDaysBetween,
  workingDaysRemaining,
  type WorkCalendar,
} from "./working-days";

export interface RiskSettings {
  healthyBufferWorkingDays: number;
  insufficientDataDays: number;
  historyWindowDays: number;
  amberRateTolerancePercent: number;
  alertReviewDays: number;
  escalationDays: number;
  criticalDays: number;
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  healthyBufferWorkingDays: 2,
  insufficientDataDays: 3,
  historyWindowDays: 7,
  amberRateTolerancePercent: 5,
  alertReviewDays: 14,
  escalationDays: 7,
  criticalDays: 3,
};

export interface DelayMilestoneInput {
  id: string;
  stage_id: string;
  stage_name: string;
  sequence: number;
  planned_date: string;
  target_quantity: number;
  status: "pending" | "in_progress" | "completed";
  is_active: boolean;
}

export interface DelayUpdateInput {
  update_date: string;
  quantity: number;
}

export interface DelayInput {
  milestone: DelayMilestoneInput;
  updates: DelayUpdateInput[];
  today: string;
  calendar?: WorkCalendar;
  settings?: RiskSettings;
}

export function calculateStageDelay({
  milestone,
  updates,
  today,
  calendar = DEFAULT_CALENDAR,
  settings = DEFAULT_RISK_SETTINGS,
}: DelayInput): DelayCalculation {
  const validUpdates = updates.filter((update) => update.update_date <= today);
  const cumulative = validUpdates.reduce((sum, update) => sum + Number(update.quantity), 0);
  const target = Number(milestone.target_quantity);
  const remaining = Math.max(0, target - cumulative);
  const isComplete = remaining === 0 || milestone.status === "completed";
  const isStarted = cumulative > 0 || validUpdates.length > 0;
  const isActive =
    isStarted ||
    milestone.planned_date <= today ||
    milestone.status === "in_progress" ||
    milestone.status === "completed";
  const daysLeft = workingDaysRemaining(today, milestone.planned_date, calendar);

  const formula: string[] = [
    `Stage target = ${formatNumber(target)} pcs (${milestone.stage_name})`,
    `Remaining = max(0, ${formatNumber(target)} − ${formatNumber(cumulative)}) = ${formatNumber(remaining)} pcs`,
    `Working days left = ${daysLeft} (${calendar.label ?? "Monday to Saturday"})`,
  ];

  if (isComplete) {
    return {
      milestoneId: milestone.id,
      stageId: milestone.stage_id,
      stageName: milestone.stage_name,
      stageSequence: milestone.sequence,
      plannedDate: milestone.planned_date,
      targetQuantity: target,
      cumulativeQuantity: cumulative,
      remainingQuantity: 0,
      workingDaysLeft: daysLeft,
      requiredDaily: 0,
      actualDaily: 0,
      projectedWorkingDays: 0,
      projectedCompletionDate: today,
      shortfallPerDay: 0,
      bufferDays: null,
      health: "green",
      warningWindow: "none",
      hasSufficientData: true,
      dataDays: 0,
      calculatedAt: new Date().toISOString(),
      formula: [...formula, "Stage is complete."],
      isComplete: true,
      isStarted,
      isActive,
    };
  }

  if (!isActive) {
    return {
      milestoneId: milestone.id,
      stageId: milestone.stage_id,
      stageName: milestone.stage_name,
      stageSequence: milestone.sequence,
      plannedDate: milestone.planned_date,
      targetQuantity: target,
      cumulativeQuantity: cumulative,
      remainingQuantity: remaining,
      workingDaysLeft: daysLeft,
      requiredDaily: 0,
      actualDaily: 0,
      projectedWorkingDays: null,
      projectedCompletionDate: null,
      shortfallPerDay: 0,
      bufferDays: null,
      health: "green",
      warningWindow: "none",
      hasSufficientData: false,
      dataDays: 0,
      calculatedAt: new Date().toISOString(),
      formula: [
        ...formula,
        `Stage has not started yet; it is planned for ${formatDate(milestone.planned_date)}.`,
      ],
      isComplete: false,
      isStarted: false,
      isActive: false,
    };
  }

  const requiredDaily = daysLeft > 0 ? remaining / daysLeft : remaining;
  formula.push(
    daysLeft > 0
      ? `Required daily = ${formatNumber(remaining)} ÷ ${daysLeft} = ${requiredDaily.toFixed(1)} pcs/day`
      : `Required daily = no working days left before ${formatDate(milestone.planned_date)} (deadline reached)`,
  );

  // Rolling output window. If today has no report yet, average the completed
  // scheduled days up to yesterday. Missing scheduled days count as zero.
  const updateDates = new Set(validUpdates.map((update) => update.update_date));
  const windowEnd = updateDates.has(today) ? today : previousWorkingDay(today, calendar);
  const windowDates = latestWorkingDays(windowEnd, settings.historyWindowDays, calendar);
  const firstUpdateDate = validUpdates.reduce<string | null>(
    (earliest, update) =>
      earliest === null || update.update_date < earliest ? update.update_date : earliest,
    null,
  );
  const scheduledDates = firstUpdateDate
    ? windowDates.filter((date) => date >= firstUpdateDate)
    : [];

  const quantitiesByDate = new Map<string, number>();
  for (const update of validUpdates) {
    quantitiesByDate.set(
      update.update_date,
      (quantitiesByDate.get(update.update_date) ?? 0) + Number(update.quantity),
    );
  }

  const dataDays = scheduledDates.filter((date) => updateDates.has(date)).length;
  const windowQuantity = scheduledDates.reduce(
    (sum, date) => sum + (quantitiesByDate.get(date) ?? 0),
    0,
  );
  const actualDaily = scheduledDates.length > 0 ? windowQuantity / scheduledDates.length : 0;
  const hasSufficientData = dataDays >= settings.insufficientDataDays;

  formula.push(
    scheduledDates.length > 0
      ? `Actual daily = ${formatNumber(windowQuantity)} pcs ÷ ${scheduledDates.length} scheduled working days = ${actualDaily.toFixed(1)} pcs/day (missing reports count as 0)`
      : "Actual daily = no production history in the rolling window",
  );

  const projectedWorkingDays =
    remaining > 0 && actualDaily > 0 ? Math.ceil(remaining / actualDaily) : null;
  const projectedCompletionDate =
    projectedWorkingDays !== null ? addWorkingDays(today, projectedWorkingDays, calendar) : null;

  if (projectedWorkingDays !== null && projectedCompletionDate) {
    formula.push(
      `Projected duration = ⌈${formatNumber(remaining)} ÷ ${actualDaily.toFixed(1)}⌉ = ${projectedWorkingDays} working days`,
      `Projected completion = ${formatDate(projectedCompletionDate)} (from ${formatDate(today)})`,
    );
  } else {
    formula.push("Projected completion = unavailable (no output recorded and quantity remains)");
  }

  const bufferDays =
    projectedCompletionDate !== null
      ? workingDaysBetween(projectedCompletionDate, milestone.planned_date, calendar)
      : null;

  if (bufferDays !== null) {
    formula.push(
      `Buffer = ${bufferDays} working days between projected completion and planned ${formatDate(milestone.planned_date)} (healthy buffer ${settings.healthyBufferWorkingDays})`,
    );
  }

  const shortfallPerDay = Math.max(0, requiredDaily - actualDaily);
  formula.push(
    `Shortfall = max(0, ${requiredDaily.toFixed(1)} − ${actualDaily.toFixed(1)}) = ${shortfallPerDay.toFixed(1)} pcs/day`,
  );

  let health: Health = "green";

  if (milestone.planned_date < today) {
    health = "red";
    formula.push("Status: Red — the planned milestone date has passed with quantity remaining.");
  } else if (!hasSufficientData && dataDays > 0) {
    health = "amber";
    formula.push(
      `Status: Amber — insufficient history (${dataDays} reported day${dataDays === 1 ? "" : "s"}, ${settings.insufficientDataDays} required); not treated as healthy.`,
    );
  } else if (!hasSufficientData && dataDays === 0) {
    health = "red";
    formula.push("Status: Red — production has not started but the stage is not complete.");
  } else if (!projectedCompletionDate) {
    health = "red";
    formula.push("Status: Red — no output is being recorded.");
  } else if (projectedCompletionDate > milestone.planned_date) {
    health = "red";
    formula.push("Status: Red — projected completion is after the planned milestone date.");
  } else if ((bufferDays ?? 0) <= settings.healthyBufferWorkingDays) {
    health = "amber";
    formula.push(
      `Status: Amber — projected completion leaves ${bufferDays} working day(s) of buffer, at or below the healthy buffer.`,
    );
  } else if (actualDaily < requiredDaily * (1 - settings.amberRateTolerancePercent / 100)) {
    health = "amber";
    formula.push(
      `Status: Amber — actual daily output is ${settings.amberRateTolerancePercent}% below the required rate.`,
    );
  } else {
    formula.push("Status: Green — projected completion is inside the healthy buffer.");
  }

  let warningWindow: DelayCalculation["warningWindow"] = "none";
  if (milestone.planned_date < today) warningWindow = "overdue";
  else if (daysLeft <= settings.criticalDays) warningWindow = "3_day";
  else if (daysLeft <= settings.escalationDays) warningWindow = "7_day";
  else if (daysLeft <= settings.alertReviewDays) warningWindow = "14_day";

  return {
    milestoneId: milestone.id,
    stageId: milestone.stage_id,
    stageName: milestone.stage_name,
    stageSequence: milestone.sequence,
    plannedDate: milestone.planned_date,
    targetQuantity: target,
    cumulativeQuantity: cumulative,
    remainingQuantity: remaining,
    workingDaysLeft: daysLeft,
    requiredDaily,
    actualDaily,
    projectedWorkingDays,
    projectedCompletionDate,
    shortfallPerDay,
    bufferDays,
    health,
    warningWindow,
    hasSufficientData,
    dataDays,
    calculatedAt: new Date().toISOString(),
    formula,
    isComplete: false,
    isStarted,
    isActive,
  };
}

const HEALTH_RANK: Record<Health, number> = { green: 0, amber: 1, red: 2 };

export function calculateOrderHealth(
  calculations: DelayCalculation[],
  exFactoryDate: string,
  today: string,
  calendar: WorkCalendar = DEFAULT_CALENDAR,
  settings: RiskSettings = DEFAULT_RISK_SETTINGS,
): OrderHealth {
  const active = calculations.filter((calc) => !calc.isComplete && calc.isActive);

  if (active.length === 0) {
    return {
      health: "green",
      basis: "All active production milestones are complete.",
      criticalStage: "Completed",
      plannedDate: exFactoryDate,
      projectedDate: null,
      daysRemaining: workingDaysRemaining(today, exFactoryDate, calendar),
    };
  }

  const critical = [...active].sort(
    (a, b) => HEALTH_RANK[b.health] - HEALTH_RANK[a.health] || a.stageSequence - b.stageSequence,
  )[0];

  let health = critical.health;
  let basis = describeRisk(critical);

  if (exFactoryDate < today && health !== "red") {
    health = "red";
    basis = "The ex-factory date has passed and production is still active.";
  } else if (health === "green") {
    const daysToShip = workingDaysRemaining(today, exFactoryDate, calendar);
    if (daysToShip <= settings.healthyBufferWorkingDays) {
      health = "amber";
      basis = `The ex-factory date is ${daysToShip} working day(s) away, inside the healthy buffer.`;
    }
  }

  return {
    health,
    basis,
    criticalStage: critical.stageName,
    plannedDate: critical.plannedDate,
    projectedDate: critical.projectedCompletionDate,
    daysRemaining: workingDaysRemaining(today, exFactoryDate, calendar),
  };
}

function describeRisk(calculation: DelayCalculation): string {
  if (calculation.isComplete) return `${calculation.stageName} is complete.`;
  if (!calculation.hasSufficientData) {
    return `${calculation.stageName} has insufficient production history to confirm it is on track.`;
  }
  if (!calculation.projectedCompletionDate) {
    return `${calculation.stageName} has remaining quantity and no recorded output.`;
  }
  if (calculation.health === "red") {
    return `${calculation.stageName} is projected to finish after its planned date (${formatDate(
      calculation.projectedCompletionDate,
    )} vs ${formatDate(calculation.plannedDate)}).`;
  }
  if (calculation.health === "amber") {
    return `${calculation.stageName} is at risk with ${calculation.bufferDays ?? 0} working day(s) of buffer.`;
  }
  return `${calculation.stageName} is on track with ${calculation.bufferDays ?? 0} working day(s) of buffer.`;
}
