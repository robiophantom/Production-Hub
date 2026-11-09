"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, CircleAlert, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { addDaysISO } from "@/lib/business/working-days";
import type { Role } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import type {
  Buyer,
  ProductionUnit,
  Profile,
  Subcontractor,
  TnaTemplate,
  TnaTemplateMilestone,
} from "@/types";
import { createOrderAction, type CreateOrderState } from "./actions";

interface TemplateWithMilestones extends TnaTemplate {
  milestones: (TnaTemplateMilestone & { stage_name: string; stage_sequence: number })[];
}

interface Axis {
  id: string;
  name: string;
}

const initialState: CreateOrderState = {};

export function OrderForm({
  role,
  businessDate,
  buyers,
  units,
  merchandisers,
  supervisors,
  subcontractors,
  templates,
}: {
  role: Role;
  businessDate: string;
  buyers: Buyer[];
  units: ProductionUnit[];
  merchandisers: Profile[];
  supervisors: Profile[];
  subcontractors: Subcontractor[];
  templates: TemplateWithMilestones[];
}) {
  const [state, formAction] = useActionState(createOrderAction, initialState);
  const counter = useRef(0);

  const [colours, setColours] = useState<Axis[]>([
    { id: "c-initial-1", name: "Navy" },
    { id: "c-initial-2", name: "White" },
  ]);
  const [sizes, setSizes] = useState<Axis[]>([
    { id: "s-initial-1", name: "S" },
    { id: "s-initial-2", name: "M" },
    { id: "s-initial-3", name: "L" },
    { id: "s-initial-4", name: "XL" },
  ]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [totalQuantity, setTotalQuantity] = useState("");

  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [optionalStageIds, setOptionalStageIds] = useState<string[]>([]);
  const [milestoneOverrides, setMilestoneOverrides] = useState<Record<string, string>>({});
  const [exFactoryDate, setExFactoryDate] = useState(addDaysISO(businessDate, 45));

  const template = templates.find((item) => item.id === templateId);

  const visibleMilestones = useMemo(
    () =>
      (template?.milestones ?? []).filter(
        (milestone) => !milestone.is_optional || optionalStageIds.includes(milestone.stage_id),
      ),
    [template, optionalStageIds],
  );

  const milestoneDates = useMemo(() => {
    const next: Record<string, string> = {};
    for (const milestone of visibleMilestones) {
      next[milestone.stage_id] =
        milestoneOverrides[milestone.stage_id] ??
        addDaysISO(exFactoryDate, Number(milestone.offset_days));
    }
    return next;
  }, [visibleMilestones, milestoneOverrides, exFactoryDate]);

  const variants = useMemo(
    () =>
      colours.flatMap((colour) =>
        sizes.map((size) => ({
          colour: colour.name.trim(),
          size: size.name.trim(),
          quantity: Number(quantities[`${colour.id}:${size.id}`] ?? 0) || 0,
        })),
      ),
    [colours, sizes, quantities],
  );

  const nonEmptyVariants = variants.filter(
    (variant) => variant.colour && variant.size && variant.quantity > 0,
  );
  const grandTotal = variants.reduce((sum, variant) => sum + variant.quantity, 0);
  const declaredTotal = Number(totalQuantity) || 0;
  const totalsMatch = declaredTotal > 0 && grandTotal === declaredTotal;

  function rowTotal(colourId: string) {
    return sizes.reduce((sum, size) => {
      const value = Number(quantities[`${colourId}:${size.id}`] ?? 0) || 0;
      return sum + value;
    }, 0);
  }

  function columnTotal(sizeId: string) {
    return colours.reduce((sum, colour) => {
      const value = Number(quantities[`${colour.id}:${sizeId}`] ?? 0) || 0;
      return sum + value;
    }, 0);
  }

  function renameColour(id: string, name: string) {
    setColours((items) => items.map((item) => (item.id === id ? { ...item, name } : item)));
  }

  function renameSize(id: string, name: string) {
    setSizes((items) => items.map((item) => (item.id === id ? { ...item, name } : item)));
  }

  function addColour() {
    counter.current += 1;
    setColours((items) => [...items, { id: `c-${counter.current}`, name: "" }]);
  }

  function addSize() {
    counter.current += 1;
    setSizes((items) => [...items, { id: `s-${counter.current}`, name: "" }]);
  }

  function removeColour(id: string) {
    setColours((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  }

  function removeSize(id: string) {
    setSizes((items) => (items.length > 1 ? items.filter((item) => item.id !== id) : items));
  }

  return (
    <form action={formAction} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <input type="hidden" name="variants" value={JSON.stringify(nonEmptyVariants)} />
      <input
        type="hidden"
        name="optionalStageIds"
        value={JSON.stringify(optionalStageIds)}
      />
      <input type="hidden" name="milestoneDates" value={JSON.stringify(milestoneDates)} />

      <div className="space-y-4">
        {state.error ? <FormError>{state.error}</FormError> : null}

        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
            <CardDescription>Buyer, style and shipment information.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="PO number" htmlFor="poNumber" required hint="Must be unique across the order book.">
              <Input id="poNumber" name="poNumber" placeholder="B-PO-88213" required />
            </Field>
            <Field label="Buyer" htmlFor="buyerId" required>
              <Select id="buyerId" name="buyerId" required defaultValue={buyers[0]?.id ?? ""}>
                {buyers.map((buyer) => (
                  <option key={buyer.id} value={buyer.id}>
                    {buyer.name} ({buyer.code})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Buyer reference" htmlFor="buyerReference">
              <Input id="buyerReference" name="buyerReference" placeholder="Buyer's PO reference" />
            </Field>
            <Field label="Order received" htmlFor="orderReceivedDate" required>
              <Input
                id="orderReceivedDate"
                name="orderReceivedDate"
                type="date"
                defaultValue={businessDate}
                required
              />
            </Field>
            <Field label="Style name" htmlFor="styleName" required>
              <Input id="styleName" name="styleName" placeholder="Men's crew neck tee" required />
            </Field>
            <Field label="Style number" htmlFor="styleNumber">
              <Input id="styleNumber" name="styleNumber" placeholder="ST-4412" />
            </Field>
            <Field label="Total order quantity (pcs)" htmlFor="totalQuantity" required>
              <Input
                id="totalQuantity"
                name="totalQuantity"
                type="number"
                min={1}
                inputMode="numeric"
                value={totalQuantity}
                onChange={(event) => setTotalQuantity(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="12000"
                required
              />
            </Field>
            <Field label="Ex-factory date" htmlFor="exFactoryDate" required>
              <Input
                id="exFactoryDate"
                name="exFactoryDate"
                type="date"
                value={exFactoryDate}
                min={businessDate}
                onChange={(event) => {
                  setExFactoryDate(event.target.value);
                  setMilestoneOverrides({});
                }}
                required
              />
            </Field>
            <Field label="Shipping method" htmlFor="shippingMethod">
              <Select id="shippingMethod" name="shippingMethod" defaultValue="sea">
                <option value="sea">Sea freight</option>
                <option value="air">Air freight</option>
                <option value="courier">Courier</option>
                <option value="road">Road</option>
              </Select>
            </Field>
            <Field label="Production priority" htmlFor="priority">
              <Select id="priority" name="priority" defaultValue="normal">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Field>
            {role === "super_admin" ? (
              <Field label="Assigned merchandiser" htmlFor="merchandiserId">
                <Select id="merchandiserId" name="merchandiserId" defaultValue={merchandisers[0]?.id ?? ""}>
                  {merchandisers.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Product description" htmlFor="description" className="sm:col-span-2">
              <Textarea
                id="description"
                name="description"
                placeholder="Fabric, GSM, print technique, packing instructions…"
                className="min-h-20"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Colour &amp; size quantities</CardTitle>
              <CardDescription>
                Edit colour and size labels, then enter pieces per combination. The grand total must
                equal the PO quantity.
              </CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addColour}>
                <Plus /> Colour
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={addSize}>
                <Plus /> Size
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-[150px] px-2 pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Colour
                    </th>
                    {sizes.map((size) => (
                      <th key={size.id} className="px-1.5 pb-2">
                        <div className="flex items-center gap-1">
                          <Input
                            aria-label="Size label"
                            value={size.name}
                            onChange={(event) => renameSize(size.id, event.target.value)}
                            className="h-8 px-2 text-center text-xs font-semibold"
                            placeholder="Size"
                          />
                          <button
                            type="button"
                            onClick={() => removeSize(size.id)}
                            className="flex size-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove size ${size.name || "column"}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="w-[86px] px-2 pb-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {colours.map((colour) => (
                    <tr key={colour.id}>
                      <td className="px-1 py-1.5">
                        <div className="flex items-center gap-1">
                          <Input
                            aria-label="Colour label"
                            value={colour.name}
                            onChange={(event) => renameColour(colour.id, event.target.value)}
                            className="h-9 px-2 text-[13px] font-medium"
                            placeholder="Colour"
                          />
                          <button
                            type="button"
                            onClick={() => removeColour(colour.id)}
                            className="flex size-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Remove colour ${colour.name || "row"}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                      {sizes.map((size) => {
                        const key = `${colour.id}:${size.id}`;
                        return (
                          <td key={size.id} className="px-1 py-1.5">
                            <Input
                              aria-label={`${colour.name || "Colour"} ${size.name || "size"} quantity`}
                              inputMode="numeric"
                              value={quantities[key] ?? ""}
                              onChange={(event) =>
                                setQuantities((current) => ({
                                  ...current,
                                  [key]: event.target.value.replace(/[^\d]/g, ""),
                                }))
                              }
                              className="h-9 px-2 text-center text-[13px] tabular-nums"
                              placeholder="0"
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-right text-[13px] font-semibold tabular-nums text-ink">
                        {formatNumber(rowTotal(colour.id))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line">
                    <td className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Total
                    </td>
                    {sizes.map((size) => (
                      <td
                        key={size.id}
                        className="px-2 py-2 text-center text-[12px] font-semibold tabular-nums text-slate-600"
                      >
                        {formatNumber(columnTotal(size.id))}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right text-sm font-semibold tabular-nums text-brand-dark">
                      {formatNumber(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-slate-50/60 px-3 py-2.5 text-[12px]">
              <span className="text-muted">
                Variant total:{" "}
                <span className="font-semibold tabular-nums text-ink">{formatNumber(grandTotal)}</span>
              </span>
              <span className="text-muted">
                PO quantity:{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {declaredTotal ? formatNumber(declaredTotal) : "—"}
                </span>
              </span>
              {declaredTotal > 0 && !totalsMatch ? (
                <span className="flex items-center gap-1 font-medium text-red-600">
                  <CircleAlert className="size-3.5" />
                  Difference {formatNumber(Math.abs(grandTotal - declaredTotal))} pcs
                </span>
              ) : totalsMatch ? (
                <span className="font-medium text-emerald-600">Quantities match</span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setTotalQuantity(String(grandTotal))}
                disabled={grandTotal === 0}
              >
                Use variant total
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TNA plan</CardTitle>
            <CardDescription>
              Milestone dates are generated from the ex-factory date using the template offsets. Dates
              remain editable for this order only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="TNA template" htmlFor="templateId" required>
              <Select
                id="templateId"
                name="templateId"
                value={templateId}
                onChange={(event) => {
                  setTemplateId(event.target.value);
                  setOptionalStageIds([]);
                  setMilestoneOverrides({});
                }}
              >
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>

            {template?.milestones.some((milestone) => milestone.is_optional) ? (
              <div className="rounded-lg border border-line bg-slate-50/50 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Optional stages
                </p>
                <div className="flex flex-wrap gap-2">
                  {template.milestones
                    .filter((milestone) => milestone.is_optional)
                    .map((milestone) => {
                      const checked = optionalStageIds.includes(milestone.stage_id);
                      return (
                        <label
                          key={milestone.stage_id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] text-slate-600"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setOptionalStageIds((current) =>
                                checked
                                  ? current.filter((id) => id !== milestone.stage_id)
                                  : [...current, milestone.stage_id],
                              )
                            }
                            className="size-3.5 accent-[#2563EB]"
                          />
                          {milestone.stage_name}
                        </label>
                      );
                    })}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              {visibleMilestones.map((milestone) => (
                <div
                  key={milestone.stage_id}
                  className="grid items-center gap-2 rounded-lg border border-line px-3 py-2 sm:grid-cols-[28px_minmax(0,1fr)_170px]"
                >
                  <span className="hidden size-6 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand sm:flex">
                    {milestone.stage_sequence}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{milestone.stage_name}</p>
                    <p className="text-[11px] text-muted">
                      {milestone.offset_days >= 0 ? "+" : ""}
                      {milestone.offset_days} days from ex-factory
                    </p>
                  </div>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      aria-label={`${milestone.stage_name} planned date`}
                      type="date"
                      value={milestoneDates[milestone.stage_id] ?? ""}
                      onChange={(event) =>
                        setMilestoneOverrides((current) => ({
                          ...current,
                          [milestone.stage_id]: event.target.value,
                        }))
                      }
                      className="h-9 pl-8 text-[12px]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
              <Field label="Primary production unit" htmlFor="primaryUnitId">
                <Select id="primaryUnitId" name="primaryUnitId" defaultValue="">
                  <option value="">Not assigned</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Supervisor" htmlFor="supervisorId">
                <Select id="supervisorId" name="supervisorId" defaultValue="">
                  <option value="">Not assigned</option>
                  {supervisors.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.full_name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subcontractor" htmlFor="subcontractorId">
                <Select id="subcontractorId" name="subcontractorId" defaultValue="">
                  <option value="">None</option>
                  {subcontractors.map((subcontractor) => (
                    <option key={subcontractor.id} value={subcontractor.id}>
                      {subcontractor.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Internal notes for merchandising and production.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea name="notes" placeholder="Packing, labelling or buyer-specific instructions…" />
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
            <CardDescription>Confirm before creating the PO.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-muted">Variants</span>
              <span className="font-medium text-ink">
                {colours.length} colours × {sizes.length} sizes
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Variant total</span>
              <span className="font-semibold tabular-nums text-ink">{formatNumber(grandTotal)} pcs</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">PO quantity</span>
              <span className="font-semibold tabular-nums text-ink">
                {declaredTotal ? `${formatNumber(declaredTotal)} pcs` : "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">TNA milestones</span>
              <span className="font-medium text-ink">{visibleMilestones.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Ex-factory</span>
              <span className="font-medium text-ink">
                {exFactoryDate ? formatDate(exFactoryDate) : "—"}
              </span>
            </div>

            {!totalsMatch ? (
              <p className="rounded-md bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700">
                The order can only be created when the variant total equals the PO quantity.
              </p>
            ) : null}

            <div className="space-y-2 border-t border-line pt-3">
              <SubmitButton className="w-full" pendingText="Creating order…" disabled={!totalsMatch}>
                Create purchase order
              </SubmitButton>
              <Button asChild variant="ghost" className="w-full" size="sm">
                <Link href="/orders">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-blue-200 bg-brand-soft px-3.5 py-3 text-[11px] leading-relaxed text-blue-800">
          Departmental rules: only merchandisers and super admins can create POs. A reason is required
          later for any planned-date change, and every change is audited.
        </div>
      </aside>
    </form>
  );
}
