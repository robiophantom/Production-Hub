import { sql } from "@/lib/db";
import type {
  BuyerNotification,
  Buyer,
  OrderSummary,
  ProductionPhoto,
  PurchaseOrder,
  SessionUser,
} from "@/types";
import {
  assertCanAccessOrder,
  orderScope,
} from "./access";
import { loadOrderSummaries } from "./order-summaries";

export interface BuyerNotificationView extends BuyerNotification {
  po_number: string;
  style_name: string;
}

export interface BuyerUpdateView {
  id: string;
  po_id: string;
  po_number: string;
  style_name: string;
  stage_name: string;
  update_date: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  photos: ProductionPhoto[];
}

export interface BuyerMetrics {
  activeOrders: number;
  orderedPieces: number;
  producedPieces: number;
  publishedUpdates: number;
  notifications: number;
}

export interface BuyerPortalData {
  orders: OrderSummary[];
  notifications: BuyerNotificationView[];
  updates: BuyerUpdateView[];
  metrics: BuyerMetrics;
}

export interface BuyerMilestoneView {
  id: string;
  stage_name: string;
  sequence: number;
  planned_date: string;
  target_quantity: number;
  cumulative: number;
  progress: number;
  status: string;
}

export interface BuyerOrderDetail {
  order: PurchaseOrder;
  buyer: Buyer;
  unit_name: string | null;
  milestones: BuyerMilestoneView[];
  currentStage: string;
  currentProgress: number;
  updates: BuyerUpdateView[];
  notifications: BuyerNotificationView[];
}

function requireBuyer(user: SessionUser): void {
  if (user.role !== "buyer") {
    throw new Error("The buyer portal is only available to buyer accounts.");
  }
}

export async function getBuyerUpdates(user: SessionUser, limit = 50): Promise<BuyerUpdateView[]> {
  requireBuyer(user);
  const scope = orderScope(user, "po", 1);
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));

  const rows = await sql<{
    id: string;
    po_id: string;
    po_number: string;
    style_name: string;
    stage_name: string;
    update_date: string;
    quantity: number;
    notes: string | null;
    created_at: string;
  }>(
    `select pu.id, pu.po_id, po.po_number, po.style_name, ps.name as stage_name,
            pu.update_date, pu.quantity, pu.notes, pu.created_at
       from production_updates pu
       join purchase_orders po on po.id = pu.po_id
       join order_milestones om on om.id = pu.milestone_id
       join production_stages ps on ps.id = om.stage_id
      where pu.approved_for_buyer = true and (${scope.clause})
      order by pu.update_date desc, pu.created_at desc
      limit $${scope.params.length + 1}`,
    [...scope.params, safeLimit],
  );

  const photos = await sql<ProductionPhoto>(
    `select ph.*
       from production_photos ph
       join purchase_orders po on po.id = ph.po_id
      where ph.approved_for_buyer = true and ph.update_id is not null and (${scope.clause})
      order by ph.created_at desc`,
    scope.params,
  );
  const photosByUpdate = new Map<string, ProductionPhoto[]>();
  for (const photo of photos) {
    if (!photo.update_id) continue;
    const list = photosByUpdate.get(photo.update_id) ?? [];
    list.push(photo);
    photosByUpdate.set(photo.update_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    po_id: row.po_id,
    po_number: row.po_number,
    style_name: row.style_name,
    stage_name: row.stage_name,
    update_date: row.update_date,
    quantity: Number(row.quantity),
    notes: row.notes,
    created_at: row.created_at,
    photos: photosByUpdate.get(row.id) ?? [],
  }));
}

export async function getBuyerNotifications(
  user: SessionUser,
  limit = 50,
): Promise<BuyerNotificationView[]> {
  requireBuyer(user);
  const scope = orderScope(user, "po", 1);
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));

  return sql<BuyerNotificationView>(
    `select bn.*, po.po_number, po.style_name
       from buyer_notifications bn
       join purchase_orders po on po.id = bn.po_id
      where bn.status in ('approved', 'sent') and (${scope.clause})
      order by coalesce(bn.sent_at, bn.approved_at, bn.created_at) desc
      limit $${scope.params.length + 1}`,
    [...scope.params, safeLimit],
  );
}

export async function getBuyerPortal(user: SessionUser): Promise<BuyerPortalData> {
  requireBuyer(user);
  const [orders, notifications, updates] = await Promise.all([
    loadOrderSummaries(user),
    getBuyerNotifications(user, 6),
    getBuyerUpdates(user, 6),
  ]);

  const active = orders.filter((order) => order.order.status === "active");

  return {
    orders,
    notifications,
    updates,
    metrics: {
      activeOrders: active.length,
      orderedPieces: active.reduce((sum, order) => sum + order.order.total_quantity, 0),
      producedPieces: active.reduce((sum, order) => sum + order.producedQuantity, 0),
      publishedUpdates: updates.length,
      notifications: notifications.length,
    },
  };
}

interface BuyerOrderRow extends PurchaseOrder {
  buyer_name: string;
  buyer_code: string;
  buyer_country: string;
  buyer_contact_person: string | null;
  buyer_contact_email: string | null;
  unit_name: string | null;
}

export async function getBuyerOrderDetail(
  user: SessionUser,
  poId: string,
): Promise<BuyerOrderDetail> {
  requireBuyer(user);
  await assertCanAccessOrder(user, poId);

  const orderRows = await sql<BuyerOrderRow>(
    `select po.*, b.name as buyer_name, b.code as buyer_code, b.country as buyer_country,
            b.contact_person as buyer_contact_person, b.contact_email as buyer_contact_email,
            u.name as unit_name
       from purchase_orders po
       join buyers b on b.id = po.buyer_id
       left join production_units u on u.id = po.primary_unit_id
      where po.id = $1`,
    [poId],
  );
  const row = orderRows[0];
  if (!row) throw new Error("Order not found.");

  const milestoneRows = await sql<{
    id: string;
    stage_name: string;
    sequence: number;
    planned_date: string;
    target_quantity: number;
    cumulative: number;
    status: string;
  }>(
    `select om.id, ps.name as stage_name, ps.sequence,
            om.planned_date, om.target_quantity, om.status,
            coalesce(sum(pu.quantity), 0)::int as cumulative
       from order_milestones om
       join production_stages ps on ps.id = om.stage_id
       left join production_updates pu on pu.milestone_id = om.id
      where om.po_id = $1 and om.is_active = true
      group by om.id, ps.name, ps.sequence, om.planned_date, om.target_quantity, om.status
      order by ps.sequence asc`,
    [poId],
  );

  const milestones: BuyerMilestoneView[] = milestoneRows.map((milestone) => {
    const target = Number(milestone.target_quantity);
    const cumulative = Number(milestone.cumulative);
    return {
      id: milestone.id,
      stage_name: milestone.stage_name,
      sequence: Number(milestone.sequence),
      planned_date: milestone.planned_date,
      target_quantity: target,
      cumulative,
      progress: target > 0 ? Math.min(100, (cumulative / target) * 100) : 0,
      status: milestone.status,
    };
  });

  const current =
    milestones.find((milestone) => milestone.status !== "completed" && milestone.progress < 100) ??
    milestones[milestones.length - 1];

  const [updates, notifications] = await Promise.all([
    getBuyerUpdates(user, 100).then((items) => items.filter((item) => item.po_id === poId)),
    getBuyerNotifications(user, 100).then((items) => items.filter((item) => item.po_id === poId)),
  ]);

  const buyer: Buyer = {
    id: row.buyer_id,
    name: row.buyer_name,
    code: row.buyer_code,
    country: row.buyer_country,
    contact_person: row.buyer_contact_person,
    contact_email: row.buyer_contact_email,
    is_active: true,
    created_at: "",
  };

  return {
    order: {
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
      merchandiser_id: null,
      primary_unit_id: row.primary_unit_id,
      notes: null,
      status: row.status,
      created_by: null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    buyer,
    unit_name: row.unit_name,
    milestones,
    currentStage: current?.stage_name ?? "Completed",
    currentProgress: current?.progress ?? 100,
    updates,
    notifications,
  };
}
