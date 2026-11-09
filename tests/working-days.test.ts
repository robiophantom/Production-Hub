import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  addWorkingDays,
  countWorkingDays,
  DEFAULT_CALENDAR,
  isWorkingDay,
  latestWorkingDays,
  previousWorkingDay,
  weekdayOf,
  workingDaysBetween,
  workingDaysRemaining,
} from "@/lib/business/working-days";

// November 2026: the 1st and 8th are Sundays; the 7th, 14th and 21st are Saturdays.
describe("working-day calendar", () => {
  it("treats Sunday as the default non-working day", () => {
    expect(weekdayOf("2026-11-08")).toBe(0);
    expect(isWorkingDay("2026-11-08")).toBe(false);
    expect(isWorkingDay("2026-11-07")).toBe(true);
    expect(DEFAULT_CALENDAR.excludedWeekdays).toEqual([0]);
  });

  it("counts an inclusive working-day range", () => {
    // Mon 2 Nov through Sun 8 Nov contains six working days.
    expect(countWorkingDays("2026-11-02", "2026-11-08")).toBe(6);
    expect(countWorkingDays("2026-11-02", "2026-11-02")).toBe(1);
    expect(countWorkingDays("2026-11-02", "2026-10-30")).toBe(0);
  });

  it("supports a configurable non-working week (Fri + Sat off)", () => {
    const calendar = { excludedWeekdays: [5, 6], label: "Sunday to Thursday" };
    // Mon 2 Nov → Sun 8 Nov: Mon–Thu + Sun = 5 working days.
    expect(countWorkingDays("2026-11-02", "2026-11-08", calendar)).toBe(5);
    expect(isWorkingDay("2026-11-06", calendar)).toBe(false);
    expect(addWorkingDays("2026-11-05", 1, calendar)).toBe("2026-11-08");
  });

  it("returns zero remaining days when the deadline is today or passed", () => {
    expect(workingDaysRemaining("2026-11-06", "2026-11-06")).toBe(0);
    expect(workingDaysRemaining("2026-11-09", "2026-11-06")).toBe(0);
    // Friday 6 Nov → Monday 9 Nov: Saturday and Monday remain.
    expect(workingDaysRemaining("2026-11-06", "2026-11-09")).toBe(2);
  });

  it("lists the last scheduled working days in ascending order", () => {
    expect(latestWorkingDays("2026-11-09", 7)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-09",
    ]);
    expect(latestWorkingDays("2026-11-08", 3)).toEqual([
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
  });

  it("advances by working days, skipping Sundays", () => {
    expect(addWorkingDays("2026-11-06", 1)).toBe("2026-11-07");
    expect(addWorkingDays("2026-11-06", 2)).toBe("2026-11-09");
    expect(addWorkingDays("2026-11-06", 0)).toBe("2026-11-06");
  });

  it("measures signed working-day distance", () => {
    expect(workingDaysBetween("2026-11-06", "2026-11-09")).toBe(2);
    expect(workingDaysBetween("2026-11-09", "2026-11-06")).toBe(-2);
    expect(workingDaysBetween("2026-11-09", "2026-11-09")).toBe(0);
  });

  it("finds the previous working day across a Sunday", () => {
    expect(previousWorkingDay("2026-11-09")).toBe("2026-11-07");
    expect(previousWorkingDay("2026-11-08")).toBe("2026-11-07");
    expect(previousWorkingDay("2026-11-07")).toBe("2026-11-06");
  });

  it("adds calendar days across month and year boundaries", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2027-03-01", -1)).toBe("2027-02-28");
    expect(addDaysISO("2028-03-01", -1)).toBe("2028-02-29");
  });
});
