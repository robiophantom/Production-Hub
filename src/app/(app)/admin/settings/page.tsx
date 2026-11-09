import type { Metadata } from "next";
import { Bot, CalendarDays, Cloud, Database, Server, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { InlineForm } from "@/components/admin/inline-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoNote } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { requireRoles } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { env, supabaseAuthEnabled } from "@/lib/env";
import { getAppConfig } from "@/lib/services/settings";
import { saveSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Settings" };

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default async function AdminSettingsPage() {
  await requireRoles("super_admin");
  const [config, db, appEnv] = await Promise.all([getAppConfig(), getDb(), Promise.resolve(env())]);

  const integrations = [
    {
      icon: Database,
      label: "Database",
      value:
        db.mode === "embedded"
          ? "Embedded PostgreSQL (PGlite) — local development"
          : "Hosted PostgreSQL — RLS enforced",
      tone: db.mode === "embedded" ? "neutral" : "success",
    },
    {
      icon: ShieldCheck,
      label: "Supabase Auth",
      value: supabaseAuthEnabled()
        ? "Configured — passwords verified by Supabase, local fallback available"
        : "Local credential store (profiles + bcrypt)",
      tone: supabaseAuthEnabled() ? "success" : "neutral",
    },
    {
      icon: Bot,
      label: "AI issue classification",
      value: appEnv.ai.enabled ? "Configured — server-side only, never blocks updates" : "Heuristic fallback only",
      tone: appEnv.ai.enabled ? "success" : "neutral",
    },
    {
      icon: Cloud,
      label: "Cloudinary",
      value: appEnv.cloudinary.enabled ? "Configured for photo storage" : "Local file storage",
      tone: appEnv.cloudinary.enabled ? "success" : "neutral",
    },
    {
      icon: CalendarDays,
      label: "Business clock",
      value: `${config.timezone} · today ${config.businessDate}`,
      tone: "neutral",
    },
    {
      icon: Server,
      label: "Application URL",
      value: appEnv.appUrl,
      tone: "neutral",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Tune the working-week calendar and the deterministic delay engine. Changes apply to every dashboard, alert scan and report immediately."
      />

      <InfoNote variant="warning" title="These values change every health calculation">
        The delay engine is deterministic and never uses AI. After saving, run a delay scan on the
        alerts page to apply new warning windows to open alerts.
      </InfoNote>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {integrations.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <item.icon className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[12px] font-semibold text-ink">{item.label}</p>
                  <Badge variant={item.tone}>{item.tone === "success" ? "Live" : "Built-in"}</Badge>
                </div>
                <p className="mt-1 break-words text-[12px] leading-relaxed text-muted">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Working calendar & delay engine</CardTitle>
            <CardDescription>
              Working days exclude the selected non-working weekdays. Dates are business dates in{" "}
              {config.timezone}; all timestamps are stored in UTC.
            </CardDescription>
          </div>
          <SlidersHorizontal className="size-5 text-slate-400" />
        </CardHeader>
        <CardContent>
          <InlineForm action={saveSettingsAction} submitLabel="Save settings" resetOnSuccess={false}>
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-[13px] font-medium text-slate-700">
                  Non-working days
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WEEKDAYS.map((day) => (
                    <label
                      key={day.value}
                      className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] text-slate-700"
                    >
                      <input
                        type="checkbox"
                        name="excludedWeekdays"
                        value={day.value}
                        defaultChecked={config.calendar.excludedWeekdays.includes(day.value)}
                        className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Current calendar: {config.calendar.label ?? "Custom"} · at least one working day is
                  required.
                </p>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-slate-700">Output & health thresholds</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field
                    label="Healthy buffer (working days)"
                    htmlFor="healthy-buffer"
                    hint="Green requires more buffer than this."
                  >
                    <Input
                      id="healthy-buffer"
                      name="healthyBufferWorkingDays"
                      type="number"
                      min={0}
                      max={30}
                      defaultValue={config.risk.healthyBufferWorkingDays}
                      required
                    />
                  </Field>
                  <Field
                    label="Insufficient-data threshold"
                    htmlFor="insufficient-data"
                    hint="Reported days needed before health is trustworthy."
                  >
                    <Input
                      id="insufficient-data"
                      name="insufficientDataDays"
                      type="number"
                      min={1}
                      max={14}
                      defaultValue={config.risk.insufficientDataDays}
                      required
                    />
                  </Field>
                  <Field
                    label="Rolling history window"
                    htmlFor="history-window"
                    hint="Scheduled working days in the actual-daily average."
                  >
                    <Input
                      id="history-window"
                      name="historyWindowDays"
                      type="number"
                      min={1}
                      max={30}
                      defaultValue={config.risk.historyWindowDays}
                      required
                    />
                  </Field>
                  <Field
                    label="Amber rate tolerance (%)"
                    htmlFor="amber-tolerance"
                    hint="Actual daily may lag the required rate by this much."
                  >
                    <Input
                      id="amber-tolerance"
                      name="amberRateTolerancePercent"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={config.risk.amberRateTolerancePercent}
                      required
                    />
                  </Field>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-slate-700">Warning windows</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="14-day review" htmlFor="alert-review" hint="Days before planned date">
                    <Input
                      id="alert-review"
                      name="alertReviewDays"
                      type="number"
                      min={1}
                      max={90}
                      defaultValue={config.risk.alertReviewDays}
                      required
                    />
                  </Field>
                  <Field label="7-day escalation" htmlFor="alert-escalation" hint="Days before planned date">
                    <Input
                      id="alert-escalation"
                      name="escalationDays"
                      type="number"
                      min={1}
                      max={90}
                      defaultValue={config.risk.escalationDays}
                      required
                    />
                  </Field>
                  <Field label="3-day critical" htmlFor="alert-critical" hint="Days before planned date">
                    <Input
                      id="alert-critical"
                      name="criticalDays"
                      type="number"
                      min={1}
                      max={90}
                      defaultValue={config.risk.criticalDays}
                      required
                    />
                  </Field>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Windows must narrow: 3-day &lt; 7-day &lt; 14-day review.
                </p>
              </div>

              <div className="max-w-xs">
                <Field
                  label="Default language"
                  htmlFor="default-language"
                  hint="Used for supervisor issue capture; Tamil text is always accepted."
                >
                  <Select
                    id="default-language"
                    name="language"
                    defaultValue={config.defaults.language}
                  >
                    <option value="en">English</option>
                    <option value="ta">Tamil</option>
                  </Select>
                </Field>
              </div>
            </div>
          </InlineForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How the delay engine decides health</CardTitle>
          <CardDescription>
            The same formula is shown on every order and alert, with the numbers filled in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-[13px] leading-relaxed text-slate-600">
            <li>
              <span className="font-medium text-ink">1. Remaining</span> = max(0, stage target −
              cumulative approved updates up to today).
            </li>
            <li>
              <span className="font-medium text-ink">2. Required daily</span> = remaining ÷ scheduled
              working days left before the planned date.
            </li>
            <li>
              <span className="font-medium text-ink">3. Actual daily</span> = output over the last{" "}
              {config.risk.historyWindowDays} scheduled working days ÷ those days. Missing reports
              count as zero.
            </li>
            <li>
              <span className="font-medium text-ink">4. Projection</span> = ⌈remaining ÷ actual daily⌉
              working days; compare the projected completion with the planned date.
            </li>
            <li>
              <span className="font-medium text-ink">5. Health</span> = red if overdue, unstarted or
              projected late; amber inside the {config.risk.healthyBufferWorkingDays}-working-day
              buffer, with insufficient history, or beyond rate tolerance; otherwise green. Orders take
              the most critical active milestone, then the ex-factory deadline.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
