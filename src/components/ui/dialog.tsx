"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "dialog-content fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-[var(--shadow-float)] sm:p-6",
          className,
        )}
        {...props}
      >
        <div className="mb-4 pr-8">
          <DialogPrimitive.Title className="text-base font-semibold text-ink">
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-muted">
              {description}
            </DialogPrimitive.Description>
          ) : null}
        </div>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:bg-slate-100 hover:text-ink">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-5 flex justify-end gap-2", className)} {...props} />;
}
