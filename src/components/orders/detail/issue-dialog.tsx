"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/form";
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES, ISSUE_STATUSES } from "@/lib/constants";
import { updateIssueAction } from "@/app/(app)/orders/[id]/actions";

export function IssueDialog({
  poId,
  issue,
}: {
  poId: string;
  issue: {
    id: string;
    category: string;
    severity: string;
    status: string;
    aiSuggestedCategory: string | null;
    aiExplanation: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateIssueAction(formData);
      if (result.ok) {
        toast.success(result.message ?? "Issue updated");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Unable to update this issue.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 />
          Review
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Review production issue"
        description="The merchandiser confirms the category and severity. AI suggestions never change the recorded category by themselves."
      >
        <form action={submit} className="space-y-4">
          <input type="hidden" name="poId" value={poId} />
          <input type="hidden" name="issueId" value={issue.id} />

          {issue.aiExplanation ? (
            <div className="rounded-lg border border-line bg-slate-50/70 p-3 text-[12px] leading-relaxed text-slate-600">
              <p className="font-semibold text-ink">AI suggestion (advisory only)</p>
              <p className="mt-1">
                {issue.aiSuggestedCategory ?? "No category suggested"}
                {issue.aiExplanation ? ` — ${issue.aiExplanation}` : ""}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor={`issue-category-${issue.id}`} required>
              <Select
                id={`issue-category-${issue.id}`}
                name="category"
                defaultValue={issue.category}
                required
              >
                {ISSUE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Severity" htmlFor={`issue-severity-${issue.id}`} required>
              <Select
                id={`issue-severity-${issue.id}`}
                name="severity"
                defaultValue={issue.severity}
                required
              >
                {ISSUE_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Status"
            htmlFor={`issue-status-${issue.id}`}
            hint="Resolving an issue records the reviewer and resolution time."
          >
            <Select id={`issue-status-${issue.id}`} name="status" defaultValue={issue.status}>
              {ISSUE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === "open" ? "Open" : status === "in_progress" ? "In progress" : "Resolved"}
                </option>
              ))}
            </Select>
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Save issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
