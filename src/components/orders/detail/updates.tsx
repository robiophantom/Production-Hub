import Image from "next/image";
import { Camera, Eye, EyeOff, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import type { OrderDetail } from "@/lib/services/orders";
import {
  setPhotoVisibilityAction,
  setUpdateVisibilityAction,
} from "@/app/(app)/orders/[id]/actions";

export function UpdatesTab({ detail, canEdit }: { detail: OrderDetail; canEdit: boolean }) {
  const milestones = new Map(detail.milestones.map((item) => [item.milestone.id, item]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily production updates</CardTitle>
        <CardDescription>
          Every submission is retained as a separate record. Updates and photographs become visible to
          the buyer only after merchandiser approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {detail.updates.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="No production updates yet"
            description="Supervisors submit daily quantities from the factory floor; those records appear here."
            className="border-0 bg-transparent"
          />
        ) : (
          <ul className="divide-y divide-line">
            {detail.updates.map((update) => {
              const milestone = milestones.get(update.milestone_id);
              return (
                <li key={update.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">
                        {milestone?.stage.name ?? "Production"}
                        <span className="ml-2 font-normal text-muted">
                          {formatDate(update.update_date)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {update.submitted_by_name} · submitted {formatDateTime(update.created_at)}
                        {update.source === "offline" ? (
                          <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
                            <WifiOff className="size-3" /> offline sync
                          </span>
                        ) : null}
                      </p>
                      {update.notes ? (
                        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
                          {update.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-semibold tabular-nums text-ink">
                        +{formatNumber(update.quantity)} pcs
                      </span>
                      <span
                        className={
                          update.approved_for_buyer
                            ? "inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"
                            : "inline-flex items-center gap-1 text-[11px] font-medium text-slate-400"
                        }
                      >
                        {update.approved_for_buyer ? (
                          <Eye className="size-3.5" />
                        ) : (
                          <EyeOff className="size-3.5" />
                        )}
                        {update.approved_for_buyer ? "Buyer-visible" : "Internal only"}
                      </span>
                      {canEdit ? (
                        <ConfirmAction
                          action={setUpdateVisibilityAction}
                          hidden={{
                            poId: detail.order.id,
                            updateId: update.id,
                            visible: String(!update.approved_for_buyer),
                          }}
                          title={
                            update.approved_for_buyer
                              ? "Hide this update from the buyer?"
                              : "Approve this update for the buyer?"
                          }
                          description={
                            update.approved_for_buyer
                              ? "The buyer will no longer see this daily update in their portal."
                              : "The buyer will see this daily quantity in their portal."
                          }
                          confirmLabel={update.approved_for_buyer ? "Hide update" : "Approve update"}
                          triggerLabel={update.approved_for_buyer ? "Hide" : "Approve"}
                          variant={update.approved_for_buyer ? "outline" : "secondary"}
                          icon={<Eye className="size-3.5" />}
                        />
                      ) : null}
                    </div>
                  </div>

                  {update.photos.length > 0 ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {update.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="overflow-hidden rounded-lg border border-line bg-slate-50"
                        >
                          <div className="relative aspect-[3/2]">
                            <Image
                              src={photo.url}
                              alt={photo.caption ?? "Production photograph"}
                              fill
                              unoptimized
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
                          </div>
                          <div className="space-y-2 p-2.5">
                            <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                              {photo.caption ?? "Production photograph"}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant={photo.approved_for_buyer ? "success" : "neutral"}>
                                {photo.approved_for_buyer ? "Buyer-visible" : "Internal"}
                              </Badge>
                              {canEdit ? (
                                <ConfirmAction
                                  action={setPhotoVisibilityAction}
                                  hidden={{
                                    poId: detail.order.id,
                                    photoId: photo.id,
                                    approved: String(!photo.approved_for_buyer),
                                  }}
                                  title={
                                    photo.approved_for_buyer
                                      ? "Hide photograph from buyer?"
                                      : "Approve photograph for buyer?"
                                  }
                                  description={
                                    photo.approved_for_buyer
                                      ? "The buyer will no longer see this image."
                                      : "The buyer will see this image in their order portal."
                                  }
                                  confirmLabel={
                                    photo.approved_for_buyer ? "Hide photo" : "Approve photo"
                                  }
                                  triggerLabel={photo.approved_for_buyer ? "Hide" : "Approve"}
                                  variant={photo.approved_for_buyer ? "outline" : "secondary"}
                                />
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
