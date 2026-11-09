import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, TBody, TD, THead, TH, TR } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import type { OrderDetail } from "@/lib/services/orders";

export function VariantsTab({ detail }: { detail: OrderDetail }) {
  const colours = [...new Set(detail.variants.map((variant) => variant.colour))];
  const sizes = [...new Set(detail.variants.map((variant) => variant.size))];
  const map = new Map(
    detail.variants.map((variant) => [`${variant.colour}|${variant.size}`, variant.quantity]),
  );

  const rowTotal = (colour: string) =>
    sizes.reduce((sum, size) => sum + (map.get(`${colour}|${size}`) ?? 0), 0);
  const columnTotal = (size: string) =>
    colours.reduce((sum, colour) => sum + (map.get(`${colour}|${size}`) ?? 0), 0);
  const grandTotal = detail.variants.reduce((sum, variant) => sum + variant.quantity, 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Colour and size matrix</CardTitle>
          <CardDescription>
            {colours.length} colour(s) × {sizes.length} size(s), {detail.variants.length} combinations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrap>
            <Table className="min-w-[560px]">
              <THead>
                <TR>
                  <TH>Colour</TH>
                  {sizes.map((size) => (
                    <TH key={size} className="text-right">
                      {size}
                    </TH>
                  ))}
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {colours.map((colour) => (
                  <TR key={colour}>
                    <TD className="font-medium text-ink">{colour}</TD>
                    {sizes.map((size) => (
                      <TD key={size} className="text-right tabular-nums text-slate-600">
                        {map.has(`${colour}|${size}`)
                          ? formatNumber(map.get(`${colour}|${size}`))
                          : "—"}
                      </TD>
                    ))}
                    <TD className="text-right font-semibold tabular-nums text-ink">
                      {formatNumber(rowTotal(colour))}
                    </TD>
                  </TR>
                ))}
              </TBody>
              <tfoot>
                <TR className="border-t-2 border-line bg-slate-50/60">
                  <TD className="font-semibold text-ink">Total</TD>
                  {sizes.map((size) => (
                    <TD key={size} className="text-right font-semibold tabular-nums text-ink">
                      {formatNumber(columnTotal(size))}
                    </TD>
                  ))}
                  <TD className="text-right font-semibold tabular-nums text-brand-dark">
                    {formatNumber(grandTotal)}
                  </TD>
                </TR>
              </tfoot>
            </Table>
          </TableWrap>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quantity reconciliation</CardTitle>
          <CardDescription>Variant totals against the PO quantity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">PO quantity</span>
            <span className="font-semibold tabular-nums text-ink">
              {formatNumber(detail.order.total_quantity)} pcs
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Variant total</span>
            <span className="font-semibold tabular-nums text-ink">{formatNumber(grandTotal)} pcs</span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-muted">Difference</span>
            <span
              className={
                grandTotal === detail.order.total_quantity
                  ? "font-semibold text-emerald-600"
                  : "font-semibold text-red-600"
              }
            >
              {formatNumber(Math.abs(grandTotal - detail.order.total_quantity))} pcs
              {grandTotal === detail.order.total_quantity ? " · balanced" : " · mismatch"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
