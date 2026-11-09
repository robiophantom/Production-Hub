"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export function InlineForm({
  action,
  hidden,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  resetOnSuccess = true,
  variant = "primary",
  size = "sm",
  className,
  footerClassName,
}: {
  action: (formData: FormData) => Promise<AdminActionResult>;
  hidden?: Record<string, string>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  resetOnSuccess?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  footerClassName?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Unable to complete this action.");
        return;
      }
      toast.success(result.message ?? "Saved");
      if (resetOnSuccess) form.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn("space-y-4", className)}>
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      {children}
      <div className={cn("flex items-center gap-2", footerClassName)}>
        <Button type="submit" size={size} variant={variant} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
