import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/lib/constants";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "ca_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().authSecret);
}

export interface SessionClaims {
  sub: string;
  email: string;
  role: Role;
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string"
    ) {
      return null;
    }
    return { sub: payload.sub, email: payload.email, role: payload.role as Role };
  } catch {
    return null;
  }
}

export function roleHome(role: Role): string {
  if (role === "unit_supervisor") return "/supervisor";
  if (role === "buyer") return "/buyer";
  return "/dashboard";
}

export function isSafeInternalPath(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}
