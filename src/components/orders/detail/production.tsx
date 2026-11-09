import { HealthBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableWrap, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/utils";
import type { OrderDetail } from "@/lib/services/orders";

export function ProductionTab({ detail }: { detail: OrderDetail }) {
  const active = detail.milestones.filter((item) => item.milestone.is_active);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Ordered pieces",
            value: formatNumber(detail.order.total_quantity),
            hint: `${detail.variants.length} variants`,
          },
          {
            label: "Produced at current stage",
            value: formatNumber(detail.producedQuantity),
            hint: detail.currentStage,
          },
          {
            label: "Active milestones",
            value: String(active.length),
            hint: `${active.filter((item) => item.calculation.isComplete).length} complete`,
          },
          {
            label: "Reported updates",
            value: String(detail.updates.length),
            hint: `${detail.updates.filter((update) => update.source === "offline").length} synced offline`,
          },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-[12px] text-muted">{item.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{item.value}</p>
            <p className="mt-1 text-[11px] text-muted">{item.hint}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stage-by-stage production</CardTitle>
          <CardDescription>
            Cumulative output is calculated from every submitted daily update. Actual daily output uses
            the last seven scheduled working days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrap>
            <Table className="min-w-[980px]">
              <THead>
                <TR>
                  <TH className="w-10">#</TH>
                  <TH>Stage</TH>
                  <TH>Planned date</TH>
                  <TH className="text-right">Target</TH>
                  <TH className="text-right">Produced</TH>
                  <TH className="text-right">Remaining</TH>
                  <TH>Progress</TH>
                  <TH className="text-right">Required / day</TH>
                  <TH className="text-right">Actual / day</TH>
                  <TH>Projected</TH>
                  <TH>Health</TH>
                </TR>
              </THead>
              <TBody>
                {active.map((item) => {
                  const calc = item.calculation;
                  return (
                    <TR key={item.milestone.id} className="hover:bg-slate-50/60">
                      <TD className="text-[11px] text-muted">{item.stage.sequence}</TD>
                      <TD>
                        <p className="text-[13px] font-medium text-ink">{item.stage.name}</p>
                        <p className="text-[11px] text-muted">
                          {item.unit?.name ?? "No unit"}
                          {item.subcontractor ? ` · ${item.subcontractor.name}` : ""}
                        </p>
                      </TD>
                      <TD className="whitespace-nowrap text-[12px] text-slate-600">
                        {formatDate(item.milestone.planned_date)}
                      </TD>
                      <TD className="text-right tabular-nums text-slate-600">
                        {formatNumber(item.milestone.target_quantity)}
                      </TD>
                      <TD className="text-right font-medium tabular-nums text-ink">
                        {formatNumber(item.cumulative)}
                      </TD>
                      <TD className="text-right tabular-nums text-slate-600">
                        {formatNumber(item.remaining)}
                      </TD>
                      <TD className="min-w-[120px]">
                        <Progress value={item.progress} height="h-1.5" />
                        <p className="mt-1 text-[10px] tabular-nums text-muted">
                          {item.progress.toFixed(0)}%
                        </p>
                      </TD>
                      <TD className="text-right tabular-nums text-slate-600">
                        {calc.requiredDaily.toFixed(1)}
                      </TD>
                      <TD
                        className={
                          calc.actualDaily < calc.requiredDaily
                            ? "text-right font-medium tabular-nums text-amber-700"
                            : "text-right tabular-nums text-slate-600"
                        }
                      >
                        {calc.actualDaily.toFixed(1)}
                      </TD>
                      <TD className="whitespace-nowrap text-[12px] text-slate-600">
                        {formatDate(calc.projectedCompletionDate)}
                      </TD>
                      <TD>
                        <HealthBadge health={calc.health} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>
    </div>
  );
}
