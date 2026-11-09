"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRoles } from "@/lib/auth/session";
import { updateOrder } from "@/lib/services/orders";

const schema = z.object({
  styleName: z.string().trim().min(2, "Style name is required").max(160),
  styleNumber: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  buyerReference: z.string().trim().max(120).optional(),
  exFactoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ex-factory date is required"),
  shippingMethod: z.enum(["sea", "air", "courier", "road"]),
  priority: z.enum(["low", "normal", "high", "critical"]),
  status: z.enum(["active", "completed", "cancelled"]),
  primaryUnitId: z.string().optional(),
  merchandiserId: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  dateChangeReason: z.string().trim().max(500).optional(),
});

export interface UpdateOrderState {
  error?: string;
}

export async function updateOrderAction(
  _prev: UpdateOrderState,
  formData: FormData,
): Promise<UpdateOrderState> {
  const user = await requireRoles("super_admin", "merchandiser");
  const poId = String(formData.get("poId") ?? "");
  if (!poId) return { error: "Order not found." };

  const parsed = schema.safeParse({
    styleName: formData.get("styleName"),
    styleNumber: formData.get("styleNumber") || undefined,
    description: formData.get("description") || undefined,
    buyerReference: formData.get("buyerReference") || undefined,
    exFactoryDate: formData.get("exFactoryDate"),
    shippingMethod: formData.get("shippingMethod"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    primaryUnitId: formData.get("primaryUnitId") || undefined,
    merchandiserId: formData.get("merchandiserId") || undefined,
    notes: formData.get("notes") || undefined,
    dateChangeReason: formData.get("dateChangeReason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the order details." };
  }

  try {
    await updateOrder(user, poId, {
      styleName: parsed.data.styleName,
      styleNumber: parsed.data.styleNumber,
      description: parsed.data.description,
      buyerReference: parsed.data.buyerReference,
      exFactoryDate: parsed.data.exFactoryDate,
      shippingMethod: parsed.data.shippingMethod,
      priority: parsed.data.priority,
      status: parsed.data.status,
      primaryUnitId: parsed.data.primaryUnitId,
      merchandiserId: parsed.data.merchandiserId,
      notes: parsed.data.notes,
      dateChangeReason: parsed.data.dateChangeReason,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update the order." };
  }

  revalidatePath(`/orders/${poId}`);
  revalidatePath("/orders");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  revalidatePath("/buyer");
  redirect(`/orders/${poId}`);
}
