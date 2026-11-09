import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoNote } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requireRoles } from "@/lib/auth/session";
import { getOrderFormOptions } from "@/lib/services/orders";
import { getAppConfig } from "@/lib/services/settings";
import { OrderForm } from "./order-form";

export const metadata: Metadata = { title: "New purchase order" };

export default async function NewOrderPage() {
  const user = await requireRoles("super_admin", "merchandiser");
  const [options, config] = await Promise.all([getOrderFormOptions(), getAppConfig()]);

  const ready =
    options.buyers.length > 0 &&
    options.templates.length > 0 &&
    options.templates.some((template) => template.milestones.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Order management"
        title="Create purchase order"
        description="Enter the buyer order, build the colour/size breakdown and configure the TNA plan. The variant total must match the PO quantity."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/orders">
              <ArrowLeft /> Back to orders
            </Link>
          </Button>
        }
      />

      {ready ? (
        <OrderForm
          role={user.role}
          businessDate={config.businessDate}
          buyers={options.buyers}
          units={options.units}
          merchandisers={options.merchandisers}
          supervisors={options.supervisors}
          subcontractors={options.subcontractors}
          templates={options.templates}
        />
      ) : (
        <Card className="p-6">
          <InfoNote variant="warning" title="Master data is incomplete">
            A purchase order needs at least one active buyer and a TNA template with milestones. Ask a
            super admin to complete{" "}
            <Link href="/admin/master-data" className="font-semibold underline">
              master data
            </Link>{" "}
            first.
          </InfoNote>
        </Card>
      )}
    </div>
  );
}
