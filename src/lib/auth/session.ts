import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import type { Role } from "@/lib/constants";
import type { SessionUser } from "@/types";
import {
  isSafeInternalPath,
  readSessionToken,
  roleHome,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
  type SessionClaims,
} from "./token";

export { isSafeInternalPath, roleHome, SESSION_COOKIE };

export async function establishSession(claims: SessionClaims): Promise<void> {
  const token = await signSessionToken(claims);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user from the cookie on every request and re-reads the
 * profile so role changes and deactivations take effect immediately.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await readSessionToken(token);
  if (!claims) return null;

  const db = await getDb();
  const user = await db.one<SessionUser>(
    `select id, email, full_name, role, unit_id, buyer_id, is_active
       from profiles
      where id = $1 and is_active = true`,
    [claims.sub],
  );

  return user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRoles(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(roleHome(user.role));
  return user;
}
