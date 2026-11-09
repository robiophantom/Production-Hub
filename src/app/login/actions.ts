"use server";

import { compare } from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { supabaseAuthEnabled } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import {
  establishSession,
  isSafeInternalPath,
  roleHome,
} from "@/lib/auth/session";
import type { Profile } from "@/types";

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

export interface LoginState {
  error?: string;
}

interface CredentialProfile extends Profile {
  password_hash: string | null;
}

async function findProfileByEmail(email: string): Promise<CredentialProfile | null> {
  const db = await getDb();
  return db.one<CredentialProfile>(
    `select id, email, full_name, role, phone, unit_id, buyer_id, avatar_url,
            is_active, created_at, updated_at, password_hash
       from profiles
      where lower(email) = $1`,
    [email],
  );
}

async function findProfileById(id: string): Promise<CredentialProfile | null> {
  const db = await getDb();
  return db.one<CredentialProfile>(
    `select id, email, full_name, role, phone, unit_id, buyer_id, avatar_url,
            is_active, created_at, updated_at, password_hash
       from profiles
      where id = $1`,
    [id],
  );
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address and your password." };
  }

  const { email, password, next } = parsed.data;
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateKey = `${email}|${ip}`;
  const rate = checkLoginRateLimit(rateKey);

  if (!rate.allowed) {
    return {
      error: `Too many sign-in attempts. Try again in ${Math.ceil(rate.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  let profile: CredentialProfile | null = null;
  let supabaseAccepted = false;

  if (supabaseAuthEnabled()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        supabaseAccepted = true;
        profile =
          (await findProfileById(data.user.id)) ?? (await findProfileByEmail(data.user.email ?? email));
      }
    }
  }

  if (!supabaseAccepted) {
    profile = await findProfileByEmail(email);
    if (!profile?.password_hash || !profile.is_active) {
      recordLoginFailure(rateKey);
      return { error: "Invalid email or password." };
    }
    const passwordMatches = await compare(password, profile.password_hash);
    if (!passwordMatches) {
      recordLoginFailure(rateKey);
      return { error: "Invalid email or password." };
    }
  }

  if (!profile || !profile.is_active) {
    recordLoginFailure(rateKey);
    return { error: "This account is not active. Contact your administrator." };
  }

  clearLoginFailures(rateKey);
  await establishSession({ sub: profile.id, email: profile.email, role: profile.role });

  redirect(isSafeInternalPath(next) ? next : roleHome(profile.role));
}
