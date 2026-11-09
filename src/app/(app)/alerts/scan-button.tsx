"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { scanAlertsAction } from "./actions";

export function ScanButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      size="sm"
      onClick={() =>
        startTransition(async () => {
          const result = await scanAlertsAction();
          if (result.ok) {
            toast.success(result.message ?? "Delay scan complete");
            router.refresh();
          } else {
            toast.error(result.error ?? "Unable to run the delay scan");
          }
        })
      }
      disabled={pending}
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "Scanning…" : "Run delay scan"}
    </Button>
  );
}
