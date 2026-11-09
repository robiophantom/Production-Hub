"use server";

import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/auth/session";
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES } from "@/lib/constants";
import {
  addMilestone,
  moveMilestone,
  updateMilestone,
} from "@/lib/services/orders";
import {
  setPhotoBuyerVisibility,
  setUpdateBuyerVisibility,
  updateIssue,
} from "@/lib/services/production";

export interface OrderActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function failure(error: unknown): OrderActionResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Unable to complete this action.",
  };
}

function refreshOrder(poId: string) {
  revalidatePath(`/orders/${poId}`);
  revalidatePath("/orders");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  revalidatePath("/buyer");
}

export async function updateMilestoneAction(formData: FormData): Promise<OrderActionResult> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");

  try {
    await updateMilestone(user, milestoneId, {
      plannedDate: String(formData.get("plannedDate") ?? ""),
      targetQuantity: Number(formData.get("targetQuantity") ?? 0),
      supervisorId: String(formData.get("supervisorId") ?? "") || undefined,
      unitId: String(formData.get("unitId") ?? "") || undefined,
      subcontractorId: String(formData.get("subcontractorId") ?? "") || undefined,
      isActive: formData.get("isActive") === "on",
      notes: String(formData.get("notes") ?? "") || undefined,
      dateChangeReason: String(formData.get("dateChangeReason") ?? "") || undefined,
    });
    refreshOrder(poId);
    return { ok: true, message: "Milestone updated" };
  } catch (error) {
    return failure(error);
  }
}

export async function addMilestoneAction(formData: FormData): Promise<OrderActionResult> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");

  try {
    await addMilestone(user, poId, {
      stageId: String(formData.get("stageId") ?? ""),
      plannedDate: String(formData.get("plannedDate") ?? ""),
      targetQuantity: Number(formData.get("targetQuantity") ?? 0),
      supervisorId: String(formData.get("supervisorId") ?? "") || undefined,
      unitId: String(formData.get("unitId") ?? "") || undefined,
      subcontractorId: String(formData.get("subcontractorId") ?? "") || undefined,
    });
    refreshOrder(poId);
    return { ok: true, message: "Milestone added to the TNA" };
  } catch (error) {
    return failure(error);
  }
}

export async function moveMilestoneAction(formData: FormData): Promise<OrderActionResult> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const direction = String(formData.get("direction") ?? "") === "up" ? "up" : "down";

  try {
    await moveMilestone(user, milestoneId, direction);
    refreshOrder(poId);
    return { ok: true, message: "TNA order updated" };
  } catch (error) {
    return failure(error);
  }
}

export async function setPhotoVisibilityAction(formData: FormData): Promise<OrderActionResult> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  const approved = String(formData.get("approved") ?? "") === "true";

  try {
    await setPhotoBuyerVisibility(user, photoId, approved);
    refreshOrder(poId);
    return {
      ok: true,
      message: approved ? "Photograph approved for the buyer" : "Photograph hidden from the buyer",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function setUpdateVisibilityAction(formData: FormData): Promise<OrderActionResult> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");
  const updateId = String(formData.get("updateId") ?? "");
  const visible = String(formData.get("visible") ?? "") === "true";

  try {
    await setUpdateBuyerVisibility(user, updateId, visible);
    refreshOrder(poId);
    return {
      ok: true,
      message: visible ? "Update approved for the buyer" : "Update hidden from the buyer",
    };
  } catch (error) {
    return failure(error);
  }
}

export async function updateIssueAction(formData: FormData): Promise<OrderActionResult> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");
  const issueId = String(formData.get("issueId") ?? "");
  const category = String(formData.get("category") ?? "");
  const severity = String(formData.get("severity") ?? "");
  const status = String(formData.get("status") ?? "");

  try {
    await updateIssue(user, issueId, {
      category: ISSUE_CATEGORIES.includes(category as (typeof ISSUE_CATEGORIES)[number])
        ? (category as (typeof ISSUE_CATEGORIES)[number])
        : undefined,
      severity: ISSUE_SEVERITIES.includes(severity as (typeof ISSUE_SEVERITIES)[number])
        ? (severity as (typeof ISSUE_SEVERITIES)[number])
        : undefined,
      status: status || undefined,
    });
    refreshOrder(poId);
    return { ok: true, message: "Issue updated" };
  } catch (error) {
    return failure(error);
  }
}
