"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PRIORITIES, PO_STATUSES, SHIPPING_METHODS } from "@/lib/constants";
import { formatDate, formatNumber, titleCase } from "@/lib/utils";
import { updateOrderAction, type UpdateOrderState } from "./actions";

export interface EditOrderDefaults {
  id: string;
  poNumber: string;
  buyerName: string;
  buyerCode: string;
  totalQuantity: number;
  orderReceivedDate: string;
  styleName: string;
  styleNumber: string | null;
  description: string | null;
  buyerReference: string | null;
  exFactoryDate: string;
  shippingMethod: string;
  priority: string;
  status: string;
  primaryUnitId: string;
  merchandiserId: string;
  notes: string | null;
}

export function EditOrderForm({
  order,
  units,
  merchandisers,
  canChooseMerchandiser,
}: {
  order: EditOrderDefaults;
  units: { id: string; name: string; code: string }[];
  merchandisers: { id: string; full_name: string }[];
  canChooseMerchandiser: boolean;
}) {
  const [state, formAction] = useActionState<UpdateOrderState, FormData>(
    updateOrderAction,
    {},
  );
  const [exFactoryDate, setExFactoryDate] = useState(order.exFactoryDate);
  const dateChanged = exFactoryDate !== order.exFactoryDate;

  return (
    <form action={formAction} className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <input type="hidden" name="poId" value={order.id} />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
            <CardDescription>
              {order.poNumber} · {order.buyerName} ({order.buyerCode}) ·{" "}
              {formatNumber(order.totalQuantity)} pcs ordered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormError>{state.error}</FormError>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Style name" htmlFor="styleName" required>
                <Input
                  id="styleName"
                  name="styleName"
                  defaultValue={order.styleName}
                  maxLength={160}
                  required
                />
              </Field>
              <Field label="Style number" htmlFor="styleNumber">
                <Input
                  id="styleNumber"
                  name="styleNumber"
                  defaultValue={order.styleNumber ?? ""}
                  maxLength={80}
                />
              </Field>
            </div>

            <Field label="Buyer reference" htmlFor="buyerReference">
              <Input
                id="buyerReference"
                name="buyerReference"
                defaultValue={order.buyerReference ?? ""}
                maxLength={120}
              />
            </Field>

            <Field label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                defaultValue={order.description ?? ""}
                maxLength={2000}
                placeholder="Garment description, fabric, wash and packing notes"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Ex-factory date"
                htmlFor="exFactoryDate"
                required
                hint="Changing this date requires a reason and is permanently recorded."
              >
                <Input
                  id="exFactoryDate"
                  name="exFactoryDate"
                  type="date"
                  value={exFactoryDate}
                  onChange={(event) => setExFactoryDate(event.target.value)}
                  required
                />
              </Field>
              <Field label="Order status" htmlFor="status">
                <Select id="status" name="status" defaultValue={order.status}>
                  {PO_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {titleCase(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {dateChanged ? (
              <Field label="Reason for ex-factory change" htmlFor="dateChangeReason" required>
                <Textarea
                  id="dateChangeReason"
                  name="dateChangeReason"
                  placeholder="e.g. Buyer approved revised shipment schedule"
                  maxLength={500}
                  required
                />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shipping method" htmlFor="shippingMethod">
                <Select
                  id="shippingMethod"
                  name="shippingMethod"
                  defaultValue={order.shippingMethod}
                >
                  {SHIPPING_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {titleCase(method)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority" htmlFor="priority">
                <Select id="priority" name="priority" defaultValue={order.priority}>
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {titleCase(priority)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Primary unit" htmlFor="primaryUnitId">
                <Select id="primaryUnitId" name="primaryUnitId" defaultValue={order.primaryUnitId}>
                  <option value="">Unassigned</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.code})
                    </option>
                  ))}
                </Select>
              </Field>
              {canChooseMerchandiser ? (
                <Field label="Merchandiser" htmlFor="merchandiserId">
                  <Select
                    id="merchandiserId"
                    name="merchandiserId"
                    defaultValue={order.merchandiserId}
                  >
                    <option value="">Unassigned</option>
                    {merchandisers.map((merchandiser) => (
                      <option key={merchandiser.id} value={merchandiser.id}>
                        {merchandiser.full_name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>

            <Field label="Internal notes" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                defaultValue={order.notes ?? ""}
                maxLength={2000}
                placeholder="Notes visible to internal staff only"
              />
            </Field>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/orders/${order.id}`}>Cancel</Link>
          </Button>
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Immutable order fields</CardTitle>
            <CardDescription>
              These values cannot be edited after creation. Create a new order if they are wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-[12px]">
              {[
                { label: "PO number", value: order.poNumber },
                { label: "Buyer", value: `${order.buyerName} (${order.buyerCode})` },
                { label: "Order received", value: formatDate(order.orderReceivedDate) },
                { label: "Ordered quantity", value: `${formatNumber(order.totalQuantity)} pcs` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{item.label}</dt>
                  <dd className="font-medium text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit notice</CardTitle>
          </CardHeader>
          <CardContent className="text-[12px] leading-relaxed text-slate-600">
            Saving writes an audit entry. Date changes also create a permanent date-history record
            containing the previous date, new date and your reason. Neither record can be edited or
            deleted.
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
