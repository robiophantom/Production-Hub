import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CalendarClock, History, ScrollText, Search } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, InfoNote } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRoles } from "@/lib/auth/session";
import { titleCase, formatDate, formatDateTime, truncate } from "@/lib/utils";
import {
  listAuditEvents,
  listDateHistory,
  listNotificationAudit,
} from "@/lib/services/admin";

export const metadata: Metadata = { title: "Activity & audit" };

const ENTITY_TYPES = [
  "purchase_order",
  "order_milestone",
  "production_update",
  "production_issue",
  "production_photo",
  "delay_alert",
  "buyer_notification",
  "buyer_share_token",
  "profile",
  "buyer",
  "production_unit",
  "production_stage",
  "subcontractor",
  "tna_template",
  "app_settings",
];

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entity?: string; from?: string; to?: string }>;
}) {
  const user = await requireRoles("super_admin");
  const filters = await searchParams;

  const [audit, dates, notifications] = await Promise.all([
    listAuditEvents(user, filters),
    listDateHistory(user),
    listNotificationAudit(user),
  ]);

  const hasFilters = Boolean(filters.q || filters.entity || filters.from || filters.to);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Activity & audit"
        description="A permanent, append-only record of every sensitive action. Audit rows and date changes cannot be edited or deleted by ordinary users."
      />

      <InfoNote variant="info" title="Immutable by design">
        The application never exposes an update or delete path for audit records, and the hosted
        database revokes write privileges on <code>audit_logs</code> and{" "}
        <code>order_date_history</code> from authenticated users. Order date changes also require a
        written reason.
      </InfoNote>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Audit log ({audit.length})</TabsTrigger>
          <TabsTrigger value="dates">Date changes ({dates.length})</TabsTrigger>
          <TabsTrigger value="notifications">Buyer notifications ({notifications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filter activity</CardTitle>
              <CardDescription>Search the latest 250 matching events, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              <form method="get" className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Field label="Search" htmlFor="audit-q">
                  <Input
                    id="audit-q"
                    name="q"
                    defaultValue={filters.q ?? ""}
                    placeholder="Action, actor, PO number…"
                  />
                </Field>
                <Field label="Entity" htmlFor="audit-entity">
                  <Select id="audit-entity" name="entity" defaultValue={filters.entity ?? ""}>
                    <option value="">All entities</option>
                    {ENTITY_TYPES.map((entity) => (
                      <option key={entity} value={entity}>
                        {titleCase(entity)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="From" htmlFor="audit-from">
                  <Input id="audit-from" name="from" type="date" defaultValue={filters.from ?? ""} />
                </Field>
                <Field label="To" htmlFor="audit-to">
                  <Input id="audit-to" name="to" type="date" defaultValue={filters.to ?? ""} />
                </Field>
                <div className="flex items-center gap-2 pb-0.5">
                  <Button type="submit" size="sm">
                    <Search /> Apply
                  </Button>
                  {hasFilters ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/admin/activity">Reset</Link>
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit entries</CardTitle>
              <CardDescription>
                {hasFilters ? "Filtered results" : "Most recent 250 events"} · timestamps shown in
                Asia/Kolkata
              </CardDescription>
            </CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <EmptyState
                  icon={ScrollText}
                  title="No audit events found"
                  description="Adjust the filters, or perform an action in the platform to create an entry."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>When</TH>
                        <TH>Action</TH>
                        <TH>Entity</TH>
                        <TH>Order</TH>
                        <TH>Actor</TH>
                        <TH>Detail</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {audit.map((row) => (
                        <TR key={row.id}>
                          <TD className="whitespace-nowrap text-[12px]">
                            {formatDateTime(row.created_at)}
                          </TD>
                          <TD>
                            <Badge variant="outline">{titleCase(row.action)}</Badge>
                          </TD>
                          <TD className="text-[12px]">{titleCase(row.entity_type)}</TD>
                          <TD className="text-[12px]">
                            {row.po_id && row.po_number ? (
                              <Link
                                href={`/orders/${row.po_id}`}
                                className="font-medium text-brand hover:underline"
                              >
                                {row.po_number}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TD>
                          <TD className="text-[12px]">{row.actor_name ?? "System"}</TD>
                          <TD>
                            {row.detail && Object.keys(row.detail).length > 0 ? (
                              <details className="max-w-[320px]">
                                <summary className="cursor-pointer text-[12px] text-brand">
                                  View detail
                                </summary>
                                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-600">
                                  {JSON.stringify(row.detail, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <span className="text-[12px] text-muted">—</span>
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
        </TabsContent>

        <TabsContent value="dates" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Order date changes</CardTitle>
                <CardDescription>
                  Every ex-factory or TNA date change with its reason, previous value and actor.
                </CardDescription>
              </div>
              <CalendarClock className="size-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              {dates.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No date changes recorded"
                  description="Changing an ex-factory or milestone date will append an immutable entry here."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>When</TH>
                        <TH>Order</TH>
                        <TH>Field</TH>
                        <TH>Previous</TH>
                        <TH>New</TH>
                        <TH>Reason</TH>
                        <TH>Changed by</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {dates.map((row) => (
                        <TR key={row.id}>
                          <TD className="whitespace-nowrap text-[12px]">
                            {formatDateTime(row.changed_at)}
                          </TD>
                          <TD>
                            <Link
                              href={`/orders/${row.po_id}`}
                              className="text-[12px] font-medium text-brand hover:underline"
                            >
                              {row.po_number ?? row.po_id.slice(0, 8)}
                            </Link>
                          </TD>
                          <TD>
                            <div className="text-[12px] font-medium text-ink">
                              {titleCase(row.field_name)}
                            </div>
                            {row.milestone_id ? (
                              <div className="text-[10px] text-muted">
                                Milestone {row.milestone_id.slice(0, 8)}
                              </div>
                            ) : null}
                          </TD>
                          <TD className="whitespace-nowrap text-[12px]">{formatDate(row.previous_date)}</TD>
                          <TD className="whitespace-nowrap text-[12px] font-medium text-ink">
                            {formatDate(row.new_date)}
                          </TD>
                          <TD className="max-w-[280px] text-[12px] leading-relaxed text-slate-600">
                            {truncate(row.reason, 140)}
                          </TD>
                          <TD className="text-[12px]">{row.actor_name ?? "System"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Buyer notifications</CardTitle>
                <CardDescription>
                  Only approved or sent messages are visible to buyers. AI never approves a
                  notification — a human must confirm the delay first.
                </CardDescription>
              </div>
              <BellRing className="size-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <EmptyState
                  icon={BellRing}
                  title="No buyer notifications"
                  description="Confirming a delay alert publishes a buyer update here."
                />
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Created</TH>
                        <TH>Order</TH>
                        <TH>Subject</TH>
                        <TH>Status</TH>
                        <TH>Approved by</TH>
                        <TH>Approved</TH>
                        <TH>Sent</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {notifications.map((row) => (
                        <TR key={row.id}>
                          <TD className="whitespace-nowrap text-[12px]">
                            {formatDateTime(row.created_at)}
                          </TD>
                          <TD>
                            <Link
                              href={`/orders/${row.po_id}`}
                              className="text-[12px] font-medium text-brand hover:underline"
                            >
                              {row.po_number}
                            </Link>
                          </TD>
                          <TD className="max-w-[320px]">
                            <div className="text-[12px] font-medium text-ink">{row.subject}</div>
                            <details className="mt-1">
                              <summary className="cursor-pointer text-[11px] text-muted">Message</summary>
                              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-600">
                                {row.message}
                              </p>
                            </details>
                          </TD>
                          <TD>
                            <StatusBadge status={row.status} />
                          </TD>
                          <TD className="text-[12px]">{row.approved_by_name ?? "—"}</TD>
                          <TD className="whitespace-nowrap text-[12px]">
                            {row.approved_at ? formatDateTime(row.approved_at) : "—"}
                          </TD>
                          <TD className="whitespace-nowrap text-[12px]">
                            {row.sent_at ? formatDateTime(row.sent_at) : "—"}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
