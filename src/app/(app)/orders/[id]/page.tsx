import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Pencil, Share2, UserRound } from "lucide-react";
import { HealthBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRoles } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/services/orders";
import { cn, formatDate, formatNumber, titleCase } from "@/lib/utils";
import { OverviewTab } from "@/components/orders/detail/overview";
import { VariantsTab } from "@/components/orders/detail/variants";
import { TnaTab } from "@/components/orders/detail/tna";
import { ProductionTab } from "@/components/orders/detail/production";
import { UpdatesTab } from "@/components/orders/detail/updates";
import { PhotosTab } from "@/components/orders/detail/photos";
import { IssuesTab } from "@/components/orders/detail/issues";
import { DelayTab } from "@/components/orders/detail/delay";
import { HistoryTab } from "@/components/orders/detail/history";

export const metadata: Metadata = { title: "Order detail" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "variants", label: "Colour & size" },
  { id: "tna", label: "TNA plan" },
  { id: "production", label: "Production" },
  { id: "updates", label: "Daily updates" },
  { id: "photos", label: "Photos" },
  { id: "issues", label: "Issues" },
  { id: "delay", label: "Delay analysis" },
  { id: "history", label: "History & audit" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function readTab(input: string | string[] | undefined): TabId {
  const value = Array.isArray(input) ? input[0] : input;
  return TABS.some((tab) => tab.id === value) ? (value as TabId) : "overview";
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRoles("super_admin", "managing_director", "merchandiser");
  const { id } = await params;
  const query = await searchParams;
  const tab = readTab(query.tab);

  let detail: Awaited<ReturnType<typeof getOrderDetail>>;
  try {
    detail = await getOrderDetail(user, id);
  } catch {
    notFound();
  }

  const counts: Partial<Record<TabId, number>> = {
    variants: detail.variants.length,
    tna: detail.milestones.length,
    updates: detail.updates.length,
    photos: detail.photos.length,
    issues: detail.issues.filter((issue) => issue.status !== "resolved").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> Back to purchase orders
        </Link>
        {detail.canEdit ? (
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/orders/${detail.order.id}/share`}>
                <Share2 /> Share
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/orders/${detail.order.id}/edit`}>
                <Pencil /> Edit order
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
              {detail.buyer.code} · {detail.buyer.name}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
              {detail.order.po_number}
              <span className="ml-2 font-normal text-slate-500">{detail.order.style_name}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> Ex-factory{" "}
                <span className="font-medium text-ink">{formatDate(detail.order.ex_factory_date)}</span>
              </span>
              <span>{formatNumber(detail.order.total_quantity)} pcs</span>
              <span>{titleCase(detail.order.shipping_method)}</span>
              {detail.merchandiser ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="size-3.5" /> {detail.merchandiser.full_name}
                </span>
              ) : null}
              <StatusBadge status={detail.order.priority} />
              <StatusBadge status={detail.order.status} />
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <HealthBadge health={detail.health.health} />
            <p className="max-w-sm text-[12px] leading-relaxed text-muted">{detail.health.basis}</p>
            <p className="text-[11px] text-muted">
              Current stage: <span className="font-medium text-ink">{detail.currentStage}</span> ·{" "}
              {detail.currentStageProgress.toFixed(0)}% complete
            </p>
          </div>
        </div>
      </div>

      <nav className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((item) => {
          const active = item.id === tab;
          const count = counts[item.id];
          return (
            <Link
              key={item.id}
              href={`/orders/${detail.order.id}?tab=${item.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative whitespace-nowrap rounded-t-md px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "text-brand after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand"
                  : "text-muted hover:text-ink",
              )}
            >
              {item.label}
              {count ? (
                <span
                  className={cn(
                    "ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-brand-soft text-brand-dark" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div>
        {tab === "overview" ? <OverviewTab detail={detail} /> : null}
        {tab === "variants" ? <VariantsTab detail={detail} /> : null}
        {tab === "tna" ? <TnaTab detail={detail} /> : null}
        {tab === "production" ? <ProductionTab detail={detail} /> : null}
        {tab === "updates" ? <UpdatesTab detail={detail} canEdit={detail.canEdit} /> : null}
        {tab === "photos" ? <PhotosTab detail={detail} /> : null}
        {tab === "issues" ? <IssuesTab detail={detail} /> : null}
        {tab === "delay" ? <DelayTab detail={detail} /> : null}
        {tab === "history" ? <HistoryTab detail={detail} /> : null}
      </div>
    </div>
  );
}
