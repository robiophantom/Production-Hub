"use server";

import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/auth/session";
import { createShareLink, revokeShareLink, type ShareScope } from "@/lib/services/share";

export interface ShareActionState {
  ok: boolean;
  error?: string;
  message?: string;
  url?: string;
  tokenId?: string;
}

function failure(error: unknown): ShareActionState {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Unable to complete this action.",
  };
}

export async function createShareLinkAction(
  _previous: ShareActionState,
  formData: FormData,
): Promise<ShareActionState> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");
  const scope = String(formData.get("scope") ?? "summary") as ShareScope;
  const days = Number(formData.get("days") ?? 14);
  const label = String(formData.get("label") ?? "");

  try {
    const result = await createShareLink(user, poId, { scope, days, label });
    revalidatePath(`/orders/${poId}/share`);
    revalidatePath(`/orders/${poId}`);
    return {
      ok: true,
      message: "Share link created. Copy it now — the raw token is shown only once.",
      url: result.url,
      tokenId: result.token.id,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeShareLinkAction(formData: FormData): Promise<ShareActionState> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");
  const tokenId = String(formData.get("tokenId") ?? "");

  try {
    await revokeShareLink(user, tokenId);
    revalidatePath(`/orders/${poId}/share`);
    revalidatePath(`/orders/${poId}`);
    return { ok: true, message: "Share link revoked. The URL no longer resolves." };
  } catch (error) {
    return failure(error);
  }
}
