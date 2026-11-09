import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  function href(nextPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || key === "page") continue;
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else params.set(key, value);
    }
    params.set("page", String(nextPage));
    return `${basePath}?${params.toString()}`;
  }

  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const pages = pageWindow(safePage, totalPages);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <p className="text-xs text-muted">
        Showing <span className="font-medium text-ink">{start}</span>–
        <span className="font-medium text-ink">{end}</span> of{" "}
        <span className="font-medium text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        {safePage > 1 ? (
          <Link href={href(safePage - 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <ChevronLeft /> Prev
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-40")}>
            <ChevronLeft /> Prev
          </span>
        )}
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((item, index) =>
            item === "…" ? (
              <span key={`ellipsis-${index}`} className="px-1.5 text-xs text-muted">
                …
              </span>
            ) : (
              <Link
                key={item}
                href={href(item)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-xs font-medium transition-colors",
                  item === safePage
                    ? "bg-brand text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {item}
              </Link>
            ),
          )}
        </div>
        <span className="px-2 text-xs text-muted sm:hidden">
          {safePage} / {totalPages}
        </span>
        {safePage < totalPages ? (
          <Link href={href(safePage + 1)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Next <ChevronRight />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-40")}>
            Next <ChevronRight />
          </span>
        )}
      </div>
    </div>
  );
}

function pageWindow(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const result: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) result.push("…");
  for (let current = start; current <= end; current += 1) result.push(current);
  if (end < total - 1) result.push("…");
  result.push(total);
  return result;
}
