import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BellRing, Camera, CheckCircle2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, InfoNote } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requireRoles } from "@/lib/auth/session";
import { getBuyerNotifications, getBuyerUpdates } from "@/lib/services/buyer";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Approved updates" };

export default async function BuyerUpdatesPage() {
  const user = await requireRoles("buyer");
  const [updates, notifications] = await Promise.all([
    getBuyerUpdates(user, 100),
    getBuyerNotifications(user, 100),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/buyer"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Back to my orders
      </Link>

      <PageHeader
        eyebrow="Buyer portal"
        title="Updates & notices"
        description="Every item here was explicitly approved by your merchandiser. Internal production issues, raw calculations and unreviewed risk alerts are not visible."
      />

      <InfoNote variant="info" title="Publication rule">
        A delay notice is published only after a merchandiser confirms the alert. Photographs appear
        only after an explicit approval action, and approved access can be reversed.
      </InfoNote>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Approved production updates</CardTitle>
            <CardDescription>
              Daily quantities and photographs cleared for buyer visibility.
            </CardDescription>
          </div>
          <History className="size-5 text-slate-400" />
        </CardHeader>
        <CardContent className="pt-1">
          {updates.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No approved updates yet"
              description="Your merchandiser will publish progress updates and photographs here after internal review."
              className="border-0 bg-transparent"
            />
          ) : (
            <ol className="relative space-y-5 border-l border-line pl-5">
              {updates.map((update) => (
                <li key={update.id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full border-2 border-white bg-brand" />
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        {update.po_number}
                        <span className="ml-2 font-normal text-muted">{update.stage_name}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {formatDate(update.update_date)} · {update.style_name}
                      </p>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Buyer notices</CardTitle>
            <CardDescription>Delay communications approved by your merchandiser.</CardDescription>
          </div>
          <BellRing className="size-5 text-slate-400" />
        </CardHeader>
        <CardContent className="pt-1">
          {notifications.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-[13px] text-muted">
              <BellRing className="size-4" /> No notices have been issued for your orders.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((notification) => (
                <li key={notification.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-ink">{notification.subject}</p>
                    <Badge variant="success">
                      {notification.status === "sent" ? "Sent" : "Approved"}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-slate-600">
                    {notification.message}
                  </p>
                  <p className="mt-2 text-[11px] text-muted">
                    {notification.po_number} · {notification.style_name} ·{" "}
                    {formatDateTime(notification.sent_at ?? notification.approved_at ?? notification.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-[11px] text-muted">
        <Camera className="size-3.5" /> Photographs are served through time-limited application
        storage and never expose internal issue records.
      </p>
    </div>
  );
}
