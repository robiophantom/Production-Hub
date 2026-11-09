import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { HEALTH_META, type Health } from "@/lib/constants";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-blue-200 bg-brand-soft text-brand-dark",
        neutral: "border-line bg-slate-50 text-slate-600",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        danger: "border-red-200 bg-red-50 text-red-700",
        purple: "border-violet-200 bg-violet-50 text-violet-700",
        outline: "border-line bg-white text-slate-600",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function HealthBadge({
  health,
  className,
  showDot = true,
}: {
  health: Health;
  className?: string;
  showDot?: boolean;
}) {
  const meta = HEALTH_META[health];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5",
        meta.bg,
        meta.border,
        meta.text,
        className,
      )}
    >
      {showDot ? <span className={cn("size-1.5 rounded-full", meta.dot)} /> : null}
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
    active: "success",
    in_progress: "default",
    pending: "neutral",
    completed: "success",
    resolved: "success",
    cancelled: "neutral",
    open: "warning",
    confirmed: "danger",
    dismissed: "neutral",
    draft: "neutral",
    approved: "default",
    sent: "success",
    low: "neutral",
    normal: "default",
    high: "warning",
    critical: "danger",
    medium: "warning",
  };
  const label = status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return <Badge variant={map[status] ?? "neutral"}>{label}</Badge>;
}
