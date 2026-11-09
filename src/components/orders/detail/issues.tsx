import Image from "next/image";
import { AlertTriangle, Bot, Languages, Mic } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatDateTime, titleCase } from "@/lib/utils";
import type { OrderDetail } from "@/lib/services/orders";
import { IssueDialog } from "./issue-dialog";

const AI_META: Record<
  string,
  { label: string; variant: "default" | "neutral" | "success" | "warning" | "danger" | "purple" }
> = {
  suggested: { label: "AI suggested", variant: "purple" },
  accepted: { label: "AI accepted", variant: "success" },
  corrected: { label: "AI corrected", variant: "warning" },
  unavailable: { label: "AI unavailable", variant: "neutral" },
};

export function IssuesTab({ detail }: { detail: OrderDetail }) {
  const milestones = new Map(detail.milestones.map((item) => [item.milestone.id, item]));
  const open = detail.issues.filter((issue) => issue.status !== "resolved");
  const resolved = detail.issues.filter((issue) => issue.status === "resolved");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Open issues", value: open.length, tone: open.length > 0 ? "text-amber-700" : "text-ink" },
          {
            label: "Critical open",
            value: open.filter((issue) => issue.severity === "critical").length,
            tone: "text-red-700",
          },
          { label: "Resolved", value: resolved.length, tone: "text-emerald-700" },
          { label: "Total reported", value: detail.issues.length, tone: "text-ink" },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-[12px] text-muted">{stat.label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${stat.tone}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reported production issues</CardTitle>
          <CardDescription>
            Tamil voice notes are transcribed and classified server-side. Suggestions are advisory — a
            merchandiser confirms or corrects every category.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.issues.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No issues reported"
              description="Supervisors can report machine breakdowns, material shortages and other blockers from the mobile floor view."
              className="border-0 bg-transparent"
            />
          ) : (
            <ul className="divide-y divide-line">
              {detail.issues.map((issue) => {
                const milestone = issue.milestone_id ? milestones.get(issue.milestone_id) : null;
                const ai = AI_META[issue.ai_status] ?? AI_META.unavailable;

                return (
                  <li key={issue.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-ink">{issue.category}</p>
                          <StatusBadge status={issue.severity} />
                          <StatusBadge status={issue.status} />
                          <Badge variant={ai.variant}>{ai.label}</Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          {issue.reported_by_name}
                          {milestone ? ` · ${milestone.stage.name}` : ""}
                          {" · "}
                          {formatDateTime(issue.created_at)}
                          {issue.resolved_at
                            ? ` · resolved ${formatDateTime(issue.resolved_at)}`
                            : ""}
                        </p>

                        {issue.description_tamil ? (
                          <p className="mt-2 flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-700">
                            <Languages className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                            <span lang="ta">{issue.description_tamil}</span>
                          </p>
                        ) : null}
                        {issue.description_english ? (
                          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                            {issue.description_english}
                          </p>
                        ) : null}

                        {issue.ai_status !== "unavailable" && issue.ai_suggested_category ? (
                          <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
                            <Bot className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                              Suggested: <span className="font-medium">{issue.ai_suggested_category}</span>
                              {issue.ai_explanation ? ` — ${issue.ai_explanation}` : ""}
                              {issue.ai_status === "accepted"
                                ? " · accepted by merchandiser"
                                : issue.ai_status === "corrected"
                                  ? ` · corrected to ${issue.category}`
                                  : " · awaiting merchandiser review"}
                            </span>
                          </p>
                        ) : null}

                        {issue.voice_transcript ? (
                          <p className="mt-2 flex gap-2 text-[11px] leading-relaxed text-slate-500">
                            <Mic className="mt-0.5 size-3.5 shrink-0" />
                            <span>Voice transcript: {issue.voice_transcript}</span>
                          </p>
                        ) : null}
                      </div>

                      {detail.canEdit && issue.status !== "resolved" ? (
                        <IssueDialog
                          poId={detail.order.id}
                          issue={{
                            id: issue.id,
                            category: issue.category,
                            severity: issue.severity,
                            status: issue.status,
                            aiSuggestedCategory: issue.ai_suggested_category,
                            aiExplanation: issue.ai_explanation,
                          }}
                        />
                      ) : null}
                    </div>

                    {issue.photos.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {issue.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="relative size-20 overflow-hidden rounded-lg border border-line bg-slate-100"
                          >
                            <Image
                              src={photo.url}
                              alt={photo.caption ?? "Issue photograph"}
                              fill
                              unoptimized
                              className="object-cover"
                              sizes="80px"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {issue.status === "resolved" ? (
                      <p className="mt-2 text-[11px] text-emerald-600">
                        Resolved{issue.resolved_by ? " by the merchandiser" : ""} ·{" "}
                        {titleCase(issue.status)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
