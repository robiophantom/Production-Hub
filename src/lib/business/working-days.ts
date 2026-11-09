export interface WorkCalendar {
  /** 0 = Sunday … 6 = Saturday — days excluded from the working week. */
  excludedWeekdays: number[];
  label?: string;
}

export const DEFAULT_CALENDAR: WorkCalendar = {
  excludedWeekdays: [0],
  label: "Monday to Saturday (Sunday off)",
};

export function parseISODate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

export function toISODate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDaysISO(value: string, days: number): string {
  const date = parseISODate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function todayISO(timezone = "Asia/Kolkata"): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export function weekdayOf(value: string): number {
  return parseISODate(value).getUTCDay();
}

export function isWorkingDay(value: string, calendar: WorkCalendar = DEFAULT_CALENDAR): boolean {
  return !calendar.excludedWeekdays.includes(weekdayOf(value));
}

export function isWeekend(value: string, calendar: WorkCalendar = DEFAULT_CALENDAR): boolean {
  return !isWorkingDay(value, calendar);
}

/** Inclusive count of scheduled working days between two business dates. */
export function countWorkingDays(
  startISO: string,
  endISO: string,
  calendar: WorkCalendar = DEFAULT_CALENDAR,
): number {
  if (endISO < startISO) return 0;
  let cursor = startISO;
  let count = 0;
  while (cursor <= endISO) {
    if (isWorkingDay(cursor, calendar)) count += 1;
    cursor = addDaysISO(cursor, 1);
  }
  return count;
}

/**
 * Working days a team still has *after* today, up to and including the planned
 * date. A deadline of today has zero remaining working days.
 */
export function workingDaysRemaining(
  today: string,
  plannedDate: string,
  calendar: WorkCalendar = DEFAULT_CALENDAR,
): number {
  if (plannedDate <= today) return 0;
  return countWorkingDays(addDaysISO(today, 1), plannedDate, calendar);
}

/**
 * The last `count` scheduled working days ending at `endISO` (inclusive),
 * returned in ascending date order. Used for the rolling output average.
 */
export function latestWorkingDays(
  endISO: string,
  count: number,
  calendar: WorkCalendar = DEFAULT_CALENDAR,
): string[] {
  const days: string[] = [];
  let cursor = endISO;
  let guard = 0;
  while (days.length < count && guard < 400) {
    if (isWorkingDay(cursor, calendar)) days.push(cursor);
    cursor = addDaysISO(cursor, -1);
    guard += 1;
  }
  return days.reverse();
}

/** Advances by `days` scheduled working days (day 1 is the next working day). */
export function addWorkingDays(
  fromISO: string,
  days: number,
  calendar: WorkCalendar = DEFAULT_CALENDAR,
): string {
  if (days <= 0) return fromISO;
  let cursor = fromISO;
  let remaining = days;
  let guard = 0;
  while (remaining > 0 && guard < 2000) {
    cursor = addDaysISO(cursor, 1);
    if (isWorkingDay(cursor, calendar)) remaining -= 1;
    guard += 1;
  }
  return cursor;
}

/**
 * Signed working-day distance from `from` to `to`: positive when `to` is later.
 * Same day = 0.
 */
export function workingDaysBetween(
  fromISO: string,
  toISO: string,
  calendar: WorkCalendar = DEFAULT_CALENDAR,
): number {
  if (fromISO === toISO) return 0;
  if (toISO > fromISO) {
    return countWorkingDays(addDaysISO(fromISO, 1), toISO, calendar);
  }
  return -countWorkingDays(addDaysISO(toISO, 1), fromISO, calendar);
}

export function previousWorkingDay(
  fromISO: string,
  calendar: WorkCalendar = DEFAULT_CALENDAR,
): string {
  let cursor = addDaysISO(fromISO, -1);
  let guard = 0;
  while (!isWorkingDay(cursor, calendar) && guard < 30) {
    cursor = addDaysISO(cursor, -1);
    guard += 1;
  }
  return cursor;
}

export function formatWorkingWeek(calendar: WorkCalendar = DEFAULT_CALENDAR): string {
  return calendar.label ?? "Monday to Saturday (Sunday off)";
}
