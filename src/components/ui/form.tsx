import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-lg border border-line bg-white text-sm text-ink shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, "h-10 px-3", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(fieldBase, "min-h-24 resize-y px-3 py-2.5", className)}
        {...props}
      />
    );
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(fieldBase, "h-10 appearance-none px-3 pr-9", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </div>
    );
  },
);

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-medium text-slate-700", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-bad">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-bad">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {children}
    </div>
  );
}
