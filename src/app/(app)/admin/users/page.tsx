import type { Metadata } from "next";
import { KeyRound, Pencil, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, InfoNote } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireRoles } from "@/lib/auth/session";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/constants";
import { getMasterData, listAdminUsers } from "@/lib/services/admin";
import { formatDate, initials } from "@/lib/utils";
import { createUserAction, resetPasswordAction, updateUserAction } from "../actions";
import { InlineForm } from "@/components/admin/inline-form";

export const metadata: Metadata = { title: "Users & roles" };

const ROLE_BADGE: Record<Role, "purple" | "default" | "neutral" | "outline"> = {
  super_admin: "purple",
  managing_director: "default",
  merchandiser: "default",
  unit_supervisor: "neutral",
  buyer: "outline",
};

export default async function AdminUsersPage() {
  const user = await requireRoles("super_admin");
  const [users, master] = await Promise.all([listAdminUsers(user), getMasterData(user)]);

  const active = users.filter((row) => row.is_active).length;
  const internal = users.filter((row) =>
    ["super_admin", "managing_director", "merchandiser"].includes(row.role),
  ).length;
  const buyers = users.filter((row) => row.role === "buyer").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        description="Create accounts, assign role-based scopes and reset credentials. Role changes take effect on the user's next request — sessions re-read the profile every time."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accounts" value={users.length} icon={Users} hint="All roles" />
        <StatCard label="Active" value={active} icon={ShieldCheck} tone="green" hint="Can sign in" />
        <StatCard label="Internal team" value={internal} icon={Users} tone="slate" hint="Admin, MD, merchandising" />
        <StatCard label="Buyer logins" value={buyers} icon={Users} tone="brand" hint="Isolated by buyer company" />
      </div>

      <InfoNote variant="info" title="Authorisation is enforced twice">
        Every sensitive request is checked in the service layer and again by PostgreSQL row-level
        security. Deactivating an account signs it out on its next request. Passwords are hashed with
        bcrypt and never displayed. You cannot deactivate your own account or remove the last active
        Super Admin.
      </InfoNote>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Add a user account</CardTitle>
            <CardDescription>
              Choose a role first, then the matching scope: unit supervisors need a production unit
              and buyers need a buyer company.
            </CardDescription>
          </div>
          <UserPlus className="size-5 text-slate-400" />
        </CardHeader>
        <CardContent>
          <InlineForm action={createUserAction} submitLabel="Create account">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Full name" htmlFor="new-user-name" required>
                <Input id="new-user-name" name="fullName" autoComplete="off" required />
              </Field>
              <Field label="Email" htmlFor="new-user-email" required>
                <Input id="new-user-email" name="email" type="email" autoComplete="off" required />
              </Field>
              <Field label="Role" htmlFor="new-user-role" required>
                <Select id="new-user-role" name="role" defaultValue="merchandiser" required>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Temporary password"
                htmlFor="new-user-password"
                required
                hint="Minimum 10 characters. Share it securely; the user can ask an admin to reset it."
              >
                <Input
                  id="new-user-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  required
                />
              </Field>
              <Field label="Phone" htmlFor="new-user-phone">
                <Input id="new-user-phone" name="phone" autoComplete="off" placeholder="+91…" />
              </Field>
              <Field label="Production unit" htmlFor="new-user-unit" hint="Required for unit supervisors">
                <Select id="new-user-unit" name="unitId" defaultValue="">
                  <option value="">No unit</option>
                  {master.units
                    .filter((unit) => unit.is_active)
                    .map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.code})
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Buyer company" htmlFor="new-user-buyer" hint="Required for buyer accounts">
                <Select id="new-user-buyer" name="buyerId" defaultValue="">
                  <option value="">No buyer</option>
                  {master.buyers
                    .filter((buyer) => buyer.is_active)
                    .map((buyer) => (
                      <option key={buyer.id} value={buyer.id}>
                        {buyer.name} ({buyer.code})
                      </option>
                    ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-slate-700">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked
                  className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Account is active immediately
              </label>
            </div>
          </InlineForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All accounts</CardTitle>
          <CardDescription>
            {users.length} account{users.length === 1 ? "" : "s"} · password hashes are never returned
            to the browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <EmptyState icon={Users} title="No accounts yet" description="Create the first user above." />
          ) : (
            <ul className="grid gap-3 xl:grid-cols-2">
              {users.map((row) => {
                const scope =
                  row.role === "buyer"
                    ? row.buyer_name ?? "Buyer company missing"
                    : row.role === "unit_supervisor"
                      ? row.unit_name ?? "Unit missing"
                      : "Company-wide";
                return (
                  <li key={row.id} className="rounded-xl border border-line bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-dark">
                        {initials(row.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-ink">{row.full_name}</p>
                          {row.id === user.id ? <Badge variant="outline">You</Badge> : null}
                        </div>
                        <p className="truncate text-[12px] text-muted">{row.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant={ROLE_BADGE[row.role]}>{ROLE_LABELS[row.role]}</Badge>
                          <Badge variant={row.is_active ? "success" : "neutral"}>
                            {row.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {row.phone ? <Badge variant="outline">{row.phone}</Badge> : null}
                        </div>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                      <div>
                        <dt className="text-muted">Scope</dt>
                        <dd className="font-medium text-ink">{scope}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Active orders</dt>
                        <dd className="font-medium text-ink">
                          {row.role === "merchandiser" ? row.active_orders : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Created</dt>
                        <dd className="text-ink">{formatDate(row.created_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">Updated</dt>
                        <dd className="text-ink">{formatDate(row.updated_at)}</dd>
                      </div>
                    </dl>

                    <div className="mt-3 space-y-2 border-t border-line pt-3">
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-brand hover:text-brand-dark">
                          <Pencil className="size-3.5" /> Edit role, scope or status
                        </summary>
                        <div className="mt-3 rounded-lg bg-slate-50/70 p-3">
                          <InlineForm
                            action={updateUserAction}
                            hidden={{ userId: row.id, email: row.email }}
                            submitLabel="Save changes"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Full name" htmlFor={`name-${row.id}`} required>
                                <Input
                                  id={`name-${row.id}`}
                                  name="fullName"
                                  defaultValue={row.full_name}
                                  required
                                />
                              </Field>
                              <Field label="Role" htmlFor={`role-${row.id}`} required>
                                <Select id={`role-${row.id}`} name="role" defaultValue={row.role}>
                                  {ROLES.map((role) => (
                                    <option key={role} value={role}>
                                      {ROLE_LABELS[role]}
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field label="Phone" htmlFor={`phone-${row.id}`}>
                                <Input id={`phone-${row.id}`} name="phone" defaultValue={row.phone ?? ""} />
                              </Field>
                              <Field label="Production unit" htmlFor={`unit-${row.id}`}>
                                <Select id={`unit-${row.id}`} name="unitId" defaultValue={row.unit_id ?? ""}>
                                  <option value="">No unit</option>
                                  {master.units.map((unit) => (
                                    <option key={unit.id} value={unit.id}>
                                      {unit.name} ({unit.code})
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <Field label="Buyer company" htmlFor={`buyer-${row.id}`}>
                                <Select id={`buyer-${row.id}`} name="buyerId" defaultValue={row.buyer_id ?? ""}>
                                  <option value="">No buyer</option>
                                  {master.buyers.map((buyer) => (
                                    <option key={buyer.id} value={buyer.id}>
                                      {buyer.name} ({buyer.code})
                                    </option>
                                  ))}
                                </Select>
                              </Field>
                              <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-slate-700">
                                <input
                                  type="checkbox"
                                  name="isActive"
                                  defaultChecked={row.is_active}
                                  disabled={row.id === user.id}
                                  className="size-4 rounded border-slate-300 text-brand focus:ring-brand"
                                />
                                Account active
                              </label>
                            </div>
                          </InlineForm>
                        </div>
                      </details>

                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-slate-600 hover:text-ink">
                          <KeyRound className="size-3.5" /> Reset password
                        </summary>
                        <div className="mt-3 rounded-lg bg-slate-50/70 p-3">
                          <InlineForm
                            action={resetPasswordAction}
                            hidden={{ userId: row.id }}
                            submitLabel="Reset password"
                            variant="outline"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="New password" htmlFor={`pw-${row.id}`} required>
                                <Input
                                  id={`pw-${row.id}`}
                                  name="password"
                                  type="password"
                                  autoComplete="new-password"
                                  minLength={10}
                                  required
                                />
                              </Field>
                              <Field label="Confirm password" htmlFor={`pw2-${row.id}`} required>
                                <Input
                                  id={`pw2-${row.id}`}
                                  name="confirmPassword"
                                  type="password"
                                  autoComplete="new-password"
                                  minLength={10}
                                  required
                                />
                              </Field>
                            </div>
                          </InlineForm>
                        </div>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
