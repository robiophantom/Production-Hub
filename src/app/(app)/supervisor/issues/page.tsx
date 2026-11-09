import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Mic, Sparkles, TriangleAlert } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireRoles } from "@/lib/auth/session";
import { getSupervisorIssues } from "@/lib/services/production";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Issues I reported" };

export default async function SupervisorIssuesPage() {
  const user = await requireRoles("unit_supervisor");
  const items = await getSupervisorIssues(user);

  const open = items.filter((item) => item.issue.status !== "resolved").length;
  const resolved = items.length - open;
  const aiReviewed = items.filter(
    (item) => item.issue.ai_status === "accepted" || item.issue.ai_status === "corrected",
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Factory floor"
        title="Issues I reported"
        description="Every issue you have raised, with the merchandiser's review status. AI suggestions are shown for transparency only; a merchandiser makes the final category decision."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/supervisor">
              <ArrowLeft /> Back to production
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Open issues" value={formatNumber(open)} icon={TriangleAlert} tone="amber" />
        <StatCard label="Resolved" value={formatNumber(resolved)} icon={CheckCircle2} tone="green" />
        <StatCard label="AI suggestion reviewed" value={formatNumber(aiReviewed)} icon={Sparkles} tone="brand" />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No issues reported"
          description="When you tick “Report a production issue” on a daily update, it appears here with its review status."
          action={
            <Button asChild size="sm">
              <Link href="/supervisor">Record an update</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <Card key={item.issue.id} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line bg-slate-50/60 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{item.po_number}</p>
                    <StatusBadge status={item.issue.status} />
                    <StatusBadge status={item.issue.severity} />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {item.style_name}
                    {item.stage_name ? ` · ${item.stage_name}` : ""}
                  </p>
                  {item.issue.voice_translation ? (
                    <p className="mt-1">
                      English translation: {item.issue.voice_translation}
                    </p>
                  ) : null}
                </div>
                <Badge variant="default">{item.issue.category}</Badge>
              </div>

              <div className="space-y-3 p-4">
                {item.issue.description_tamil ? (
                  <p className="text-[13px] leading-relaxed text-ink">{item.issue.description_tamil}</p>
                ) : null}
                {item.issue.description_english ? (
                  <p className="text-[12px] leading-relaxed text-slate-600">
                    {item.issue.description_english}
                  </p>
                ) : null}
                {item.issue.voice_transcript ? (
                  <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                    <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <Mic className="size-3" /> Voice transcript
                    </p>
                    {item.issue.voice_transcript}
                  </div>
                ) : item.issue.voice_url ? (
                  <a
                    href={item.issue.voice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                  >
                    <Mic className="size-3.5" /> Play voice note
                  </a>
                ) : null}

                {item.issue.ai_suggested_category ? (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[12px] text-violet-800">
                    <p className="flex items-center gap-1 font-semibold">
                      <Sparkles className="size-3.5" /> AI suggested: {item.issue.ai_suggested_category}
                      {item.issue.ai_status === "accepted"
                        ? " · accepted by merchandiser"
                        : item.issue.ai_status === "corrected"
                          ? ` · corrected to ${item.issue.category}`
                          : " · awaiting merchandiser review"}
                    </p>
                    {item.issue.ai_explanation ? (
                      <p className="mt-0.5">{item.issue.ai_explanation}</p>
                    ) : null}
                  </div>
                ) : null}

                {item.photos.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {item.photos.map((photo) => (
                      <span key={photo.id} className="relative h-16 w-24 overflow-hidden rounded-lg border border-line">
                        <Image
                          src={photo.url}
                          alt={photo.caption ?? "Issue photograph"}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="96px"
                        />
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="text-[11px] text-muted">
                  Reported {formatDateTime(item.issue.created_at)}
                  {item.issue.resolved_at
                    ? ` · Resolved ${formatDateTime(item.issue.resolved_at)}`
                    : ""}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
