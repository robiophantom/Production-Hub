import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Download, FileSpreadsheet, FileText, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoNote } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { requireRoles } from "@/lib/auth/session";
import {
  buildReport,
  isReportType,
  resolveReportRange,
  REPORT_TYPES,
  type ReportType,
} from "@/lib/reports/core";
import { getAppConfig } from "@/lib/services/settings";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const REPORT_META: Record<ReportType, { label: string; description: string }> = {
  production: {
    label: "Production",
    description: "Every daily production submission in the selected period, including offline-synced entries.",
  },
  orders: {
    label: "Orders",
    description: "Live purchase order status, current stage, progress, health and open issues.",
  },
  delays: {
    label: "Delays",
    description: "Active delay alerts with the deterministic calculation behind each warning window.",
  },
  buyers: {
    label: "Buyers",
    description: "Ordered and produced quantities, delay exposure and on-time percentage per buyer.",
  },
};

function readType(value: string | string[] | undefined): ReportType {
  const raw = Array.isArray(value) ? value[0] : value;
  return isReportType(raw) ? raw : "production";
}

function readDate(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRoles("super_admin", "managing_director", "merchandiser");
  const query = await searchParams;
  const type = readType(query.type);
  const from = readDate(query.from);
  const to = readDate(query.to);

  const config = await getAppConfig();
  const range = resolveReportRange(config.businessDate, from, to);
  const report = await buildReport(user, type, range);

  const queryString = (nextType: ReportType) =>
    `?type=${nextType}&from=${range.from}&to=${range.to}`;
  const downloadHref = (format: "xlsx" | "pdf") =>
    `/api/reports/${type}?format=${format}&from=${range.from}&to=${range.to}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management reporting"
        title="Reports"
        description="Excel and PDF exports generated from the same scoped data as the portal. Every export respects your role: merchandisers only see their own orders, while Super Admin and Managing Director see all orders."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={downloadHref("xlsx")}>
                <FileSpreadsheet /> Excel
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={downloadHref("pdf")}>
                <FileText /> PDF
              </a>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Reporting period</CardTitle>
          <CardDescription>
            Business date {formatDate(config.businessDate)} · {config.calendar.label ?? "Working-day"}{" "}
            calendar. Ranges are capped at 365 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/reports" method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="type" value={type} />
            <div className="w-full sm:w-44">
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={range.from} max={range.to} />
            </div>
            <div className="w-full sm:w-44">
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={range.to} min={range.from} />
            </div>
            <Button type="submit" variant="primary" size="md">
              <CalendarRange /> Apply period
            </Button>
            <Button asChild variant="ghost" size="md">
              <a href={`/reports?type=${type}`}>Reset to last 30 days</a>
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 border-b border-line pb-1 lg:flex-row lg:items-center lg:justify-between">
        <nav className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto">
          {REPORT_TYPES.map((item) => {
            const active = item === type;
            return (
              <Link
                key={item}
                href={`/reports${queryString(item)}`}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "relative whitespace-nowrap rounded-t-md px-3 py-2.5 text-[13px] font-semibold text-brand after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand"
                    : "whitespace-nowrap rounded-t-md px-3 py-2.5 text-[13px] font-medium text-muted hover:text-ink"
                }
              >
                {REPORT_META[item].label}
              </Link>
            );
          })}
        </nav>
        <p className="text-[11px] text-muted">
          {range.from} → {range.to}
        </p>
      </div>

      <InfoNote variant="info" title={REPORT_META[type].label}>
        {REPORT_META[type].description} Only approved buyer-facing content is ever included in buyer
        reports; internal delay calculations and factory issues stay internal.
      </InfoNote>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{report.title}</CardTitle>
            <CardDescription className="mt-1 break-words">{report.subtitle}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={downloadHref("xlsx")} download>
                <FileSpreadsheet /> Excel
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={downloadHref("pdf")} download>
                <FileText /> PDF
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {report.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <ScrollText className="size-8 text-slate-300" />
              <p className="text-sm font-semibold text-ink">Nothing to report for this period</p>
              <p className="max-w-md text-[13px] text-muted">
                Adjust the reporting period or check back after the next production submissions.
              </p>
            </div>
          ) : (
            <div className="scrollbar-thin max-h-[36rem] overflow-auto rounded-b-[var(--radius-card)] border-t border-line">
              <table className="w-full min-w-[54rem] border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    {report.columns.map((column) => (
                      <th
                        key={column.header}
                        scope="col"
                        className={
                          column.align === "right"
                            ? "whitespace-nowrap border-b border-line px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                            : "whitespace-nowrap border-b border-line px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                        }
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60">
                      {report.columns.map((column, columnIndex) => (
                        <td
                          key={column.header}
                          className={
                            column.align === "right"
                              ? "whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700"
                              : "whitespace-nowrap px-3 py-2 text-slate-700"
                          }
                        >
                          {row[columnIndex] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <Download className="size-3.5" />
        Exports are generated server-side as branded A4 landscape PDFs or formatted Excel workbooks.
        The preview above and the downloads are built from the same scoped query result.
      </p>
    </div>
  );
}
