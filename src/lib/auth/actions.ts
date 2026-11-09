"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  await destroySession();
  redirect("/login");
}
