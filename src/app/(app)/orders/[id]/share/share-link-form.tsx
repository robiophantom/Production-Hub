"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { createShareLinkAction, type ShareActionState } from "./actions";

const INITIAL: ShareActionState = { ok: false };

export function ShareLinkForm({ poId }: { poId: string }) {
  const [state, formAction, pending] = useActionState(createShareLinkAction, INITIAL);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const router = useRouter();
  const lastToken = useRef<string | undefined>(undefined);
  const url = state.ok && state.url ? state.url : "";
  const copied = copiedToken !== null && copiedToken === state.tokenId;

  useEffect(() => {
    if (!state.ok) {
      if (state.error) toast.error(state.error);
      return;
    }
    if (state.tokenId && state.tokenId !== lastToken.current) {
      lastToken.current = state.tokenId;
      toast.success(state.message ?? "Share link created");
      router.refresh();
    }
  }, [state, router]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(state.tokenId ?? null);
      toast.success("Link copied to clipboard");
      window.setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error("Unable to copy. Select the link manually.");
    }
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="poId" value={poId} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Scope" htmlFor="share-scope">
            <Select id="share-scope" name="scope" defaultValue="summary">
              <option value="summary">Summary and milestones</option>
              <option value="updates">Summary, milestones and approved updates</option>
            </Select>
          </Field>
          <Field label="Expires after" htmlFor="share-days">
            <Select id="share-days" name="days" defaultValue="14">
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </Select>
          </Field>
          <Field label="Label (optional)" htmlFor="share-label" hint="For your own reference">
            <Input id="share-label" name="label" maxLength={80} placeholder="e.g. Buyer weekly review" />
          </Field>
        </div>

        {!state.ok && state.error ? <FormError>{state.error}</FormError> : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Link2 />}
            {pending ? "Creating…" : "Create read-only link"}
          </Button>
          <p className="text-[11px] text-muted">
            The link is read-only, limited to this order, and cannot expose internal notes, issues or
            alert calculations.
          </p>
        </div>
      </form>

      {url ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[12px] font-semibold text-emerald-800">
            Copy this link now — it is shown only once.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input value={url} readOnly className="h-9 bg-white font-mono text-[11px]" onFocus={(event) => event.currentTarget.select()} />
            <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
