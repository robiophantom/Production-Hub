import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="mb-2 h-8 w-24" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <Skeleton className="mb-5 h-8 w-full" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
