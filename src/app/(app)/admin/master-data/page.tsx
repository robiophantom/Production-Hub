import type { Metadata } from "next";
import { Building2, FileStack, Layers, Plus, Scissors, Truck } from "lucide-react";
import { InlineForm } from "@/components/admin/inline-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState, InfoNote } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRoles } from "@/lib/auth/session";
import {
  getMasterData,
  type AdminBuyerRow,
  type AdminStageRow,
  type AdminSubcontractorRow,
  type AdminTemplateRow,
  type AdminUnitRow,
} from "@/lib/services/admin";
import {
  removeTemplateMilestoneAction,
  saveBuyerAction,
  saveStageAction,
  saveSubcontractorAction,
  saveTemplateAction,
  saveTemplateMilestoneAction,
  saveUnitAction,
} from "../actions";

export const metadata: Metadata = { title: "Master data" };

function ActiveBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>;
}

function BuyerFields({ buyer, prefix }: { buyer?: AdminBuyerRow; prefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Buyer name" htmlFor={`${prefix}-name`} required>
        <Input id={`${prefix}-name`} name="name" defaultValue={buyer?.name} required />
      </Field>
      <Field label="Code" htmlFor={`${prefix}-code`} required hint="Unique, e.g. B or C">
        <Input id={`${prefix}-code`} name="code" defaultValue={buyer?.code} required />
      </Field>
      <Field label="Country" htmlFor={`${prefix}-country`}>
        <Input id={`${prefix}-country`} name="country" defaultValue={buyer?.country ?? "UK"} />
      </Field>
      <Field label="Contact person" htmlFor={`${prefix}-contact`}>
        <Input
          id={`${prefix}-contact`}
          name="contactPerson"
          defaultValue={buyer?.contact_person ?? ""}
        />
      </Field>
      <Field label="Contact email" htmlFor={`${prefix}-email`}>
        <Input
          id={`${prefix}-email`}
          name="contactEmail"
          type="email"
          defaultValue={buyer?.contact_email ?? ""}
        />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-slate-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={buyer?.is_active ?? true}
          className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
        />
        Active
      </label>
    </div>
  );
}

function UnitFields({ unit, prefix }: { unit?: AdminUnitRow; prefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Unit name" htmlFor={`${prefix}-name`} required>
        <Input id={`${prefix}-name`} name="name" defaultValue={unit?.name} required />
      </Field>
      <Field label="Code" htmlFor={`${prefix}-code`} required>
        <Input id={`${prefix}-code`} name="code" defaultValue={unit?.code} required />
      </Field>
      <Field label="Location" htmlFor={`${prefix}-location`}>
        <Input id={`${prefix}-location`} name="location" defaultValue={unit?.location ?? ""} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-slate-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={unit?.is_active ?? true}
          className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
        />
        Active
      </label>
    </div>
  );
}

function StageFields({ stage, prefix }: { stage?: AdminStageRow; prefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Stage name" htmlFor={`${prefix}-name`} required>
        <Input id={`${prefix}-name`} name="name" defaultValue={stage?.name} required />
      </Field>
      <Field label="Code" htmlFor={`${prefix}-code`} required hint="lowercase_with_underscores">
        <Input id={`${prefix}-code`} name="code" defaultValue={stage?.code} required />
      </Field>
      <Field label="Sequence" htmlFor={`${prefix}-sequence`} required>
        <Input
          id={`${prefix}-sequence`}
          name="sequence"
          type="number"
          min={1}
          max={99}
          defaultValue={stage?.sequence}
          required
        />
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-slate-700 sm:col-span-3">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={stage?.is_active ?? true}
          className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
        />
        Active — inactive stages stay on existing orders but are hidden from new plans
      </label>
    </div>
  );
}

function SubcontractorFields({
  subcontractor,
  prefix,
}: {
  subcontractor?: AdminSubcontractorRow;
  prefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Name" htmlFor={`${prefix}-name`} required>
        <Input id={`${prefix}-name`} name="name" defaultValue={subcontractor?.name} required />
      </Field>
      <Field label="Type" htmlFor={`${prefix}-type`} required>
        <Select id={`${prefix}-type`} name="type" defaultValue={subcontractor?.type ?? "other"}>
          <option value="printing">Printing</option>
          <option value="washing">Washing</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Contact person" htmlFor={`${prefix}-contact`}>
        <Input
          id={`${prefix}-contact`}
          name="contactPerson"
          defaultValue={subcontractor?.contact_person ?? ""}
        />
      </Field>
      <Field label="Phone" htmlFor={`${prefix}-phone`}>
        <Input id={`${prefix}-phone`} name="phone" defaultValue={subcontractor?.phone ?? ""} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-slate-700">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={subcontractor?.is_active ?? true}
          className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
        />
        Active
      </label>
    </div>
  );
}

function TemplateFields({ template, prefix }: { template?: AdminTemplateRow; prefix: string }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Template name" htmlFor={`${prefix}-name`} required>
          <Input id={`${prefix}-name`} name="name" defaultValue={template?.name} required />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-slate-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={template?.is_active ?? true}
            className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Available for new purchase orders
        </label>
      </div>
      <Field label="Description" htmlFor={`${prefix}-description`}>
        <Textarea
          id={`${prefix}-description`}
          name="description"
          defaultValue={template?.description ?? ""}
          className="min-h-16"
        />
      </Field>
    </div>
  );
}

export default async function MasterDataPage() {
  const user = await requireRoles("super_admin");
  const data = await getMasterData(user);
  const activeStages = data.stages.filter((stage) => stage.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Buyers, units & stages"
        description="Maintain the shared reference data that powers orders, TNA plans and the production board. Records are deactivated rather than deleted so historical orders and audit entries stay intact."
      />

      <InfoNote variant="info" title="Safe by default">
        Codes and stage sequences must be unique. Deactivating a record removes it from new-order
        pickers without altering existing purchase orders, milestones or production history.
      </InfoNote>

      <Tabs defaultValue="buyers">
        <TabsList>
          <TabsTrigger value="buyers">Buyers</TabsTrigger>
          <TabsTrigger value="units">Production units</TabsTrigger>
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="subcontractors">Subcontractors</TabsTrigger>
          <TabsTrigger value="templates">TNA templates</TabsTrigger>
        </TabsList>

        <TabsContent value="buyers" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Add a buyer</CardTitle>
                <CardDescription>Buyers can only ever see orders linked to their own company.</CardDescription>
              </div>
              <Building2 className="size-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <InlineForm action={saveBuyerAction} submitLabel="Create buyer">
                <BuyerFields prefix="new-buyer" />
              </InlineForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buyers</CardTitle>
              <CardDescription>{data.buyers.length} buyer companies</CardDescription>
            </CardHeader>
            <CardContent>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Buyer</TH>
                      <TH>Country</TH>
                      <TH>Contact</TH>
                      <TH>Orders</TH>
                      <TH>Status</TH>
                      <TH>Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.buyers.map((buyer) => (
                      <TR key={buyer.id}>
                        <TD>
                          <div className="font-medium text-ink">{buyer.name}</div>
                          <div className="text-[11px] text-muted">{buyer.code}</div>
                        </TD>
                        <TD>{buyer.country}</TD>
                        <TD>
                          <div>{buyer.contact_person ?? "—"}</div>
                          <div className="text-[11px] text-muted">{buyer.contact_email ?? ""}</div>
                        </TD>
                        <TD>{buyer.order_count}</TD>
                        <TD>
                          <ActiveBadge active={buyer.is_active} />
                        </TD>
                        <TD>
                          <details className="min-w-[320px]">
                            <summary className="cursor-pointer text-[12px] font-medium text-brand">
                              Edit buyer
                            </summary>
                            <div className="mt-3 rounded-lg bg-slate-50/70 p-3">
                              <InlineForm
                                action={saveBuyerAction}
                                hidden={{ id: buyer.id }}
                                submitLabel="Save buyer"
                              >
                                <BuyerFields buyer={buyer} prefix={`buyer-${buyer.id}`} />
                              </InlineForm>
                            </div>
                          </details>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Add a production unit</CardTitle>
                <CardDescription>Units group supervisors, orders and stage assignments.</CardDescription>
              </div>
              <Layers className="size-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <InlineForm action={saveUnitAction} submitLabel="Create unit">
                <UnitFields prefix="new-unit" />
              </InlineForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production units</CardTitle>
              <CardDescription>{data.units.length} units</CardDescription>
            </CardHeader>
            <CardContent>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Unit</TH>
                      <TH>Location</TH>
                      <TH>Supervisors</TH>
                      <TH>Orders</TH>
                      <TH>Status</TH>
                      <TH>Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.units.map((unit) => (
                      <TR key={unit.id}>
                        <TD>
                          <div className="font-medium text-ink">{unit.name}</div>
                          <div className="text-[11px] text-muted">{unit.code}</div>
                        </TD>
                        <TD>{unit.location ?? "—"}</TD>
                        <TD>{unit.supervisor_count}</TD>
                        <TD>{unit.order_count}</TD>
                        <TD>
                          <ActiveBadge active={unit.is_active} />
                        </TD>
                        <TD>
                          <details className="min-w-[300px]">
                            <summary className="cursor-pointer text-[12px] font-medium text-brand">
                              Edit unit
                            </summary>
                            <div className="mt-3 rounded-lg bg-slate-50/70 p-3">
                              <InlineForm
                                action={saveUnitAction}
                                hidden={{ id: unit.id }}
                                submitLabel="Save unit"
                              >
                                <UnitFields unit={unit} prefix={`unit-${unit.id}`} />
                              </InlineForm>
                            </div>
                          </details>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Add a production stage</CardTitle>
                <CardDescription>Sequence controls the default order of TNA milestones.</CardDescription>
              </div>
              <Scissors className="size-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <InlineForm action={saveStageAction} submitLabel="Create stage">
                <StageFields prefix="new-stage" />
              </InlineForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production stages</CardTitle>
              <CardDescription>
                {data.stages.length} stages · {activeStages.length} active
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Seq</TH>
                      <TH>Stage</TH>
                      <TH>Code</TH>
                      <TH>Milestones</TH>
                      <TH>Status</TH>
                      <TH>Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {data.stages.map((stage) => (
                      <TR key={stage.id}>
                        <TD>{stage.sequence}</TD>
                        <TD className="font-medium text-ink">{stage.name}</TD>
                        <TD>
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">
                            {stage.code}
                          </code>
                        </TD>
                        <TD>{stage.milestone_count}</TD>
                        <TD>
                          <ActiveBadge active={stage.is_active} />
                        </TD>
                        <TD>
                          <details className="min-w-[340px]">
                            <summary className="cursor-pointer text-[12px] font-medium text-brand">
                              Edit stage
                            </summary>
                            <div className="mt-3 rounded-lg bg-slate-50/70 p-3">
                              <InlineForm
                                action={saveStageAction}
                                hidden={{ id: stage.id }}
                                submitLabel="Save stage"
                              >
                                <StageFields stage={stage} prefix={`stage-${stage.id}`} />
                              </InlineForm>
                            </div>
                          </details>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subcontractors" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Add a subcontractor</CardTitle>
                <CardDescription>Printing and washing partners can be assigned to TNA stages.</CardDescription>
              </div>
              <Truck className="size-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <InlineForm action={saveSubcontractorAction} submitLabel="Create subcontractor">
                <SubcontractorFields prefix="new-sub" />
              </InlineForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subcontractors</CardTitle>
              <CardDescription>{data.subcontractors.length} partners</CardDescription>
            </CardHeader>
            <CardContent>
              {data.subcontractors.length === 0 ? (
                <EmptyState icon={Truck} title="No subcontractors" description="Add your first partner above." />
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Name</TH>
                        <TH>Type</TH>
                        <TH>Contact</TH>
                        <TH>Assignments</TH>
                        <TH>Status</TH>
                        <TH>Actions</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {data.subcontractors.map((partner) => (
                        <TR key={partner.id}>
                          <TD className="font-medium text-ink">{partner.name}</TD>
                          <TD className="capitalize">{partner.type}</TD>
                          <TD>
                            <div>{partner.contact_person ?? "—"}</div>
                            <div className="text-[11px] text-muted">{partner.phone ?? ""}</div>
                          </TD>
                          <TD>{partner.assignment_count}</TD>
                          <TD>
                            <ActiveBadge active={partner.is_active} />
                          </TD>
                          <TD>
                            <details className="min-w-[300px]">
                              <summary className="cursor-pointer text-[12px] font-medium text-brand">
                                Edit partner
                              </summary>
                              <div className="mt-3 rounded-lg bg-slate-50/70 p-3">
                                <InlineForm
                                  action={saveSubcontractorAction}
                                  hidden={{ id: partner.id }}
                                  submitLabel="Save partner"
                                >
                                  <SubcontractorFields
                                    subcontractor={partner}
                                    prefix={`sub-${partner.id}`}
                                  />
                                </InlineForm>
                              </div>
                            </details>
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

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Add a TNA template</CardTitle>
                <CardDescription>
                  Templates seed milestone dates when a purchase order is created. Offsets are measured
                  in calendar days from the order-received date.
                </CardDescription>
              </div>
              <FileStack className="size-5 text-slate-400" />
            </CardHeader>
            <CardContent>
              <InlineForm action={saveTemplateAction} submitLabel="Create template">
                <TemplateFields prefix="new-template" />
              </InlineForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>
                {data.templates.length} templates · stages are ordered by sequence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.templates.length === 0 ? (
                <EmptyState icon={FileStack} title="No templates" description="Create a template above." />
              ) : (
                data.templates.map((template) => (
                  <div key={template.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-ink">{template.name}</p>
                          <ActiveBadge active={template.is_active} />
                          <Badge variant="outline">{template.milestones.length} milestones</Badge>
                        </div>
                        {template.description ? (
                          <p className="mt-1 max-w-2xl text-[12px] text-muted">{template.description}</p>
                        ) : null}
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-[12px] font-medium text-brand">
                        Edit template
                      </summary>
                      <div className="mt-3 rounded-lg bg-slate-50/70 p-3">
                        <InlineForm
                          action={saveTemplateAction}
                          hidden={{ id: template.id }}
                          submitLabel="Save template"
                        >
                          <TemplateFields template={template} prefix={`template-${template.id}`} />
                        </InlineForm>
                      </div>
                    </details>

                    <div className="mt-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Milestones
                      </p>
                      {template.milestones.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-[12px] text-muted">
                          No milestones yet — add the first stage below.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {template.milestones.map((milestone) => (
                            <div
                              key={milestone.id}
                              className="rounded-lg border border-line bg-slate-50/40 p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                                <Badge variant="outline">{milestone.sequence}</Badge>
                                <span className="font-medium text-ink">{milestone.stage_name}</span>
                                <span className="text-muted">
                                  {milestone.offset_days === 0
                                    ? "on order date"
                                    : `${milestone.offset_days > 0 ? "+" : ""}${milestone.offset_days} days`}
                                </span>
                                {milestone.is_optional ? <Badge variant="neutral">Optional</Badge> : null}
                                <span className="ml-auto">
                                  <ConfirmAction
                                    action={removeTemplateMilestoneAction}
                                    hidden={{
                                      templateId: template.id,
                                      milestoneId: milestone.id,
                                    }}
                                    title={`Remove ${milestone.stage_name}?`}
                                    description="This removes the stage from future plans created with this template. Existing orders are not affected."
                                    confirmLabel="Remove stage"
                                    triggerLabel="Remove"
                                    variant="ghost"
                                  />
                                </span>
                              </div>
                              <details className="mt-2">
                                <summary className="cursor-pointer text-[11px] font-medium text-brand">
                                  Adjust offset
                                </summary>
                                <div className="mt-2 max-w-md">
                                  <InlineForm
                                    action={saveTemplateMilestoneAction}
                                    hidden={{
                                      templateId: template.id,
                                      stageId: milestone.stage_id,
                                    }}
                                    submitLabel="Save milestone"
                                  >
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <Field
                                        label="Offset (days, negative = before order date)"
                                        htmlFor={`offset-${milestone.id}`}
                                      >
                                        <Input
                                          id={`offset-${milestone.id}`}
                                          name="offsetDays"
                                          type="number"
                                          min={-365}
                                          max={365}
                                          defaultValue={milestone.offset_days}
                                          required
                                        />
                                      </Field>
                                      <label className="flex items-center gap-2 self-end pb-2 text-[12px] text-slate-700">
                                        <input
                                          type="checkbox"
                                          name="isOptional"
                                          defaultChecked={milestone.is_optional}
                                          className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
                                        />
                                        Optional stage
                                      </label>
                                    </div>
                                  </InlineForm>
                                </div>
                              </details>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <details className="mt-3">
                      <summary className="flex items-center gap-1 text-[12px] font-medium text-slate-600">
                        <Plus className="size-3.5" /> Add or update a stage
                      </summary>
                      <div className="mt-3 max-w-xl rounded-lg bg-slate-50/70 p-3">
                        <InlineForm
                          action={saveTemplateMilestoneAction}
                          hidden={{ templateId: template.id }}
                          submitLabel="Save milestone"
                        >
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Field label="Stage" htmlFor={`add-stage-${template.id}`} required className="sm:col-span-2">
                              <Select
                                id={`add-stage-${template.id}`}
                                name="stageId"
                                defaultValue=""
                                required
                              >
                                <option value="" disabled>
                                  Select a stage
                                </option>
                                {activeStages.map((stage) => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.sequence}. {stage.name}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Offset days" htmlFor={`add-offset-${template.id}`} required>
                              <Input
                                id={`add-offset-${template.id}`}
                                name="offsetDays"
                                type="number"
                                min={-365}
                                max={365}
                                defaultValue={-30}
                                required
                              />
                            </Field>
                          </div>
                          <label className="flex items-center gap-2 text-[12px] text-slate-700">
                            <input
                              type="checkbox"
                              name="isOptional"
                              className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
                            />
                            Optional stage
                          </label>
                        </InlineForm>
                      </div>
                    </details>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
