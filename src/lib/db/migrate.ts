import { promises as fs } from "node:fs";
import path from "node:path";
import type { Database } from "./index";

const MIGRATION_TABLE = `
  create table if not exists public._migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )
`;

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const LOCAL_BOOTSTRAP = path.join(
  process.cwd(),
  "supabase",
  "local",
  "0000_local_bootstrap.sql",
);

async function readSqlFile(fullPath: string): Promise<string | null> {
  try {
    return await fs.readFile(fullPath, "utf8");
  } catch {
    return null;
  }
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

/**
 * Applies schema migrations idempotently and records them in _migrations.
 * The embedded development database runs this automatically on first use.
 * For a hosted Supabase database run `npm run db:migrate` (or supabase db push).
 */
export async function runMigrations(
  db: Database,
  options: { includeLocalBootstrap?: boolean } = {},
): Promise<string[]> {
  if (options.includeLocalBootstrap ?? db.mode === "embedded") {
    const bootstrap = await readSqlFile(LOCAL_BOOTSTRAP);
    if (bootstrap) await db.exec(bootstrap);
  }

  await db.exec(MIGRATION_TABLE);

  const applied = new Set(
    (await db.query<{ filename: string }>("select filename from public._migrations")).map(
      (row) => row.filename,
    ),
  );

  const newlyApplied: string[] = [];

  for (const filename of await listMigrationFiles()) {
    if (applied.has(filename)) continue;
    const sqlContent = await readSqlFile(path.join(MIGRATIONS_DIR, filename));
    if (!sqlContent) continue;

    await db.transaction(async (tx) => {
      await tx.exec(sqlContent);
      await tx.query("insert into public._migrations (filename) values ($1)", [filename]);
    });

    newlyApplied.push(filename);
  }

  if (newlyApplied.length > 0) {
    console.info(`[db] applied migrations: ${newlyApplied.join(", ")}`);
  }

  return newlyApplied;
}
