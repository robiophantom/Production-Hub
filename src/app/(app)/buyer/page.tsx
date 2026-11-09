import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Factory,
  Layers3,
  PackageSearch,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, InfoNote } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { requireRoles } from "@/lib/auth/session";
import { getBuyerPortal } from "@/lib/services/buyer";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "My orders" };

export default async function BuyerPortalPage() {
  const user = await requireRoles("buyer");
  const portal = await getBuyerPortal(user);
  const { metrics } = portal;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Buyer portal"
        title="My orders"
        description="Read-only production progress for your purchase orders. Only updates, photographs and delay notices approved by your merchandiser appear here."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/buyer/updates">
              <BellRing /> Updates & notices
            </Link>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active orders"
          value={formatNumber(metrics.activeOrders)}
          icon={ClipboardList}
          hint="Orders in production"
        />
        <StatCard
          label="Ordered pieces"
          value={formatNumber(metrics.orderedPieces)}
          icon={Layers3}
          tone="slate"
          hint="Across active orders"
        />
        <StatCard
          label="Produced at current stage"
          value={formatNumber(metrics.producedPieces)}
          icon={Factory}
          tone="green"
          hint="Reported by the production team"
        />
        <StatCard
          label="Published updates"
          value={formatNumber(metrics.publishedUpdates)}
          icon={CheckCircle2}
          tone="brand"
          hint="Approved for your visibility"
        />
      </section>

      {portal.orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No purchase orders yet"
          description="Orders will appear here once your merchandiser publishes them to your account."
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {portal.orders.map((summary) => (
            <Card key={summary.order.id}>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
                    {summary.order.po_number}
                  </p>
                  <CardTitle className="mt-1 truncate">{summary.order.style_name}</CardTitle>
                  <CardDescription>
                    Ref {summary.order.buyer_reference ?? "—"} · {formatNumber(summary.order.total_quantity)} pcs
                  </CardDescription>
                </div>
                <Badge variant={summary.order.status === "active" ? "success" : "neutral"}>
                  {summary.order.status === "active" ? "In production" : "Completed"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <CalendarDays className="size-3.5" /> Ex-factory
                  </span>
                  <span className="font-medium text-ink">{formatDate(summary.order.ex_factory_date)}</span>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-muted">Current stage</span>
                    <span className="font-medium text-ink">{summary.currentStage}</span>
                  </div>
                  <Progress value={summary.currentStageProgress} height="h-1.5" />
                  <p className="mt-1 text-right text-[11px] text-muted">
                    {summary.currentStageProgress.toFixed(0)}% of this stage
                  </p>
                </div>

                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={`/buyer/orders/${summary.order.id}`}>
                    View order progress <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Latest production updates</CardTitle>
              <CardDescription>Published by your merchandiser.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/buyer/updates">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-1">
            {portal.updates.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">
                No updates have been published yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {portal.updates.slice(0, 4).map((update) => (
                  <li key={update.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">
                        {update.po_number}
                        <span className="ml-2 font-normal text-muted">{update.stage_name}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {formatDate(update.update_date)} · {update.style_name}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                      +{formatNumber(update.quantity)} pcs
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buyer notices</CardTitle>
            <CardDescription>
              Delay notices are only published after internal review. Nothing appears here
              automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {portal.notifications.length === 0 ? (
              <p className="flex items-center gap-2 py-6 text-[13px] text-muted">
                <BellRing className="size-4" /> No notices have been issued.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {portal.notifications.slice(0, 4).map((notification) => (
                  <li key={notification.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13px] font-semibold text-ink">{notification.subject}</p>
                      <Badge variant="success">
                        {notification.status === "sent" ? "Sent" : "Approved"}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-[12px] leading-relaxed text-slate-600">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {notification.po_number} ·{" "}
                      {formatDateTime(notification.sent_at ?? notification.approved_at ?? notification.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <InfoNote variant="info" title="What you can see">
        Your account is scoped to your own purchase orders. Photographs are published only after
        internal approval, and internal factory issues and delay calculations are never exposed.
      </InfoNote>
    </div>
  );
}
