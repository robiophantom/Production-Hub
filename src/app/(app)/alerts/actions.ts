"use server";

import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/auth/session";
import { confirmAlert, dismissAlert, scanDelayAlerts } from "@/lib/services/alerts";

export interface AlertActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function failure(error: unknown): AlertActionResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Unable to complete this action.",
  };
}

function refreshAlertViews(poId?: string) {
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  revalidatePath("/board");
  revalidatePath("/orders");
  if (poId) revalidatePath(`/orders/${poId}`);
  revalidatePath("/buyer");
  revalidatePath("/reports");
}

export async function scanAlertsAction(): Promise<AlertActionResult> {
  const user = await requireRoles("super_admin", "managing_director", "merchandiser");
  try {
    const result = await scanDelayAlerts(user);
    refreshAlertViews();
    return {
      ok: true,
      message: `Delay scan complete — ${result.created} new, ${result.updated} updated, ${result.resolved} resolved, ${result.dismissedSkips} dismissed window(s) respected.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function confirmAlertAction(formData: FormData): Promise<AlertActionResult> {
  const user = await requireRoles("super_admin", "merchandiser");
  const alertId = String(formData.get("alertId") ?? "");

  try {
    const result = await confirmAlert(user, alertId);
    refreshAlertViews();
    return { ok: true, message: result.message };
  } catch (error) {
    return failure(error);
  }
}

export async function dismissAlertAction(formData: FormData): Promise<AlertActionResult> {
  const user = await requireRoles("super_admin", "merchandiser");
  const alertId = String(formData.get("alertId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  try {
    const result = await dismissAlert(user, alertId, reason);
    refreshAlertViews();
    return { ok: true, message: result.message };
  } catch (error) {
    return failure(error);
  }
}
