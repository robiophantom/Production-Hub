import { randomUUID } from "node:crypto";
import { getDb, sql, type Queryable } from "@/lib/db";
import type { DelayAlert, OrderMilestone, SessionUser } from "@/types";
import { calculateStageDelay, type RiskSettings } from "@/lib/business/delay";
import type { WorkCalendar } from "@/lib/business/working-days";
import { ALERT_WINDOW_LABELS } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  assertCanEditOrder,
  canPlanOrders,
  isInternalRole,
  orderScope,
} from "./access";
import { getAppConfig } from "./settings";

export type AlertWindow = "14_day" | "7_day" | "3_day" | "overdue" | "none";
export type AlertStatus = DelayAlert["status"];

export interface ScanResult {
  created: number;
  updated: number;
  resolved: number;
  dismissedSkips: number;
}

export interface AlertView extends DelayAlert {
  po_number: string;
  style_name: string;
  ex_factory_date: string;
  buyer_name: string;
  buyer_code: string;
  stage_name: string;
  stage_sequence: number;
  confirmed_by_name: string | null;
  notification_id: string | null;
  notification_status: string | null;
  notification_sent_at: string | null;
}

export interface AlertFilters {
  status?: "active" | AlertStatus | "all";
  risk?: "amber" | "red";
  window?: AlertWindow;
  search?: string;
}

export interface AlertStats {
  active: number;
  open: number;
  confirmed: number;
  overdue: number;
  red: number;
  dismissed: number;
  resolved: number;
}

const WINDOW_RANK: Record<string, number> = {
  overdue: 0,
  "3_day": 1,
  "7_day": 2,
  "14_day": 3,
  none: 4,
};

const RISK_RANK: Record<string, number> = { red: 0, amber: 1 };

function requireInternal(user: SessionUser): void {
  if (!isInternalRole(user.role)) {
    throw new Error("Only internal team members can review delay alerts.");
  }
}

function requireAlertManager(user: SessionUser): void {
  if (!canPlanOrders(user.role)) {
    throw new Error("Only the Super Admin or the assigned merchandiser can review delay alerts.");
  }
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

interface ScanMilestone {
  po_id: string;
  po_number: string;
  style_name: string;
  ex_factory_date: string;
  buyer_name: string;
  buyer_code: string;
  milestone_id: string;
  stage_id: string;
  stage_name: string;
  stage_sequence: number;
  planned_date: string;
  target_quantity: number;
  status: OrderMilestone["status"];
  is_active: boolean;
}

interface ScanUpdate {
  milestone_id: string;
  update_date: string;
  quantity: number;
}

interface ExistingAlert extends DelayAlert {
  stage_id: string;
}

function alertSnapshot(
  calc: ReturnType<typeof calculateStageDelay>,
): Omit<DelayAlert, "id" | "po_id" | "milestone_id" | "status" | "confirmed_by" | "confirmed_at" | "dismiss_reason" | "buyer_notified" | "created_at" | "updated_at" | "alert_date"> {
  return {
    risk_level: calc.health === "red" ? "red" : "amber",
    warning_window: calc.warningWindow,
    planned_date: calc.plannedDate,
    remaining_qty: calc.remainingQuantity,
    working_days_left: calc.workingDaysLeft,
    actual_daily: Number(calc.actualDaily.toFixed(2)),
    required_daily: Number(calc.requiredDaily.toFixed(2)),
    projected_completion_date: calc.projectedCompletionDate,
    shortfall: Number(calc.shortfallPerDay.toFixed(2)),
    calculation: calc as unknown as Record<string, unknown>,
  };
}

function snapshotChanged(
  alert: DelayAlert,
  snapshot: ReturnType<typeof alertSnapshot>,
): boolean {
  return (
    alert.risk_level !== snapshot.risk_level ||
    alert.warning_window !== snapshot.warning_window ||
    alert.planned_date !== snapshot.planned_date ||
    num(alert.remaining_qty) !== snapshot.remaining_qty ||
    num(alert.working_days_left) !== snapshot.working_days_left ||
    num(alert.actual_daily) !== snapshot.actual_daily ||
    num(alert.required_daily) !== snapshot.required_daily ||
    alert.projected_completion_date !== snapshot.projected_completion_date ||
    num(alert.shortfall) !== snapshot.shortfall
  );
}

async function writeAudit(
  db: Queryable,
  poId: string,
  actorId: string | null,
  action: string,
  entityId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
     values ($1, $2, $3, 'delay_alert', $4, $5)`,
    [poId, actorId, action, entityId, JSON.stringify(detail)],
  );
}

/**
 * Recomputes delay risk for every active milestone in the user's scope and
 * keeps the alert ledger in sync. The delay engine is deterministic; no AI is
 * involved, and creating an alert never notifies a buyer. A buyer-facing
 * notification only exists after an explicit confirm action.
 */
export async function scanDelayAlerts(user: SessionUser): Promise<ScanResult> {
  requireInternal(user);
  const config = await getAppConfig();
  const scope = orderScope(user, "po", 1);
  const db = await getDb();

  const [milestoneRows, updateRows, existingRows, dismissedRows] = await Promise.all([
    sql<ScanMilestone>(
      `select po.id as po_id, po.po_number, po.style_name, po.ex_factory_date,
              b.name as buyer_name, b.code as buyer_code,
              om.id as milestone_id, om.stage_id, om.planned_date, om.target_quantity,
              om.status, om.is_active,
              ps.name as stage_name, ps.sequence as stage_sequence
         from purchase_orders po
         join buyers b on b.id = po.buyer_id
         join order_milestones om on om.po_id = po.id
         join production_stages ps on ps.id = om.stage_id
        where po.status = 'active' and om.is_active = true and (${scope.clause})
        order by po.ex_factory_date asc, om.sequence asc`,
      scope.params,
    ),
    sql<ScanUpdate>(
      `select pu.milestone_id, pu.update_date, pu.quantity
         from production_updates pu
         join purchase_orders po on po.id = pu.po_id
        where po.status = 'active' and (${scope.clause})`,
      scope.params,
    ),
    sql<ExistingAlert>(
      `select da.*, om.stage_id
         from delay_alerts da
         join purchase_orders po on po.id = da.po_id
         join order_milestones om on om.id = da.milestone_id
        where da.status in ('open', 'confirmed') and (${scope.clause})`,
      scope.params,
    ),
    sql<{ milestone_id: string; warning_window: string }>(
      `select da.milestone_id, da.warning_window
         from delay_alerts da
         join purchase_orders po on po.id = da.po_id
        where da.status = 'dismissed' and (${scope.clause})`,
      scope.params,
    ),
  ]);

  const updatesByMilestone = new Map<string, ScanUpdate[]>();
  for (const update of updateRows) {
    const list = updatesByMilestone.get(update.milestone_id) ?? [];
    list.push(update);
    updatesByMilestone.set(update.milestone_id, list);
  }

  const openByMilestone = new Map(existingRows.map((alert) => [alert.milestone_id, alert]));
  const dismissedKeys = new Set(
    dismissedRows.map((row) => `${row.milestone_id}:${row.warning_window}`),
  );
  const seenMilestones = new Set<string>();
  const result: ScanResult = { created: 0, updated: 0, resolved: 0, dismissedSkips: 0 };

  for (const row of milestoneRows) {
    seenMilestones.add(row.milestone_id);
    const calc = calculateStageDelay({
      milestone: {
        id: row.milestone_id,
        stage_id: row.stage_id,
        stage_name: row.stage_name,
        sequence: num(row.stage_sequence),
        planned_date: row.planned_date,
        target_quantity: num(row.target_quantity),
        status: row.status,
        is_active: row.is_active,
      },
      updates: (updatesByMilestone.get(row.milestone_id) ?? []).map((update) => ({
        update_date: update.update_date,
        quantity: num(update.quantity),
      })),
      today: config.businessDate,
      calendar: config.calendar,
      settings: config.risk,
    });

    const risky =
      calc.isActive &&
      !calc.isComplete &&
      calc.health !== "green" &&
      calc.warningWindow !== "none" &&
      calc.remainingQuantity > 0;

    const existing = openByMilestone.get(row.milestone_id);

    if (!risky) {
      if (existing) {
        await sql(
          "update delay_alerts set status = 'resolved', updated_at = now() where id = $1",
          [existing.id],
        );
        await writeAudit(db, row.po_id, user.id, "delay_alert_resolved", existing.id, {
          reason: calc.isComplete
            ? "Milestone quantity complete."
            : "Risk cleared or the milestone is no longer inside an alert window.",
          business_date: config.businessDate,
        });
        result.resolved += 1;
      }
      continue;
    }

    const snapshot = alertSnapshot(calc);

    if (existing && existing.status === "confirmed" && existing.warning_window !== calc.warningWindow) {
      // Escalation needs a fresh human review. Keep the confirmed alert as
      // history and fall through to open the next window's alert.
      await sql(
        "update delay_alerts set status = 'resolved', updated_at = now() where id = $1",
        [existing.id],
      );
      await writeAudit(db, row.po_id, user.id, "delay_alert_resolved", existing.id, {
        reason: `Escalated to the ${ALERT_WINDOW_LABELS[calc.warningWindow]} window.`,
        business_date: config.businessDate,
      });
      result.resolved += 1;
    } else if (existing) {
      if (existing.warning_window !== calc.warningWindow) {
        await sql(
          `update delay_alerts
              set risk_level = $2, warning_window = $3, planned_date = $4, remaining_qty = $5,
                  working_days_left = $6, actual_daily = $7, required_daily = $8,
                  projected_completion_date = $9, shortfall = $10, calculation = $11,
                  alert_date = $12, updated_at = now()
            where id = $1`,
          [
            existing.id,
            snapshot.risk_level,
            snapshot.warning_window,
            snapshot.planned_date,
            snapshot.remaining_qty,
            snapshot.working_days_left,
            snapshot.actual_daily,
            snapshot.required_daily,
            snapshot.projected_completion_date,
            snapshot.shortfall,
            JSON.stringify(snapshot.calculation),
            config.businessDate,
          ],
        );
        await writeAudit(db, row.po_id, user.id, "delay_alert_escalated", existing.id, {
          warning_window: calc.warningWindow,
          business_date: config.businessDate,
        });
        result.updated += 1;
      } else if (snapshotChanged(existing, snapshot)) {
        await sql(
          `update delay_alerts
              set risk_level = $2, planned_date = $3, remaining_qty = $4,
                  working_days_left = $5, actual_daily = $6, required_daily = $7,
                  projected_completion_date = $8, shortfall = $9, calculation = $10,
                  alert_date = $11, updated_at = now()
            where id = $1`,
          [
            existing.id,
            snapshot.risk_level,
            snapshot.planned_date,
            snapshot.remaining_qty,
            snapshot.working_days_left,
            snapshot.actual_daily,
            snapshot.required_daily,
            snapshot.projected_completion_date,
            snapshot.shortfall,
            JSON.stringify(snapshot.calculation),
            config.businessDate,
          ],
        );
        result.updated += 1;
      }
      continue;
    }

    if (dismissedKeys.has(`${row.milestone_id}:${calc.warningWindow}`)) {
      result.dismissedSkips += 1;
      continue;
    }

    const alertId = randomUUID();
    await sql(
      `insert into delay_alerts
        (id, po_id, milestone_id, risk_level, warning_window, alert_date, planned_date,
         remaining_qty, working_days_left, actual_daily, required_daily,
         projected_completion_date, shortfall, calculation, status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'open')`,
      [
        alertId,
        row.po_id,
        row.milestone_id,
        snapshot.risk_level,
        snapshot.warning_window,
        config.businessDate,
        snapshot.planned_date,
        snapshot.remaining_qty,
        snapshot.working_days_left,
        snapshot.actual_daily,
        snapshot.required_daily,
        snapshot.projected_completion_date,
        snapshot.shortfall,
        JSON.stringify(snapshot.calculation),
      ],
    );
    await writeAudit(db, row.po_id, user.id, "delay_alert_generated", alertId, {
      stage: row.stage_name,
      warning_window: calc.warningWindow,
      risk_level: snapshot.risk_level,
      business_date: config.businessDate,
    });
    result.created += 1;
  }

  for (const alert of existingRows) {
    if (seenMilestones.has(alert.milestone_id)) continue;
    await sql(
      "update delay_alerts set status = 'resolved', updated_at = now() where id = $1",
      [alert.id],
    );
    await writeAudit(db, alert.po_id, user.id, "delay_alert_resolved", alert.id, {
      reason: "Milestone is no longer part of the active TNA.",
      business_date: config.businessDate,
    });
    result.resolved += 1;
  }

  return result;
}

export async function getAlerts(user: SessionUser, filters: AlertFilters = {}): Promise<AlertView[]> {
  requireInternal(user);
  const scope = orderScope(user, "po", 1);
  const clauses: string[] = [scope.clause];
  const params: unknown[] = [...scope.params];

  const status = filters.status ?? "active";
  if (status === "active") {
    clauses.push("da.status in ('open', 'confirmed')");
  } else if (status !== "all") {
    params.push(status);
    clauses.push(`da.status = $${params.length}`);
  }
  if (filters.risk) {
    params.push(filters.risk);
    clauses.push(`da.risk_level = $${params.length}`);
  }
  if (filters.window) {
    params.push(filters.window);
    clauses.push(`da.warning_window = $${params.length}`);
  }
  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    const index = params.length;
    clauses.push(
      `(po.po_number ilike $${index} or po.style_name ilike $${index} or b.name ilike $${index} or ps.name ilike $${index})`,
    );
  }

  return sql<AlertView>(
    `select da.*, po.po_number, po.style_name, po.ex_factory_date,
            b.name as buyer_name, b.code as buyer_code,
            ps.name as stage_name, ps.sequence as stage_sequence,
            reviewer.full_name as confirmed_by_name,
            bn.id as notification_id, bn.status as notification_status,
            bn.sent_at as notification_sent_at
       from delay_alerts da
       join purchase_orders po on po.id = da.po_id
       join buyers b on b.id = po.buyer_id
       join order_milestones om on om.id = da.milestone_id
       join production_stages ps on ps.id = om.stage_id
       left join profiles reviewer on reviewer.id = da.confirmed_by
       left join buyer_notifications bn on bn.alert_id = da.id
      where ${clauses.join(" and ")}
      order by case da.risk_level when 'red' then 0 else 1 end,
               case da.warning_window
                 when 'overdue' then 0 when '3_day' then 1 when '7_day' then 2
                 when '14_day' then 3 else 4 end,
               da.planned_date asc, da.created_at desc`,
    params,
  ).then((rows) =>
    rows
      .map((row) => ({
        ...row,
        remaining_qty: num(row.remaining_qty),
        working_days_left: num(row.working_days_left),
        actual_daily: num(row.actual_daily),
        required_daily: num(row.required_daily),
        shortfall: num(row.shortfall),
        stage_sequence: num(row.stage_sequence),
      }))
      .sort(
        (a, b) =>
          RISK_RANK[a.risk_level] - RISK_RANK[b.risk_level] ||
          WINDOW_RANK[a.warning_window] - WINDOW_RANK[b.warning_window] ||
          a.planned_date.localeCompare(b.planned_date),
      ),
  );
}

export async function getAlertStats(user: SessionUser): Promise<AlertStats> {
  const alerts = await getAlerts(user, { status: "all" });
  return {
    active: alerts.filter((alert) => alert.status === "open" || alert.status === "confirmed").length,
    open: alerts.filter((alert) => alert.status === "open").length,
    confirmed: alerts.filter((alert) => alert.status === "confirmed").length,
    overdue: alerts.filter(
      (alert) =>
        (alert.status === "open" || alert.status === "confirmed") &&
        alert.warning_window === "overdue",
    ).length,
    red: alerts.filter(
      (alert) =>
        (alert.status === "open" || alert.status === "confirmed") && alert.risk_level === "red",
    ).length,
    dismissed: alerts.filter((alert) => alert.status === "dismissed").length,
    resolved: alerts.filter((alert) => alert.status === "resolved").length,
  };
}

interface AlertContext extends DelayAlert {
  po_number: string;
  style_name: string;
  buyer_id: string;
  merchandiser_id: string | null;
  ex_factory_date: string;
  buyer_name: string;
  buyer_code: string;
  stage_name: string;
  target_quantity: number;
}

async function loadAlertContext(alertId: string): Promise<AlertContext | null> {
  const rows = await sql<AlertContext>(
    `select da.*, po.po_number, po.style_name, po.buyer_id, po.merchandiser_id,
            po.ex_factory_date, b.name as buyer_name, b.code as buyer_code,
            ps.name as stage_name, om.target_quantity
       from delay_alerts da
       join purchase_orders po on po.id = da.po_id
       join buyers b on b.id = po.buyer_id
       join order_milestones om on om.id = da.milestone_id
       join production_stages ps on ps.id = om.stage_id
      where da.id = $1`,
    [alertId],
  );
  return rows[0] ?? null;
}

function buildBuyerMessage(
  context: AlertContext,
  reviewerName: string,
  calendar: WorkCalendar,
  risk: RiskSettings,
): { subject: string; message: string } {
  const subject = `Production status update — ${context.po_number}`;
  const lines = [
    `Dear ${context.buyer_name} team,`,
    "",
    `Our ${calendar.label ?? "working-day"} delay analysis for ${context.po_number} (${context.style_name}) has identified a risk to the ${context.stage_name} milestone. We are reviewing it with the production team.`,
    "",
    `Stage: ${context.stage_name}`,
    `Planned stage completion: ${formatDate(context.planned_date)}`,
    `Projected completion at the current reported rate: ${formatDate(context.projected_completion_date)}`,
    `Remaining quantity: ${formatNumber(context.remaining_qty)} pcs`,
    `Working days left: ${context.working_days_left}`,
    `Required daily output: ${Number(context.required_daily).toFixed(1)} pcs/day`,
    `Actual daily output (last ${risk.historyWindowDays} scheduled working days): ${Number(context.actual_daily).toFixed(1)} pcs/day`,
    `Ex-factory date: ${formatDate(context.ex_factory_date)}`,
    "",
    "We will share a recovery plan and updated photographs through this portal. Please contact your merchandiser if you need any clarification.",
    "",
    `Reviewed by: ${reviewerName}`,
  ];
  return { subject, message: lines.join("\n") };
}

export interface ConfirmAlertResult {
  alertId: string;
  notificationId: string;
  message: string;
}

/**
 * Explicit human confirmation. This is the only path that creates a
 * buyer-visible notification for a delay alert; the notification is approved
 * immediately because the reviewer made the decision.
 */
export async function confirmAlert(user: SessionUser, alertId: string): Promise<ConfirmAlertResult> {
  requireAlertManager(user);
  const context = await loadAlertContext(alertId);
  if (!context) throw new Error("Alert not found.");
  if (context.status !== "open") {
    throw new Error("This alert has already been reviewed.");
  }
  if (num(context.remaining_qty) <= 0) {
    throw new Error("This milestone is complete and the alert should be resolved instead.");
  }
  await assertCanEditOrder(user, context.po_id);
  const config = await getAppConfig();
  const { subject, message } = buildBuyerMessage(context, user.full_name, config.calendar, config.risk);
  const notificationId = randomUUID();
  const db = await getDb();

  await db.transaction(async (tx) => {
    await tx.query(
      `insert into buyer_notifications
        (id, po_id, alert_id, subject, message, status, approved_by, approved_at, created_by)
       values ($1, $2, $3, $4, $5, 'approved', $6, now(), $6)`,
      [notificationId, context.po_id, alertId, subject, message, user.id],
    );
    const updated = await tx.query<{ id: string }>(
      `update delay_alerts
          set status = 'confirmed', confirmed_by = $2, confirmed_at = now(),
              buyer_notified = true, updated_at = now()
        where id = $1 and status = 'open'
        returning id`,
      [alertId, user.id],
    );
    if (updated.length === 0) throw new Error("This alert has already been reviewed.");
    await writeAudit(tx, context.po_id, user.id, "delay_alert_confirmed", alertId, {
      notification_id: notificationId,
      subject,
    });
  });

  return {
    alertId,
    notificationId,
    message: "Alert confirmed and the approved update is now visible to the buyer.",
  };
}

export async function dismissAlert(
  user: SessionUser,
  alertId: string,
  reason: string,
): Promise<{ alertId: string; message: string }> {
  requireAlertManager(user);
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) {
    throw new Error("Give a reason of at least 5 characters when dismissing an alert.");
  }
  if (cleanReason.length > 500) {
    throw new Error("The dismissal reason must be 500 characters or fewer.");
  }
  const context = await loadAlertContext(alertId);
  if (!context) throw new Error("Alert not found.");
  if (context.status !== "open") {
    throw new Error("Only open alerts can be dismissed.");
  }
  await assertCanEditOrder(user, context.po_id);

  const updated = await sql<{ id: string }>(
    `update delay_alerts
        set status = 'dismissed', dismiss_reason = $2, confirmed_by = $3,
            confirmed_at = now(), updated_at = now()
      where id = $1 and status = 'open'
      returning id`,
    [alertId, cleanReason, user.id],
  );
  if (updated.length === 0) throw new Error("This alert has already been reviewed.");

  await writeAudit(await getDb(), context.po_id, user.id, "delay_alert_dismissed", alertId, {
    reason: cleanReason,
  });

  return {
    alertId,
    message:
      "Alert dismissed. It will not be recreated for the same warning window unless a later milestone update changes the risk.",
  };
}
