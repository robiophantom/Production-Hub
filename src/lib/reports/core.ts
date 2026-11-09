import { sql } from "@/lib/db";
import type { SessionUser } from "@/types";
import { addDaysISO, todayISO } from "@/lib/business/working-days";
import { isInternalRole, orderScope } from "@/lib/services/access";
import { getAlerts } from "@/lib/services/alerts";
import { loadOrderSummaries } from "@/lib/services/order-summaries";
import { getAppConfig } from "@/lib/services/settings";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";

export const REPORT_TYPES = ["production", "orders", "delays", "buyers"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

export interface ReportTable {
  type: ReportType;
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: (string | number)[][];
  fileBase: string;
}

export interface ReportRange {
  from: string;
  to: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isReportType(value: string | undefined): value is ReportType {
  return REPORT_TYPES.includes(value as ReportType);
}

export function resolveReportRange(
  businessDate: string,
  fromRaw: string | undefined,
  toRaw: string | undefined,
): ReportRange {
  const validFrom = fromRaw && ISO_DATE.test(fromRaw) ? fromRaw : null;
  const validTo = toRaw && ISO_DATE.test(toRaw) ? toRaw : null;
  let to = validTo ?? businessDate;
  let from = validFrom ?? addDaysISO(to, -29);
  if (from > to) [from, to] = [to, from];
  if (from < addDaysISO(to, -365)) from = addDaysISO(to, -365);
  return { from, to };
}

function requireInternal(user: SessionUser): void {
  if (!isInternalRole(user.role)) {
    throw new Error("Reports are available to internal team members only.");
  }
}

function healthLabel(value: string): string {
  return value === "green" ? "On track" : value === "amber" ? "At risk" : "Delayed";
}

export async function buildReport(
  user: SessionUser,
  type: ReportType,
  rangeInput?: { from?: string; to?: string },
): Promise<ReportTable> {
  requireInternal(user);
  const config = await getAppConfig();
  const range = resolveReportRange(config.businessDate, rangeInput?.from, rangeInput?.to);
  const rangeLabel = `${formatDate(range.from)} to ${formatDate(range.to)}`;
  const generated = `Generated ${formatDate(config.businessDate)} · Business timezone ${config.timezone}`;

  if (type === "production") {
    const scope = orderScope(user, "po", 1);
    const rows = await sql<{
      update_date: string;
      po_number: string;
      buyer_name: string;
      style_name: string;
      stage_name: string;
      quantity: number;
      supervisor_name: string | null;
      source: string;
    }>(
      `select pu.update_date, po.po_number, b.name as buyer_name, po.style_name,
              ps.name as stage_name, pu.quantity, pr.full_name as supervisor_name, pu.source
         from production_updates pu
         join purchase_orders po on po.id = pu.po_id
         join buyers b on b.id = po.buyer_id
         join order_milestones om on om.id = pu.milestone_id
         join production_stages ps on ps.id = om.stage_id
         left join profiles pr on pr.id = pu.submitted_by
        where (${scope.clause})
          and pu.update_date >= $${scope.params.length + 1}
          and pu.update_date <= $${scope.params.length + 2}
        order by pu.update_date desc, po.po_number asc, ps.sequence asc`,
      [...scope.params, range.from, range.to],
    );

    const total = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const offline = rows.filter((row) => row.source === "offline").length;

    return {
      type,
      title: "Daily production report",
      subtitle: `${rangeLabel} · ${rows.length} submissions · ${formatNumber(total)} pcs reported · ${offline} offline-synced · ${generated}`,
      fileBase: `production-${range.from}-to-${range.to}`,
      columns: [
        { header: "Date", width: 0.11 },
        { header: "PO number", width: 0.15 },
        { header: "Buyer", width: 0.16 },
        { header: "Style", width: 0.17 },
        { header: "Stage", width: 0.12 },
        { header: "Quantity", width: 0.1, align: "right" },
        { header: "Supervisor", width: 0.12 },
        { header: "Source", width: 0.07 },
      ],
      rows: rows.map((row) => [
        row.update_date,
        row.po_number,
        row.buyer_name,
        row.style_name,
        row.stage_name,
        Number(row.quantity),
        row.supervisor_name ?? "—",
        row.source === "offline" ? "Offline" : "Online",
      ]),
    };
  }

  if (type === "orders") {
    const summaries = await loadOrderSummaries(user);
    const active = summaries.filter((summary) => summary.order.status === "active");
    const delayed = active.filter((summary) => summary.health.health === "red").length;
    const atRisk = active.filter((summary) => summary.health.health === "amber").length;

    return {
      type,
      title: "Purchase order status report",
      subtitle: `${active.length} active orders · ${formatNumber(
        active.reduce((sum, item) => sum + item.order.total_quantity, 0),
      )} pcs ordered · ${delayed} delayed · ${atRisk} at risk · ${generated}`,
      fileBase: `orders-${config.businessDate}`,
      columns: [
        { header: "PO number", width: 0.13 },
        { header: "Buyer", width: 0.14 },
        { header: "Style", width: 0.16 },
        { header: "Qty", width: 0.08, align: "right" },
        { header: "Ex-factory", width: 0.1 },
        { header: "Priority", width: 0.08 },
        { header: "Current stage", width: 0.12 },
        { header: "Progress", width: 0.07, align: "right" },
        { header: "Health", width: 0.07 },
        { header: "Issues", width: 0.05, align: "right" },
      ],
      rows: summaries.map((summary) => [
        summary.order.po_number,
        summary.buyer.name,
        summary.order.style_name,
        summary.order.total_quantity,
        summary.order.ex_factory_date,
        titleCase(summary.order.priority),
        summary.currentStage,
        `${summary.currentStageProgress.toFixed(0)}%`,
        healthLabel(summary.health.health),
        summary.openIssues,
      ]),
    };
  }

  if (type === "delays") {
    const alerts = await getAlerts(user, { status: "active" });
    const overdue = alerts.filter((alert) => alert.warning_window === "overdue").length;
    const waiting = alerts.filter((alert) => alert.status === "open").length;

    return {
      type,
      title: "Delay exposure report",
      subtitle: `${alerts.length} active alerts · ${overdue} overdue · ${waiting} awaiting review · Calculation is deterministic; AI is not used · ${generated}`,
      fileBase: `delays-${config.businessDate}`,
      columns: [
        { header: "PO number", width: 0.11 },
        { header: "Buyer", width: 0.12 },
        { header: "Stage", width: 0.1 },
        { header: "Risk", width: 0.06 },
        { header: "Window", width: 0.09 },
        { header: "Planned", width: 0.08 },
        { header: "Projected", width: 0.08 },
        { header: "Remaining", width: 0.07, align: "right" },
        { header: "Required/day", width: 0.07, align: "right" },
        { header: "Actual/day", width: 0.07, align: "right" },
        { header: "Shortfall", width: 0.06, align: "right" },
        { header: "Status", width: 0.07 },
      ],
      rows:
        alerts.length === 0
          ? [["No active delay alerts in scope.", "", "", "", "", "", "", "", "", "", "", ""]]
          : alerts.map((alert) => [
              alert.po_number,
              alert.buyer_name,
              alert.stage_name,
              alert.risk_level === "red" ? "Red" : "Amber",
              alert.warning_window.replace("_", "-"),
              alert.planned_date,
              alert.projected_completion_date ?? "—",
              formatNumber(alert.remaining_qty),
              alert.required_daily.toFixed(1),
              alert.actual_daily.toFixed(1),
              alert.shortfall.toFixed(1),
              alert.status === "open" ? "Awaiting review" : "Confirmed",
            ]),
    };
  }

  const summaries = await loadOrderSummaries(user);
  const byBuyer = new Map<
    string,
    { name: string; code: string; country: string; orders: number; ordered: number; produced: number; delayed: number; atRisk: number }
  >();
  for (const summary of summaries) {
    const entry = byBuyer.get(summary.buyer.id) ?? {
      name: summary.buyer.name,
      code: summary.buyer.code,
      country: summary.buyer.country,
      orders: 0,
      ordered: 0,
      produced: 0,
      delayed: 0,
      atRisk: 0,
    };
    entry.orders += 1;
    entry.ordered += summary.order.total_quantity;
    entry.produced += summary.producedQuantity;
    if (summary.health.health === "red") entry.delayed += 1;
    if (summary.health.health === "amber") entry.atRisk += 1;
    byBuyer.set(summary.buyer.id, entry);
  }
  const buyers = [...byBuyer.values()].sort((a, b) => b.ordered - a.ordered);

  return {
    type,
    title: "Buyer summary report",
    subtitle: `${buyers.length} buyers · ${formatNumber(
      buyers.reduce((sum, buyer) => sum + buyer.ordered, 0),
    )} pcs ordered · ${generated}`,
    fileBase: `buyers-${config.businessDate}`,
    columns: [
      { header: "Buyer", width: 0.2 },
      { header: "Code", width: 0.1 },
      { header: "Country", width: 0.14 },
      { header: "Orders", width: 0.08, align: "right" },
      { header: "Ordered pcs", width: 0.13, align: "right" },
      { header: "Produced pcs", width: 0.13, align: "right" },
      { header: "Delayed", width: 0.08, align: "right" },
      { header: "At risk", width: 0.08, align: "right" },
      { header: "On-time %", width: 0.08, align: "right" },
    ],
    rows: buyers.map((buyer) => [
      buyer.name,
      buyer.code,
      buyer.country,
      buyer.orders,
      buyer.ordered,
      buyer.produced,
      buyer.delayed,
      buyer.atRisk,
      `${(((buyer.orders - buyer.delayed) / Math.max(1, buyer.orders)) * 100).toFixed(0)}%`,
    ]),
  };
}

export function defaultReportRange(): ReportRange {
  const today = todayISO();
  return { from: addDaysISO(today, -29), to: today };
}
