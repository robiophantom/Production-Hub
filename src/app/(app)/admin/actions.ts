"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRoles } from "@/lib/auth/session";
import { ROLES } from "@/lib/constants";
import {
  createAdminUser,
  removeTemplateMilestone,
  resetAdminUserPassword,
  saveBuyer,
  saveStage,
  saveSubcontractor,
  saveTemplate,
  saveTemplateMilestone,
  saveUnit,
  updateAdminUser,
  updateAppSettings,
} from "@/lib/services/admin";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function failure(error: unknown): AdminActionResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Unable to complete this action.",
  };
}

function refreshAdminViews(includeSettings = false) {
  revalidatePath("/admin/users");
  revalidatePath("/admin/master-data");
  revalidatePath("/admin/activity");
  revalidatePath("/admin/settings");
  if (includeSettings) {
    revalidatePath("/dashboard");
    revalidatePath("/orders");
    revalidatePath("/board");
    revalidatePath("/alerts");
    revalidatePath("/reports");
    revalidatePath("/buyer");
    revalidatePath("/supervisor");
  }
}

const userSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  role: z.enum(ROLES),
  phone: z.string().trim().max(40).optional(),
  unitId: z.string().optional(),
  buyerId: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function createUserAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const parsed = userSchema.safeParse({
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    phone: formData.get("phone") || undefined,
    unitId: formData.get("unitId") || undefined,
    buyerId: formData.get("buyerId") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  const email = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .safeParse(formData.get("email"));
  const password = z.string().min(10, "Use a password of at least 10 characters").max(200).safeParse(
    formData.get("password"),
  );

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  if (!email.success) return { ok: false, error: "Enter a valid email address." };
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message };

  try {
    await createAdminUser(user, { ...parsed.data, email: email.data, password: password.data });
    refreshAdminViews();
    return { ok: true, message: "User account created" };
  } catch (error) {
    return failure(error);
  }
}

export async function updateUserAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { ok: false, error: "Select a user to update." };

  const parsed = userSchema.safeParse({
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    phone: formData.get("phone") || undefined,
    unitId: formData.get("unitId") || undefined,
    buyerId: formData.get("buyerId") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const email = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: "Enter a valid email address." };

  try {
    await updateAdminUser(user, userId, { ...parsed.data, email: email.data });
    refreshAdminViews(true);
    return { ok: true, message: "User updated" };
  } catch (error) {
    return failure(error);
  }
}

export async function resetPasswordAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (password !== confirm) return { ok: false, error: "The two passwords do not match." };

  try {
    await resetAdminUserPassword(user, userId, password);
    refreshAdminViews();
    return { ok: true, message: "Password reset. Share the new password securely." };
  } catch (error) {
    return failure(error);
  }
}

function activeFlag(formData: FormData): boolean {
  return formData.get("isActive") === "on";
}

export async function saveBuyerAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const parsed = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(120),
      code: z.string().trim().min(2).max(20),
      country: z.string().trim().max(80).optional(),
      contactPerson: z.string().trim().max(120).optional(),
      contactEmail: z
        .union([z.literal(""), z.string().trim().pipe(z.email("Enter a valid contact email"))])
        .optional(),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      code: formData.get("code"),
      country: formData.get("country") || undefined,
      contactPerson: formData.get("contactPerson") || undefined,
      contactEmail: formData.get("contactEmail") || "",
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    await saveBuyer(user, { ...parsed.data, isActive: activeFlag(formData) });
    refreshAdminViews(true);
    return { ok: true, message: parsed.data.id ? "Buyer updated" : "Buyer created" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveUnitAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const parsed = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(120),
      code: z.string().trim().min(2).max(20),
      location: z.string().trim().max(160).optional(),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      code: formData.get("code"),
      location: formData.get("location") || undefined,
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    await saveUnit(user, { ...parsed.data, isActive: activeFlag(formData) });
    refreshAdminViews(true);
    return { ok: true, message: parsed.data.id ? "Production unit updated" : "Production unit created" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveStageAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const parsed = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(120),
      code: z.string().trim().min(2).max(40),
      sequence: z.coerce.number().int().min(1).max(99),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      code: formData.get("code"),
      sequence: formData.get("sequence"),
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    await saveStage(user, { ...parsed.data, isActive: activeFlag(formData) });
    refreshAdminViews(true);
    return { ok: true, message: parsed.data.id ? "Production stage updated" : "Production stage created" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveSubcontractorAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const parsed = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(120),
      type: z.enum(["printing", "washing", "other"]),
      contactPerson: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      type: formData.get("type"),
      contactPerson: formData.get("contactPerson") || undefined,
      phone: formData.get("phone") || undefined,
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    await saveSubcontractor(user, { ...parsed.data, isActive: activeFlag(formData) });
    refreshAdminViews(true);
    return { ok: true, message: parsed.data.id ? "Subcontractor updated" : "Subcontractor created" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveTemplateAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const parsed = z
    .object({
      id: z.string().optional(),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().max(500).optional(),
    })
    .safeParse({
      id: formData.get("id") || undefined,
      name: formData.get("name"),
      description: formData.get("description") || undefined,
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    await saveTemplate(user, { ...parsed.data, isActive: activeFlag(formData) });
    refreshAdminViews(true);
    return { ok: true, message: parsed.data.id ? "TNA template updated" : "TNA template created" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveTemplateMilestoneAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const parsed = z
    .object({
      templateId: z.string().min(1),
      stageId: z.string().min(1, "Select a production stage"),
      offsetDays: z.coerce.number().int().min(-365).max(365),
    })
    .safeParse({
      templateId: formData.get("templateId"),
      stageId: formData.get("stageId"),
      offsetDays: formData.get("offsetDays"),
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    await saveTemplateMilestone(user, {
      ...parsed.data,
      isOptional: formData.get("isOptional") === "on",
    });
    refreshAdminViews(true);
    return { ok: true, message: "TNA template milestone saved" };
  } catch (error) {
    return failure(error);
  }
}

export async function removeTemplateMilestoneAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const templateId = String(formData.get("templateId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  try {
    await removeTemplateMilestone(user, templateId, milestoneId);
    refreshAdminViews(true);
    return { ok: true, message: "Template milestone removed" };
  } catch (error) {
    return failure(error);
  }
}

export async function saveSettingsAction(formData: FormData): Promise<AdminActionResult> {
  const user = await requireRoles("super_admin");
  const excludedWeekdays = formData
    .getAll("excludedWeekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

  const parsed = z
    .object({
      healthyBufferWorkingDays: z.coerce.number().int().min(0).max(30),
      insufficientDataDays: z.coerce.number().int().min(1).max(14),
      historyWindowDays: z.coerce.number().int().min(1).max(30),
      amberRateTolerancePercent: z.coerce.number().int().min(0).max(100),
      alertReviewDays: z.coerce.number().int().min(1).max(90),
      escalationDays: z.coerce.number().int().min(1).max(90),
      criticalDays: z.coerce.number().int().min(1).max(90),
      language: z.enum(["en", "ta"]),
    })
    .safeParse({
      healthyBufferWorkingDays: formData.get("healthyBufferWorkingDays"),
      insufficientDataDays: formData.get("insufficientDataDays"),
      historyWindowDays: formData.get("historyWindowDays"),
      amberRateTolerancePercent: formData.get("amberRateTolerancePercent"),
      alertReviewDays: formData.get("alertReviewDays"),
      escalationDays: formData.get("escalationDays"),
      criticalDays: formData.get("criticalDays"),
      language: formData.get("language") || "en",
    });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    await updateAppSettings(user, { ...parsed.data, excludedWeekdays });
    refreshAdminViews(true);
    return { ok: true, message: "Settings saved. Delay alerts will use the new rules on the next scan." };
  } catch (error) {
    return failure(error);
  }
}
