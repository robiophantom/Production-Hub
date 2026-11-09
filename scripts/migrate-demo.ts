/**
 * Copies the current local PGlite demo dataset into a hosted Postgres database.
 *
 * This is intentionally opt-in and insert-only. Existing rows are never updated
 * or deleted, so it cannot overwrite unrelated production data.
 *
 * Usage:
 *   DEMO_MIGRATION_CONFIRM=YES DATABASE_URL="postgresql://..." npm run db:migrate-demo
 *   DEMO_MIGRATION_CONFIRM=YES PGLITE_DATA_DIR=".data/pgdata" DATABASE_URL="..." npm run db:migrate-demo
 */

import path from "node:path";
import { createEmbedded, createPostgres } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";

const TABLES = [
  "buyers",
  "production_units",
  "subcontractors",
  "profiles",
  "production_stages",
  "tna_templates",
  "tna_template_milestones",
  "purchase_orders",
  "order_variants",
  "order_milestones",
  "stage_assignments",
  "production_updates",
  "production_issues",
  "production_photos",
  "delay_alerts",
  "buyer_notifications",
  "order_date_history",
  "audit_logs",
  "buyer_share_tokens",
  "app_settings",
] as const;

function fail(message: string): never {
  console.error(`\n[db:migrate-demo] ${message}\n`);
  process.exit(1);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL is required for the destination database.");
  if (process.env.DEMO_MIGRATION_CONFIRM !== "YES") {
    fail("Set DEMO_MIGRATION_CONFIRM=YES to confirm an insert-only demo migration.");
  }

  const sourceDir = path.resolve(
    process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pgdata"),
  );
  const source = await createEmbedded(sourceDir);
  const target = await createPostgres(connectionString);
  await runMigrations(target);
  const sourceProfiles = await source.one<{ count: number }>(
    "select count(*)::int as count from public.profiles",
  );
  const sourceOrders = await source.one<{ count: number }>(
    "select count(*)::int as count from public.purchase_orders",
  );
  if (!sourceProfiles?.count || !sourceOrders?.count) {
    fail(`The local database at ${sourceDir} does not contain the expected demo dataset.`);
  }

  const summary: string[] = [];
  await target.transaction(async (tx) => {
    for (const table of TABLES) {
      const columns = await source.query<{ column_name: string }>(
        `select column_name
           from information_schema.columns
          where table_schema = 'public' and table_name = $1
          order by ordinal_position`,
        [table],
      );
      if (columns.length === 0) continue;

      const names = columns.map((column) => column.column_name);
      const rows = await source.query<Record<string, unknown>>(
        `select ${names.map((name) => `"${name.replaceAll('"', '""')}"`).join(", ")}
           from public."${table}"`,
      );
      for (const row of rows) {
        await tx.query(
          `insert into public."${table}" (${names.map((name) => `"${name.replaceAll('"', '""')}"`).join(", ")})
           values (${names.map((_, index) => `$${index + 1}`).join(", ")})
           on conflict do nothing`,
          names.map((name) => row[name] ?? null),
        );
      }
      summary.push(`${table}=${rows.length}`);
    }
  });

  console.info(`[db:migrate-demo] copied local dataset from ${sourceDir}`);
  console.info(`[db:migrate-demo] ${summary.join(", ")}`);
  console.info("[db:migrate-demo] existing destination rows were preserved; no rows were updated or deleted.");
  process.exit(0);
}

main().catch((error) => {
  console.error("[db:migrate-demo] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
