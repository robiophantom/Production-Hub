import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Camera, ClipboardList, CloudOff, Factory, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireRoles } from "@/lib/auth/session";
import { getSupervisorHistory } from "@/lib/services/production";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "My submissions" };

export default async function SupervisorHistoryPage() {
  const user = await requireRoles("unit_supervisor");
  const history = await getSupervisorHistory(user);

  const totalPieces = history.reduce((sum, item) => sum + Number(item.update.quantity), 0);
  const offlineCount = history.filter((item) => item.update.source === "offline").length;
  const photoCount = history.reduce((sum, item) => sum + item.photos.length, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Factory floor"
        title="My submissions"
        description="Every daily production update you have recorded, newest first. Offline updates keep their original client id, so a re-send never double counts."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/supervisor">
              <ArrowLeft /> Back to production
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Submissions" value={formatNumber(history.length)} icon={History} />
        <StatCard label="Pieces recorded" value={formatNumber(totalPieces)} icon={Factory} tone="green" />
        <StatCard label="Synced from offline" value={formatNumber(offlineCount)} icon={CloudOff} tone="amber" />
        <StatCard label="Photographs attached" value={formatNumber(photoCount)} icon={Camera} tone="slate" />
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No production updates yet"
          description="Use the daily update form on your production page to record completed pieces."
          action={
            <Button asChild size="sm">
              <Link href="/supervisor">Record an update</Link>
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {history.map((item) => (
            <article key={item.update.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{item.po_number}</p>
                  <Badge variant="neutral">{item.stage_name}</Badge>
                  {item.update.source === "offline" ? (
                    <Badge variant="warning">Synced offline</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[12px] text-muted">{item.style_name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span>Production date: {formatDate(item.update.update_date)}</span>
                  <span>Submitted: {formatDateTime(item.update.created_at)}</span>
                </div>
                {item.update.notes ? (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-600">
                    {item.update.notes}
                  </p>
                ) : null}
                {item.photos.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.photos.map((photo) => (
                      <span key={photo.id} className="relative size-12 overflow-hidden rounded-lg border border-line">
                        <Image
                          src={photo.url}
                          alt={photo.caption ?? "Production photograph"}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="48px"
                        />
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-lg font-semibold tabular-nums text-ink">
                  {formatNumber(item.update.quantity)}
                </p>
                <p className="text-[11px] text-muted">pieces</p>
              </div>
            </article>
          ))}
        </Card>
      )}
    </div>
  );
}
