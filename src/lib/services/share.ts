import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb, sql } from "@/lib/db";
import { env } from "@/lib/env";
import type { Buyer, BuyerNotification, ProductionPhoto, SessionUser } from "@/types";
import { assertCanEditOrder } from "./access";

export type ShareScope = "summary" | "updates";

export interface ShareTokenSummary {
  id: string;
  po_id: string;
  scope: ShareScope;
  label: string | null;
  expires_at: string;
  is_expired: boolean;
  revoked_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
  created_by_name: string | null;
}

export interface ShareLinkResult {
  token: ShareTokenSummary;
  url: string;
  expiresAt: string;
}

export interface SharePageData {
  order: {
    id: string;
    po_number: string;
    style_name: string;
    style_number: string | null;
    total_quantity: number;
    ex_factory_date: string;
    order_received_date: string;
    shipping_method: string;
    status: string;
  };
  buyer: Buyer;
  tokens: ShareTokenSummary[];
}

export interface SharedMilestone {
  id: string;
  stage_name: string;
  sequence: number;
  planned_date: string;
  target_quantity: number;
  cumulative: number;
  progress: number;
  status: string;
}

export interface SharedUpdate {
  id: string;
  stage_name: string;
  update_date: string;
  quantity: number;
  notes: string | null;
  photos: ProductionPhoto[];
}

export interface SharedOrder {
  tokenId: string;
  scope: ShareScope;
  expiresAt: string;
  order: SharePageData["order"];
  buyer: Buyer;
  unit_name: string | null;
  milestones: SharedMilestone[];
  currentStage: string;
  currentProgress: number;
  notifications: (Pick<BuyerNotification, "id" | "subject" | "message" | "status" | "created_at" | "sent_at">)[];
  updates: SharedUpdate[];
}

const SCOPE_LABELS: Record<ShareScope, string> = {
  summary: "Order summary and milestones",
  updates: "Order summary, milestones and approved updates",
};

export function shareScopeLabel(scope: ShareScope): string {
  return SCOPE_LABELS[scope];
}

/** Only the SHA-256 hash of a share token is persisted. */
function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function shareUrl(rawToken: string): string {
  return `${env().appUrl.replace(/\/+$/, "")}/share/${rawToken}`;
}

export async function createShareLink(
  user: SessionUser,
  poId: string,
  input: { scope: ShareScope; days: number; label?: string },
): Promise<ShareLinkResult> {
  await assertCanEditOrder(user, poId);
  if (input.scope !== "summary" && input.scope !== "updates") {
    throw new Error("Choose a valid share scope.");
  }
  const days = Math.trunc(input.days);
  if (!Number.isFinite(days) || days < 1 || days > 90) {
    throw new Error("Share links must expire between 1 and 90 days from now.");
  }
  const label = (input.label ?? "").trim().slice(0, 80) || null;

  const rawToken = randomBytes(32).toString("base64url");
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into buyer_share_tokens
        (id, po_id, token_hash, scope, label, expires_at, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [tokenId, poId, hashShareToken(rawToken), input.scope, label, expiresAt, user.id],
    );
    await tx.query(
      `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
       values ($1, $2, 'share_link_created', 'buyer_share_token', $3, $4)`,
      [
        poId,
        user.id,
        tokenId,
        JSON.stringify({ scope: input.scope, days, label, expires_at: expiresAt }),
      ],
    );
  });

  const tokenRows = await sql<ShareTokenSummary>(
    `select t.id, t.po_id, t.scope, t.label, t.expires_at,
            (t.expires_at <= now()) as is_expired, t.revoked_at, t.created_at,
            t.last_accessed_at, p.full_name as created_by_name
       from buyer_share_tokens t
       left join profiles p on p.id = t.created_by
      where t.id = $1`,
    [tokenId],
  );

  return {
    token: tokenRows[0],
    url: shareUrl(rawToken),
    expiresAt,
  };
}

export async function revokeShareLink(user: SessionUser, tokenId: string): Promise<void> {
  const rows = await sql<{ id: string; po_id: string; revoked_at: string | null }>(
    "select id, po_id, revoked_at from buyer_share_tokens where id = $1",
    [tokenId],
  );
  const token = rows[0];
  if (!token) throw new Error("Share link not found.");
  await assertCanEditOrder(user, token.po_id);
  if (token.revoked_at) throw new Error("This share link is already revoked.");

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      "update buyer_share_tokens set revoked_at = now() where id = $1 and revoked_at is null",
      [tokenId],
    );
    await tx.query(
      `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
       values ($1, $2, 'share_link_revoked', 'buyer_share_token', $3, '{}'::jsonb)`,
      [token.po_id, user.id, tokenId],
    );
  });
}

export async function getOrderSharePage(
  user: SessionUser,
  poId: string,
): Promise<SharePageData> {
  await assertCanEditOrder(user, poId);

  const rows = await sql<{
    id: string;
    po_number: string;
    style_name: string;
    style_number: string | null;
    total_quantity: number;
    ex_factory_date: string;
    order_received_date: string;
    shipping_method: string;
    status: string;
    buyer_id: string;
    buyer_name: string;
    buyer_code: string;
    buyer_country: string;
    buyer_contact_person: string | null;
    buyer_contact_email: string | null;
  }>(
    `select po.id, po.po_number, po.style_name, po.style_number, po.total_quantity,
            po.ex_factory_date, po.order_received_date, po.shipping_method, po.status,
            po.buyer_id, b.name as buyer_name, b.code as buyer_code, b.country as buyer_country,
            b.contact_person as buyer_contact_person, b.contact_email as buyer_contact_email
       from purchase_orders po
       join buyers b on b.id = po.buyer_id
      where po.id = $1`,
    [poId],
  );
  const row = rows[0];
  if (!row) throw new Error("Order not found.");

  const tokens = await sql<ShareTokenSummary>(
    `select t.id, t.po_id, t.scope, t.label, t.expires_at,
            (t.expires_at <= now()) as is_expired, t.revoked_at, t.created_at,
            t.last_accessed_at, p.full_name as created_by_name
       from buyer_share_tokens t
       left join profiles p on p.id = t.created_by
      where t.po_id = $1
      order by t.created_at desc`,
    [poId],
  );

  return {
    order: {
      id: row.id,
      po_number: row.po_number,
      style_name: row.style_name,
      style_number: row.style_number,
      total_quantity: Number(row.total_quantity),
      ex_factory_date: row.ex_factory_date,
      order_received_date: row.order_received_date,
      shipping_method: row.shipping_method,
      status: row.status,
    },
    buyer: {
      id: row.buyer_id,
      name: row.buyer_name,
      code: row.buyer_code,
      country: row.buyer_country,
      contact_person: row.buyer_contact_person,
      contact_email: row.buyer_contact_email,
      is_active: true,
      created_at: "",
    },
    tokens,
  };
}

interface ResolvedToken {
  id: string;
  po_id: string;
  scope: ShareScope;
  expires_at: string;
}

export async function resolveShareToken(rawToken: string): Promise<ResolvedToken | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(rawToken)) return null;
  const hash = hashShareToken(rawToken);
  const rows = await sql<ResolvedToken>(
    `select id, po_id, scope, expires_at
       from buyer_share_tokens
      where token_hash = $1 and revoked_at is null and expires_at > now()`,
    [hash],
  );
  const token = rows[0];
  if (!token) return null;

  await sql(
    `update buyer_share_tokens
        set last_accessed_at = now()
      where id = $1
        and (last_accessed_at is null or last_accessed_at < now() - interval '5 minutes')`,
    [token.id],
  );

  return token;
}

export async function getSharedOrder(rawToken: string): Promise<SharedOrder | null> {
  const token = await resolveShareToken(rawToken);
  if (!token) return null;

  const orderRows = await sql<{
    id: string;
    po_number: string;
    style_name: string;
    style_number: string | null;
    total_quantity: number;
    ex_factory_date: string;
    order_received_date: string;
    shipping_method: string;
    status: string;
    buyer_id: string;
    buyer_name: string;
    buyer_code: string;
    buyer_country: string;
    unit_name: string | null;
  }>(
    `select po.id, po.po_number, po.style_name, po.style_number, po.total_quantity,
            po.ex_factory_date, po.order_received_date, po.shipping_method, po.status,
            po.buyer_id, b.name as buyer_name, b.code as buyer_code, b.country as buyer_country,
            u.name as unit_name
       from purchase_orders po
       join buyers b on b.id = po.buyer_id
       left join production_units u on u.id = po.primary_unit_id
      where po.id = $1`,
    [token.po_id],
  );
  const row = orderRows[0];
  if (!row) return null;

  const [milestoneRows, notificationRows] = await Promise.all([
    sql<{
      id: string;
      stage_name: string;
      sequence: number;
      planned_date: string;
      target_quantity: number;
      cumulative: number;
      status: string;
    }>(
      `select om.id, ps.name as stage_name, ps.sequence, om.planned_date,
              om.target_quantity, om.status, coalesce(sum(pu.quantity), 0)::int as cumulative
         from order_milestones om
         join production_stages ps on ps.id = om.stage_id
         left join production_updates pu on pu.milestone_id = om.id
        where om.po_id = $1 and om.is_active = true
        group by om.id, ps.name, ps.sequence, om.planned_date, om.target_quantity, om.status
        order by ps.sequence asc`,
      [token.po_id],
    ),
    sql<SharedOrder["notifications"][number]>(
      `select id, subject, message, status, created_at, sent_at
         from buyer_notifications
        where po_id = $1 and status in ('approved', 'sent')
        order by coalesce(sent_at, approved_at, created_at) desc`,
      [token.po_id],
    ),
  ]);

  const milestones: SharedMilestone[] = milestoneRows.map((milestone) => {
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

  let updates: SharedUpdate[] = [];
  if (token.scope === "updates") {
    const updateRows = await sql<{
      id: string;
      stage_name: string;
      update_date: string;
      quantity: number;
      notes: string | null;
    }>(
      `select pu.id, ps.name as stage_name, pu.update_date, pu.quantity, pu.notes
         from production_updates pu
         join order_milestones om on om.id = pu.milestone_id
         join production_stages ps on ps.id = om.stage_id
        where pu.po_id = $1 and pu.approved_for_buyer = true
        order by pu.update_date desc, pu.created_at desc`,
      [token.po_id],
    );
    const photos = await sql<ProductionPhoto>(
      `select ph.*
         from production_photos ph
        where ph.po_id = $1 and ph.approved_for_buyer = true and ph.update_id is not null
        order by ph.created_at desc`,
      [token.po_id],
    );
    const photosByUpdate = new Map<string, ProductionPhoto[]>();
    for (const photo of photos) {
      if (!photo.update_id) continue;
      const list = photosByUpdate.get(photo.update_id) ?? [];
      list.push(photo);
      photosByUpdate.set(photo.update_id, list);
    }
    updates = updateRows.map((update) => ({
      id: update.id,
      stage_name: update.stage_name,
      update_date: update.update_date,
      quantity: Number(update.quantity),
      notes: update.notes,
      photos: photosByUpdate.get(update.id) ?? [],
    }));
  }

  return {
    tokenId: token.id,
    scope: token.scope,
    expiresAt: token.expires_at,
    order: {
      id: row.id,
      po_number: row.po_number,
      style_name: row.style_name,
      style_number: row.style_number,
      total_quantity: Number(row.total_quantity),
      ex_factory_date: row.ex_factory_date,
      order_received_date: row.order_received_date,
      shipping_method: row.shipping_method,
      status: row.status,
    },
    buyer: {
      id: row.buyer_id,
      name: row.buyer_name,
      code: row.buyer_code,
      country: row.buyer_country,
      contact_person: null,
      contact_email: null,
      is_active: true,
      created_at: "",
    },
    unit_name: row.unit_name,
    milestones,
    currentStage: current?.stage_name ?? "Completed",
    currentProgress: current?.progress ?? 100,
    notifications: notificationRows,
    updates,
  };
}
