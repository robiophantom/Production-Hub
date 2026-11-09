import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-4 sm:px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <SearchX className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page may have moved, the link may be incomplete, or this order or share link is no
          longer available to you.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button asChild>
            <Link href="/">Go to my home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
