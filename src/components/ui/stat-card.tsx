import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  className,
}: {
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "brand" | "green" | "amber" | "red" | "slate";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  }[tone];

  return (
    <div
      className={cn(
        "group rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-float)] sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-muted">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
        </div>
        {Icon ? (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tones)}>
            <Icon className="size-[18px]" />
          </div>
        ) : null}
      </div>
      {hint ? <div className="mt-2 text-[11px] leading-relaxed text-muted">{hint}</div> : null}
    </div>
  );
}
