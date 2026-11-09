import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Factory,
  Layers3,
  TrendingUp,
} from "lucide-react";
import { ProductionChart } from "@/components/charts/production-chart";
import { UnitComparisonChart } from "@/components/charts/unit-chart";
import { HealthBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { requireRoles } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/services/dashboard";
import { cn, formatDate, formatNumber, formatQuantity, percent } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES = [14, 30, 60] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireRoles("super_admin", "managing_director", "merchandiser");
  const params = await searchParams;
  const requestedRange = Number(params.range ?? 14);
  const range = RANGES.includes(requestedRange as (typeof RANGES)[number]) ? requestedRange : 14;

  const data = await getDashboardData(user, range);
  const { metrics, config } = data;
  const companyWide = user.role !== "merchandiser";

  const healthRows = [
    {
      key: "green",
      label: "On track",
      value: metrics.onTrack,
      tone: "bg-emerald-500",
      text: "text-emerald-700",
    },
    { key: "amber", label: "At risk", value: metrics.atRisk, tone: "bg-amber-500", text: "text-amber-700" },
    { key: "red", label: "Delayed", value: metrics.delayed, tone: "bg-red-500", text: "text-red-700" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management dashboard"
        title={companyWide ? "Company production overview" : "My production overview"}
        description={
          companyWide
            ? `Live health across ${metrics.activeOrders} active purchase orders. Delay projections use actual reported output and the Monday–Saturday calendar — business date ${formatDate(config.businessDate)}.`
            : `Orders assigned to you, with transparent delay projections. Business date ${formatDate(config.businessDate)}.`
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/board">Open production board</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active purchase orders"
          value={formatNumber(metrics.activeOrders)}
          icon={ClipboardList}
          hint={`${metrics.upcomingShipments} ex-factory within 14 days`}
        />
        <StatCard
          label="Ordered pieces"
          value={formatNumber(metrics.totalOrdered)}
          icon={Layers3}
          hint="Across active orders"
          tone="slate"
        />
        <StatCard
          label="Produced at current stage"
          value={formatNumber(metrics.totalProduced)}
          icon={Factory}
          hint={`${percent(metrics.totalProduced, metrics.totalOrdered).toFixed(1)}% of active ordered volume`}
        />
        <StatCard
          label="Output last 7 working days"
          value={formatNumber(metrics.producedLast7Days)}
          icon={TrendingUp}
          hint="All reported stages"
          tone="green"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="On track"
          value={formatNumber(metrics.onTrack)}
          icon={CheckCircle2}
          tone="green"
          hint="Healthy buffer before planned dates"
        />
        <StatCard
          label="At risk"
          value={formatNumber(metrics.atRisk)}
          icon={AlertTriangle}
          tone="amber"
          hint="Insufficient buffer or rate"
        />
        <StatCard
          label="Delayed"
          value={formatNumber(metrics.delayed)}
          icon={AlertOctagon}
          tone="red"
          hint="Projected after planned date"
        />
        <StatCard
          label="Ex-factory next 14 days"
          value={formatNumber(metrics.upcomingShipments)}
          icon={CalendarClock}
          hint="Shipments to protect"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Production performance</CardTitle>
              <CardDescription>
                Daily reported output on scheduled working days. Missing reports count as zero.
              </CardDescription>
            </div>
            <div className="flex shrink-0 rounded-lg border border-line bg-slate-50 p-0.5">
              {RANGES.map((value) => (
                <Link
                  key={value}
                  href={`/dashboard?range=${value}`}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    range === value ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink",
                  )}
                >
                  {value}d
                </Link>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ProductionChart data={data.production} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order health</CardTitle>
            <CardDescription>
              Derived from the most critical active milestone and the ex-factory deadline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              {healthRows.map((row) => (
                <div
                  key={row.key}
                  className={row.tone}
                  style={{ width: `${percent(row.value, metrics.activeOrders)}%` }}
                />
              ))}
            </div>
            <ul className="space-y-3">
              {healthRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] text-slate-600">
                    <span className={cn("size-2 rounded-full", row.tone)} />
                    {row.label}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className={cn("text-sm font-semibold tabular-nums", row.text)}>
                      {formatNumber(row.value)}
                    </span>
                    <span className="text-[11px] text-muted">
                      {percent(row.value, metrics.activeOrders).toFixed(0)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/board?health=red">Review delayed orders</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Unit-wise production</CardTitle>
            <CardDescription>Ordered volume versus output at each order&apos;s current stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <UnitComparisonChart data={data.units} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buyer overview</CardTitle>
            <CardDescription>Active order book by buyer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.buyers.length === 0 ? (
              <p className="text-sm text-muted">No active buyer orders in your scope.</p>
            ) : (
              data.buyers.map((buyer) => (
                <div key={buyer.code}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {buyer.name} <span className="text-xs text-muted">({buyer.code})</span>
                      </p>
                      <p className="text-[11px] text-muted">
                        {buyer.orders} orders · {formatQuantity(buyer.ordered)}
                      </p>
                    </div>
                    {buyer.delayed > 0 ? (
                      <span className="text-[11px] font-semibold text-red-600">
                        {buyer.delayed} delayed
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-emerald-600">No delays</span>
                    )}
                  </div>
                  <Progress
                    className="mt-2"
                    height="h-1.5"
                    value={percent(buyer.produced, buyer.ordered)}
                    barClassName="bg-brand/70"
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming ex-factory dates</CardTitle>
            <CardDescription>Shipments due in the next 14 days.</CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {data.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No shipments in the next 14 days"
                description="The ex-factory calendar is clear for this window."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.upcoming.map((summary) => (
                  <li key={summary.order.id}>
                    <Link
                      href={`/orders/${summary.order.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:text-brand"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">
                          {summary.order.po_number}
                          <span className="ml-2 font-normal text-muted">{summary.buyer.name}</span>
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted">
                          {summary.currentStage} · {summary.order.style_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[12px] font-semibold text-ink">
                          {formatDate(summary.order.ex_factory_date)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          {summary.health.daysRemaining} working day(s) left
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Orders requiring attention</CardTitle>
              <CardDescription>Most severe active milestone risk first.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/alerts">All alerts</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-1">
            {data.attention.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No orders at risk"
                description="Every active order is inside its healthy buffer."
                className="border-0 bg-transparent py-8"
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.attention.map((summary) => (
                  <li key={summary.order.id}>
                    <Link
                      href={`/orders/${summary.order.id}?tab=delay`}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink">
                          {summary.order.po_number}
                          <span className="ml-2 font-normal text-muted">{summary.buyer.name}</span>
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
                          {summary.health.basis}
                        </p>
                      </div>
                      <HealthBadge health={summary.health.health} className="mt-0.5 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Recent production updates</CardTitle>
              <CardDescription>Latest submissions from the floor.</CardDescription>
            </div>
            <StatusBadge status="in_progress" />
          </CardHeader>
          <CardContent className="pt-1">
            {data.recentUpdates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No production updates yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.recentUpdates.map((update) => (
                  <li key={update.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">
                        {update.poNumber}
                        <span className="ml-2 font-normal text-muted">{update.stageName}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {update.supervisorName} · {formatDate(update.updateDate)}
                        {update.source === "offline" ? " · synced offline" : ""}
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
            <CardTitle>Recent factory issues</CardTitle>
            <CardDescription>Reported by supervisors and classified server-side.</CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            {data.recentIssues.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No issues reported.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.recentIssues.map((issue) => (
                  <li key={issue.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-medium text-ink">
                        {issue.category}
                        <span className="ml-2 font-normal text-muted">{issue.poNumber}</span>
                      </p>
                      <StatusBadge status={issue.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                      {issue.description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            href: "/orders/new",
            title: "Create a purchase order",
            body: "Colour/size breakdown, TNA template and unit assignment.",
          },
          {
            href: "/board",
            title: "Production board",
            body: "Filter every order by buyer, unit, stage and health.",
          },
          {
            href: "/alerts",
            title: "Delay alerts",
            body: "Review 14/7/3-day warnings and confirm buyer messages.",
          },
          {
            href: "/reports",
            title: "Reports",
            body: "Export production, delay and buyer summaries.",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)] transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
          >
            <p className="text-[13px] font-semibold text-ink">{item.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.body}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
