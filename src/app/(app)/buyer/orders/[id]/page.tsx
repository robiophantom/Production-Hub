import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Factory,
  Layers3,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { requireRoles } from "@/lib/auth/session";
import { getBuyerOrderDetail, type BuyerOrderDetail } from "@/lib/services/buyer";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/utils";

export const metadata: Metadata = { title: "Order progress" };

export default async function BuyerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRoles("buyer");
  const { id } = await params;

  let detail: BuyerOrderDetail;
  try {
    detail = await getBuyerOrderDetail(user, id);
  } catch {
    notFound();
  }

  const facts = [
    { label: "Style", value: detail.order.style_name },
    { label: "Buyer reference", value: detail.order.buyer_reference ?? "—" },
    { label: "Ordered", value: `${formatNumber(detail.order.total_quantity)} pcs` },
    { label: "Ex-factory", value: formatDate(detail.order.ex_factory_date) },
    { label: "Shipping", value: titleCase(detail.order.shipping_method) },
    { label: "Production unit", value: detail.unit_name ?? "—" },
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/buyer"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Back to my orders
      </Link>

      <PageHeader
        eyebrow={`${detail.buyer.code} · ${detail.buyer.name}`}
        title={detail.order.po_number}
        description={`${detail.order.style_name} · Ex-factory ${formatDate(detail.order.ex_factory_date)}`}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-xl border border-line bg-white p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{fact.label}</p>
            <p className="mt-1 truncate text-[13px] font-semibold text-ink">{fact.value}</p>
          </div>
        ))}
      </section>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Production stages</CardTitle>
            <CardDescription>
              Reported output against each stage target. Figures come from supervisor submissions and
              are shown only after merchandiser approval at stage level.
            </CardDescription>
          </div>
          <Factory className="size-5 text-slate-400" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="text-muted">Current stage</span>
              <span className="font-medium text-ink">{detail.currentStage}</span>
            </div>
            <Progress value={detail.currentProgress} height="h-2" />
            <p className="mt-1 text-right text-[11px] text-muted">
              {detail.currentProgress.toFixed(0)}% of the current stage target
            </p>
          </div>

          <ul className="divide-y divide-line">
            {detail.milestones.map((milestone) => (
              <li key={milestone.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                      {milestone.sequence}
                    </span>
                    <p className="text-[13px] font-medium text-ink">{milestone.stage_name}</p>
                    <Badge variant={milestone.status === "completed" ? "success" : "neutral"}>
                      {titleCase(milestone.status)}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted">
                    Planned {formatDate(milestone.planned_date)} · {formatNumber(milestone.cumulative)} /{" "}
                    {formatNumber(milestone.target_quantity)} pcs
                  </p>
                </div>
                <Progress className="mt-2" value={milestone.progress} height="h-1.5" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Published updates</CardTitle>
            <CardDescription>Approved daily progress submissions.</CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {detail.updates.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No updates published yet"
                description="Updates appear here after your merchandiser reviews them."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="divide-y divide-line">
                {detail.updates.map((update) => (
                  <li key={update.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium text-ink">{update.stage_name}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {formatDate(update.update_date)}
                          {update.notes ? ` · ${update.notes}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                        +{formatNumber(update.quantity)} pcs
                      </span>
                    </div>
                    {update.photos.length > 0 ? (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {update.photos.map((photo) => (
                          <div key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                            <Image
                              src={photo.url}
                              alt={photo.caption ?? "Approved production photograph"}
                              fill
                              unoptimized
                              sizes="160px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order timeline</CardTitle>
              <CardDescription>Key commercial dates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px]">
              <p className="flex items-center gap-2 text-muted">
                <CalendarDays className="size-4 text-slate-400" /> Order received{" "}
                <span className="ml-auto font-medium text-ink">
                  {formatDate(detail.order.order_received_date)}
                </span>
              </p>
              <p className="flex items-center gap-2 text-muted">
                <Factory className="size-4 text-slate-400" /> Ex-factory{" "}
                <span className="ml-auto font-medium text-ink">
                  {formatDate(detail.order.ex_factory_date)}
                </span>
              </p>
              <p className="flex items-center gap-2 text-muted">
                <Layers3 className="size-4 text-slate-400" /> Quantity{" "}
                <span className="ml-auto font-medium text-ink">
                  {formatNumber(detail.order.total_quantity)} pcs
                </span>
              </p>
              <p className="flex items-center gap-2 text-muted">
                <MapPin className="size-4 text-slate-400" /> Unit{" "}
                <span className="ml-auto font-medium text-ink">{detail.unit_name ?? "—"}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Notices</CardTitle>
                <CardDescription>Approved communications for this order.</CardDescription>
              </div>
              <BellRing className="size-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.notifications.length === 0 ? (
                <p className="py-2 text-[12px] text-muted">No notices issued for this order.</p>
              ) : (
                detail.notifications.map((notification) => (
                  <div key={notification.id} className="rounded-lg border border-line bg-slate-50/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-ink">{notification.subject}</p>
                      <Badge variant="success">
                        {notification.status === "sent" ? "Sent" : "Approved"}
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      {formatDateTime(
                        notification.sent_at ?? notification.approved_at ?? notification.created_at,
                      )}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
