import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  className,
  tone = "brand",
}: {
  name: string;
  className?: string;
  tone?: "brand" | "slate" | "green";
}) {
  const tones = {
    brand: "bg-brand-light text-brand-dark",
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-100 text-emerald-700",
  }[tone];
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        tones,
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
