import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-6" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function InfoNote({
  children,
  variant = "info",
  title,
  className,
}: {
  children: React.ReactNode;
  variant?: "info" | "warning" | "success" | "danger";
  title?: string;
  className?: string;
}) {
  const styles = {
    info: "border-blue-200 bg-brand-soft text-blue-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[variant];
  const Icon = { info: Info, warning: AlertCircle, success: CheckCircle2, danger: AlertCircle }[variant];
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed", styles, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
