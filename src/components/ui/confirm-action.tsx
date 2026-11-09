"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";

type ActionResult = { ok: boolean; error?: string; message?: string };

export function ConfirmAction({
  action,
  hidden,
  title,
  description,
  confirmLabel = "Confirm",
  triggerLabel,
  variant = "primary",
  prompt,
  icon,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  hidden: Record<string, string>;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerLabel: string;
  variant?: ButtonProps["variant"];
  prompt?: { name: string; label: string; placeholder?: string; required?: boolean };
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const router = useRouter();

  function submit() {
    if (prompt?.required && !reason.trim()) {
      toast.error(`${prompt.label} is required`);
      return;
    }
    const formData = new FormData();
    for (const [key, value] of Object.entries(hidden)) formData.set(key, value);
    if (prompt) formData.set(prompt.name, reason);

    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message ?? "Done");
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          {icon}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        {prompt ? (
          <Field label={prompt.label} htmlFor="confirm-reason">
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={prompt.placeholder}
              required={prompt.required}
            />
          </Field>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={submit} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
