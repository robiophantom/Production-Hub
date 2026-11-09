import { cn } from "@/lib/utils";
import { clampPercent } from "@/lib/utils";

export function Progress({
  value,
  className,
  barClassName,
  height = "h-2",
}: {
  value: number;
  className?: string;
  barClassName?: string;
  height?: string;
}) {
  const safe = clampPercent(value);
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-slate-100", height, className)}
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full bg-brand transition-[width] duration-500", barClassName)}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export function ProgressWithLabel({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const safe = clampPercent(value);
  return (
    <div className={cn("min-w-[120px]", className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tabular-nums text-ink">{safe.toFixed(0)}%</span>
        {label ? <span className="text-[11px] text-muted">{label}</span> : null}
      </div>
      <Progress value={safe} height="h-1.5" />
    </div>
  );
}
