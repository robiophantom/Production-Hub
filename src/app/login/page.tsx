import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, ChartNoAxesCombined, Factory, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { BUYER_DEMO_ACCOUNT_C, DEMO_ACCOUNTS } from "@/lib/constants";
import { env } from "@/lib/env";
import { LoginForm, type DemoLogin } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Company A Production Hub.",
};

const capabilities = [
  {
    icon: ChartNoAxesCombined,
    title: "Live production health",
    body: "Every order, stage and quantity in one shared view instead of scattered spreadsheets.",
  },
  {
    icon: CalendarClock,
    title: "Two weeks earlier",
    body: "Transparent delay projections surface risk at 14, 7 and 3 working days — never a black box.",
  },
  {
    icon: Factory,
    title: "Built for the floor",
    body: "Supervisors submit daily output and Tamil issue notes from a phone, even when the network drops.",
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSessionUser();
  if (session) redirect(roleHome(session.role));

  const { next } = await searchParams;
  const config = env();
  const showDemo =
    process.env.NODE_ENV !== "production" && config.seedDemoData && !config.databaseUrl;

  const demoAccounts: DemoLogin[] = showDemo
    ? [
        ...DEMO_ACCOUNTS,
        { role: "buyer" as const, ...BUYER_DEMO_ACCOUNT_C },
      ]
    : [];

  return (
    <main className="grid min-h-dvh bg-page lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand p-12 text-white lg:flex lg:p-14">
        <div className="pointer-events-none absolute inset-0 grid-paper opacity-40" />
        <div className="relative">
          <Logo tone="white" />
        </div>

        <div className="relative max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200">
            Garment production, end to end
          </p>
          <h1 className="mt-4 text-[34px] font-semibold leading-[1.15] tracking-tight">
            Know which orders will miss ex-factory — while there is still time to act.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-blue-100">
            Company A&apos;s three units, subcontractors, TNA milestones and 500 annual purchase
            orders on one platform. Merchandisers stop chasing status; buyers see approved progress.
          </p>

          <div className="mt-9 grid gap-5">
            {capabilities.map((item) => (
              <div key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/20">
                  <item.icon className="size-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-blue-100">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[12px] text-blue-200">
          <ShieldCheck className="size-4" />
          Role-based access · buyer data isolation · immutable date audit
        </div>
      </section>

      <section className="flex flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
            <h2 className="text-[22px] font-semibold tracking-tight text-ink">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted">
              Sign in with your Company A account to continue.
            </p>
            <div className="mt-6">
              <LoginForm next={next} demoAccounts={demoAccounts} />
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted">
            Access is restricted to authorised Company A staff and buyers. Sessions expire after
            seven days.
          </p>
        </div>
      </section>
    </main>
  );
}
