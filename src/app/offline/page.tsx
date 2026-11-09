import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Offline · Company A Production Hub" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <WifiOff className="size-7" />
        </div>
        <h1 className="text-lg font-semibold text-ink">You are offline</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          The floor app keeps new updates on this device. Reconnect to sync them — nothing recorded
          offline is lost.
        </p>
        <Button asChild className="mt-5">
          <Link href="/supervisor">Try the supervisor workspace</Link>
        </Button>
      </div>
    </main>
  );
}
