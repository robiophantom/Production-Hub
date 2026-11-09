import { getDb, sql } from "@/lib/db";
import type {
  AuditLog,
  Buyer,
  BuyerNotification,
  DelayAlert,
  DelayCalculation,
  OrderDateHistory,
  OrderHealth,
  OrderMilestone,
  OrderVariant,
  ProductionIssue,
  ProductionPhoto,
  ProductionStage,
  ProductionUnit,
  ProductionUpdate,
  Profile,
  PurchaseOrder,
  SessionUser,
  StageAssignment,
  Subcontractor,
  TnaTemplate,
  TnaTemplateMilestone,
} from "@/types";
import { calculateOrderHealth, calculateStageDelay } from "@/lib/business/delay";
import { addDaysISO } from "@/lib/business/working-days";
import { assertCanAccessOrder, assertCanEditOrder, canPlanOrders } from "./access";
import { getAppConfig } from "./settings";
import type { AppConfig } from "./settings";

export interface MilestoneDetail {
  milestone: OrderMilestone;
  stage: ProductionStage;
  assignment: StageAssignment | null;
  unit: ProductionUnit | null;
  supervisor: Profile | null;
  subcontractor: Subcontractor | null;
  cumulative: number;
  remaining: number;
  progress: number;
  calculation: DelayCalculation;
}

export interface UpdateDetail extends ProductionUpdate {
  submitted_by_name: string;
  photos: ProductionPhoto[];
}

export interface IssueDetail extends ProductionIssue {
  reported_by_name: string;
  photos: ProductionPhoto[];
}

export interface OrderDetail {
  order: PurchaseOrder;
  buyer: Buyer;
  unit: ProductionUnit | null;
  merchandiser: Profile | null;
  variants: OrderVariant[];
  milestones: MilestoneDetail[];
  updates: UpdateDetail[];
  issues: IssueDetail[];
  alerts: (DelayAlert & { stage_name: string; confirmed_by_name: string | null })[];
  notifications: (BuyerNotification & { approved_by_name: string | null })[];
  dateHistory: (OrderDateHistory & { changed_by_name: string | null })[];
  auditLogs: (AuditLog & { actor_name: string | null })[];
  health: OrderHealth;
  currentStage: string;
  currentStageProgress: number;
  producedQuantity: number;
  photos: ProductionPhoto[];
  config: AppConfig;
  canEdit: boolean;
}

export async function getOrderDetail(user: SessionUser, poId: string): Promise<OrderDetail> {
  await assertCanAccessOrder(user, poId);
  const config = await getAppConfig();

  const orderRows = await sql<
    PurchaseOrder & {
      buyer_name: string;
      buyer_code: string;
      buyer_country: string;
      buyer_contact_person: string | null;
      buyer_contact_email: string | null;
      unit_name: string | null;
      unit_code: string | null;
      unit_location: string | null;
      merchandiser_name: string | null;
      merchandiser_email: string | null;
    }
  >(
    `select po.*,
            b.name as buyer_name, b.code as buyer_code, b.country as buyer_country,
            b.contact_person as buyer_contact_person, b.contact_email as buyer_contact_email,
            u.name as unit_name, u.code as unit_code, u.location as unit_location,
            m.full_name as merchandiser_name, m.email as merchandiser_email
       from purchase_orders po
       join buyers b on b.id = po.buyer_id
       left join production_units u on u.id = po.primary_unit_id
       left join profiles m on m.id = po.merchandiser_id
      where po.id = $1`,
    [poId],
  );

  const orderRow = orderRows[0];
  if (!orderRow) throw new Error("Order not found.");

  const [variantRows, milestoneRows, updateRows, issueRows, photoRows, alertRows, notificationRows, historyRows, auditRows, canEdit] =
    await Promise.all([
      sql<OrderVariant>(
        "select * from order_variants where po_id = $1 order by colour asc, size asc",
        [poId],
      ),
      sql<
        OrderMilestone & {
          stage_name: string;
          stage_code: string;
          stage_sequence: number;
          stage_active: boolean;
          assignment_id: string | null;
          unit_id: string | null;
          supervisor_id: string | null;
          subcontractor_id: string | null;
          assigned_at: string | null;
          assigned_by: string | null;
          supervisor_name: string | null;
          supervisor_email: string | null;
          assignment_unit_name: string | null;
          assignment_unit_code: string | null;
          subcontractor_name: string | null;
          subcontractor_type: string | null;
        }
      >(
        `select om.*, ps.name as stage_name, ps.code as stage_code, ps.sequence as stage_sequence,
                ps.is_active as stage_active,
                sa.id as assignment_id, sa.unit_id, sa.supervisor_id, sa.subcontractor_id,
                sa.assigned_at, sa.assigned_by,
                sup.full_name as supervisor_name, sup.email as supervisor_email,
                au.name as assignment_unit_name, au.code as assignment_unit_code,
                sub.name as subcontractor_name, sub.type as subcontractor_type
           from order_milestones om
           join production_stages ps on ps.id = om.stage_id
           left join stage_assignments sa on sa.milestone_id = om.id
           left join profiles sup on sup.id = sa.supervisor_id
           left join production_units au on au.id = sa.unit_id
           left join subcontractors sub on sub.id = sa.subcontractor_id
          where om.po_id = $1
          order by om.sequence asc`,
        [poId],
      ),
      sql<ProductionUpdate & { submitted_by_name: string }>(
        `select pu.*, p.full_name as submitted_by_name
           from production_updates pu
           join profiles p on p.id = pu.submitted_by
          where pu.po_id = $1
          order by pu.update_date desc, pu.created_at desc`,
        [poId],
      ),
      sql<ProductionIssue & { reported_by_name: string }>(
        `select pi.*, p.full_name as reported_by_name
           from production_issues pi
           join profiles p on p.id = pi.reported_by
          where pi.po_id = $1
          order by pi.created_at desc`,
        [poId],
      ),
      sql<ProductionPhoto>("select * from production_photos where po_id = $1 order by created_at desc", [
        poId,
      ]),
      sql<DelayAlert & { stage_name: string; confirmed_by_name: string | null }>(
        `select da.*, ps.name as stage_name, p.full_name as confirmed_by_name
           from delay_alerts da
           join order_milestones om on om.id = da.milestone_id
           join production_stages ps on ps.id = om.stage_id
           left join profiles p on p.id = da.confirmed_by
          where da.po_id = $1
          order by da.created_at desc`,
        [poId],
      ),
      sql<BuyerNotification & { approved_by_name: string | null }>(
        `select bn.*, p.full_name as approved_by_name
           from buyer_notifications bn
           left join profiles p on p.id = bn.approved_by
          where bn.po_id = $1
          order by bn.created_at desc`,
        [poId],
      ),
      sql<OrderDateHistory & { changed_by_name: string | null }>(
        `select h.*, p.full_name as changed_by_name
           from order_date_history h
           left join profiles p on p.id = h.changed_by
          where h.po_id = $1
          order by h.changed_at desc`,
        [poId],
      ),
      sql<AuditLog & { actor_name: string | null }>(
        `select a.*, p.full_name as actor_name
           from audit_logs a
           left join profiles p on p.id = a.actor_id
          where a.po_id = $1
          order by a.created_at desc
          limit 60`,
        [poId],
      ),
      canPlanOrders(user.role) ? canEditOrderAccess(user, poId) : Promise.resolve(false),
    ]);

  const photosByUpdate = new Map<string, ProductionPhoto[]>();
  const photosByIssue = new Map<string, ProductionPhoto[]>();
  for (const photo of photoRows) {
    if (photo.update_id) {
      const list = photosByUpdate.get(photo.update_id) ?? [];
      list.push(photo);
      photosByUpdate.set(photo.update_id, list);
    }
    if (photo.issue_id) {
      const list = photosByIssue.get(photo.issue_id) ?? [];
      list.push(photo);
      photosByIssue.set(photo.issue_id, list);
    }
  }

  const updatesByMilestone = new Map<string, { update_date: string; quantity: number }[]>();
  for (const update of updateRows) {
    const list = updatesByMilestone.get(update.milestone_id) ?? [];
    list.push({ update_date: update.update_date, quantity: Number(update.quantity) });
    updatesByMilestone.set(update.milestone_id, list);
  }

  const milestones: MilestoneDetail[] = milestoneRows.map((row) => {
    const stage: ProductionStage = {
      id: row.stage_id,
      name: row.stage_name,
      code: row.stage_code,
      sequence: Number(row.stage_sequence),
      is_active: row.stage_active,
      created_at: "",
    };
    const updates = updatesByMilestone.get(row.id) ?? [];
    const calculation = calculateStageDelay({
      milestone: {
        id: row.id,
        stage_id: row.stage_id,
        stage_name: row.stage_name,
        sequence: Number(row.stage_sequence),
        planned_date: row.planned_date,
        target_quantity: Number(row.target_quantity),
        status: row.status,
        is_active: row.is_active,
      },
      updates,
      today: config.businessDate,
      calendar: config.calendar,
      settings: config.risk,
    });

    const assignment: StageAssignment | null = row.assignment_id
      ? {
          id: row.assignment_id,
          milestone_id: row.id,
          unit_id: row.unit_id,
          supervisor_id: row.supervisor_id,
          subcontractor_id: row.subcontractor_id,
          assigned_at: row.assigned_at ?? "",
          assigned_by: row.assigned_by,
        }
      : null;

    const unit: ProductionUnit | null = row.unit_id
      ? {
          id: row.unit_id,
          name: row.assignment_unit_name ?? "—",
          code: row.assignment_unit_code ?? "—",
          location: null,
          is_active: true,
          created_at: "",
        }
      : null;

    const supervisor: Profile | null = row.supervisor_id
      ? {
          id: row.supervisor_id,
          email: row.supervisor_email ?? "",
          full_name: row.supervisor_name ?? "—",
          role: "unit_supervisor",
          phone: null,
          unit_id: row.unit_id,
          buyer_id: null,
          is_active: true,
          avatar_url: null,
          created_at: "",
          updated_at: "",
        }
      : null;

    const subcontractor: Subcontractor | null = row.subcontractor_id
      ? {
          id: row.subcontractor_id,
          name: row.subcontractor_name ?? "—",
          type: (row.subcontractor_type as Subcontractor["type"]) ?? "other",
          contact_person: null,
          phone: null,
          is_active: true,
          created_at: "",
        }
      : null;

    return {
      milestone: {
        id: row.id,
        po_id: row.po_id,
        stage_id: row.stage_id,
        sequence: Number(row.sequence),
        planned_date: row.planned_date,
        target_quantity: Number(row.target_quantity),
        status: row.status,
        is_active: row.is_active,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      stage,
      assignment,
      unit,
      supervisor,
      subcontractor,
      cumulative: calculation.cumulativeQuantity,
      remaining: calculation.remainingQuantity,
      progress:
        Number(row.target_quantity) > 0
          ? Math.min(100, (calculation.cumulativeQuantity / Number(row.target_quantity)) * 100)
          : 0,
      calculation,
    };
  });

  const activeCalculations = milestones
    .filter((item) => item.milestone.is_active)
    .map((item) => item.calculation);

  const health = calculateOrderHealth(
    activeCalculations,
    orderRow.ex_factory_date,
    config.businessDate,
    config.calendar,
    config.risk,
  );

  const activeMilestones = milestones.filter((item) => item.milestone.is_active);
  const allComplete =
    activeMilestones.length > 0 && activeMilestones.every((item) => item.calculation.isComplete);
  const current =
    activeMilestones.find((item) => !item.calculation.isComplete) ??
    activeMilestones[activeMilestones.length - 1];

  const buyer: Buyer = {
    id: orderRow.buyer_id,
    name: orderRow.buyer_name,
    code: orderRow.buyer_code,
    country: orderRow.buyer_country,
    contact_person: orderRow.buyer_contact_person,
    contact_email: orderRow.buyer_contact_email,
    is_active: true,
    created_at: "",
  };

  const merchandiser: Profile | null = orderRow.merchandiser_id
    ? {
        id: orderRow.merchandiser_id,
        email: orderRow.merchandiser_email ?? "",
        full_name: orderRow.merchandiser_name ?? "—",
        role: "merchandiser",
        phone: null,
        unit_id: null,
        buyer_id: null,
        is_active: true,
        avatar_url: null,
        created_at: "",
        updated_at: "",
      }
    : null;

  return {
    order: {
      ...stripOrderRow(orderRow),
    },
    buyer,
    unit: orderRow.primary_unit_id
      ? {
          id: orderRow.primary_unit_id,
          name: orderRow.unit_name ?? "—",
          code: orderRow.unit_code ?? "—",
          location: orderRow.unit_location,
          is_active: true,
          created_at: "",
        }
      : null,
    merchandiser,
    variants: variantRows,
    milestones,
    updates: updateRows.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
      photos: photosByUpdate.get(row.id) ?? [],
    })),
    issues: issueRows.map((row) => ({
      ...row,
      photos: photosByIssue.get(row.id) ?? [],
    })),
    photos: photoRows,
    alerts: alertRows,
    notifications: notificationRows,
    dateHistory: historyRows,
    auditLogs: auditRows,
    health,
    currentStage: allComplete ? "Completed" : (current?.stage.name ?? "No TNA"),
    currentStageProgress: allComplete ? 100 : (current?.progress ?? 0),
    producedQuantity: allComplete ? orderRow.total_quantity : (current?.cumulative ?? 0),
    config,
    canEdit,
  };
}

async function canEditOrderAccess(user: SessionUser, poId: string): Promise<boolean> {
  try {
    await assertCanEditOrder(user, poId);
    return true;
  } catch {
    return false;
  }
}

function stripOrderRow<T extends PurchaseOrder>(row: T): PurchaseOrder {
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

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface VariantInput {
  colour: string;
  size: string;
  quantity: number;
}

export interface CreateOrderInput {
  poNumber: string;
  buyerId: string;
  buyerReference?: string;
  orderReceivedDate: string;
  styleName: string;
  styleNumber?: string;
  description?: string;
  totalQuantity: number;
  exFactoryDate: string;
  shippingMethod: string;
  priority: string;
  merchandiserId?: string;
  primaryUnitId?: string;
  notes?: string;
  variants: VariantInput[];
  templateId: string;
  optionalStageIds?: string[];
  milestoneDates?: Record<string, string>;
  supervisorId?: string;
  subcontractorId?: string;
}

export function validateVariants(
  variants: VariantInput[],
  totalQuantity: number,
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(variants) || variants.length === 0) {
    return { ok: false, error: "Add at least one colour and size combination." };
  }
  const seen = new Set<string>();
  let sum = 0;
  for (const variant of variants) {
    const colour = variant.colour?.trim();
    const size = variant.size?.trim();
    if (!colour || !size) {
      return { ok: false, error: "Every variant needs a colour and a size." };
    }
    if (!Number.isInteger(variant.quantity) || variant.quantity < 0) {
      return { ok: false, error: "Variant quantities must be non-negative whole numbers." };
    }
    const key = `${colour.toLowerCase()}::${size.toLowerCase()}`;
    if (seen.has(key)) {
      return { ok: false, error: `Duplicate variant: ${colour} / ${size}.` };
    }
    seen.add(key);
    sum += variant.quantity;
  }
  if (sum !== totalQuantity) {
    return {
      ok: false,
      error: `Variant quantities total ${sum.toLocaleString("en-IN")} pieces, but the PO quantity is ${totalQuantity.toLocaleString("en-IN")}. They must match.`,
    };
  }
  return { ok: true };
}

export async function createOrder(user: SessionUser, input: CreateOrderInput): Promise<string> {
  if (!canPlanOrders(user.role)) {
    throw new Error("You do not have permission to create purchase orders.");
  }
  if (!input.poNumber.trim()) throw new Error("PO number is required.");
  if (input.totalQuantity <= 0) throw new Error("Order quantity must be greater than zero.");
  if (input.exFactoryDate < input.orderReceivedDate) {
    throw new Error("Ex-factory date cannot be before the order received date.");
  }

  const validation = validateVariants(input.variants, input.totalQuantity);
  if (!validation.ok) throw new Error(validation.error);

  const duplicate = await sql<{ id: string }>(
    "select id from purchase_orders where lower(po_number) = lower($1) limit 1",
    [input.poNumber.trim()],
  );
  if (duplicate.length > 0) throw new Error("That PO number already exists.");

  const templateRows = await sql<TnaTemplateMilestone & { stage_name: string }>(
    `select ttm.*, ps.name as stage_name
       from tna_template_milestones ttm
       join production_stages ps on ps.id = ttm.stage_id
      where ttm.template_id = $1
      order by ttm.sequence asc`,
    [input.templateId],
  );
  if (templateRows.length === 0) throw new Error("Select a TNA template with milestones.");

  const optional = new Set(input.optionalStageIds ?? []);
  const selected = templateRows.filter((row) => !row.is_optional || optional.has(row.stage_id));
  if (selected.length === 0) throw new Error("Include at least one TNA milestone.");

  const db = await getDb();

  return db.transaction(async (tx) => {
    const merchandiserId =
      user.role === "super_admin" ? (input.merchandiserId ?? user.id) : user.id;

    const inserted = await tx.query<{ id: string }>(
      `insert into purchase_orders
        (po_number, buyer_id, buyer_reference, order_received_date, style_name, style_number,
         description, total_quantity, ex_factory_date, shipping_method, priority,
         merchandiser_id, primary_unit_id, notes, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning id`,
      [
        input.poNumber.trim(),
        input.buyerId,
        input.buyerReference?.trim() || null,
        input.orderReceivedDate,
        input.styleName.trim(),
        input.styleNumber?.trim() || null,
        input.description?.trim() || null,
        input.totalQuantity,
        input.exFactoryDate,
        input.shippingMethod,
        input.priority,
        merchandiserId,
        input.primaryUnitId || null,
        input.notes?.trim() || null,
        user.id,
      ],
    );
    const poId = inserted[0].id;

    for (const variant of input.variants) {
      await tx.query(
        `insert into order_variants (po_id, colour, size, quantity) values ($1,$2,$3,$4)`,
        [poId, variant.colour.trim(), variant.size.trim(), variant.quantity],
      );
    }

    for (let index = 0; index < selected.length; index += 1) {
      const row = selected[index];
      const override = input.milestoneDates?.[row.stage_id];
      const plannedDate =
        override && /^\d{4}-\d{2}-\d{2}$/.test(override)
          ? override
          : addDaysISO(input.exFactoryDate, Number(row.offset_days));
      const milestone = await tx.query<{ id: string }>(
        `insert into order_milestones
          (po_id, stage_id, sequence, planned_date, target_quantity)
         values ($1,$2,$3,$4,$5)
         returning id`,
        [poId, row.stage_id, index + 1, plannedDate, input.totalQuantity],
      );
      await tx.query(
        `insert into stage_assignments
          (milestone_id, unit_id, supervisor_id, subcontractor_id, assigned_by)
         values ($1,$2,$3,$4,$5)`,
        [
          milestone[0].id,
          input.primaryUnitId || null,
          input.supervisorId || null,
          input.subcontractorId || null,
          user.id,
        ],
      );
    }

    await tx.query(
      `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
       values ($1,$2,'order_created','purchase_order',$1,$3)`,
      [poId, user.id, JSON.stringify({ po_number: input.poNumber, total_quantity: input.totalQuantity })],
    );

    return poId;
  });
}

export interface UpdateOrderInput {
  styleName: string;
  styleNumber?: string;
  description?: string;
  buyerReference?: string;
  shippingMethod: string;
  priority: string;
  primaryUnitId?: string;
  merchandiserId?: string;
  notes?: string;
  exFactoryDate: string;
  dateChangeReason?: string;
  status?: string;
}

export async function updateOrder(
  user: SessionUser,
  poId: string,
  input: UpdateOrderInput,
): Promise<void> {
  await assertCanEditOrder(user, poId);
  const existing = await sql<PurchaseOrder>(
    "select * from purchase_orders where id = $1",
    [poId],
  );
  if (!existing[0]) throw new Error("Order not found.");

  const current = existing[0];
  const dateChanged = input.exFactoryDate !== current.ex_factory_date;
  if (dateChanged && !input.dateChangeReason?.trim()) {
    throw new Error("A reason is required when changing the ex-factory date.");
  }

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      `update purchase_orders
          set style_name = $2, style_number = $3, description = $4, buyer_reference = $5,
              shipping_method = $6, priority = $7, primary_unit_id = $8, merchandiser_id = $9,
              notes = $10, ex_factory_date = $11, status = $12, updated_at = now()
        where id = $1`,
      [
        poId,
        input.styleName.trim(),
        input.styleNumber?.trim() || null,
        input.description?.trim() || null,
        input.buyerReference?.trim() || null,
        input.shippingMethod,
        input.priority,
        input.primaryUnitId || null,
        user.role === "super_admin" ? (input.merchandiserId ?? current.merchandiser_id) : current.merchandiser_id,
        input.notes?.trim() || null,
        input.exFactoryDate,
        input.status ?? current.status,
      ],
    );

    if (dateChanged) {
      await tx.query(
        `insert into order_date_history
          (po_id, milestone_id, field_name, previous_date, new_date, reason, changed_by)
         values ($1, null, 'ex_factory_date', $2, $3, $4, $5)`,
        [poId, current.ex_factory_date, input.exFactoryDate, input.dateChangeReason!.trim(), user.id],
      );
      await tx.query(
        `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
         values ($1,$2,'ex_factory_date_changed','purchase_order',$1,$3)`,
        [
          poId,
          user.id,
          JSON.stringify({ from: current.ex_factory_date, to: input.exFactoryDate }),
        ],
      );
    } else {
      await tx.query(
        `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
         values ($1,$2,'order_updated','purchase_order',$1,$3)`,
        [poId, user.id, JSON.stringify({ style_name: input.styleName })],
      );
    }
  });
}

export interface MilestoneUpdateInput {
  plannedDate: string;
  targetQuantity: number;
  supervisorId?: string;
  unitId?: string;
  subcontractorId?: string;
  isActive: boolean;
  notes?: string;
  dateChangeReason?: string;
}

export async function updateMilestone(
  user: SessionUser,
  milestoneId: string,
  input: MilestoneUpdateInput,
): Promise<void> {
  const milestoneRows = await sql<OrderMilestone>(
    "select * from order_milestones where id = $1",
    [milestoneId],
  );
  const milestone = milestoneRows[0];
  if (!milestone) throw new Error("Milestone not found.");
  await assertCanEditOrder(user, milestone.po_id);

  const dateChanged = input.plannedDate !== milestone.planned_date;
  if (dateChanged && !input.dateChangeReason?.trim()) {
    throw new Error("A reason is required when changing a planned date.");
  }
  if (!Number.isInteger(input.targetQuantity) || input.targetQuantity < 0) {
    throw new Error("Target quantity must be a non-negative whole number.");
  }

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      `update order_milestones
          set planned_date = $2, target_quantity = $3, is_active = $4, notes = $5, updated_at = now()
        where id = $1`,
      [milestoneId, input.plannedDate, input.targetQuantity, input.isActive, input.notes?.trim() || null],
    );

    const existingAssignment = await tx.query<{ id: string }>(
      "select id from stage_assignments where milestone_id = $1",
      [milestoneId],
    );
    if (existingAssignment[0]) {
      await tx.query(
        `update stage_assignments
            set unit_id = $2, supervisor_id = $3, subcontractor_id = $4
          where milestone_id = $1`,
        [milestoneId, input.unitId || null, input.supervisorId || null, input.subcontractorId || null],
      );
    } else {
      await tx.query(
        `insert into stage_assignments (milestone_id, unit_id, supervisor_id, subcontractor_id, assigned_by)
         values ($1,$2,$3,$4,$5)`,
        [milestoneId, input.unitId || null, input.supervisorId || null, input.subcontractorId || null, user.id],
      );
    }

    if (dateChanged) {
      await tx.query(
        `insert into order_date_history
          (po_id, milestone_id, field_name, previous_date, new_date, reason, changed_by)
         values ($1,$2,'milestone_planned_date',$3,$4,$5,$6)`,
        [
          milestone.po_id,
          milestoneId,
          milestone.planned_date,
          input.plannedDate,
          input.dateChangeReason!.trim(),
          user.id,
        ],
      );
      await tx.query(
        `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
         values ($1,$2,'tna_date_changed','order_milestone',$3,$4)`,
        [
          milestone.po_id,
          user.id,
          milestoneId,
          JSON.stringify({ from: milestone.planned_date, to: input.plannedDate, reason: input.dateChangeReason }),
        ],
      );
    } else {
      await tx.query(
        `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
         values ($1,$2,'tna_updated','order_milestone',$3,$4)`,
        [milestone.po_id, user.id, milestoneId, JSON.stringify({ target: input.targetQuantity, active: input.isActive })],
      );
    }
  });
}

export async function addMilestone(
  user: SessionUser,
  poId: string,
  input: {
    stageId: string;
    plannedDate: string;
    targetQuantity: number;
    supervisorId?: string;
    unitId?: string;
    subcontractorId?: string;
  },
): Promise<void> {
  await assertCanEditOrder(user, poId);
  const existing = await sql<{ id: string }>(
    "select id from order_milestones where po_id = $1 and stage_id = $2",
    [poId, input.stageId],
  );
  if (existing.length > 0) throw new Error("That production stage is already in this order's TNA.");

  const max = await sql<{ max: number | null }>(
    "select max(sequence)::int as max from order_milestones where po_id = $1",
    [poId],
  );

  const db = await getDb();
  await db.transaction(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `insert into order_milestones (po_id, stage_id, sequence, planned_date, target_quantity, is_active)
       values ($1,$2,$3,$4,$5,true) returning id`,
      [poId, input.stageId, Number(max[0]?.max ?? 0) + 1, input.plannedDate, input.targetQuantity],
    );
    await tx.query(
      `insert into stage_assignments (milestone_id, unit_id, supervisor_id, subcontractor_id, assigned_by)
       values ($1,$2,$3,$4,$5)`,
      [inserted[0].id, input.unitId || null, input.supervisorId || null, input.subcontractorId || null, user.id],
    );
    await tx.query(
      `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
       values ($1,$2,'tna_milestone_added','order_milestone',$3,$4)`,
      [poId, user.id, inserted[0].id, JSON.stringify({ stage_id: input.stageId, planned_date: input.plannedDate })],
    );
  });
}

export async function moveMilestone(
  user: SessionUser,
  milestoneId: string,
  direction: "up" | "down",
): Promise<void> {
  const rows = await sql<OrderMilestone>(
    "select * from order_milestones where id = $1",
    [milestoneId],
  );
  const milestone = rows[0];
  if (!milestone) throw new Error("Milestone not found.");
  await assertCanEditOrder(user, milestone.po_id);

  const siblings = await sql<{ id: string; sequence: number }>(
    "select id, sequence from order_milestones where po_id = $1 order by sequence asc",
    [milestone.po_id],
  );
  const index = siblings.findIndex((item) => item.id === milestoneId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const current = siblings[index];
  const other = siblings[swapIndex];

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query("update order_milestones set sequence = $2, updated_at = now() where id = $1", [
      current.id,
      other.sequence,
    ]);
    await tx.query("update order_milestones set sequence = $2, updated_at = now() where id = $1", [
      other.id,
      current.sequence,
    ]);
    await tx.query(
      `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
       values ($1,$2,'tna_reordered','order_milestone',$3,$4)`,
      [
        milestone.po_id,
        user.id,
        milestoneId,
        JSON.stringify({ direction, stage_id: milestone.stage_id }),
      ],
    );
  });
}

// ---------------------------------------------------------------------------
// Form option data
// ---------------------------------------------------------------------------
export interface OrderFormOptions {
  buyers: Buyer[];
  units: ProductionUnit[];
  merchandisers: Profile[];
  supervisors: Profile[];
  subcontractors: Subcontractor[];
  stages: ProductionStage[];
  templates: (TnaTemplate & { milestones: (TnaTemplateMilestone & { stage_name: string; stage_sequence: number })[] })[];
}

export async function getOrderFormOptions(): Promise<OrderFormOptions> {
  const [buyers, units, merchandisers, supervisors, subcontractors, stages, templates, templateMilestones] =
    await Promise.all([
      sql<Buyer>("select * from buyers where is_active = true order by name"),
      sql<ProductionUnit>("select * from production_units where is_active = true order by name"),
      sql<Profile>(
        "select id, email, full_name, role, phone, unit_id, buyer_id, is_active, avatar_url, created_at, updated_at from profiles where role in ('merchandiser','super_admin') and is_active = true order by full_name",
      ),
      sql<Profile>(
        "select id, email, full_name, role, phone, unit_id, buyer_id, is_active, avatar_url, created_at, updated_at from profiles where role = 'unit_supervisor' and is_active = true order by full_name",
      ),
      sql<Subcontractor>("select * from subcontractors where is_active = true order by name"),
      sql<ProductionStage>("select * from production_stages where is_active = true order by sequence"),
      sql<TnaTemplate>("select * from tna_templates where is_active = true order by name"),
      sql<TnaTemplateMilestone & { stage_name: string; stage_sequence: number }>(
        `select ttm.*, ps.name as stage_name, ps.sequence as stage_sequence
           from tna_template_milestones ttm
           join production_stages ps on ps.id = ttm.stage_id
          order by ttm.sequence asc`,
      ),
    ]);

  return {
    buyers,
    units,
    merchandisers,
    supervisors,
    subcontractors,
    stages,
    templates: templates.map((template) => ({
      ...template,
      milestones: templateMilestones.filter((milestone) => milestone.template_id === template.id),
    })),
  };
}
