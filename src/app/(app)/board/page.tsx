import type { Metadata } from "next";
import Link from "next/link";
import { Filter, RotateCcw, Search, SquareKanban } from "lucide-react";
import { OrderTable } from "@/components/orders/order-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireRoles } from "@/lib/auth/session";
import { addDaysISO, weekdayOf } from "@/lib/business/working-days";
import { sql } from "@/lib/db";
import { listOrderSummaries, type OrderFilters } from "@/lib/services/order-summaries";
import { getAppConfig } from "@/lib/services/settings";
import { cn, formatDate } from "@/lib/utils";
import type { Buyer, ProductionStage, ProductionUnit, Profile } from "@/types";

export const metadata: Metadata = { title: "Production board" };

function value(input: string | string[] | undefined): string {
  if (Array.isArray(input)) return input[0] ?? "";
  return input ?? "";
}

function mondayOf(date: string): string {
  const weekday = weekdayOf(date);
  if (weekday === 1) return date;
  return addDaysISO(date, weekday === 0 ? -6 : 1 - weekday);
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRoles("super_admin", "managing_director", "merchandiser");
  const params = await searchParams;
  const config = await getAppConfig();
  const page = Math.max(1, Number(value(params.page)) || 1);

  const currentMonday = mondayOf(config.businessDate);
  const weekOptions = Array.from({ length: 18 }, (_, index) => {
    const start = addDaysISO(currentMonday, (index - 4) * 7);
    return {
      value: start,
      label: `${formatDate(start)} – ${formatDate(addDaysISO(start, 6))}`,
    };
  });
  const selectedWeek = value(params.week);
  const weekStart = selectedWeek && /^\d{4}-\d{2}-\d{2}$/.test(selectedWeek) ? selectedWeek : "";

  const filters: OrderFilters = {
    search: value(params.q) || undefined,
    buyerId: value(params.buyer) || undefined,
    unitId: value(params.unit) || undefined,
    merchandiserId: value(params.merch) || undefined,
    stageId: value(params.stage) || undefined,
    health: value(params.health) || undefined,
    dateFrom: weekStart || undefined,
    dateTo: weekStart ? addDaysISO(weekStart, 6) : undefined,
    status: "active",
    sort: value(params.sort) || "health",
  };

  const [result, buyers, units, stages, merchandisers] = await Promise.all([
    listOrderSummaries(user, filters, page, 15),
    sql<Buyer>("select * from buyers where is_active = true order by name"),
    sql<ProductionUnit>("select * from production_units where is_active = true order by name"),
    sql<ProductionStage>("select * from production_stages where is_active = true order by sequence"),
    sql<Profile>(
      "select id, email, full_name, role, phone, unit_id, buyer_id, is_active, avatar_url, created_at, updated_at from profiles where role = 'merchandiser' and is_active = true order by full_name",
    ),
  ]);

  const healthTabs = [
    { value: "", label: "All health" },
    { value: "red", label: "Delayed" },
    { value: "amber", label: "At risk" },
    { value: "green", label: "On track" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Production board"
        title="Order board"
        description="Every active order with its current stage, output and calculated health. Click any row for the full TNA, daily updates and delay analysis."
      />

      <div className="flex flex-wrap gap-2">
        {healthTabs.map((tab) => {
          const qs = new URLSearchParams();
          Object.entries(params).forEach(([key, entry]) => {
            if (key === "health" || key === "page" || entry === undefined) return;
            if (Array.isArray(entry)) entry.forEach((v) => qs.append(key, v));
            else qs.set(key, entry);
          });
          if (tab.value) qs.set("health", tab.value);
          return (
            <Link
              key={tab.value || "all"}
              href={`/board${qs.size ? `?${qs.toString()}` : ""}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                (filters.health ?? "") === tab.value
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-white text-slate-600 hover:border-brand/40 hover:text-brand",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Card className="p-4">
        <form method="get" className="space-y-3">
          {filters.health ? <input type="hidden" name="health" value={filters.health} /> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={filters.search}
                  placeholder="PO, style, buyer reference"
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
              <Label htmlFor="merch">Merchandiser</Label>
              <Select id="merch" name="merch" defaultValue={filters.merchandiserId ?? ""}>
                <option value="">All merchandisers</option>
                {merchandisers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.full_name}
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
              <Label htmlFor="week">Ex-factory week</Label>
              <Select id="week" name="week" defaultValue={weekStart}>
                <option value="">All weeks</option>
                {weekOptions.map((week) => (
                  <option key={week.value} value={week.value}>
                    {week.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sort">Sort</Label>
              <Select id="sort" name="sort" defaultValue={filters.sort}>
                <option value="health">Most at risk first</option>
                <option value="ex_factory_asc">Ex-factory earliest</option>
                <option value="quantity_desc">Quantity largest</option>
                <option value="progress_desc">Progress highest</option>
                <option value="po_number">PO number</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">
              <Filter /> Apply
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/board">
                <RotateCcw /> Reset
              </Link>
            </Button>
            <span className="ml-auto text-xs text-muted">{result.total} active order(s)</span>
          </div>
        </form>
      </Card>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
            <SquareKanban className="size-4 text-slate-400" />
            Active production orders
          </div>
          <p className="text-[11px] text-muted">
            {weekStart ? `Week of ${formatDate(weekStart)} · ` : ""}Page {result.page}
          </p>
        </div>
        <div className="p-3 sm:p-4">
          <OrderTable items={result.items} showMerchandiser />
        </div>
        {result.total > 0 ? (
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            basePath="/board"
            searchParams={params}
          />
        ) : null}
      </div>
    </div>
  );
}
