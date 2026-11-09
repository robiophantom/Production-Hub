import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, supabaseAuthEnabled } from "@/lib/env";

/**
 * Supabase Auth is used when a Supabase project is configured. Without
 * credentials the application uses the local credential store in `profiles`.
 */
export async function createSupabaseServerClient() {
  if (!supabaseAuthEnabled()) return null;

  const cookieStore = await cookies();

  return createServerClient(env().supabaseUrl!, env().supabasePublishableKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render; the proxy refreshes session
          // cookies instead, so this failure is safe.
        }
      },
    },
  });
}
