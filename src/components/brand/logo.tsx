import { Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  tone = "brand",
  showText = true,
}: {
  className?: string;
  tone?: "brand" | "white";
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl shadow-sm",
          tone === "brand" ? "bg-brand text-white" : "bg-white/15 text-white ring-1 ring-white/25",
        )}
      >
        <Shirt className="size-[18px]" strokeWidth={2.2} />
      </span>
      {showText ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-[15px] font-semibold tracking-tight",
              tone === "brand" ? "text-ink" : "text-white",
            )}
          >
            Production Hub
          </span>
          <span
            className={cn(
              "mt-1 text-[10px] font-medium uppercase tracking-[0.16em]",
              tone === "brand" ? "text-slate-400" : "text-blue-200",
            )}
          >
            Company A · Tiruppur
          </span>
        </span>
      ) : null}
    </span>
  );
}
