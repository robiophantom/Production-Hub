import Image from "next/image";
import { Camera, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/utils";
import type { OrderDetail } from "@/lib/services/orders";
import { setPhotoVisibilityAction } from "@/app/(app)/orders/[id]/actions";

export function PhotosTab({ detail }: { detail: OrderDetail }) {
  const updates = new Map(detail.updates.map((update) => [update.id, update]));
  const issues = new Map(detail.issues.map((issue) => [issue.id, issue]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Production photographs</CardTitle>
        <CardDescription>
          Photos are internal by default. Approve an image to publish it to the buyer portal; the
          approval is audited and can be reversed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {detail.photos.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="No photographs uploaded"
            description="Supervisors can attach photos to daily updates and issues from the mobile floor view."
            className="border-0 bg-transparent"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detail.photos.map((photo) => {
              const update = photo.update_id ? updates.get(photo.update_id) : null;
              const issue = photo.issue_id ? issues.get(photo.issue_id) : null;
              return (
                <figure
                  key={photo.id}
                  className="overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-card)]"
                >
                  <div className="relative aspect-[3/2] bg-slate-100">
                    <Image
                      src={photo.url}
                      alt={photo.caption ?? "Production photograph"}
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <figcaption className="space-y-2.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[12px] leading-relaxed text-slate-600">
                        {photo.caption ?? "Production photograph"}
                      </p>
                      <Badge variant={photo.approved_for_buyer ? "success" : "neutral"}>
                        {photo.approved_for_buyer ? "Buyer-visible" : "Internal"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted">
                      {issue
                        ? `Issue: ${issue.category}`
                        : update
                          ? `Daily update · ${update.submitted_by_name}`
                          : "Unlinked upload"}
                      {" · "}
                      {formatDateTime(photo.created_at)}
                    </p>
                    {detail.canEdit ? (
                      <ConfirmAction
                        action={setPhotoVisibilityAction}
                        hidden={{
                          poId: detail.order.id,
                          photoId: photo.id,
                          approved: String(!photo.approved_for_buyer),
                        }}
                        title={
                          photo.approved_for_buyer
                            ? "Hide this photograph from the buyer?"
                            : "Approve this photograph for the buyer?"
                        }
                        description={
                          photo.approved_for_buyer
                            ? "The buyer will no longer see this image in their order portal."
                            : "The buyer will see this image in their order portal. You can reverse this at any time."
                        }
                        confirmLabel={photo.approved_for_buyer ? "Hide photo" : "Approve photo"}
                        triggerLabel={photo.approved_for_buyer ? "Hide from buyer" : "Approve for buyer"}
                        variant={photo.approved_for_buyer ? "outline" : "secondary"}
                        icon={
                          photo.approved_for_buyer ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />
                        }
                      />
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
