import { sql } from "@/lib/db";
import type { SessionUser } from "@/types";

export function isInternalRole(role: SessionUser["role"]): boolean {
  return ["super_admin", "managing_director", "merchandiser"].includes(role);
}

export function canManage(role: SessionUser["role"]): boolean {
  return role === "super_admin";
}

export function canPlanOrders(role: SessionUser["role"]): boolean {
  return role === "super_admin" || role === "merchandiser";
}

export interface ScopeQuery {
  clause: string;
  params: unknown[];
}

/**
 * SQL scope applied to purchase_orders aliased as `po`. This is the server-side
 * enforcement mirror of the RLS policies, and the second line of defence for
 * every query (never trust an id supplied by the client).
 */
export function orderScope(user: SessionUser, alias = "po", startIndex = 1): ScopeQuery {
  switch (user.role) {
    case "super_admin":
    case "managing_director":
      return { clause: "1 = 1", params: [] };
    case "merchandiser":
      return { clause: `${alias}.merchandiser_id = $${startIndex}`, params: [user.id] };
    case "unit_supervisor":
      return {
        clause: `exists (
          select 1 from order_milestones scope_om
          join stage_assignments scope_sa on scope_sa.milestone_id = scope_om.id
          where scope_om.po_id = ${alias}.id and scope_sa.supervisor_id = $${startIndex}
        )`,
        params: [user.id],
      };
    case "buyer":
      return {
        clause: `${alias}.buyer_id = $${startIndex}`,
        params: [user.buyer_id],
      };
    default:
      return { clause: "1 = 0", params: [] };
  }
}

export async function canAccessOrder(user: SessionUser, orderId: string): Promise<boolean> {
  if (!orderId) return false;
  const scope = orderScope(user, "po", 2);
  const row = await sql<{ id: string }>(
    `select po.id from purchase_orders po where po.id = $1 and (${scope.clause}) limit 1`,
    [orderId, ...scope.params],
  );
  return row.length > 0;
}

export async function canEditOrder(user: SessionUser, orderId: string): Promise<boolean> {
  if (!canPlanOrders(user.role)) return false;
  if (user.role === "super_admin") return canAccessOrder(user, orderId);
  const row = await sql<{ id: string }>(
    "select id from purchase_orders where id = $1 and merchandiser_id = $2 limit 1",
    [orderId, user.id],
  );
  return row.length > 0;
}

export async function assertCanEditOrder(user: SessionUser, orderId: string): Promise<void> {
  if (!(await canEditOrder(user, orderId))) {
    throw new Error("You do not have permission to change this order.");
  }
}

export async function assertCanAccessOrder(user: SessionUser, orderId: string): Promise<void> {
  if (!(await canAccessOrder(user, orderId))) {
    throw new Error("Order not found or you do not have access to it.");
  }
}

/** Asserts the supervisor is assigned to at least one milestone of this order. */
export async function assertSupervisorAssigned(
  user: SessionUser,
  orderId: string,
  milestoneId?: string,
): Promise<void> {
  if (user.role === "super_admin") return;
  if (user.role !== "unit_supervisor") {
    throw new Error("Only unit supervisors can submit production updates.");
  }
  const rows = await sql<{ id: string }>(
    `select om.id
       from order_milestones om
       join stage_assignments sa on sa.milestone_id = om.id
      where om.po_id = $1 and sa.supervisor_id = $2
      ${milestoneId ? "and om.id = $3" : ""}
      limit 1`,
    milestoneId ? [orderId, user.id, milestoneId] : [orderId, user.id],
  );
  if (rows.length === 0) {
    throw new Error("This order or production stage is not assigned to you.");
  }
}
