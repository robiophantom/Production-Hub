import * as React from "react";
import { cn } from "@/lib/utils";

export function TableWrap({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("scrollbar-thin w-full overflow-x-auto rounded-[var(--radius-card)]", className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-slate-50/80", className)} {...props} />;
}

export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("transition-colors", className)} {...props} />;
}

export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3.5 align-middle", className)} {...props} />;
}

export function CellMuted({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-xs text-muted", className)} {...props} />;
}

export function CellStrong({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-medium text-ink", className)} {...props} />;
}
