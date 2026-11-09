import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/types";

const dataDir = path.join(process.cwd(), ".data", "vitest-integration");
process.env.PGLITE_DATA_DIR = dataDir;
process.env.SEED_DEMO_DATA = "true";

await rm(dataDir, { recursive: true, force: true });
(globalThis as unknown as { __productionHubDb?: unknown }).__productionHubDb = undefined;

const { getDb, sql } = await import("@/lib/db");
const { canAccessOrder, canEditOrder, assertSupervisorAssigned } = await import(
  "@/lib/services/access"
);
const { getBuyerPortal, getBuyerOrderDetail } = await import("@/lib/services/buyer");
const {
  createShareLink,
  revokeShareLink,
  resolveShareToken,
  getSharedOrder,
} = await import("@/lib/services/share");
const { submitProductionUpdate } = await import("@/lib/services/production");
const { createAdminUser, listAuditEvents } = await import("@/lib/services/admin");
const { todayISO, addDaysISO } = await import("@/lib/business/working-days");

const ORDER_B_88213 = "70000000-0000-4000-8000-000000000001";
const ORDER_B_88240 = "70000000-0000-4000-8000-000000000002";
const ORDER_C_0488 = "70000000-0000-4000-8000-000000000003";
const ORDER_B_88301 = "70000000-0000-4000-8000-000000000004";

async function sessionFor(email: string): Promise<SessionUser> {
  const rows = await sql<SessionUser>(
    `select id, email, full_name, role, unit_id, buyer_id, is_active
       from profiles where email = $1`,
    [email],
  );
  const row = rows[0];
  if (!row) throw new Error(`Missing seeded profile ${email}`);
  return row;
}

let admin: SessionUser;
let merch1: SessionUser;
let merch2: SessionUser;
let sup1: SessionUser;
let sup2: SessionUser;
let buyerB: SessionUser;
let buyerC: SessionUser;

beforeAll(async () => {
  await getDb();
  [admin, merch1, merch2, sup1, sup2, buyerB, buyerC] = await Promise.all([
    sessionFor("admin@company-a.test"),
    sessionFor("merch@company-a.test"),
    sessionFor("merch2@company-a.test"),
    sessionFor("supervisor@company-a.test"),
    sessionFor("supervisor2@company-a.test"),
    sessionFor("buyer@company-b.test"),
    sessionFor("buyer.c@company-c.test"),
  ]);
});

describe("service-level order scoping", () => {
  it("lets a buyer see only their own orders", async () => {
    expect(await canAccessOrder(buyerB, ORDER_B_88213)).toBe(true);
    expect(await canAccessOrder(buyerB, ORDER_B_88240)).toBe(true);
    expect(await canAccessOrder(buyerB, ORDER_C_0488)).toBe(false);

    expect(await canAccessOrder(buyerC, ORDER_C_0488)).toBe(true);
    expect(await canAccessOrder(buyerC, ORDER_B_88213)).toBe(false);
  });

  it("rejects cross-buyer order detail requests even with a valid id", async () => {
    await expect(getBuyerOrderDetail(buyerB, ORDER_C_0488)).rejects.toThrow(
      /not found|do not have access/i,
    );
    const detail = await getBuyerOrderDetail(buyerB, ORDER_B_88213);
    expect(detail.order.po_number).toBe("B-PO-88213");
  });

  it("scopes the buyer portal data to the signed-in buyer", async () => {
    const portal = await getBuyerPortal(buyerB);
    expect(portal.orders.length).toBe(4);
    expect(portal.orders.every((row) => row.order.buyer_id === buyerB.buyer_id)).toBe(true);
    const numbers = portal.orders.map((row) => row.order.po_number).sort();
    expect(numbers).toEqual(["B-PO-88213", "B-PO-88240", "B-PO-88301", "B-PO-88315"]);
    await expect(getBuyerPortal(merch1)).rejects.toThrow(/buyer portal/i);
  });

  it("lets a merchandiser see only their assigned orders", async () => {
    expect(await canAccessOrder(merch1, ORDER_B_88213)).toBe(true);
    expect(await canAccessOrder(merch2, ORDER_B_88213)).toBe(false);
    expect(await canAccessOrder(merch2, ORDER_B_88301)).toBe(true);
    expect(await canEditOrder(merch1, ORDER_B_88213)).toBe(true);
    expect(await canEditOrder(merch2, ORDER_B_88213)).toBe(false);
  });

  it("lets a supervisor see only orders with their own stage assignments", async () => {
    expect(await canAccessOrder(sup1, ORDER_B_88213)).toBe(true);
    expect(await canAccessOrder(sup1, ORDER_C_0488)).toBe(false);
    expect(await canAccessOrder(sup2, ORDER_C_0488)).toBe(true);
    expect(await canEditOrder(sup1, ORDER_B_88213)).toBe(false);

    const foreignMilestone = await sql<{ id: string }>(
      "select id from order_milestones where po_id = $1 limit 1",
      [ORDER_C_0488],
    );
    await expect(
      assertSupervisorAssigned(sup1, ORDER_C_0488, foreignMilestone[0].id),
    ).rejects.toThrow(/not assigned/i);
    await expect(assertSupervisorAssigned(sup1, ORDER_B_88213)).resolves.toBeUndefined();
  });
});

describe("PostgreSQL row-level security", () => {
  it("filters purchase orders to the buyer identity set on the database session", async () => {
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [buyerB.id]);
      await tx.exec("set local role authenticated");

      const rows = await tx.query<{ po_number: string }>(
        "select po_number from purchase_orders order by po_number",
      );
      expect(rows.map((row) => row.po_number)).toEqual([
        "B-PO-88213",
        "B-PO-88240",
        "B-PO-88301",
        "B-PO-88315",
      ]);

      const other = await tx.query<{ id: string }>(
        "select id from purchase_orders where id = $1",
        [ORDER_C_0488],
      );
      expect(other).toHaveLength(0);

      const updated = await tx.query<{ id: string }>(
        "update purchase_orders set style_name = 'tampered' where id = $1 returning id",
        [ORDER_B_88213],
      );
      expect(updated).toHaveLength(0);
    });

    const unchanged = await sql<{ style_name: string }>(
      "select style_name from purchase_orders where id = $1",
      [ORDER_B_88213],
    );
    expect(unchanged[0].style_name).not.toBe("tampered");
  });

  it("keeps audit records and buyer share tokens out of client write reach", async () => {
    const db = await getDb();
    const privileges = await db.query<{
      audit_update: boolean;
      history_update: boolean;
      token_select: boolean;
    }>(
      `select has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE') as audit_update,
              has_table_privilege('authenticated', 'public.order_date_history', 'UPDATE') as history_update,
              has_table_privilege('authenticated', 'public.buyer_share_tokens', 'SELECT') as token_select`,
    );
    expect(privileges[0]).toEqual({
      audit_update: false,
      history_update: false,
      token_select: false,
    });
  });
});

describe("buyer share links", () => {
  it("stores only the SHA-256 hash of the token", async () => {
    const link = await createShareLink(merch1, ORDER_B_88213, {
      scope: "summary",
      days: 7,
      label: "Buyer weekly view",
    });
    const rawToken = link.url.split("/").pop() ?? "";
    expect(rawToken.length).toBeGreaterThan(20);
    expect(link.url.endsWith(`/share/${rawToken}`)).toBe(true);

    const rows = await sql<{ token_hash: string; scope: string; label: string }>(
      "select token_hash, scope, label from buyer_share_tokens where id = $1",
      [link.token.id],
    );
    expect(rows[0].token_hash).toBe(createHash("sha256").update(rawToken).digest("hex"));
    expect(rows[0].token_hash).not.toContain(rawToken);
    expect(rows[0].scope).toBe("summary");
    expect(rows[0].label).toBe("Buyer weekly view");

    const resolved = await resolveShareToken(rawToken);
    expect(resolved?.po_id).toBe(ORDER_B_88213);

    await expect(resolveShareToken(`${rawToken.slice(0, -1)}x`)).resolves.toBeNull();
    await expect(getSharedOrder("not-a-real-token")).resolves.toBeNull();

    await revokeShareLink(merch1, link.token.id);
    await expect(resolveShareToken(rawToken)).resolves.toBeNull();
    await expect(getSharedOrder(rawToken)).resolves.toBeNull();
  });

  it("honours the link scope for approved production updates", async () => {
    await sql(
      `update production_updates
          set approved_for_buyer = true
        where id = (select id from production_updates where po_id = $1 limit 1)`,
      [ORDER_B_88213],
    );

    const summary = await createShareLink(merch1, ORDER_B_88213, { scope: "summary", days: 2 });
    const updates = await createShareLink(merch1, ORDER_B_88213, { scope: "updates", days: 2 });

    const summaryView = await getSharedOrder(summary.url.split("/").pop()!);
    const updatesView = await getSharedOrder(updates.url.split("/").pop()!);
    expect(summaryView?.updates).toEqual([]);
    expect(updatesView?.updates.length).toBeGreaterThan(0);
    expect(updatesView?.order.po_number).toBe("B-PO-88213");
  });

  it("rejects expired links", async () => {
    const link = await createShareLink(merch1, ORDER_B_88213, { scope: "summary", days: 1 });
    const rawToken = link.url.split("/").pop()!;
    await sql(
      "update buyer_share_tokens set expires_at = now() - interval '1 hour' where id = $1",
      [link.token.id],
    );
    await expect(resolveShareToken(rawToken)).resolves.toBeNull();
  });

  it("rejects links created by a merchandiser who does not own the order", async () => {
    await expect(
      createShareLink(merch2, ORDER_B_88213, { scope: "summary", days: 3 }),
    ).rejects.toThrow(/permission/i);
  });
});

describe("supervisor production updates", () => {
  async function activeMilestoneFor(orderId: string, supervisorId: string) {
    const rows = await sql<{ id: string; target_quantity: number }>(
      `select om.id, om.target_quantity
         from order_milestones om
         join stage_assignments sa on sa.milestone_id = om.id
        where om.po_id = $1 and om.is_active = true and sa.supervisor_id = $2
        order by om.sequence desc limit 1`,
      [orderId, supervisorId],
    );
    return rows[0];
  }

  it("is idempotent for offline retries with the same client id", async () => {
    const milestone = await activeMilestoneFor(ORDER_B_88213, sup1.id);
    const clientUuid = randomUUID();
    const today = todayISO("Asia/Kolkata");
    const input = {
      poId: ORDER_B_88213,
      milestoneId: milestone.id,
      updateDate: today,
      quantity: 5,
      clientUuid,
      source: "offline" as const,
    };

    const first = await submitProductionUpdate(sup1, input);
    const second = await submitProductionUpdate(sup1, input);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.id).toBe(first.id);
    expect(second.cumulative).toBe(first.cumulative);

    const rows = await sql<{ count: number }>(
      "select count(*)::int as count from production_updates where client_uuid = $1",
      [clientUuid],
    );
    expect(rows[0].count).toBe(1);
  });

  it("rejects updates from an unassigned supervisor and future dates", async () => {
    const milestone = await activeMilestoneFor(ORDER_B_88213, sup1.id);
    await expect(
      submitProductionUpdate(sup2, {
        poId: ORDER_B_88213,
        milestoneId: milestone.id,
        updateDate: todayISO("Asia/Kolkata"),
        quantity: 1,
        clientUuid: randomUUID(),
        source: "online",
      }),
    ).rejects.toThrow(/not assigned/i);

    await expect(
      submitProductionUpdate(sup1, {
        poId: ORDER_B_88213,
        milestoneId: milestone.id,
        updateDate: addDaysISO(todayISO("Asia/Kolkata"), 1),
        quantity: 1,
        clientUuid: randomUUID(),
        source: "online",
      }),
    ).rejects.toThrow(/future/i);
  });

  it("rejects an update used against a different stage", async () => {
    const milestone = await activeMilestoneFor(ORDER_B_88213, sup1.id);
    const clientUuid = randomUUID();
    await submitProductionUpdate(sup1, {
      poId: ORDER_B_88213,
      milestoneId: milestone.id,
      updateDate: todayISO("Asia/Kolkata"),
      quantity: 1,
      clientUuid,
      source: "online",
    });
    await expect(
      submitProductionUpdate(sup1, {
        poId: ORDER_B_88213,
        milestoneId: randomUUID(),
        updateDate: todayISO("Asia/Kolkata"),
        quantity: 1,
        clientUuid,
        source: "online",
      }),
    ).rejects.toThrow(/stage/i);
  });
});

describe("administration authorization", () => {
  it("blocks non-admins from every administrative operation", async () => {
    await expect(
      createAdminUser(buyerB, {
        fullName: "Intruder",
        email: "intruder@company-a.test",
        role: "merchandiser",
        password: "Intruder@12345",
      }),
    ).rejects.toThrow(/Super Admin/i);
    await expect(listAuditEvents(merch1)).rejects.toThrow(/Super Admin/i);
  });

  it("hashes new passwords and records an audit entry", async () => {
    const id = await createAdminUser(admin, {
      fullName: "Quality Analyst",
      email: "qa.analyst@company-a.test",
      role: "merchandiser",
      password: "QaAnalyst@123",
    });
    const rows = await sql<{ password_hash: string | null; role: string }>(
      "select password_hash, role from profiles where id = $1",
      [id],
    );
    expect(rows[0].role).toBe("merchandiser");
    expect(rows[0].password_hash).not.toBe("QaAnalyst@123");
    expect(rows[0].password_hash?.startsWith("$2")).toBe(true);

    const audit = await sql<{ action: string }>(
      `select action from audit_logs
        where entity_type = 'profile' and entity_id = $1
        order by created_at desc limit 1`,
      [id],
    );
    expect(audit[0].action).toBe("user_created");
  });
});
