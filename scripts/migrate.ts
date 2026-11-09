/**
 * Applies SQL migrations to the database named by DATABASE_URL.
 *
 * The embedded PGlite database migrates itself on first use, so this script is
 * for a hosted Postgres/Supabase project. It is idempotent: applied files are
 * recorded in public._migrations.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npm run db:migrate
 */

import { createPostgres } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "\n[db:migrate] DATABASE_URL is not set. Local development uses the embedded " +
        "database, which applies migrations automatically.\n",
    );
    process.exit(1);
  }

  const db = await createPostgres(connectionString);
  const applied = await runMigrations(db);

  console.info(
    applied.length > 0
      ? `[db:migrate] applied ${applied.length} migration(s): ${applied.join(", ")}`
      : "[db:migrate] database is already up to date",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("[db:migrate] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
