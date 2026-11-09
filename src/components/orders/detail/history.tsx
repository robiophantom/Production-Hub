import { History, LockKeyhole } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Table, TableWrap, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import type { OrderDetail } from "@/lib/services/orders";

function actionLabel(action: string): string {
  return action
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function HistoryTab({ detail }: { detail: OrderDetail }) {
  const milestones = new Map(detail.milestones.map((item) => [item.milestone.id, item]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Date change history</CardTitle>
          <CardDescription>
            Every planned-date change is permanent. The previous date, new date, reason and author are
            retained for the life of the order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.dateHistory.length === 0 ? (
            <EmptyState
              icon={History}
              title="No date changes recorded"
              description="Planned-date changes will appear here with their mandatory reason."
              className="border-0 bg-transparent"
            />
          ) : (
            <TableWrap>
              <Table className="min-w-[820px]">
                <THead>
                  <TR>
                    <TH>Changed at</TH>
                    <TH>Field</TH>
                    <TH>Milestone</TH>
                    <TH>Previous</TH>
                    <TH>New</TH>
                    <TH>Reason</TH>
                    <TH>Changed by</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.dateHistory.map((entry) => (
                    <TR key={entry.id}>
                      <TD className="whitespace-nowrap text-[12px] text-slate-600">
                        {formatDateTime(entry.changed_at)}
                      </TD>
                      <TD className="text-[12px] text-slate-600">
                        {titleCase(entry.field_name.replaceAll("_", " "))}
                      </TD>
                      <TD className="text-[12px] text-slate-600">
                        {entry.milestone_id
                          ? (milestones.get(entry.milestone_id)?.stage.name ?? "Removed stage")
                          : "Order"}
                      </TD>
                      <TD className="whitespace-nowrap text-[12px] text-slate-500">
                        {formatDate(entry.previous_date)}
                      </TD>
                      <TD className="whitespace-nowrap text-[12px] font-medium text-ink">
                        {formatDate(entry.new_date)}
                      </TD>
                      <TD className="max-w-[260px] text-[12px] leading-relaxed text-slate-600">
                        {entry.reason}
                      </TD>
                      <TD className="text-[12px] text-slate-600">
                        {entry.changed_by_name ?? "System"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>
              A chronological record of writes to this order. Audit entries cannot be edited or deleted
              by ordinary users.
            </CardDescription>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
            <LockKeyhole className="size-3.5" /> Immutable
          </span>
        </CardHeader>
        <CardContent>
          {detail.auditLogs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No audit entries yet"
              description="Order activity will be recorded here as changes are made."
              className="border-0 bg-transparent"
            />
          ) : (
            <TableWrap>
              <Table className="min-w-[760px]">
                <THead>
                  <TR>
                    <TH>When</TH>
                    <TH>Action</TH>
                    <TH>Entity</TH>
                    <TH>Actor</TH>
                    <TH>Detail</TH>
                  </TR>
                </THead>
                <TBody>
                  {detail.auditLogs.map((entry) => (
                    <TR key={entry.id}>
                      <TD className="whitespace-nowrap text-[12px] text-slate-600">
                        {formatDateTime(entry.created_at)}
                      </TD>
                      <TD className="text-[12px] font-medium text-ink">
                        {actionLabel(entry.action)}
                      </TD>
                      <TD className="text-[12px] text-slate-600">
                        {titleCase(entry.entity_type.replaceAll("_", " "))}
                      </TD>
                      <TD className="text-[12px] text-slate-600">
                        {entry.actor_name ?? "System"}
                      </TD>
                      <TD className="max-w-[320px]">
                        {entry.detail ? (
                          <details className="text-[11px] text-slate-500">
                            <summary className="cursor-pointer select-none text-brand hover:underline">
                              View detail
                            </summary>
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-[10px] leading-relaxed text-slate-600">
                              {JSON.stringify(entry.detail, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
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
