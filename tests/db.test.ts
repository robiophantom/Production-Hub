import { rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dataDir = path.join(process.cwd(), ".data", "vitest-pgdata");
process.env.PGLITE_DATA_DIR = dataDir;
process.env.SEED_DEMO_DATA = "true";

const { getDb } = await import("@/lib/db");

describe("embedded database", () => {
  it("applies migrations and seeds the demo dataset", async () => {
    await rm(dataDir, { recursive: true, force: true });
    // Force a fresh embedded database for this run.
    const globalForDb = globalThis as unknown as { __productionHubDb?: unknown };
    globalForDb.__productionHubDb = undefined;

    const db = await getDb();
    expect(db.mode).toBe("embedded");

    const profiles = await db.query<{ count: number }>(
      "select count(*)::int as count from profiles",
    );
    expect(profiles[0].count).toBe(9);

    const orders = await db.query<{ count: number }>(
      "select count(*)::int as count from purchase_orders",
    );
    expect(orders[0].count).toBe(8);

    const po1 = await db.one<{ id: string; total_quantity: number }>(
      "select id, total_quantity from purchase_orders where po_number = 'B-PO-88213'",
    );
    expect(po1?.total_quantity).toBe(12000);

    const variantSum = await db.one<{ total: number }>(
      "select coalesce(sum(quantity),0)::int as total from order_variants where po_id = $1",
      [po1!.id],
    );
    expect(variantSum?.total).toBe(12000);

    const migrations = await db.query<{ filename: string }>(
      "select filename from _migrations order by filename",
    );
    expect(migrations.map((row) => row.filename)).toEqual([
      "0001_initial_schema.sql",
      "0002_rls_policies.sql",
      "0003_share_token_scope.sql",
      "0003_voice_translation.sql",
    ]);

    const stitching = await db.one<{ total: number }>(
      `select coalesce(sum(u.quantity),0)::int as total
         from production_updates u
         join order_milestones m on m.id = u.milestone_id
         join production_stages s on s.id = m.stage_id
        where u.po_id = $1 and s.code = 'stitching'`,
      [po1!.id],
    );
    expect(stitching?.total).toBe(6800);

    const issues = await db.query<{ category: string; description_tamil: string | null }>(
      "select category, description_tamil from production_issues order by created_at",
    );
    expect(issues.some((issue) => issue.category === "Machine Breakdown")).toBe(true);
    expect(issues.some((issue) => issue.description_tamil?.includes("தையல்"))).toBe(true);

    const updatesWithPhotos = await db.query<{ count: number }>(
      "select count(*)::int as count from production_photos",
    );
    expect(updatesWithPhotos[0].count).toBe(4);
  });
});
