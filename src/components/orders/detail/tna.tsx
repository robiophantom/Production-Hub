import { CalendarClock, ListTree } from "lucide-react";
import { Badge, HealthBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { Table, TableWrap, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import { getOrderFormOptions } from "@/lib/services/orders";
import type { OrderDetail } from "@/lib/services/orders";
import { formatDate, formatNumber } from "@/lib/utils";
import {
  AddMilestoneDialog,
  EditMilestoneDialog,
  MoveMilestoneButton,
} from "./milestone-dialogs";

export async function TnaTab({ detail }: { detail: OrderDetail }) {
  const options = await getOrderFormOptions();
  const usedStageIds = new Set(detail.milestones.map((item) => item.milestone.stage_id));
  const availableStages = options.stages
    .filter((stage) => !usedStageIds.has(stage.id))
    .map((stage) => ({ id: stage.id, name: stage.name, sequence: stage.sequence }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Time and action plan</CardTitle>
            <CardDescription>
              Milestones are evaluated in sequence. The most critical active milestone drives the
              order health shown at the top of this page.
            </CardDescription>
          </div>
          {detail.canEdit ? (
            <AddMilestoneDialog
              poId={detail.order.id}
              stages={availableStages}
              units={options.units}
              supervisors={options.supervisors}
              subcontractors={options.subcontractors}
            />
          ) : null}
        </CardHeader>
        <CardContent>
          {detail.milestones.length === 0 ? (
            <EmptyState
              icon={ListTree}
              title="No TNA milestones"
              description="Add production stages to build the time and action plan for this order."
              className="border-0 bg-transparent"
            />
          ) : (
            <TableWrap>
              <Table className="min-w-[1080px]">
                <THead>
                  <TR>
                    <TH className="w-12">Order</TH>
                    <TH>Stage</TH>
                    <TH>Planned date</TH>
                    <TH className="text-right">Target</TH>
                    <TH className="text-right">Produced</TH>
                    <TH className="text-right">Remaining</TH>
                    <TH>Progress</TH>
                    <TH>Assignment</TH>
                    <TH>Health</TH>
                    {detail.canEdit ? <TH className="text-right">Actions</TH> : null}
                  </TR>
                </THead>
                <TBody>
                  {detail.milestones.map((item, index) => {
                    const calc = item.calculation;
                    const isUpDisabled = index === 0;
                    const isDownDisabled = index === detail.milestones.length - 1;

                    return (
                      <TR
                        key={item.milestone.id}
                        className={item.milestone.is_active ? undefined : "bg-slate-50/60 text-slate-400"}
                      >
                        <TD className="tabular-nums text-[11px] text-muted">
                          {item.milestone.sequence}
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                item.milestone.is_active
                                  ? "text-[13px] font-medium text-ink"
                                  : "text-[13px] font-medium text-slate-400"
                              }
                            >
                              {item.stage.name}
                            </span>
                            {item.milestone.is_active ? null : (
                              <Badge variant="neutral">Excluded</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted">
                            {item.subcontractor ? item.subcontractor.name : "In-house"}
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
                        <TD>
                          <p className="text-[12px] text-slate-600">
                            {item.unit?.name ?? "No unit"}
                          </p>
                          <p className="text-[11px] text-muted">
                            {item.supervisor?.full_name ?? "No supervisor"}
                          </p>
                        </TD>
                        <TD>
                          {item.milestone.is_active ? (
                            <div className="space-y-1">
                              <HealthBadge health={calc.health} />
                              <div>
                                <StatusBadge status={item.milestone.status} />
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline">Ignored</Badge>
                          )}
                        </TD>
                        {detail.canEdit ? (
                          <TD>
                            <div className="flex items-center justify-end gap-0.5">
                              <MoveMilestoneButton
                                poId={detail.order.id}
                                milestoneId={item.milestone.id}
                                direction="up"
                                disabled={isUpDisabled}
                                stageName={item.stage.name}
                              />
                              <MoveMilestoneButton
                                poId={detail.order.id}
                                milestoneId={item.milestone.id}
                                direction="down"
                                disabled={isDownDisabled}
                                stageName={item.stage.name}
                              />
                              <EditMilestoneDialog
                                poId={detail.order.id}
                                milestone={{
                                  id: item.milestone.id,
                                  stageName: item.stage.name,
                                  plannedDate: item.milestone.planned_date,
                                  targetQuantity: item.milestone.target_quantity,
                                  isActive: item.milestone.is_active,
                                  notes: item.milestone.notes,
                                  unitId: item.unit?.id ?? "",
                                  supervisorId: item.supervisor?.id ?? "",
                                  subcontractorId: item.subcontractor?.id ?? "",
                                }}
                                units={options.units}
                                supervisors={options.supervisors}
                                subcontractors={options.subcontractors}
                              />
                            </div>
                          </TD>
                        ) : null}
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sequencing rules</CardTitle>
          <CardDescription>How milestones feed the delay engine.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-[13px] leading-relaxed text-slate-600 sm:grid-cols-3">
          <div className="flex gap-2.5">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand" />
            <p>
              Working days are Monday to Saturday. Sundays are excluded unless the calendar setting
              changes the configured working week.
            </p>
          </div>
          <div className="flex gap-2.5">
            <ListTree className="mt-0.5 size-4 shrink-0 text-brand" />
            <p>
              Quantity is cumulative across every daily update before the planned date. Missing update
              days count as zero in the rolling seven-day actual rate.
            </p>
          </div>
          <div className="flex gap-2.5">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand" />
            <p>
              A planned-date change requires a reason and is written to the immutable date-change
              history and the audit log.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
