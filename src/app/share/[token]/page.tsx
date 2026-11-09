import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  BellRing,
  CalendarDays,
  Factory,
  Layers3,
  Lock,
  PackageCheck,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getSharedOrder, type SharedOrder } from "@/lib/services/share";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared order progress",
  robots: { index: false, follow: false },
};

export default async function SharedOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let shared: SharedOrder | null = null;
  try {
    shared = await getSharedOrder(token);
  } catch {
    shared = null;
  }
  if (!shared) notFound();

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Logo />
          <Badge variant="neutral">
            <Lock className="size-3" /> Read-only shared view
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">
                {shared.buyer.code} · {shared.buyer.name}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
                {shared.order.po_number}
                <span className="ml-2 font-normal text-slate-500">{shared.order.style_name}</span>
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> Ex-factory{" "}
                  <span className="font-medium text-ink">{formatDate(shared.order.ex_factory_date)}</span>
                </span>
                <span>{formatNumber(shared.order.total_quantity)} pcs</span>
                <span>{titleCase(shared.order.shipping_method)}</span>
                {shared.unit_name ? <span>{shared.unit_name}</span> : null}
              </div>
            </div>
            <Badge variant={shared.order.status === "active" ? "success" : "neutral"}>
              {shared.order.status === "active" ? "In production" : titleCase(shared.order.status)}
            </Badge>
          </div>

          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="text-muted">Current stage</span>
              <span className="font-medium text-ink">{shared.currentStage}</span>
            </div>
            <Progress value={shared.currentProgress} height="h-2" />
            <p className="mt-1 text-right text-[11px] text-muted">
              {shared.currentProgress.toFixed(0)}% of the current stage target
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Factory className="size-4 text-brand" /> Production milestones
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {shared.milestones.map((milestone) => (
                <li key={milestone.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink">
                      {milestone.sequence}. {milestone.stage_name}
                    </p>
                    <p className="text-[11px] text-muted">
                      Planned {formatDate(milestone.planned_date)} ·{" "}
                      {formatNumber(milestone.cumulative)} / {formatNumber(milestone.target_quantity)} pcs
                    </p>
                  </div>
                  <Progress className="mt-2" value={milestone.progress} height="h-1.5" />
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <PackageCheck className="size-4 text-brand" /> Order facts
              </h2>
              <dl className="mt-3 space-y-2 text-[12px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Style</dt>
                  <dd className="font-medium text-ink">{shared.order.style_name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Style number</dt>
                  <dd className="font-medium text-ink">{shared.order.style_number ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Quantity</dt>
                  <dd className="font-medium text-ink">{formatNumber(shared.order.total_quantity)} pcs</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Order received</dt>
                  <dd className="font-medium text-ink">{formatDate(shared.order.order_received_date)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Ex-factory</dt>
                  <dd className="font-medium text-ink">{formatDate(shared.order.ex_factory_date)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Unit</dt>
                  <dd className="font-medium text-ink">{shared.unit_name ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <BellRing className="size-4 text-brand" /> Approved notices
              </h2>
              {shared.notifications.length === 0 ? (
                <p className="mt-3 text-[12px] text-muted">No notices issued for this order.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {shared.notifications.map((notification) => (
                    <li key={notification.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-[12px] font-semibold text-ink">{notification.subject}</p>
                      <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-slate-600">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted">
                        {formatDateTime(notification.sent_at ?? notification.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {shared.scope === "updates" ? (
          <section className="rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Layers3 className="size-4 text-brand" /> Approved production updates
            </h2>
            {shared.updates.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted">No updates have been published yet.</p>
            ) : (
              <ol className="mt-4 space-y-5 border-l border-line pl-5">
                {shared.updates.map((update) => (
                  <li key={update.id} className="relative">
                    <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full border-2 border-white bg-brand" />
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold text-ink">{update.stage_name}</p>
                        <p className="mt-0.5 text-[11px] text-muted">{formatDate(update.update_date)}</p>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums text-ink">
                        +{formatNumber(update.quantity)} pcs
                      </span>
                    </div>
                    {update.notes ? (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
                        {update.notes}
                      </p>
                    ) : null}
                    {update.photos.length > 0 ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {update.photos.map((photo) => (
                          <figure
                            key={photo.id}
                            className="overflow-hidden rounded-lg border border-line bg-slate-50"
                          >
                            <div className="relative aspect-[4/3]">
                              <Image
                                src={photo.url}
                                alt={photo.caption ?? "Approved production photograph"}
                                fill
                                unoptimized
                                sizes="(max-width: 640px) 50vw, 240px"
                                className="object-cover"
                              />
                            </div>
                            {photo.caption ? (
                              <figcaption className="px-2 py-1.5 text-[11px] text-muted">
                                {photo.caption}
                              </figcaption>
                            ) : null}
                          </figure>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        <footer className="flex flex-col items-center gap-1 py-4 text-center text-[11px] text-muted">
          <p className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> This read-only link expires {formatDateTime(shared.expiresAt)}.
          </p>
          <p>Company A Production Hub · Shared by your merchandising team.</p>
        </footer>
      </main>
    </div>
  );
}
