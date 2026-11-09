"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRoles } from "@/lib/auth/session";
import { createOrder } from "@/lib/services/orders";

const variantSchema = z.object({
  colour: z.string().trim().min(1, "Colour is required").max(60),
  size: z.string().trim().min(1, "Size is required").max(30),
  quantity: z.coerce.number().int().min(0).max(10_000_000),
});

const schema = z.object({
  poNumber: z.string().trim().min(2, "PO number is required").max(60),
  buyerId: z.string().min(1, "Buyer is required"),
  buyerReference: z.string().trim().max(120).optional(),
  orderReceivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Order received date is required"),
  styleName: z.string().trim().min(2, "Style name is required").max(160),
  styleNumber: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  totalQuantity: z.coerce.number().int().positive("Order quantity must be greater than zero"),
  exFactoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ex-factory date is required"),
  shippingMethod: z.string().trim().min(1).max(30),
  priority: z.string().trim().min(1).max(30),
  merchandiserId: z.string().optional(),
  primaryUnitId: z.string().optional(),
  supervisorId: z.string().optional(),
  subcontractorId: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  templateId: z.string().min(1, "Select a TNA template"),
});

export interface CreateOrderState {
  error?: string;
}

function parseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function createOrderAction(
  _prev: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  const user = await requireRoles("super_admin", "merchandiser");

  const parsed = schema.safeParse({
    poNumber: formData.get("poNumber"),
    buyerId: formData.get("buyerId"),
    buyerReference: formData.get("buyerReference") || undefined,
    orderReceivedDate: formData.get("orderReceivedDate"),
    styleName: formData.get("styleName"),
    styleNumber: formData.get("styleNumber") || undefined,
    description: formData.get("description") || undefined,
    totalQuantity: formData.get("totalQuantity"),
    exFactoryDate: formData.get("exFactoryDate"),
    shippingMethod: formData.get("shippingMethod") || "sea",
    priority: formData.get("priority") || "normal",
    merchandiserId: formData.get("merchandiserId") || undefined,
    primaryUnitId: formData.get("primaryUnitId") || undefined,
    supervisorId: formData.get("supervisorId") || undefined,
    subcontractorId: formData.get("subcontractorId") || undefined,
    notes: formData.get("notes") || undefined,
    templateId: formData.get("templateId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the order details." };
  }

  const variants = z.array(variantSchema).max(500).safeParse(parseJson(formData.get("variants")));
  if (!variants.success) {
    return { error: "Add at least one valid colour and size quantity." };
  }

  const optionalStageIds = z
    .array(z.string())
    .safeParse(parseJson(formData.get("optionalStageIds")) ?? []);
  const milestoneDates = z
    .record(z.string(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .safeParse(parseJson(formData.get("milestoneDates")) ?? {});

  if (!milestoneDates.success) {
    return { error: "One or more TNA milestone dates are invalid." };
  }

  let id: string;
  try {
    id = await createOrder(user, {
      ...parsed.data,
      variants: variants.data,
      optionalStageIds: optionalStageIds.success ? optionalStageIds.data : [],
      milestoneDates: milestoneDates.data,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to create the purchase order.",
    };
  }

  revalidatePath("/orders");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
  redirect(`/orders/${id}`);
}
