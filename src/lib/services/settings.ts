import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import {
  DEFAULT_RISK_SETTINGS,
  type RiskSettings,
} from "@/lib/business/delay";
import { DEFAULT_CALENDAR, todayISO, type WorkCalendar } from "@/lib/business/working-days";

export interface AppDefaults {
  language: "en" | "ta";
  alertReviewDays: number;
  escalationDays: number;
  criticalDays: number;
}

export interface AppConfig {
  calendar: WorkCalendar;
  risk: RiskSettings;
  defaults: AppDefaults;
  businessDate: string;
  timezone: string;
}

function parseSetting<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return { ...fallback, ...(JSON.parse(value) as T) };
    } catch {
      return fallback;
    }
  }
  return { ...fallback, ...(value as T) };
}

export async function getAppConfig(): Promise<AppConfig> {
  const rows = await sql<{ key: string; value: unknown }>(
    "select key, value from app_settings where key in ('working_days', 'risk_thresholds', 'defaults')",
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const workingDays = parseSetting(map.get("working_days"), {
    excludedWeekdays: DEFAULT_CALENDAR.excludedWeekdays,
    label: DEFAULT_CALENDAR.label,
  });
  const riskRaw = parseSetting(map.get("risk_thresholds"), {
    healthyBufferWorkingDays: DEFAULT_RISK_SETTINGS.healthyBufferWorkingDays,
    insufficientDataDays: DEFAULT_RISK_SETTINGS.insufficientDataDays,
    historyWindowDays: DEFAULT_RISK_SETTINGS.historyWindowDays,
    amberRateTolerancePercent: DEFAULT_RISK_SETTINGS.amberRateTolerancePercent,
  });
  const defaults = parseSetting<AppDefaults>(map.get("defaults"), {
    language: "en",
    alertReviewDays: DEFAULT_RISK_SETTINGS.alertReviewDays,
    escalationDays: DEFAULT_RISK_SETTINGS.escalationDays,
    criticalDays: DEFAULT_RISK_SETTINGS.criticalDays,
  });

  const config = env();

  return {
    calendar: {
      excludedWeekdays: Array.isArray(workingDays.excludedWeekdays)
        ? workingDays.excludedWeekdays.map(Number)
        : DEFAULT_CALENDAR.excludedWeekdays,
      label: workingDays.label ?? DEFAULT_CALENDAR.label,
    },
    risk: {
      healthyBufferWorkingDays: Number(riskRaw.healthyBufferWorkingDays),
      insufficientDataDays: Number(riskRaw.insufficientDataDays),
      historyWindowDays: Number(riskRaw.historyWindowDays),
      amberRateTolerancePercent: Number(riskRaw.amberRateTolerancePercent),
      alertReviewDays: Number(defaults.alertReviewDays),
      escalationDays: Number(defaults.escalationDays),
      criticalDays: Number(defaults.criticalDays),
    },
    defaults,
    businessDate: todayISO(config.businessTimezone),
    timezone: config.businessTimezone,
  };
}
