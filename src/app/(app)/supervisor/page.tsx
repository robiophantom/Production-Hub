import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requireRoles } from "@/lib/auth/session";
import { getSupervisorWorkspace } from "@/lib/services/production";
import { SupervisorWorkspace } from "./workspace";

export const metadata: Metadata = { title: "My production" };

export default async function SupervisorPage() {
  const user = await requireRoles("unit_supervisor");
  const { orders, businessDate } = await getSupervisorWorkspace(user);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Factory floor"
        title={`Vanakkam, ${user.full_name.split(" ")[0]}`}
        description="Record today's completed pieces for your assigned stages. Updates are saved on this device when the network drops and sent automatically when you are back online."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/supervisor/history">
              My submissions <ArrowRight />
            </Link>
          </Button>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="No stages assigned to you yet"
          description="Your merchandiser will assign stages to your unit. Once assigned, the daily update form appears here."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/supervisor/issues">
                <ClipboardCheck /> Issues I reported
              </Link>
            </Button>
          }
        />
      ) : (
        <SupervisorWorkspace orders={orders} businessDate={businessDate} />
      )}
    </div>
  );
}
