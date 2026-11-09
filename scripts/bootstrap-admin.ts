/**
 * Creates (or promotes) the first Super Admin on a hosted database.
 *
 * Demo seeding is deliberately unavailable outside the embedded database, so a
 * fresh Supabase/Postgres deployment uses this script once and then creates all
 * other users from Administration → Users & roles.
 *
 * With Supabase Auth configured, the account is created through the Admin API
 * and the profile row is linked to the Supabase user id. Without Supabase Auth,
 * the script writes a bcrypt password hash and the app's local JWT sign-in is
 * used instead.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." \
 *   SUPABASE_SECRET_KEY="..." \
 *   npm run admin:bootstrap -- \
 *     --email=admin@company-a.example \
 *     --password="A-long-unique-password" \
 *     --name="Operations Admin"
 *
 * The password may also be supplied via ADMIN_PASSWORD. It is never logged.
 */

import { randomUUID } from "node:crypto";
import { hashSync } from "bcryptjs";
import { createPostgres } from "@/lib/db";
import { runMigrations } from "@/lib/db/migrate";

function option(name: string): string | undefined {
  const inline = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(`\n[admin:bootstrap] ${message}\n`);
  process.exit(1);
}

function validatePassword(password: string, email: string) {
  if (password.length < 12) {
    fail("Choose a password of at least 12 characters. It is never written to logs.");
  }
  if (password.length > 200) fail("Password must be 200 characters or fewer.");
  if (password.toLowerCase() === email.toLowerCase()) fail("Password must not equal the email.");
  if (["password1234", "administrator1", "changeme1234"].includes(password.toLowerCase())) {
    fail("That password is too common. Choose something unique.");
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL is required. Point it at your Supabase pooler.");

  const email = (option("email") ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = option("password") ?? process.env.ADMIN_PASSWORD ?? "";
  const fullName = (option("name") ?? process.env.ADMIN_NAME ?? "Super Admin").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Provide a valid --email address.");
  validatePassword(password, email);
  if (!fullName) fail("Provide a non-empty --name.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && !secretKey) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL is set without a server-side secret. Set SUPABASE_SECRET_KEY " +
        "(service role) so the Supabase Auth user can be created, or remove the Supabase URL " +
        "to use local password authentication.",
    );
  }

  const db = await createPostgres(connectionString);
  await runMigrations(db);

  let authUserId: string;
  let provider: string;

  if (supabaseUrl && secretKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (created.data.user) {
      authUserId = created.data.user.id;
    } else if (/already|registered|exists/i.test(created.error?.message ?? "")) {
      let found: { id: string } | null = null;
      for (let page = 1; page <= 10 && !found; page += 1) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) fail(`Could not list Supabase users: ${error.message}`);
        found = data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
        if (data.users.length < 200) break;
      }
      if (!found) fail("Supabase reports the email as registered but it could not be found.");
      authUserId = found.id;
      console.info("[admin:bootstrap] Supabase Auth user already exists; promoting account.");
    } else {
      fail(`Supabase Auth user creation failed: ${created.error?.message ?? "unknown error"}`);
    }

    provider = "Supabase Auth";
  } else {
    authUserId = randomUUID();
    provider = "local password (bcrypt)";
  }

  const existing = await db.one<{ id: string }>(
    "select id from profiles where lower(email) = lower($1)",
    [email],
  );

  const profileId = existing?.id ?? authUserId;
  const passwordHash = supabaseUrl ? null : hashSync(password, 12);

  if (existing) {
    await db.query(
      `update profiles
          set full_name = $2,
              role = 'super_admin',
              is_active = true,
              password_hash = coalesce($3, password_hash),
              updated_at = now()
        where id = $1`,
      [profileId, fullName, passwordHash],
    );
  } else {
    await db.query(
      `insert into profiles (id, email, full_name, role, is_active, password_hash)
       values ($1, $2, $3, 'super_admin', true, $4)`,
      [profileId, email, fullName, passwordHash],
    );
  }

  await db.query(
    `insert into audit_logs (actor_id, action, entity_type, entity_id, detail)
     values ($1, 'user_created', 'profile', $1, $2)`,
    [
      profileId,
      JSON.stringify({
        email,
        role: "super_admin",
        provider,
        source: "admin:bootstrap",
      }),
    ],
  );

  console.info(`
[admin:bootstrap] Super Admin ready
  email:     ${email}
  name:      ${fullName}
  auth:      ${provider}
  profile:   ${profileId}
${existing ? "  action:    existing profile promoted to Super Admin" : "  action:    new profile created"}

Sign in at ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login
Create buyers, units, stages and users from Administration.
`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[admin:bootstrap] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
