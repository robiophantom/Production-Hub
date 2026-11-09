import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HealthBadge } from "@/components/ui/badge";
import { ProgressWithLabel } from "@/components/ui/progress";
import { Table, TableWrap, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate, formatNumber } from "@/lib/utils";
import type { OrderSummary } from "@/types";
import { ClipboardList } from "lucide-react";

export function OrderTable({
  items,
  showMerchandiser = false,
  emptyAction,
}: {
  items: OrderSummary[];
  showMerchandiser?: boolean;
  emptyAction?: React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No purchase orders match these filters"
        description="Adjust the search, dates or health filter to see more orders."
        action={emptyAction}
      />
    );
  }

  return (
    <>
      <TableWrap className="hidden lg:block">
        <Table className="min-w-[980px]">
          <THead>
            <TR>
              <TH>Purchase order</TH>
              <TH>Buyer</TH>
              <TH>Unit</TH>
              {showMerchandiser ? <TH>Merchandiser</TH> : null}
              <TH className="text-right">Ordered</TH>
              <TH className="text-right">Produced</TH>
              <TH>Current stage</TH>
              <TH>Ex-factory</TH>
              <TH>Health</TH>
              <TH className="w-10" />
            </TR>
          </THead>
          <TBody>
            {items.map((summary) => (
              <TR key={summary.order.id} className="group hover:bg-slate-50/70">
                <TD>
                  <Link href={`/orders/${summary.order.id}`} className="block min-w-0">
                    <span className="block text-[13px] font-semibold text-ink group-hover:text-brand">
                      {summary.order.po_number}
                    </span>
                    <span className="mt-0.5 block max-w-[220px] truncate text-[11px] text-muted">
                      {summary.order.style_name}
                    </span>
                  </Link>
                </TD>
                <TD>
                  <span className="block text-[13px] text-ink">{summary.buyer.name}</span>
                  <span className="text-[11px] text-muted">{summary.buyer.code}</span>
                </TD>
                <TD>
                  <span className="block max-w-[150px] truncate text-[12px] text-slate-600">
                    {summary.unit?.name ?? "Unassigned"}
                  </span>
                </TD>
                {showMerchandiser ? (
                  <TD>
                    <span className="block max-w-[140px] truncate text-[12px] text-slate-600">
                      {summary.merchandiser?.full_name ?? "—"}
                    </span>
                  </TD>
                ) : null}
                <TD className="text-right">
                  <span className="text-[13px] font-medium tabular-nums text-ink">
                    {formatNumber(summary.order.total_quantity)}
                  </span>
                </TD>
                <TD className="text-right">
                  <span className="text-[13px] tabular-nums text-slate-600">
                    {formatNumber(summary.producedQuantity)}
                  </span>
                </TD>
                <TD>
                  <p className="mb-1 text-[12px] font-medium text-ink">{summary.currentStage}</p>
                  <ProgressWithLabel
                    value={summary.currentStageProgress}
                    className="min-w-[100px] max-w-[140px]"
                  />
                </TD>
                <TD>
                  <span className="whitespace-nowrap text-[12px] font-medium text-ink">
                    {formatDate(summary.order.ex_factory_date)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {summary.health.daysRemaining} working day(s)
                  </span>
                </TD>
                <TD>
                  <HealthBadge health={summary.health.health} />
                  {summary.openIssues > 0 ? (
                    <span className="mt-1 block text-[10px] font-medium text-amber-600">
                      {summary.openIssues} open issue(s)
                    </span>
                  ) : null}
                </TD>
                <TD>
                  <Link
                    href={`/orders/${summary.order.id}`}
                    className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-brand-soft hover:text-brand"
                    aria-label={`Open ${summary.order.po_number}`}
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>

      <ul className="space-y-3 lg:hidden">
        {items.map((summary) => (
          <li key={summary.order.id}>
            <Link
              href={`/orders/${summary.order.id}`}
              className="block rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{summary.order.po_number}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">{summary.order.style_name}</p>
                </div>
                <HealthBadge health={summary.health.health} />
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                <div>
                  <dt className="text-muted">Buyer</dt>
                  <dd className="mt-0.5 truncate font-medium text-ink">{summary.buyer.name}</dd>
                </div>
                <div>
                  <dt className="text-muted">Unit</dt>
                  <dd className="mt-0.5 truncate font-medium text-ink">
                    {summary.unit?.name ?? "Unassigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Ordered / produced</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-ink">
                    {formatNumber(summary.order.total_quantity)} /{" "}
                    {formatNumber(summary.producedQuantity)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Ex-factory</dt>
                  <dd className="mt-0.5 font-medium text-ink">
                    {formatDate(summary.order.ex_factory_date)}
                  </dd>
                </div>
              </dl>

              <div className="mt-3">
                <ProgressWithLabel value={summary.currentStageProgress} label={summary.currentStage} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
