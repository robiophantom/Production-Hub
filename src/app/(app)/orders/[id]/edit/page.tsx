import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireRoles } from "@/lib/auth/session";
import { getOrderDetail, getOrderFormOptions } from "@/lib/services/orders";
import { EditOrderForm } from "./edit-form";

export const metadata: Metadata = { title: "Edit order" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRoles("super_admin", "merchandiser");
  const { id } = await params;

  let detail: Awaited<ReturnType<typeof getOrderDetail>>;
  try {
    detail = await getOrderDetail(user, id);
  } catch {
    notFound();
  }

  if (!detail.canEdit) redirect(`/orders/${id}`);
  const options = await getOrderFormOptions();

  return (
    <div className="space-y-5">
      <Link
        href={`/orders/${id}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Back to {detail.order.po_number}
      </Link>

      <PageHeader
        eyebrow="Order administration"
        title={`Edit ${detail.order.po_number}`}
        description="Update commercial details and the ex-factory deadline. TNA milestones are managed from the order's TNA plan tab."
      />

      <EditOrderForm
        order={{
          id: detail.order.id,
          poNumber: detail.order.po_number,
          buyerName: detail.buyer.name,
          buyerCode: detail.buyer.code,
          totalQuantity: detail.order.total_quantity,
          orderReceivedDate: detail.order.order_received_date,
          styleName: detail.order.style_name,
          styleNumber: detail.order.style_number,
          description: detail.order.description,
          buyerReference: detail.order.buyer_reference,
          exFactoryDate: detail.order.ex_factory_date,
          shippingMethod: detail.order.shipping_method,
          priority: detail.order.priority,
          status: detail.order.status,
          primaryUnitId: detail.order.primary_unit_id ?? "",
          merchandiserId: detail.order.merchandiser_id ?? "",
          notes: detail.order.notes,
        }}
        units={options.units}
        merchandisers={options.merchandisers}
        canChooseMerchandiser={user.role === "super_admin"}
      />
    </div>
  );
}
