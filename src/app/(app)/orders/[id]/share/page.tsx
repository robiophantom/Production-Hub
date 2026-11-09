import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Link2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState, InfoNote } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { requireRoles } from "@/lib/auth/session";
import {
  getOrderSharePage,
  shareScopeLabel,
  type SharePageData,
} from "@/lib/services/share";
import { formatDateTime } from "@/lib/utils";
import { revokeShareLinkAction } from "./actions";
import { ShareLinkForm } from "./share-link-form";

export const metadata: Metadata = { title: "Buyer share links" };

export default async function OrderSharePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRoles("super_admin", "merchandiser");
  const { id } = await params;

  let data: SharePageData;
  try {
    data = await getOrderSharePage(user, id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/orders/${data.order.id}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" /> Back to {data.order.po_number}
      </Link>

      <PageHeader
        eyebrow={`${data.buyer.code} · ${data.buyer.name}`}
        title="Read-only buyer share links"
        description={`Create an expiring link for ${data.order.po_number} (${data.order.style_name}). Links are scoped to this one order and can be revoked at any time.`}
      />

      <InfoNote variant="info" title="Secure by design">
        Only a SHA-256 hash of each token is stored. The raw link is displayed once at creation and
        is never written to the database, logs or audit detail. Expired or revoked tokens return a
        404.
      </InfoNote>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Create a link</CardTitle>
            <CardDescription>
              Choose whether the recipient sees only the milestone summary or also the approved
              updates and photographs.
            </CardDescription>
          </div>
          <Link2 className="size-5 text-slate-400" />
        </CardHeader>
        <CardContent>
          <ShareLinkForm poId={data.order.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Issued links</CardTitle>
            <CardDescription>Revocation takes effect immediately.</CardDescription>
          </div>
          <ShieldCheck className="size-5 text-slate-400" />
        </CardHeader>
        <CardContent>
          {data.tokens.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No share links issued"
              description="Create a link above when a buyer or auditor needs read-only progress access."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.tokens.map((token) => {
                const expired = token.is_expired;
                const active = !token.revoked_at && !expired;
                return (
                  <li key={token.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={active ? "success" : "neutral"}>
                          {token.revoked_at ? "Revoked" : expired ? "Expired" : "Active"}
                        </Badge>
                        <Badge variant="outline">{token.scope === "updates" ? "Summary + updates" : "Summary"}</Badge>
                        <span className="text-[12px] font-medium text-ink">
                          {token.label ?? "Untitled link"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        {shareScopeLabel(token.scope)} · created {formatDateTime(token.created_at)}
                        {token.created_by_name ? ` by ${token.created_by_name}` : ""}
                      </p>
                      <p className="text-[11px] text-muted">
                        Expires {formatDateTime(token.expires_at)}
                        {token.last_accessed_at
                          ? ` · last opened ${formatDateTime(token.last_accessed_at)}`
                          : " · never opened"}
                      </p>
                    </div>
                    {active ? (
                      <ConfirmAction
                        action={revokeShareLinkAction}
                        hidden={{ poId: data.order.id, tokenId: token.id }}
                        title="Revoke this share link?"
                        description="The link will stop working immediately for everyone who has it. This cannot be undone."
                        confirmLabel="Revoke link"
                        triggerLabel="Revoke"
                        variant="outline"
                        icon={<Ban />}
                      />
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
