import { Activity, Calculator, ShieldAlert } from "lucide-react";
import { HealthBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { Table, TableWrap, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import { ALERT_WINDOW_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import type { OrderDetail } from "@/lib/services/orders";

export function DelayTab({ detail }: { detail: OrderDetail }) {
  const active = detail.milestones.filter((item) => item.milestone.is_active);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Order health</CardTitle>
          <CardDescription>
            Overall health is the most critical active milestone, combined with the ex-factory deadline.
            AI is never used to determine delays.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <HealthBadge health={detail.health.health} />
            <span className="text-[13px] text-slate-600">{detail.health.basis}</span>
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Critical stage", value: detail.health.criticalStage },
              { label: "Critical planned date", value: formatDate(detail.health.plannedDate) },
              { label: "Projected completion", value: formatDate(detail.health.projectedDate) },
              { label: "Working days left", value: String(detail.health.daysRemaining) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-line bg-slate-50/60 p-3">
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</dt>
                <dd className="mt-0.5 text-[13px] font-medium text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {active.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardContent>
              <EmptyState
                icon={Calculator}
                title="No active milestones"
                description="Add active TNA milestones so the delay engine can calculate order risk."
                className="border-0 bg-transparent"
              />
            </CardContent>
          </Card>
        ) : (
          active.map((item) => {
            const calc = item.calculation;
            return (
              <Card key={item.milestone.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>{item.stage.name}</CardTitle>
                    <CardDescription>
                      Planned {formatDate(item.milestone.planned_date)} ·{" "}
                      {formatNumber(item.milestone.target_quantity)} pcs target
                    </CardDescription>
                  </div>
                  <HealthBadge health={calc.health} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
                    <Metric label="Produced" value={`${formatNumber(calc.cumulativeQuantity)} pcs`} />
                    <Metric label="Remaining" value={`${formatNumber(calc.remainingQuantity)} pcs`} />
                    <Metric label="Required / day" value={calc.requiredDaily.toFixed(1)} />
                    <Metric
                      label="Actual / day"
                      value={calc.actualDaily.toFixed(1)}
                      tone={calc.actualDaily < calc.requiredDaily ? "warn" : undefined}
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                      <span>Stage progress</span>
                      <span className="tabular-nums">{item.progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={item.progress} height="h-1.5" />
                  </div>

                  <div className="rounded-lg border border-line bg-slate-50/70 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Calculator className="size-3.5" /> Transparent calculation
                    </p>
                    <ul className="space-y-1 text-[12px] leading-relaxed text-slate-600">
                      {calc.formula.map((line, index) => (
                        <li key={index} className="tabular-nums">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <Activity className="size-3.5" />
                      {calc.dataDays} update day(s) in the rolling window
                      {calc.hasSufficientData ? "" : " · insufficient data warning"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="size-3.5" />
                      {ALERT_WINDOW_LABELS[calc.warningWindow]}
                    </span>
                  </div>

                  {calc.isComplete ? (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
                      Stage quantity complete.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recorded delay alerts</CardTitle>
          <CardDescription>
            Alerts are generated by the server-side delay engine and require merchandiser confirmation
            before any buyer-facing message can be approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.alerts.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted">
              No delay alerts have been recorded for this order.
            </p>
          ) : (
            <TableWrap>
              <Table className="min-w-[900px]">
                <THead>
                  <TR>
                    <TH>Stage</TH>
                    <TH>Risk</TH>
                    <TH>Window</TH>
                    <TH className="text-right">Remaining</TH>
                    <TH className="text-right">Required / day</TH>
                    <TH className="text-right">Actual / day</TH>
                    <TH>Projected</TH>
                    <TH>Status</TH>
                    <TH>Reviewed</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.alerts.map((alert) => (
                    <TR key={alert.id}>
                      <TD className="text-[13px] font-medium text-ink">{alert.stage_name}</TD>
                      <TD>
                        <HealthBadge health={alert.risk_level} />
                      </TD>
                      <TD className="text-[12px] text-slate-600">
                        {ALERT_WINDOW_LABELS[alert.warning_window]}
                      </TD>
                      <TD className="text-right tabular-nums text-slate-600">
                        {formatNumber(alert.remaining_qty)}
                      </TD>
                      <TD className="text-right tabular-nums text-slate-600">
                        {Number(alert.required_daily).toFixed(1)}
                      </TD>
                      <TD className="text-right tabular-nums text-slate-600">
                        {Number(alert.actual_daily).toFixed(1)}
                      </TD>
                      <TD className="whitespace-nowrap text-[12px] text-slate-600">
                        {formatDate(alert.projected_completion_date)}
                      </TD>
                      <TD>
                        <StatusBadge status={alert.status} />
                      </TD>
                      <TD className="text-[11px] text-muted">
                        {alert.confirmed_by_name
                          ? `${alert.confirmed_by_name} · ${formatDateTime(alert.confirmed_at)}`
                          : "Not reviewed"}
                        {alert.dismiss_reason ? (
                          <span className="mt-0.5 block text-slate-500">
                            Reason: {alert.dismiss_reason}
                          </span>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={
          tone === "warn"
            ? "mt-0.5 font-semibold tabular-nums text-amber-700"
            : "mt-0.5 font-semibold tabular-nums text-ink"
        }
      >
        {value}
      </p>
    </div>
  );
}
