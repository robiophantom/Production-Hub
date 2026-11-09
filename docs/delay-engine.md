# Delay engine

The delay engine lives in `src/lib/business/delay.ts` with calendar maths in `src/lib/business/working-days.ts`. It is deterministic, pure TypeScript with the business date and calendar supplied by the caller. **AI is never used to decide delays, health or alerts.**

## Inputs

| Input | Source |
| --- | --- |
| Stage target | `order_milestones.target_quantity` |
| Cumulative production | Sum of `production_updates.quantity` for the milestone where `update_date <= today` |
| Planned date | `order_milestones.planned_date` |
| Today | `todayISO(BUSINESS_TIMEZONE)`, default `Asia/Kolkata` |
| Calendar | `app_settings.working_days`, default Monday–Saturday with Sunday excluded |
| Thresholds | `app_settings.risk_thresholds` and `defaults` |

Future-dated updates are ignored by the calculation even if they exist in the database.

## Working-day calendar

- A business date is a plain `YYYY-MM-DD` string; all arithmetic uses UTC-midnight dates and never the server's local timezone.
- `workingDaysRemaining(today, planned)` counts the scheduled working days **after today up to and including** the planned date. A deadline of today has zero remaining days.
- `latestWorkingDays(end, 7)` returns the seven most recent scheduled working days ending on `end`, ascending.
- `addWorkingDays(from, n)` advances by `n` scheduled working days; `workingDaysBetween(a, b)` is the signed distance between two dates.
- Administrators can exclude Friday and Saturday instead of Sunday; the label shown in the UI is stored with the setting.

## Stage formulas

```
remaining        = max(0, target − cumulative)
workingDaysLeft  = scheduled working days after today, up to planned date
requiredDaily    = remaining > 0
                     ? (workingDaysLeft > 0 ? remaining / workingDaysLeft : remaining)
                     : 0
```

### Actual daily output

```
windowEnd   = today if an update exists today, otherwise the previous working day
windowDates = the last 7 scheduled working days ending at windowEnd
scheduled   = windowDates filtered to dates on/after the first recorded update
actualDaily = sum(quantities on scheduled dates) / scheduled.length
```

Missing scheduled days count as **zero**. If the supervisor started reporting three scheduled days ago, only those three days form the denominator; once seven scheduled days exist, the window is a true seven-day rolling average. If there is no history at all, actual daily output is zero.

### Projection and buffer

```
projectedWorkingDays   = actualDaily > 0 ? ceil(remaining / actualDaily) : null
projectedCompletion    = projectedWorkingDays !== null
                           ? addWorkingDays(today, projectedWorkingDays)
                           : null
bufferDays             = projectedCompletion !== null
                           ? workingDaysBetween(projectedCompletion, plannedDate)
                           : null
shortfallPerDay        = max(0, requiredDaily − actualDaily)
```

`bufferDays` is positive when the projection lands before the planned date, zero when it lands on the planned date, and negative when it lands after.

### Data sufficiency

`dataDays` is the number of scheduled days in the rolling window that actually have a report. A stage has sufficient data when `dataDays >= insufficientDataDays` (default 3). If a stage has started but has fewer reported days, its health is amber rather than green. If it has no reported days at all while quantity remains, it is red.

## Health rules

Rules are evaluated in order; the first match wins.

| # | Condition | Health |
| --- | --- | --- |
| 1 | Remaining = 0 or milestone status is completed | Green (complete) |
| 2 | Stage has not started and its planned date is in the future | Green (neutral, not treated as on track) |
| 3 | Planned date is before today and quantity remains | Red |
| 4 | Started, but fewer than `insufficientDataDays` reported days | Amber |
| 5 | Started with no reported days at all | Red |
| 6 | No projected completion (no output) | Red |
| 7 | Projected completion is after the planned date | Red |
| 8 | Buffer ≤ `healthyBufferWorkingDays` (default 2) | Amber |
| 9 | Actual daily output is more than `amberRateTolerancePercent` (default 5%) below required daily | Amber |
| 10 | Otherwise | Green |

Stages that have not started appear as neutral green so the UI does not mark a future stage as a risk prematurely; the order roll-up ignores them.

## Warning windows

The window drives alerts and is independent of health:

| Condition | Window |
| --- | --- |
| Planned date before today | `overdue` |
| Days left ≤ 3 | `3_day` |
| Days left ≤ 7 | `7_day` |
| Days left ≤ 14 | `14_day` |
| Otherwise | `none` |

Thresholds come from `defaults.criticalDays`, `defaults.escalationDays` and `defaults.alertReviewDays`.

## Order-level health

1. Take all incomplete, active milestone calculations.
2. If none remain, the order is green ("all active milestones complete").
3. Otherwise the most critical result wins: red beats amber beats green; ties are broken by the earliest stage sequence.
4. If the ex-factory date has passed while production is active, the order is red regardless of the stage result.
5. If the stage result is green but the ex-factory date is within the healthy buffer (≤ 2 working days), the order is amber.

The roll-up returns a human-readable basis, the critical stage, planned and projected dates and the working days remaining to ex-factory.

## Worked example

Business date **Monday 9 November 2026**, planned date **Saturday 21 November 2026**, target 1,000, cumulative 700 from seven daily reports totalling 700:

```
Remaining          = 1000 − 700 = 300
Working days left  = 11 (10–21 Nov, excluding Sunday 15 Nov)
Required / day     = 300 ÷ 11 = 27.3
Actual / day       = 700 ÷ 7  = 100.0  (all seven scheduled days reported)
Projected duration = ceil(300 ÷ 100) = 3 working days
Projected finish   = 12 November 2026
Buffer             = 8 working days
Shortfall          = max(0, 27.3 − 100) = 0
```

Buffer 8 > 2, so the result is **green**. The UI shows each line of this calculation on the order's Delay tab so a merchandiser can audit it.

A second example: the same stage with only two updated days in the window is **amber** for insufficient history even though the recorded output looks high. Removing all output while quantity remains is **red**. A planned date in the past with quantity remaining is **red** regardless of output.

## Alerts

`scanDelayAlerts` evaluates every active milestone, stores a snapshot of the calculation and opens an alert when a stage is amber or red. The partial unique index allows only one `open`/`confirmed` alert per milestone, so repeated scans update rather than duplicate. Alerts that are no longer at risk are resolved. Dismissed alerts are not recreated for the same warning window unless a later change alters the risk.

Confirming an alert creates an approved buyer notification; dismissing it requires a reason. Neither action changes the underlying calculation.

## Configuration

| Setting key | Fields | Default |
| --- | --- | --- |
| `working_days` | `excludedWeekdays`, `label` | `[0]`, "Monday to Saturday (Sunday off)" |
| `risk_thresholds` | `healthyBufferWorkingDays`, `insufficientDataDays`, `historyWindowDays`, `amberRateTolerancePercent` | 2, 3, 7, 5 |
| `defaults` | `language`, `alertReviewDays`, `escalationDays`, `criticalDays` | `en`, 14, 7, 3 |

Change them in **Administration → Settings**. Every change is audited and affects the next calculation immediately.

## Tests

`tests/working-days.test.ts` and `tests/delay.test.ts` cover Sunday exclusion, custom Friday/Saturday weekends, month/year/leap boundaries, green/amber/red paths, insufficient data, missing reports counted as zero, overdue stages, future updates, the 2-day buffer, custom thresholds and order roll-up behaviour.

## Related reading

- [Orders & TNA](orders-and-tna.md)
- [Administration](administration.md)
- [Testing](testing.md)
