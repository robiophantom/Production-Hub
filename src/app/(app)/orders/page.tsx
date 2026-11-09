import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Filter, Plus, RotateCcw, Search } from "lucide-react";
import { OrderTable } from "@/components/orders/order-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireRoles } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { listOrderSummaries, type OrderFilters } from "@/lib/services/order-summaries";
import type { Buyer, ProductionStage, ProductionUnit } from "@/types";

export const metadata: Metadata = { title: "Purchase orders" };

function value(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRoles("super_admin", "managing_director", "merchandiser");
  const params = await searchParams;
  const page = Math.max(1, Number(value(params.page)) || 1);

  const filters: OrderFilters = {
    search: value(params.q) || undefined,
    buyerId: value(params.buyer) || undefined,
    unitId: value(params.unit) || undefined,
    stageId: value(params.stage) || undefined,
    status: value(params.status) || undefined,
    health: value(params.health) || undefined,
    priority: value(params.priority) || undefined,
    dateFrom: value(params.from) || undefined,
    dateTo: value(params.to) || undefined,
    sort: value(params.sort) || undefined,
  };

  const [result, buyers, units, stages] = await Promise.all([
    listOrderSummaries(user, filters, page, 12),
    sql<Buyer>("select * from buyers where is_active = true order by name"),
    sql<ProductionUnit>("select * from production_units where is_active = true order by name"),
    sql<ProductionStage>("select * from production_stages where is_active = true order by sequence"),
  ]);

  const canCreate = user.role === "super_admin" || user.role === "merchandiser";
  const hasFilters = Object.values(filters).some(Boolean) && filters.sort === undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Order management"
        title="Purchase orders"
        description="Search, filter and manage the full order book. Order health is calculated from live stage output against each TNA milestone."
        actions={
          canCreate ? (
            <Button asChild size="sm">
              <Link href="/orders/new">
                <Plus /> New purchase order
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card className="p-4">
        <form method="get" className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={filters.search}
                  placeholder="PO number, style, buyer reference or buyer"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="buyer">Buyer</Label>
              <Select id="buyer" name="buyer" defaultValue={filters.buyerId ?? ""}>
                <option value="">All buyers</option>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select id="unit" name="unit" defaultValue={filters.unitId ?? ""}>
                <option value="">All units</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="stage">Stage</Label>
              <Select id="stage" name="stage" defaultValue={filters.stageId ?? ""}>
                <option value="">Any stage</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="health">Health</Label>
              <Select id="health" name="health" defaultValue={filters.health ?? ""}>
                <option value="">All health</option>
                <option value="green">On track</option>
                <option value="amber">At risk</option>
                <option value="red">Delayed</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={filters.status ?? ""}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue={filters.priority ?? ""}>
                <option value="">All priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="from">Ex-factory from</Label>
              <Input id="from" name="from" type="date" defaultValue={filters.dateFrom} />
            </div>
            <div>
              <Label htmlFor="to">Ex-factory to</Label>
              <Input id="to" name="to" type="date" defaultValue={filters.dateTo} />
            </div>
            <div>
              <Label htmlFor="sort">Sort by</Label>
              <Select id="sort" name="sort" defaultValue={filters.sort ?? "ex_factory_asc"}>
                <option value="ex_factory_asc">Ex-factory (earliest)</option>
                <option value="ex_factory_desc">Ex-factory (latest)</option>
                <option value="health">Most at risk first</option>
                <option value="po_number">PO number</option>
                <option value="quantity_desc">Quantity (largest)</option>
                <option value="progress_desc">Progress (highest)</option>
                <option value="buyer">Buyer name</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">
              <Filter /> Apply filters
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders">
                <RotateCcw /> Reset
              </Link>
            </Button>
            <span className="ml-auto text-xs text-muted">
              {result.total} order{result.total === 1 ? "" : "s"} in scope
              {hasFilters ? " · filtered" : ""}
            </span>
          </div>
        </form>
      </Card>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <ClipboardList className="size-4 text-slate-400" />
            Order book
          </div>
          <p className="text-[11px] text-muted">Page {result.page}</p>
        </div>
        <div className="p-3 sm:p-4">
          <OrderTable
            items={result.items}
            emptyAction={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href="/orders/new">Create a purchase order</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
        {result.total > 0 ? (
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            basePath="/orders"
            searchParams={params}
          />
        ) : null}
      </div>
    </div>
  );
}
