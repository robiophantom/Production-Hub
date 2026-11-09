import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { getDb, sql, type Queryable } from "@/lib/db";
import type { Role } from "@/lib/constants";
import type {
  AuditLog,
  Buyer,
  BuyerNotification,
  OrderDateHistory,
  ProductionStage,
  ProductionUnit,
  SessionUser,
  Subcontractor,
  TnaTemplate,
  TnaTemplateMilestone,
} from "@/types";

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  unit_id: string | null;
  buyer_id: string | null;
  unit_name: string | null;
  buyer_name: string | null;
  is_active: boolean;
  active_orders: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUserInput {
  fullName: string;
  email: string;
  role: Role;
  phone?: string;
  unitId?: string;
  buyerId?: string;
  isActive?: boolean;
  password?: string;
}

export interface AdminBuyerRow extends Buyer {
  order_count: number;
}

export interface AdminUnitRow extends ProductionUnit {
  order_count: number;
  supervisor_count: number;
}

export interface AdminStageRow extends ProductionStage {
  milestone_count: number;
}

export interface AdminSubcontractorRow extends Subcontractor {
  assignment_count: number;
}

export interface AdminTemplateMilestone extends TnaTemplateMilestone {
  stage_name: string;
  stage_code: string;
}

export interface AdminTemplateRow extends TnaTemplate {
  milestones: AdminTemplateMilestone[];
}

export interface MasterData {
  buyers: AdminBuyerRow[];
  units: AdminUnitRow[];
  stages: AdminStageRow[];
  subcontractors: AdminSubcontractorRow[];
  templates: AdminTemplateRow[];
}

export interface AuditRow extends AuditLog {
  actor_name: string | null;
  po_number: string | null;
}

export interface DateHistoryRow extends OrderDateHistory {
  actor_name: string | null;
  po_number: string | null;
}

export interface NotificationAuditRow extends BuyerNotification {
  po_number: string;
  approved_by_name: string | null;
}

export interface SettingsInput {
  excludedWeekdays: number[];
  healthyBufferWorkingDays: number;
  insufficientDataDays: number;
  historyWindowDays: number;
  amberRateTolerancePercent: number;
  alertReviewDays: number;
  escalationDays: number;
  criticalDays: number;
  language: "en" | "ta";
}

function assertAdmin(user: SessionUser): void {
  if (user.role !== "super_admin") {
    throw new Error("Only a Super Admin can manage this area.");
  }
}

async function writeAudit(
  tx: Queryable,
  input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    detail?: Record<string, unknown>;
    poId?: string | null;
  },
): Promise<void> {
  await tx.query(
    `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      input.poId ?? null,
      input.actorId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      JSON.stringify(input.detail ?? {}),
    ],
  );
}

export async function listAdminUsers(user: SessionUser): Promise<AdminUserRow[]> {
  assertAdmin(user);
  return sql<AdminUserRow>(
    `select p.id, p.email, p.full_name, p.role, p.phone, p.unit_id, p.buyer_id,
            u.name as unit_name, b.name as buyer_name, p.is_active,
            p.created_at, p.updated_at,
            (select count(*)::int from purchase_orders po
              where po.merchandiser_id = p.id and po.status = 'active') as active_orders
       from profiles p
       left join production_units u on u.id = p.unit_id
       left join buyers b on b.id = p.buyer_id
      order by case p.role
                 when 'super_admin' then 0
                 when 'managing_director' then 1
                 when 'merchandiser' then 2
                 when 'unit_supervisor' then 3
                 else 4
               end,
               p.full_name`,
  );
}

async function assertUniqueEmail(email: string, excludeId?: string): Promise<void> {
  const rows = excludeId
    ? await sql<{ id: string }>("select id from profiles where lower(email) = lower($1) and id <> $2", [
        email,
        excludeId,
      ])
    : await sql<{ id: string }>("select id from profiles where lower(email) = lower($1)", [email]);
  if (rows.length > 0) throw new Error("Another account already uses this email address.");
}

function validateRoleScope(input: { role: Role; unitId?: string; buyerId?: string }): void {
  if (input.role === "buyer" && !input.buyerId) {
    throw new Error("Buyer accounts must be linked to a buyer company.");
  }
  if (input.role === "unit_supervisor" && !input.unitId) {
    throw new Error("Unit supervisor accounts must be linked to a production unit.");
  }
}

export async function createAdminUser(
  user: SessionUser,
  input: AdminUserInput,
): Promise<string> {
  assertAdmin(user);
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!input.fullName.trim()) throw new Error("Full name is required.");
  if (!input.password || input.password.length < 10) {
    throw new Error("Set a password of at least 10 characters.");
  }
  validateRoleScope(input);
  await assertUniqueEmail(email);

  const passwordHash = await hash(input.password, 10);
  const id = randomUUID();
  const unitId = input.role === "unit_supervisor" ? input.unitId ?? null : null;
  const buyerId = input.role === "buyer" ? input.buyerId ?? null : null;

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into profiles
        (id, email, full_name, role, phone, unit_id, buyer_id, password_hash, is_active)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        email,
        input.fullName.trim(),
        input.role,
        input.phone?.trim() || null,
        unitId,
        buyerId,
        passwordHash,
        input.isActive ?? true,
      ],
    );
    await writeAudit(tx, {
      actorId: user.id,
      action: "user_created",
      entityType: "profile",
      entityId: id,
      detail: { email, full_name: input.fullName.trim(), role: input.role },
    });
  });

  return id;
}

export async function updateAdminUser(
  user: SessionUser,
  userId: string,
  input: AdminUserInput,
): Promise<void> {
  assertAdmin(user);
  const db = await getDb();
  const existing = await db.one<{
    id: string;
    role: Role;
    is_active: boolean;
    full_name: string;
    phone: string | null;
    unit_id: string | null;
    buyer_id: string | null;
  }>("select id, role, is_active, full_name, phone, unit_id, buyer_id from profiles where id = $1", [
    userId,
  ]);
  if (!existing) throw new Error("User not found.");

  const isActive = input.isActive ?? existing.is_active;
  if (userId === user.id && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }
  if (userId === user.id && input.role !== "super_admin") {
    throw new Error("You cannot remove your own Super Admin role.");
  }
  validateRoleScope(input);
  if (existing.role === "super_admin" && existing.is_active && (input.role !== "super_admin" || !isActive)) {
    const others = await db.one<{ count: number }>(
      "select count(*)::int as count from profiles where role = 'super_admin' and is_active = true and id <> $1",
      [userId],
    );
    if ((others?.count ?? 0) === 0) {
      throw new Error("At least one active Super Admin must remain.");
    }
  }

  const unitId = input.role === "unit_supervisor" ? input.unitId ?? null : null;
  const buyerId = input.role === "buyer" ? input.buyerId ?? null : null;
  const detail = {
    before: {
      full_name: existing.full_name,
      role: existing.role,
      phone: existing.phone,
      unit_id: existing.unit_id,
      buyer_id: existing.buyer_id,
      is_active: existing.is_active,
    },
    after: {
      full_name: input.fullName.trim(),
      role: input.role,
      phone: input.phone?.trim() || null,
      unit_id: unitId,
      buyer_id: buyerId,
      is_active: isActive,
    },
  };

  await db.transaction(async (tx) => {
    await tx.query(
      `update profiles
          set full_name = $2, role = $3, phone = $4, unit_id = $5, buyer_id = $6,
              is_active = $7, updated_at = now()
        where id = $1`,
      [
        userId,
        input.fullName.trim(),
        input.role,
        input.phone?.trim() || null,
        unitId,
        buyerId,
        isActive,
      ],
    );
    await writeAudit(tx, {
      actorId: user.id,
      action: "user_updated",
      entityType: "profile",
      entityId: userId,
      detail,
    });
  });
}

export async function resetAdminUserPassword(
  user: SessionUser,
  userId: string,
  password: string,
): Promise<void> {
  assertAdmin(user);
  if (password.length < 10) throw new Error("Use a password of at least 10 characters.");
  const db = await getDb();
  const existing = await db.one<{ id: string; email: string }>(
    "select id, email from profiles where id = $1",
    [userId],
  );
  if (!existing) throw new Error("User not found.");

  const passwordHash = await hash(password, 10);
  await db.transaction(async (tx) => {
    await tx.query("update profiles set password_hash = $2, updated_at = now() where id = $1", [
      userId,
      passwordHash,
    ]);
    await writeAudit(tx, {
      actorId: user.id,
      action: "user_password_reset",
      entityType: "profile",
      entityId: userId,
      detail: { email: existing.email },
    });
  });
}

export async function getMasterData(user: SessionUser): Promise<MasterData> {
  assertAdmin(user);
  const [buyers, units, stages, subcontractors, templates, templateMilestones] = await Promise.all([
    sql<AdminBuyerRow>(
      `select b.*, (select count(*)::int from purchase_orders po where po.buyer_id = b.id) as order_count
         from buyers b order by b.code`,
    ),
    sql<AdminUnitRow>(
      `select u.*,
              (select count(*)::int from purchase_orders po where po.primary_unit_id = u.id) as order_count,
              (select count(*)::int from profiles p where p.unit_id = u.id and p.role = 'unit_supervisor') as supervisor_count
         from production_units u order by u.code`,
    ),
    sql<AdminStageRow>(
      `select s.*,
              (select count(*)::int from order_milestones om where om.stage_id = s.id) as milestone_count
         from production_stages s order by s.sequence`,
    ),
    sql<AdminSubcontractorRow>(
      `select s.*,
              (select count(*)::int from stage_assignments sa where sa.subcontractor_id = s.id) as assignment_count
         from subcontractors s order by s.name`,
    ),
    sql<TnaTemplate>("select * from tna_templates order by name"),
    sql<AdminTemplateMilestone>(
      `select tm.*, s.name as stage_name, s.code as stage_code
         from tna_template_milestones tm
         join production_stages s on s.id = tm.stage_id
        order by tm.template_id, tm.sequence`,
    ),
  ]);

  const templatesWithMilestones = templates.map((template) => ({
    ...template,
    milestones: templateMilestones.filter((milestone) => milestone.template_id === template.id),
  }));

  return {
    buyers,
    units,
    stages,
    subcontractors,
    templates: templatesWithMilestones,
  };
}

export async function saveBuyer(
  user: SessionUser,
  input: {
    id?: string;
    name: string;
    code: string;
    country?: string;
    contactPerson?: string;
    contactEmail?: string;
    isActive?: boolean;
  },
): Promise<void> {
  assertAdmin(user);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
    throw new Error("Buyer code must be 2–20 characters using letters, numbers, dashes or underscores.");
  }
  if (!input.name.trim()) throw new Error("Buyer name is required.");
  const db = await getDb();
  const duplicate = await db.one<{ id: string }>(
    input.id
      ? "select id from buyers where code = $1 and id <> $2"
      : "select id from buyers where code = $1",
    input.id ? [code, input.id] : [code],
  );
  if (duplicate) throw new Error(`Buyer code ${code} is already in use.`);

  const id = input.id ?? randomUUID();
  await db.transaction(async (tx) => {
    if (input.id) {
      await tx.query(
        `update buyers set name = $2, code = $3, country = $4, contact_person = $5,
                contact_email = $6, is_active = $7 where id = $1`,
        [
          id,
          input.name.trim(),
          code,
          input.country?.trim() || "India",
          input.contactPerson?.trim() || null,
          input.contactEmail?.trim() || null,
          input.isActive ?? true,
        ],
      );
    } else {
      await tx.query(
        `insert into buyers (id, name, code, country, contact_person, contact_email, is_active)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          input.name.trim(),
          code,
          input.country?.trim() || "India",
          input.contactPerson?.trim() || null,
          input.contactEmail?.trim() || null,
          input.isActive ?? true,
        ],
      );
    }
    await writeAudit(tx, {
      actorId: user.id,
      action: input.id ? "buyer_updated" : "buyer_created",
      entityType: "buyer",
      entityId: id,
      detail: { name: input.name.trim(), code, is_active: input.isActive ?? true },
    });
  });
}

export async function saveUnit(
  user: SessionUser,
  input: {
    id?: string;
    name: string;
    code: string;
    location?: string;
    isActive?: boolean;
  },
): Promise<void> {
  assertAdmin(user);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) {
    throw new Error("Unit code must be 2–20 characters using letters, numbers, dashes or underscores.");
  }
  if (!input.name.trim()) throw new Error("Unit name is required.");
  const db = await getDb();
  const duplicate = await db.one<{ id: string }>(
    input.id
      ? "select id from production_units where code = $1 and id <> $2"
      : "select id from production_units where code = $1",
    input.id ? [code, input.id] : [code],
  );
  if (duplicate) throw new Error(`Unit code ${code} is already in use.`);

  const id = input.id ?? randomUUID();
  await db.transaction(async (tx) => {
    if (input.id) {
      await tx.query(
        "update production_units set name = $2, code = $3, location = $4, is_active = $5 where id = $1",
        [id, input.name.trim(), code, input.location?.trim() || null, input.isActive ?? true],
      );
    } else {
      await tx.query(
        `insert into production_units (id, name, code, location, is_active)
         values ($1,$2,$3,$4,$5)`,
        [id, input.name.trim(), code, input.location?.trim() || null, input.isActive ?? true],
      );
    }
    await writeAudit(tx, {
      actorId: user.id,
      action: input.id ? "unit_updated" : "unit_created",
      entityType: "production_unit",
      entityId: id,
      detail: { name: input.name.trim(), code, is_active: input.isActive ?? true },
    });
  });
}

export async function saveStage(
  user: SessionUser,
  input: {
    id?: string;
    name: string;
    code: string;
    sequence: number;
    isActive?: boolean;
  },
): Promise<void> {
  assertAdmin(user);
  const code = input.code.trim().toLowerCase().replace(/\s+/g, "_");
  if (!/^[a-z0-9_]{2,40}$/.test(code)) {
    throw new Error("Stage code must be 2–40 lowercase characters, numbers or underscores.");
  }
  if (!input.name.trim()) throw new Error("Stage name is required.");
  if (!Number.isInteger(input.sequence) || input.sequence < 1 || input.sequence > 99) {
    throw new Error("Stage sequence must be a whole number between 1 and 99.");
  }
  const db = await getDb();
  const duplicate = await db.one<{ id: string; code: string; sequence: number }>(
    `select id, code, sequence from production_stages
      where (code = $1 or name = $2 or sequence = $3) and ($4::uuid is null or id <> $4)`,
    [code, input.name.trim(), input.sequence, input.id ?? null],
  );
  if (duplicate) {
    if (duplicate.code === code) throw new Error(`Stage code ${code} is already in use.`);
    if (duplicate.sequence === input.sequence) {
      throw new Error(`Sequence ${input.sequence} is already assigned to another stage.`);
    }
    throw new Error(`A stage named ${input.name.trim()} already exists.`);
  }

  const id = input.id ?? randomUUID();
  await db.transaction(async (tx) => {
    if (input.id) {
      await tx.query(
        "update production_stages set name = $2, code = $3, sequence = $4, is_active = $5 where id = $1",
        [id, input.name.trim(), code, input.sequence, input.isActive ?? true],
      );
    } else {
      await tx.query(
        `insert into production_stages (id, name, code, sequence, is_active)
         values ($1,$2,$3,$4,$5)`,
        [id, input.name.trim(), code, input.sequence, input.isActive ?? true],
      );
    }
    await writeAudit(tx, {
      actorId: user.id,
      action: input.id ? "stage_updated" : "stage_created",
      entityType: "production_stage",
      entityId: id,
      detail: { name: input.name.trim(), code, sequence: input.sequence },
    });
  });
}

export async function saveSubcontractor(
  user: SessionUser,
  input: {
    id?: string;
    name: string;
    type: "printing" | "washing" | "other";
    contactPerson?: string;
    phone?: string;
    isActive?: boolean;
  },
): Promise<void> {
  assertAdmin(user);
  if (!input.name.trim()) throw new Error("Subcontractor name is required.");
  if (!["printing", "washing", "other"].includes(input.type)) {
    throw new Error("Choose a valid subcontractor type.");
  }
  const id = input.id ?? randomUUID();
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (input.id) {
      await tx.query(
        `update subcontractors set name = $2, type = $3, contact_person = $4,
                phone = $5, is_active = $6 where id = $1`,
        [
          id,
          input.name.trim(),
          input.type,
          input.contactPerson?.trim() || null,
          input.phone?.trim() || null,
          input.isActive ?? true,
        ],
      );
    } else {
      await tx.query(
        `insert into subcontractors (id, name, type, contact_person, phone, is_active)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          id,
          input.name.trim(),
          input.type,
          input.contactPerson?.trim() || null,
          input.phone?.trim() || null,
          input.isActive ?? true,
        ],
      );
    }
    await writeAudit(tx, {
      actorId: user.id,
      action: input.id ? "subcontractor_updated" : "subcontractor_created",
      entityType: "subcontractor",
      entityId: id,
      detail: { name: input.name.trim(), type: input.type },
    });
  });
}

export async function saveTemplate(
  user: SessionUser,
  input: { id?: string; name: string; description?: string; isActive?: boolean },
): Promise<void> {
  assertAdmin(user);
  if (!input.name.trim()) throw new Error("Template name is required.");
  const db = await getDb();
  const duplicate = await db.one<{ id: string }>(
    input.id
      ? "select id from tna_templates where name = $1 and id <> $2"
      : "select id from tna_templates where name = $1",
    input.id ? [input.name.trim(), input.id] : [input.name.trim()],
  );
  if (duplicate) throw new Error(`A TNA template named ${input.name.trim()} already exists.`);

  const id = input.id ?? randomUUID();
  await db.transaction(async (tx) => {
    if (input.id) {
      await tx.query(
        "update tna_templates set name = $2, description = $3, is_active = $4 where id = $1",
        [id, input.name.trim(), input.description?.trim() || null, input.isActive ?? true],
      );
    } else {
      await tx.query(
        "insert into tna_templates (id, name, description, is_active) values ($1,$2,$3,$4)",
        [id, input.name.trim(), input.description?.trim() || null, input.isActive ?? true],
      );
    }
    await writeAudit(tx, {
      actorId: user.id,
      action: input.id ? "tna_template_updated" : "tna_template_created",
      entityType: "tna_template",
      entityId: id,
      detail: { name: input.name.trim() },
    });
  });
}

export async function saveTemplateMilestone(
  user: SessionUser,
  input: {
    templateId: string;
    stageId: string;
    offsetDays: number;
    isOptional?: boolean;
  },
): Promise<void> {
  assertAdmin(user);
  if (!Number.isInteger(input.offsetDays) || input.offsetDays < -365 || input.offsetDays > 365) {
    throw new Error("Offset must be a whole number of days between -365 and 365.");
  }
  const db = await getDb();
  const template = await db.one<{ id: string }>("select id from tna_templates where id = $1", [
    input.templateId,
  ]);
  if (!template) throw new Error("TNA template not found.");
  const stage = await db.one<{ id: string; name: string }>(
    "select id, name from production_stages where id = $1",
    [input.stageId],
  );
  if (!stage) throw new Error("Select a valid production stage.");

  await db.transaction(async (tx) => {
    const maxRow = await tx.query<{ max: number | null }>(
      "select max(sequence)::int as max from tna_template_milestones where template_id = $1",
      [input.templateId],
    );
    const nextSequence = (maxRow[0]?.max ?? 0) + 1;
    await tx.query(
      `insert into tna_template_milestones (id, template_id, stage_id, sequence, offset_days, is_optional)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (template_id, stage_id) do update
         set offset_days = excluded.offset_days, is_optional = excluded.is_optional`,
      [
        randomUUID(),
        input.templateId,
        input.stageId,
        nextSequence,
        input.offsetDays,
        input.isOptional ?? false,
      ],
    );
    await writeAudit(tx, {
      actorId: user.id,
      action: "tna_template_milestone_saved",
      entityType: "tna_template",
      entityId: input.templateId,
      detail: { stage: stage.name, offset_days: input.offsetDays, optional: input.isOptional ?? false },
    });
  });
}

export async function removeTemplateMilestone(
  user: SessionUser,
  templateId: string,
  milestoneId: string,
): Promise<void> {
  assertAdmin(user);
  const db = await getDb();
  const row = await db.one<{ id: string; stage_id: string }>(
    "select id, stage_id from tna_template_milestones where id = $1 and template_id = $2",
    [milestoneId, templateId],
  );
  if (!row) throw new Error("Template milestone not found.");

  await db.transaction(async (tx) => {
    await tx.query("delete from tna_template_milestones where id = $1 and template_id = $2", [
      milestoneId,
      templateId,
    ]);
    await tx.query(
      `update tna_template_milestones tm
          set sequence = ranked.rn
         from (
           select id, row_number() over (order by sequence) as rn
             from tna_template_milestones
            where template_id = $1
         ) ranked
        where tm.id = ranked.id and tm.template_id = $1`,
      [templateId],
    );
    await writeAudit(tx, {
      actorId: user.id,
      action: "tna_template_milestone_removed",
      entityType: "tna_template",
      entityId: templateId,
      detail: { milestone_id: milestoneId },
    });
  });
}

export interface AuditFilters {
  q?: string;
  entity?: string;
  from?: string;
  to?: string;
}

function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function listAuditEvents(
  user: SessionUser,
  filters: AuditFilters = {},
): Promise<AuditRow[]> {
  assertAdmin(user);
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    clauses.push(
      `(a.action ilike $${params.length} or a.entity_type ilike $${params.length}
        or p.full_name ilike $${params.length} or po.po_number ilike $${params.length})`,
    );
  }
  if (filters.entity?.trim()) {
    params.push(filters.entity.trim());
    clauses.push(`a.entity_type = $${params.length}`);
  }
  if (isIsoDate(filters.from)) {
    params.push(filters.from);
    clauses.push(`a.created_at >= $${params.length}::date`);
  }
  if (isIsoDate(filters.to)) {
    params.push(filters.to);
    clauses.push(`a.created_at < ($${params.length}::date + interval '1 day')`);
  }

  return sql<AuditRow>(
    `select a.id, a.po_id, a.actor_id, a.action, a.entity_type, a.entity_id, a.detail, a.created_at,
            p.full_name as actor_name, po.po_number
       from audit_logs a
       left join profiles p on p.id = a.actor_id
       left join purchase_orders po on po.id = a.po_id
      ${clauses.length ? `where ${clauses.join(" and ")}` : ""}
      order by a.created_at desc, a.id
      limit 250`,
    params,
  );
}

export async function listDateHistory(user: SessionUser): Promise<DateHistoryRow[]> {
  assertAdmin(user);
  return sql<DateHistoryRow>(
    `select h.id, h.po_id, h.milestone_id, h.field_name, h.previous_date, h.new_date, h.reason,
            h.changed_by, h.changed_at, p.full_name as actor_name, po.po_number
       from order_date_history h
       left join profiles p on p.id = h.changed_by
       left join purchase_orders po on po.id = h.po_id
      order by h.changed_at desc
      limit 250`,
  );
}

export async function listNotificationAudit(
  user: SessionUser,
): Promise<NotificationAuditRow[]> {
  assertAdmin(user);
  return sql<NotificationAuditRow>(
    `select n.id, n.po_id, n.alert_id, n.subject, n.message, n.status, n.approved_by,
            n.approved_at, n.sent_at, n.created_by, n.created_at,
            po.po_number, p.full_name as approved_by_name
       from buyer_notifications n
       join purchase_orders po on po.id = n.po_id
       left join profiles p on p.id = n.approved_by
      order by n.created_at desc
      limit 250`,
  );
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function calendarLabel(excludedWeekdays: number[]): string {
  if (excludedWeekdays.length === 0) return "Seven-day working week";
  const names = excludedWeekdays.map((day) => WEEKDAY_NAMES[day]).filter(Boolean);
  if (excludedWeekdays.length === 1 && excludedWeekdays[0] === 0) {
    return "Monday to Saturday (Sunday off)";
  }
  return `Working week (${names.join(", ")} off)`;
}

export async function updateAppSettings(
  user: SessionUser,
  input: SettingsInput,
): Promise<void> {
  assertAdmin(user);
  const excluded = [...new Set(input.excludedWeekdays)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
  if (excluded.length === 7) throw new Error("At least one working day is required.");
  if (input.healthyBufferWorkingDays < 0 || input.healthyBufferWorkingDays > 30) {
    throw new Error("Healthy buffer must be between 0 and 30 working days.");
  }
  if (input.insufficientDataDays < 1 || input.insufficientDataDays > 14) {
    throw new Error("Insufficient-data threshold must be between 1 and 14 days.");
  }
  if (input.historyWindowDays < 1 || input.historyWindowDays > 30) {
    throw new Error("History window must be between 1 and 30 working days.");
  }
  if (input.amberRateTolerancePercent < 0 || input.amberRateTolerancePercent > 100) {
    throw new Error("Amber rate tolerance must be between 0 and 100 percent.");
  }
  if (
    input.alertReviewDays < 1 ||
    input.escalationDays < 1 ||
    input.criticalDays < 1 ||
    input.alertReviewDays > 90 ||
    input.escalationDays > 90 ||
    input.criticalDays > 90
  ) {
    throw new Error("Alert windows must be between 1 and 90 days.");
  }
  if (!(input.criticalDays < input.escalationDays && input.escalationDays < input.alertReviewDays)) {
    throw new Error("Alert windows must narrow: 3-day < 7-day < 14-day review window.");
  }
  if (input.language !== "en" && input.language !== "ta") {
    throw new Error("Choose a supported default language.");
  }

  const workingDays = { excludedWeekdays: excluded, label: calendarLabel(excluded) };
  const risk = {
    healthyBufferWorkingDays: input.healthyBufferWorkingDays,
    insufficientDataDays: input.insufficientDataDays,
    historyWindowDays: input.historyWindowDays,
    amberRateTolerancePercent: input.amberRateTolerancePercent,
  };
  const defaults = {
    language: input.language,
    alertReviewDays: input.alertReviewDays,
    escalationDays: input.escalationDays,
    criticalDays: input.criticalDays,
  };

  const db = await getDb();
  await db.transaction(async (tx) => {
    const existing = await tx.query<{ key: string; value: unknown }>(
      "select key, value from app_settings where key in ('working_days','risk_thresholds','defaults')",
    );
    const before = Object.fromEntries(existing.map((row) => [row.key, row.value]));

    for (const [key, value] of Object.entries({ working_days: workingDays, risk_thresholds: risk, defaults })) {
      await tx.query(
        `insert into app_settings (key, value, updated_by, updated_at)
         values ($1, $2::jsonb, $3, now())
         on conflict (key) do update
           set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
        [key, JSON.stringify(value), user.id],
      );
    }

    await writeAudit(tx, {
      actorId: user.id,
      action: "settings_updated",
      entityType: "app_settings",
      detail: {
        before,
        after: { working_days: workingDays, risk_thresholds: risk, defaults },
      },
    });
  });
}
