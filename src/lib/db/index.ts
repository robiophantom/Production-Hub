import { promises as fs } from "node:fs";
import path from "node:path";
import { assertDatabaseConfigured, env } from "@/lib/env";

export type QueryOptions = {
  parsers?: Record<number, (value: string) => unknown>;
};

export interface Queryable {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  transaction<T>(callback: (tx: Queryable) => Promise<T>): Promise<T>;
}

export interface Database extends Queryable {
  mode: "postgres" | "embedded";
  one<T>(sql: string, params?: unknown[]): Promise<T | null>;
}

// PostgreSQL `date` is a business date, not an instant. Return it as a plain
// YYYY-MM-DD string from both drivers so timezone handling stays predictable.
const DATE_PARSERS = {
  1082: (value: string) => value,
};

function normalizeSql(sql: string): string {
  return sql.trim();
}

export async function createEmbedded(dataDir = process.env.PGLITE_DATA_DIR): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { runMigrations } = await import("./migrate");

  const resolvedDataDir =
    dataDir ?? path.join(process.cwd(), ".data", "pgdata");
  await fs.mkdir(path.dirname(resolvedDataDir), { recursive: true });

  const client = await PGlite.create({ dataDir: resolvedDataDir });

  const run = async <T>(sql: string, params: unknown[] = [], tx?: typeof client) => {
    const target = tx ?? client;
    const result = await target.query<T>(normalizeSql(sql), params, {
      parsers: DATE_PARSERS,
    });
    return result.rows;
  };

  const db: Database = {
    mode: "embedded",
    async query<T>(sql: string, params: unknown[] = []) {
      return run<T>(sql, params);
    },
    async one<T>(sql: string, params: unknown[] = []) {
      const rows = await run<T>(sql, params);
      return rows[0] ?? null;
    },
    async exec(sql: string) {
      await client.exec(sql);
    },
    async transaction<T>(callback: (tx: Queryable) => Promise<T>) {
      return client.transaction(async (tx) => {
        const txDb: Queryable = {
          query: <R>(sql: string, params: unknown[] = []) =>
            run<R>(sql, params, tx as unknown as typeof client),
          exec: async (sql: string) => {
            await tx.exec(sql);
          },
          transaction: async <R>(nested: (inner: Queryable) => Promise<R>) => nested(txDb),
        };
        return callback(txDb);
      });
    },
  };

  await runMigrations(db);
  return db;
}

export async function createPostgres(connectionString: string): Promise<Database> {
  const { Pool, types } = await import("pg");
  types.setTypeParser(1082, (value: string) => value);

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });

  const db: Database = {
    mode: "postgres",
    async query<T>(sql: string, params: unknown[] = []) {
      const result = await pool.query(normalizeSql(sql), params);
      return result.rows as T[];
    },
    async one<T>(sql: string, params: unknown[] = []) {
      const rows = await db.query<T>(sql, params);
      return rows[0] ?? null;
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction<T>(callback: (tx: Queryable) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txDb: Queryable = {
          query: async <R>(sql: string, params: unknown[] = []) => {
            const result = await client.query(normalizeSql(sql), params);
            return result.rows as R[];
          },
          exec: async (sql: string) => {
            await client.query(sql);
          },
          transaction: async <R>(nested: (inner: Queryable) => Promise<R>) => nested(txDb),
        };
        const result = await callback(txDb);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };

  return db;
}

const globalForDb = globalThis as unknown as {
  __productionHubDb?: Promise<Database>;
};

export function getDb(): Promise<Database> {
  if (!globalForDb.__productionHubDb) {
    globalForDb.__productionHubDb = (async () => {
      assertDatabaseConfigured();
      const config = env();
      const db = config.databaseUrl
        ? await createPostgres(config.databaseUrl)
        : await createEmbedded();

      // Demo accounts only exist in the zero-credential embedded database. A
      // hosted Supabase project must never receive predictable logins.
      if (config.seedDemoData && db.mode === "embedded") {
        const { seedDemoData } = await import("./seed");
        await seedDemoData(db);
      }

      return db;
    })().catch((error) => {
      globalForDb.__productionHubDb = undefined;
      throw error;
    });
  }
  return globalForDb.__productionHubDb;
}

export async function sql<T>(query: string, params: unknown[] = []) {
  const db = await getDb();
  return db.query<T>(query, params);
}

export async function one<T>(query: string, params: unknown[] = []) {
  const db = await getDb();
  return db.one<T>(query, params);
}
