import { sql } from "@/lib/db";
import type {
  Buyer,
  OrderHealth,
  OrderMilestone,
  OrderSummary,
  ProductionUnit,
  PurchaseOrder,
  SessionUser,
} from "@/types";
import { calculateOrderHealth, calculateStageDelay, type RiskSettings } from "@/lib/business/delay";
import type { WorkCalendar } from "@/lib/business/working-days";
import { orderScope } from "./access";
import { getAppConfig } from "./settings";

interface OrderJoinRow extends PurchaseOrder {
  buyer_name: string;
  buyer_code: string;
  buyer_country: string;
  buyer_contact_email: string | null;
  unit_name: string | null;
  unit_code: string | null;
  unit_location: string | null;
  merchandiser_name: string | null;
}

interface MilestoneRow extends OrderMilestone {
  stage_name: string;
  stage_sequence: number;
  supervisor_id: string | null;
  assignment_unit_id: string | null;
  subcontractor_id: string | null;
  supervisor_name: string | null;
  assignment_unit_name: string | null;
}

interface UpdateRow {
  po_id: string;
  milestone_id: string;
  update_date: string;
  quantity: number;
}

export interface OrderFilters {
  search?: string;
  buyerId?: string;
  unitId?: string;
  merchandiserId?: string;
  stageId?: string;
  health?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  priority?: string;
  sort?: string;
}

export interface OrderListResult {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const HEALTH_ORDER: Record<string, number> = { red: 0, amber: 1, green: 2 };

function buildWhere(user: SessionUser, filters: OrderFilters) {
  const scope = orderScope(user, "po", 1);
  const clauses: string[] = [scope.clause];
  const params: unknown[] = [...scope.params];

  if (filters.search) {
    params.push(`%${filters.search.trim()}%`);
    const index = params.length;
    clauses.push(
      `(po.po_number ilike $${index} or po.style_name ilike $${index} or po.style_number ilike $${index} or po.buyer_reference ilike $${index} or b.name ilike $${index})`,
    );
  }
  if (filters.buyerId) {
    params.push(filters.buyerId);
    clauses.push(`po.buyer_id = $${params.length}`);
  }
  if (filters.unitId) {
    params.push(filters.unitId);
    clauses.push(`po.primary_unit_id = $${params.length}`);
  }
  if (filters.merchandiserId) {
    params.push(filters.merchandiserId);
    clauses.push(`po.merchandiser_id = $${params.length}`);
  }
  if (filters.stageId) {
    params.push(filters.stageId);
    clauses.push(
      `exists (select 1 from order_milestones fm where fm.po_id = po.id and fm.stage_id = $${params.length} and fm.is_active = true)`,
    );
  }
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`po.status = $${params.length}`);
  }
  if (filters.priority) {
    params.push(filters.priority);
    clauses.push(`po.priority = $${params.length}`);
  }
  if (filters.dateFrom) {
    params.push(filters.dateFrom);
    clauses.push(`po.ex_factory_date >= $${params.length}`);
  }
  if (filters.dateTo) {
    params.push(filters.dateTo);
    clauses.push(`po.ex_factory_date <= $${params.length}`);
  }

  return { clause: clauses.join(" and "), params };
}

export async function loadOrderSummaries(
  user: SessionUser,
  filters: OrderFilters = {},
): Promise<OrderSummary[]> {
  const config = await getAppConfig();
  const where = buildWhere(user, filters);

  const rows = await sql<OrderJoinRow>(
    `select po.*,
            b.name as buyer_name, b.code as buyer_code, b.country as buyer_country,
            b.contact_email as buyer_contact_email,
            u.name as unit_name, u.code as unit_code, u.location as unit_location,
            merch.full_name as merchandiser_name
       from purchase_orders po
       join buyers b on b.id = po.buyer_id
       left join production_units u on u.id = po.primary_unit_id
       left join profiles merch on merch.id = po.merchandiser_id
      where ${where.clause}
      order by po.ex_factory_date asc, po.po_number asc`,
    where.params,
  );

  return hydrateOrderSummaries(rows, config.calendar, config.risk, config.businessDate);
}

export async function listOrderSummaries(
  user: SessionUser,
  filters: OrderFilters,
  page = 1,
  pageSize = 12,
): Promise<OrderListResult> {
  const summaries = await loadOrderSummaries(user, filters);
  const filtered = filters.health
    ? summaries.filter((summary) => summary.health.health === filters.health)
    : summaries;

  const sorted = sortSummaries(filtered, filters.sort);
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page: safePage,
    pageSize,
  };
}

function sortSummaries(items: OrderSummary[], sort?: string): OrderSummary[] {
  const copy = [...items];
  switch (sort) {
    case "ex_factory_desc":
      return copy.sort((a, b) =>
        b.order.ex_factory_date.localeCompare(a.order.ex_factory_date),
      );
    case "po_number":
      return copy.sort((a, b) => a.order.po_number.localeCompare(b.order.po_number));
    case "quantity_desc":
      return copy.sort((a, b) => b.order.total_quantity - a.order.total_quantity);
    case "progress_desc":
      return copy.sort((a, b) => b.currentStageProgress - a.currentStageProgress);
    case "health":
      return copy.sort(
        (a, b) =>
          HEALTH_ORDER[a.health.health] - HEALTH_ORDER[b.health.health] ||
          a.order.ex_factory_date.localeCompare(b.order.ex_factory_date),
      );
    case "buyer":
      return copy.sort((a, b) => a.buyer.name.localeCompare(b.buyer.name));
    default:
      return copy.sort((a, b) =>
        a.order.ex_factory_date.localeCompare(b.order.ex_factory_date),
      );
  }
}

export async function hydrateOrderSummaries(
  rows: OrderJoinRow[],
  calendar: WorkCalendar,
  risk: RiskSettings,
  today: string,
): Promise<OrderSummary[]> {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");

  const [milestoneRows, updateRows, issueRows, variantRows] = await Promise.all([
    sql<MilestoneRow>(
      `select om.*, ps.name as stage_name, ps.sequence as stage_sequence,
              sa.supervisor_id, sa.unit_id as assignment_unit_id, sa.subcontractor_id,
              sup.full_name as supervisor_name, au.name as assignment_unit_name
         from order_milestones om
         join production_stages ps on ps.id = om.stage_id
         left join stage_assignments sa on sa.milestone_id = om.id
         left join profiles sup on sup.id = sa.supervisor_id
         left join production_units au on au.id = sa.unit_id
        where om.po_id in (${placeholders})
        order by om.sequence asc`,
      ids,
    ),
    sql<UpdateRow>(
      `select po_id, milestone_id, update_date, quantity
         from production_updates
        where po_id in (${placeholders})`,
      ids,
    ),
    sql<{ po_id: string; open_issues: number }>(
      `select po_id, count(*)::int as open_issues
         from production_issues
        where po_id in (${placeholders}) and status <> 'resolved'
        group by po_id`,
      ids,
    ),
    sql<{ po_id: string; variant_count: number }>(
      `select po_id, count(*)::int as variant_count
         from order_variants
        where po_id in (${placeholders})
        group by po_id`,
      ids,
    ),
  ]);

  const milestonesByOrder = groupBy(milestoneRows, (row) => row.po_id);
  const updatesByMilestone = groupBy(updateRows, (row) => row.milestone_id);
  const issueMap = new Map(issueRows.map((row) => [row.po_id, Number(row.open_issues)]));
  const variantMap = new Map(variantRows.map((row) => [row.po_id, Number(row.variant_count)]));

  return rows.map((row) => {
    const milestones = milestonesByOrder.get(row.id) ?? [];
    const active = milestones.filter((milestone) => milestone.is_active);

    const calculations = active.map((milestone) =>
      calculateStageDelay({
        milestone: {
          id: milestone.id,
          stage_id: milestone.stage_id,
          stage_name: milestone.stage_name,
          sequence: milestone.stage_sequence,
          planned_date: milestone.planned_date,
          target_quantity: Number(milestone.target_quantity),
          status: milestone.status,
          is_active: milestone.is_active,
        },
        updates: (updatesByMilestone.get(milestone.id) ?? []).map((update) => ({
          update_date: update.update_date,
          quantity: Number(update.quantity),
        })),
        today,
        calendar,
        settings: risk,
      }),
    );

    const cumulativeByMilestone = new Map<string, number>();
    for (const calculation of calculations) {
      cumulativeByMilestone.set(calculation.milestoneId, calculation.cumulativeQuantity);
    }

    const current =
      active.find((milestone) => {
        const calc = calculations.find((item) => item.milestoneId === milestone.id);
        return calc ? !calc.isComplete : true;
      }) ?? active[active.length - 1];

    const currentCalc = current
      ? calculations.find((item) => item.milestoneId === current.id)
      : undefined;

    const produced = current ? (cumulativeByMilestone.get(current.id) ?? 0) : 0;
    const progress =
      current && Number(current.target_quantity) > 0
        ? Math.min(100, (produced / Number(current.target_quantity)) * 100)
        : 0;

    const health: OrderHealth = calculateOrderHealth(
      calculations,
      row.ex_factory_date,
      today,
      calendar,
      risk,
    );

    const buyer: Buyer = {
      id: row.buyer_id,
      name: row.buyer_name,
      code: row.buyer_code,
      country: row.buyer_country,
      contact_person: null,
      contact_email: row.buyer_contact_email,
      is_active: true,
      created_at: "",
    };

    const unit: ProductionUnit | null = row.primary_unit_id
      ? {
          id: row.primary_unit_id,
          name: row.unit_name ?? "—",
          code: row.unit_code ?? "—",
          location: row.unit_location,
          is_active: true,
          created_at: "",
        }
      : null;

    return {
      order: stripOrderJoin(row),
      buyer,
      unit,
      merchandiser: row.merchandiser_id
        ? {
            id: row.merchandiser_id,
            email: "",
            full_name: row.merchandiser_name ?? "—",
            role: "merchandiser",
            phone: null,
            unit_id: null,
            buyer_id: null,
            is_active: true,
            avatar_url: null,
            created_at: "",
            updated_at: "",
          }
        : null,
      currentStage: currentCalc?.stageName ?? (active.length === 0 ? "No TNA" : "Completed"),
      currentStageProgress: progress,
      producedQuantity: produced,
      targetQuantity: Number(current?.target_quantity ?? row.total_quantity),
      health,
      openIssues: issueMap.get(row.id) ?? 0,
      variantCount: variantMap.get(row.id) ?? 0,
    };
  });
}

function stripOrderJoin(row: OrderJoinRow): PurchaseOrder {
  return {
    id: row.id,
    po_number: row.po_number,
    buyer_id: row.buyer_id,
    buyer_reference: row.buyer_reference,
    order_received_date: row.order_received_date,
    style_name: row.style_name,
    style_number: row.style_number,
    description: row.description,
    total_quantity: Number(row.total_quantity),
    ex_factory_date: row.ex_factory_date,
    shipping_method: row.shipping_method,
    priority: row.priority,
    merchandiser_id: row.merchandiser_id,
    primary_unit_id: row.primary_unit_id,
    notes: row.notes,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    const list = map.get(value) ?? [];
    list.push(row);
    map.set(value, list);
  }
  return map;
}
