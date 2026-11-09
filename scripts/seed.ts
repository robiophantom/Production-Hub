/**
 * Seeds the embedded demo database used for local development and evaluation.
 *
 * Demo accounts have fixed, documented passwords, so this script refuses to
 * touch a hosted database. Production/Supabase deployments start empty and use
 * `npm run admin:bootstrap` plus the administration screens instead.
 *
 * Usage:
 *   npm run db:seed            # create the demo data if the database is empty
 *   npm run db:seed -- --reset # delete .data/pgdata first, then reseed
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { DEMO_ACCOUNTS, BUYER_DEMO_ACCOUNT_C } from "@/lib/constants";

const reset = process.argv.includes("--reset");
const dataDir = path.resolve(
  process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pgdata"),
);

function refuse(message: string): never {
  console.error(`\n[seed] ${message}\n`);
  process.exit(1);
}

async function main() {
  if (process.env.DATABASE_URL) {
    refuse(
      "DATABASE_URL is set. Demo seeding is disabled for hosted or external Postgres " +
        "because it would create predictable accounts. Run `npm run admin:bootstrap` instead, " +
        "then create master data from the administration screens.",
    );
  }

  process.env.PGLITE_DATA_DIR = dataDir;
  process.env.SEED_DEMO_DATA = "true";

  if (reset) {
    await fs.rm(dataDir, { recursive: true, force: true });
    console.info(`[seed] removed ${path.relative(process.cwd(), dataDir)}`);
  }

  const { getDb } = await import("@/lib/db");
  const db = await getDb();

  if (db.mode !== "embedded") {
    refuse("Expected the embedded database. Unset DATABASE_URL and try again.");
  }

  const [profiles] = await db.query<{ count: number }>(
    "select count(*)::int as count from profiles",
  );
  const [orders] = await db.query<{ count: number }>(
    "select count(*)::int as count from purchase_orders",
  );

  console.info(`\n[seed] embedded database ready at ${path.relative(process.cwd(), dataDir)}`);
  console.info(`[seed] ${profiles?.count ?? 0} profiles, ${orders?.count ?? 0} purchase orders`);
  console.info("\nDemo accounts (development only):");
  for (const account of DEMO_ACCOUNTS) {
    console.info(`  ${account.role.padEnd(18)} ${account.email.padEnd(26)} ${account.password}`);
  }
  console.info(
    `  ${"buyer".padEnd(18)} ${BUYER_DEMO_ACCOUNT_C.email.padEnd(26)} ${BUYER_DEMO_ACCOUNT_C.password}`,
  );
  if (reset) {
    console.info("\nAll local demo data was recreated with today's business date.");
  }
  console.info("\nStart the app with `npm run dev` and sign in at http://localhost:3000/login\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("[seed] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
