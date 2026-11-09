import Link from "next/link";
import { BellRing, CalendarDays, ClipboardCheck, Factory, UserRound } from "lucide-react";
import { HealthBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressWithLabel } from "@/components/ui/progress";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/utils";
import type { OrderDetail } from "@/lib/services/orders";

export function OverviewTab({ detail }: { detail: OrderDetail }) {
  const { order, buyer, unit, merchandiser, health } = detail;

  const facts = [
    { label: "Buyer", value: buyer.name, hint: `${buyer.code} · ${buyer.country}` },
    { label: "Buyer reference", value: order.buyer_reference ?? "—" },
    { label: "Style", value: order.style_name, hint: order.style_number ?? undefined },
    { label: "Order received", value: formatDate(order.order_received_date) },
    { label: "Ex-factory", value: formatDate(order.ex_factory_date) },
    { label: "Shipping", value: titleCase(order.shipping_method) },
    { label: "Priority", value: titleCase(order.priority) },
    { label: "Primary unit", value: unit?.name ?? "Unassigned" },
    { label: "Merchandiser", value: merchandiser?.full_name ?? "—" },
    { label: "Order status", value: titleCase(order.status) },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Order facts</CardTitle>
            <CardDescription>
              {order.description ?? "No product description recorded for this PO."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-400">{fact.label}</dt>
                  <dd className="mt-0.5 truncate text-[13px] font-medium text-ink">{fact.value}</dd>
                  {fact.hint ? (
                    <dd className="truncate text-[11px] text-muted">{fact.hint}</dd>
                  ) : null}
                </div>
              ))}
            </dl>
            {order.notes ? (
              <div className="mt-5 rounded-lg border border-line bg-slate-50/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Internal notes
                </p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-slate-600">
                  {order.notes}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest production updates</CardTitle>
            <CardDescription>Most recent floor submissions for this order.</CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {detail.updates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No production updates recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {detail.updates.slice(0, 5).map((update) => {
                  const stage = detail.milestones.find(
                    (item) => item.milestone.id === update.milestone_id,
                  );
                  return (
                    <li key={update.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">
                          {stage?.stage.name ?? "Production"}
                          <span className="ml-2 font-normal text-muted">
                            {formatDate(update.update_date)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {update.submitted_by_name}
                          {update.source === "offline" ? " · synced offline" : ""}
                          {update.approved_for_buyer ? " · buyer-visible" : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
                        +{formatNumber(update.quantity)} pcs
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {detail.updates.length > 0 ? (
              <Link
                href={`/orders/${order.id}?tab=updates`}
                className="mt-2 inline-block text-[12px] font-medium text-brand hover:underline"
              >
                View all {detail.updates.length} updates
              </Link>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buyer communications</CardTitle>
            <CardDescription>
              Only approved notifications are visible in the buyer portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {detail.notifications.length === 0 ? (
              <p className="flex items-center gap-2 py-4 text-[13px] text-muted">
                <BellRing className="size-4" /> No buyer notifications have been issued.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {detail.notifications.map((notification) => (
                  <li key={notification.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[13px] font-semibold text-ink">{notification.subject}</p>
                      <StatusBadge status={notification.status} />
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {notification.status === "approved" || notification.status === "sent"
                        ? `Approved ${formatDateTime(notification.approved_at)}`
                        : "Draft — not visible to the buyer"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Production status</CardTitle>
            <CardDescription>Current stage and calculated order health.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted">Health</span>
              <HealthBadge health={health.health} />
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
              {health.basis}
            </p>

            <div>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="text-muted">Current stage</span>
                <span className="font-medium text-ink">{detail.currentStage}</span>
              </div>
              <ProgressWithLabel value={detail.currentStageProgress} />
            </div>

            <dl className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <dt className="text-muted">Ordered</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {formatNumber(order.total_quantity)} pcs
                </dd>
              </div>
              <div>
                <dt className="text-muted">Produced</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {formatNumber(detail.producedQuantity)} pcs
                </dd>
              </div>
              <div>
                <dt className="text-muted">Critical stage</dt>
                <dd className="mt-0.5 font-medium text-ink">{health.criticalStage}</dd>
              </div>
              <div>
                <dt className="text-muted">Working days left</dt>
                <dd className="mt-0.5 font-medium text-ink">{health.daysRemaining}</dd>
              </div>
            </dl>

            <div className="space-y-2 border-t border-line pt-3 text-[11px] text-muted">
              <p className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> Critical planned date:{" "}
                <span className="font-medium text-ink">{formatDate(health.plannedDate)}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <ClipboardCheck className="size-3.5" /> Projected completion:{" "}
                <span className="font-medium text-ink">{formatDate(health.projectedDate)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[12px]">
            <p className="flex items-center gap-2 text-muted">
              <Factory className="size-4 text-slate-400" />
              {unit ? `${unit.name} · ${unit.location ?? ""}` : "No primary unit"}
            </p>
            <p className="flex items-center gap-2 text-muted">
              <UserRound className="size-4 text-slate-400" />
              {merchandiser?.full_name ?? "No merchandiser"} · {merchandiser?.email ?? ""}
            </p>
            <p className="flex items-center gap-2 text-muted">
              <ClipboardCheck className="size-4 text-slate-400" />
              {detail.milestones.filter((item) => item.milestone.is_active).length} active TNA
              milestone(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-[12px]">
            <Link href={`/orders/${order.id}?tab=tna`} className="font-medium text-brand hover:underline">
              Manage the TNA plan
            </Link>
            <Link href={`/orders/${order.id}?tab=delay`} className="font-medium text-brand hover:underline">
              Review delay analysis
            </Link>
            <Link href={`/orders/${order.id}?tab=issues`} className="font-medium text-brand hover:underline">
              Review reported issues
            </Link>
            <Link href={`/orders/${order.id}?tab=history`} className="font-medium text-brand hover:underline">
              Audit and date-change history
            </Link>
            {detail.canEdit ? (
              <Link href={`/orders/${order.id}/share`} className="font-medium text-brand hover:underline">
                Create a read-only buyer share link
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
