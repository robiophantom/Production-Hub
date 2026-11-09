import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isInternalRole } from "@/lib/services/access";
import { buildReport, isReportType } from "@/lib/reports/core";
import { reportToExcel, reportToPdf } from "@/lib/reports/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to download reports." }, { status: 401 });
  }
  if (!isInternalRole(user.role)) {
    return NextResponse.json({ error: "Reports are available to internal team members only." }, { status: 403 });
  }

  const { type } = await params;
  if (!isReportType(type)) {
    return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "xlsx";
  if (format !== "xlsx" && format !== "pdf") {
    return NextResponse.json({ error: "Supported formats are xlsx and pdf." }, { status: 400 });
  }
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  const report = await buildReport(user, type, { from, to });
  const bytes =
    format === "pdf" ? await reportToPdf(report) : await reportToExcel(report);

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${report.fileBase}.${format}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
