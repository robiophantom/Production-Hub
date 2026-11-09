import { sql } from "@/lib/db";
import type { SessionUser } from "@/types";
import type { OrderSummary } from "@/types";
import { latestWorkingDays } from "@/lib/business/working-days";
import { orderScope } from "./access";
import { loadOrderSummaries } from "./order-summaries";
import { getAppConfig, type AppConfig } from "./settings";

export interface ProductionPoint {
  date: string;
  label: string;
  quantity: number;
}

export interface UnitPoint {
  name: string;
  ordered: number;
  produced: number;
  orders: number;
}

export interface BuyerPoint {
  name: string;
  code: string;
  orders: number;
  ordered: number;
  produced: number;
  delayed: number;
}

export interface RecentUpdateRow {
  id: string;
  poNumber: string;
  styleName: string;
  stageName: string;
  quantity: number;
  updateDate: string;
  supervisorName: string;
  source: string;
}

export interface RecentIssueRow {
  id: string;
  poNumber: string;
  category: string;
  severity: string;
  status: string;
  description: string;
  createdAt: string;
}

export interface DashboardMetrics {
  activeOrders: number;
  totalOrdered: number;
  totalProduced: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  upcomingShipments: number;
  producedLast7Days: number;
}

export interface DashboardData {
  config: AppConfig;
  metrics: DashboardMetrics;
  production: ProductionPoint[];
  units: UnitPoint[];
  buyers: BuyerPoint[];
  upcoming: OrderSummary[];
  attention: OrderSummary[];
  recentUpdates: RecentUpdateRow[];
  recentIssues: RecentIssueRow[];
}

function shortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(parsed);
}

export async function getDashboardData(user: SessionUser, rangeDays = 14): Promise<DashboardData> {
  const config = await getAppConfig();
  const summaries = await loadOrderSummaries(user);

  const active = summaries.filter((summary) => summary.order.status === "active");
  const counts = { green: 0, amber: 0, red: 0 };
  for (const summary of active) counts[summary.health.health] += 1;

  const upcomingWindowEnd = new Date(`${config.businessDate}T00:00:00Z`);
  upcomingWindowEnd.setUTCDate(upcomingWindowEnd.getUTCDate() + 14);

  const productionDates = latestWorkingDays(config.businessDate, Math.min(rangeDays, 60), config.calendar);
  const chartStart = productionDates[0] ?? config.businessDate;
  const scope = orderScope(user, "po", 1);
  const productionRows = await sql<{ date: string; quantity: number }>(
    `select pu.update_date as date, coalesce(sum(pu.quantity),0)::int as quantity
       from production_updates pu
       join purchase_orders po on po.id = pu.po_id
      where ${scope.clause} and pu.update_date >= $${scope.params.length + 1}
        and pu.update_date <= $${scope.params.length + 2}
      group by pu.update_date
      order by pu.update_date asc`,
    [...scope.params, chartStart, config.businessDate],
  );
  const productionMap = new Map(productionRows.map((row) => [row.date, Number(row.quantity)]));
  const production: ProductionPoint[] = productionDates.map((date) => ({
    date,
    label: shortDate(date),
    quantity: productionMap.get(date) ?? 0,
  }));

  const last7 = latestWorkingDays(config.businessDate, 7, config.calendar);
  const producedLast7Days = last7.reduce((sum, date) => sum + (productionMap.get(date) ?? 0), 0);

  const unitMap = new Map<string, UnitPoint>();
  const buyerMap = new Map<string, BuyerPoint>();
  for (const summary of active) {
    const unitName = summary.unit?.name ?? "Unassigned";
    const unit = unitMap.get(unitName) ?? {
      name: unitName,
      ordered: 0,
      produced: 0,
      orders: 0,
    };
    unit.ordered += summary.order.total_quantity;
    unit.produced += summary.producedQuantity;
    unit.orders += 1;
    unitMap.set(unitName, unit);

    const buyer = buyerMap.get(summary.buyer.id) ?? {
      name: summary.buyer.name,
      code: summary.buyer.code,
      orders: 0,
      ordered: 0,
      produced: 0,
      delayed: 0,
    };
    buyer.orders += 1;
    buyer.ordered += summary.order.total_quantity;
    buyer.produced += summary.producedQuantity;
    if (summary.health.health === "red") buyer.delayed += 1;
    buyerMap.set(summary.buyer.id, buyer);
  }

  const units = [...unitMap.values()].sort((a, b) => b.ordered - a.ordered);
  const buyers = [...buyerMap.values()].sort((a, b) => b.ordered - a.ordered).slice(0, 6);

  const upcoming = active
    .filter(
      (summary) =>
        summary.order.ex_factory_date >= config.businessDate &&
        summary.order.ex_factory_date <= upcomingWindowEnd.toISOString().slice(0, 10),
    )
    .sort((a, b) => a.order.ex_factory_date.localeCompare(b.order.ex_factory_date))
    .slice(0, 6);

  const attention = active
    .filter((summary) => summary.health.health !== "green")
    .sort(
      (a, b) =>
        (a.health.health === "red" ? 0 : 1) - (b.health.health === "red" ? 0 : 1) ||
        a.order.ex_factory_date.localeCompare(b.order.ex_factory_date),
    )
    .slice(0, 6);

  const [recentUpdates, recentIssues] = await Promise.all([
    sql<{
      id: string;
      po_number: string;
      style_name: string;
      stage_name: string;
      quantity: number;
      update_date: string;
      supervisor_name: string | null;
      source: string;
    }>(
      `select pu.id, po.po_number, po.style_name, ps.name as stage_name,
              pu.quantity, pu.update_date, pr.full_name as supervisor_name, pu.source
         from production_updates pu
         join purchase_orders po on po.id = pu.po_id
         join order_milestones om on om.id = pu.milestone_id
         join production_stages ps on ps.id = om.stage_id
         left join profiles pr on pr.id = pu.submitted_by
        where ${scope.clause}
        order by pu.update_date desc, pu.created_at desc
        limit 7`,
      scope.params,
    ),
    sql<{
      id: string;
      po_number: string;
      category: string;
      severity: string;
      status: string;
      description_english: string | null;
      description_tamil: string | null;
      created_at: string;
    }>(
      `select pi.id, po.po_number, pi.category, pi.severity, pi.status,
              pi.description_english, pi.description_tamil, pi.created_at
         from production_issues pi
         join purchase_orders po on po.id = pi.po_id
        where ${scope.clause}
        order by pi.created_at desc
        limit 5`,
      scope.params,
    ),
  ]);

  return {
    config,
    metrics: {
      activeOrders: active.length,
      totalOrdered: active.reduce((sum, summary) => sum + summary.order.total_quantity, 0),
      totalProduced: active.reduce((sum, summary) => sum + summary.producedQuantity, 0),
      onTrack: counts.green,
      atRisk: counts.amber,
      delayed: counts.red,
      upcomingShipments: upcoming.length,
      producedLast7Days,
    },
    production,
    units,
    buyers,
    upcoming,
    attention,
    recentUpdates: recentUpdates.map((row) => ({
      id: row.id,
      poNumber: row.po_number,
      styleName: row.style_name,
      stageName: row.stage_name,
      quantity: Number(row.quantity),
      updateDate: row.update_date,
      supervisorName: row.supervisor_name ?? "—",
      source: row.source,
    })),
    recentIssues: recentIssues.map((row) => ({
      id: row.id,
      poNumber: row.po_number,
      category: row.category,
      severity: row.severity,
      status: row.status,
      description: row.description_english ?? row.description_tamil ?? "",
      createdAt: row.created_at,
    })),
  };
}
