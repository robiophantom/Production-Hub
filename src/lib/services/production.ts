import { getDb, sql } from "@/lib/db";
import type {
  IssueCategory,
  IssueSeverity,
  OrderMilestone,
  OrderSummary,
  ProductionIssue,
  ProductionPhoto,
  ProductionStage,
  ProductionUpdate,
  SessionUser,
} from "@/types";
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES } from "@/lib/constants";
import { assertCanEditOrder, assertSupervisorAssigned } from "./access";
import { getAppConfig } from "./settings";
import { loadOrderSummaries } from "./order-summaries";

export interface SupervisorStage {
  milestone: OrderMilestone;
  stage: ProductionStage;
  cumulative: number;
  remaining: number;
  todayQuantity: number;
  plannedDate: string;
  targetQuantity: number;
}

export interface SupervisorOrder {
  summary: OrderSummary;
  stages: SupervisorStage[];
}

export async function getSupervisorWorkspace(user: SessionUser): Promise<{
  orders: SupervisorOrder[];
  businessDate: string;
}> {
  const config = await getAppConfig();
  const summaries = await loadOrderSummaries(user);

  const stageRows = await sql<
    OrderMilestone & {
      stage_name: string;
      stage_code: string;
      stage_sequence: number;
      cumulative: number;
      today_quantity: number;
    }
  >(
    `select om.*, ps.name as stage_name, ps.code as stage_code, ps.sequence as stage_sequence,
            coalesce((select sum(quantity) from production_updates pu where pu.milestone_id = om.id), 0)::int as cumulative,
            coalesce((select sum(quantity) from production_updates pu where pu.milestone_id = om.id and pu.update_date = $2), 0)::int as today_quantity
       from order_milestones om
       join production_stages ps on ps.id = om.stage_id
       join stage_assignments sa on sa.milestone_id = om.id
      where sa.supervisor_id = $1 and om.is_active = true
      order by ps.sequence asc`,
    [user.id, config.businessDate],
  );

  const stagesByOrder = new Map<string, SupervisorStage[]>();
  for (const row of stageRows) {
    const stage: ProductionStage = {
      id: row.stage_id,
      name: row.stage_name,
      code: row.stage_code,
      sequence: Number(row.stage_sequence),
      is_active: true,
      created_at: "",
    };
    const cumulative = Number(row.cumulative);
    const target = Number(row.target_quantity);
    const list = stagesByOrder.get(row.po_id) ?? [];
    list.push({
      milestone: {
        id: row.id,
        po_id: row.po_id,
        stage_id: row.stage_id,
        sequence: Number(row.sequence),
        planned_date: row.planned_date,
        target_quantity: target,
        status: row.status,
        is_active: row.is_active,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      stage,
      cumulative,
      remaining: Math.max(0, target - cumulative),
      todayQuantity: Number(row.today_quantity),
      plannedDate: row.planned_date,
      targetQuantity: target,
    });
    stagesByOrder.set(row.po_id, list);
  }

  const orders = summaries
    .filter((summary) => stagesByOrder.has(summary.order.id))
    .map((summary) => ({
      summary,
      stages: (stagesByOrder.get(summary.order.id) ?? []).sort(
        (a, b) => a.stage.sequence - b.stage.sequence,
      ),
    }));

  return { orders, businessDate: config.businessDate };
}

export interface PhotoInput {
  url: string;
  publicId: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  caption?: string;
}

export interface IssueInput {
  descriptionTamil?: string;
  descriptionEnglish?: string;
  category: IssueCategory;
  severity: IssueSeverity;
  aiSuggestedCategory?: string;
  aiExplanation?: string;
  aiStatus?: "suggested" | "accepted" | "corrected" | "unavailable";
  voiceUrl?: string;
  voiceTranscript?: string;
  voiceTranslation?: string;
}

export interface SubmitUpdateInput {
  poId: string;
  milestoneId: string;
  updateDate: string;
  quantity: number;
  clientUuid: string;
  source: "online" | "offline";
  notes?: string;
  issue?: IssueInput;
  photos?: PhotoInput[];
}

export interface SubmitUpdateResult {
  id: string;
  duplicate: boolean;
  cumulative: number;
  milestoneCompleted: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function submitProductionUpdate(
  user: SessionUser,
  input: SubmitUpdateInput,
): Promise<SubmitUpdateResult> {
  if (user.role !== "unit_supervisor" && user.role !== "super_admin") {
    throw new Error("Only unit supervisors can submit production updates.");
  }
  if (!UUID_RE.test(input.clientUuid)) {
    throw new Error("A valid client update id is required.");
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new Error("Quantity must be a non-negative whole number.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.updateDate)) {
    throw new Error("A valid update date is required.");
  }

  const config = await getAppConfig();
  if (input.updateDate > config.businessDate) {
    throw new Error("Production updates cannot be dated in the future.");
  }

  const milestoneRows = await sql<
    OrderMilestone & { po_status: string; order_buyer_id: string; stage_name: string }
  >(
    `select om.*, po.status as po_status, po.buyer_id as order_buyer_id, ps.name as stage_name
       from order_milestones om
       join purchase_orders po on po.id = om.po_id
       join production_stages ps on ps.id = om.stage_id
      where om.id = $1 and om.po_id = $2`,
    [input.milestoneId, input.poId],
  );

  const milestone = milestoneRows[0];
  if (!milestone) throw new Error("Production stage not found for this order.");
  if (milestone.po_status !== "active") {
    throw new Error("This purchase order is not active.");
  }

  await assertSupervisorAssigned(user, input.poId, input.milestoneId);

  const existing = await sql<ProductionUpdate>(
    "select * from production_updates where client_uuid = $1",
    [input.clientUuid],
  );
  if (existing[0]) {
    if (existing[0].milestone_id !== input.milestoneId) {
      throw new Error("This update id has already been used for another stage.");
    }
    const cumulative = await cumulativeFor(input.milestoneId);
    return {
      id: existing[0].id,
      duplicate: true,
      cumulative,
      milestoneCompleted: cumulative >= Number(milestone.target_quantity),
    };
  }

  if (input.issue) {
    if (!ISSUE_CATEGORIES.includes(input.issue.category)) {
      throw new Error("Invalid issue category.");
    }
    if (!ISSUE_SEVERITIES.includes(input.issue.severity)) {
      throw new Error("Invalid issue severity.");
    }
  }

  const db = await getDb();

  const result = await db.transaction(async (tx) => {
    const inserted = await tx.query<{ id: string }>(
      `insert into production_updates
        (po_id, milestone_id, update_date, quantity, submitted_by, client_uuid, notes, source)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id`,
      [
        input.poId,
        input.milestoneId,
        input.updateDate,
        input.quantity,
        user.id,
        input.clientUuid,
        input.notes?.trim() || null,
        input.source,
      ],
    );
    const updateId = inserted[0].id;

    const cumulativeRows = await tx.query<{ total: number }>(
      "select coalesce(sum(quantity), 0)::int as total from production_updates where milestone_id = $1",
      [input.milestoneId],
    );
    const cumulative = Number(cumulativeRows[0]?.total ?? 0);
    const completed = cumulative >= Number(milestone.target_quantity);

    await tx.query(
      `update order_milestones
          set status = $2, updated_at = now()
        where id = $1`,
      [input.milestoneId, completed ? "completed" : "in_progress"],
    );

    let issueId: string | null = null;
    if (input.issue) {
      const issue = await tx.query<{ id: string }>(
        `insert into production_issues
          (po_id, milestone_id, update_id, description_tamil, description_english, category,
           ai_suggested_category, ai_explanation, ai_status, voice_url, voice_transcript,
           voice_translation, severity, reported_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         returning id`,
        [
          input.poId,
          input.milestoneId,
          updateId,
          input.issue.descriptionTamil?.trim() || null,
          input.issue.descriptionEnglish?.trim() || null,
          input.issue.category,
          input.issue.aiSuggestedCategory ?? null,
          input.issue.aiExplanation ?? null,
          input.issue.aiStatus ?? "unavailable",
          input.issue.voiceUrl ?? null,
          input.issue.voiceTranscript ?? null,
          input.issue.voiceTranslation ?? null,
          input.issue.severity,
          user.id,
        ],
      );
      issueId = issue[0].id;
      await tx.query(
        `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
         values ($1,$2,'issue_reported','production_issue',$3,$4)`,
        [
          input.poId,
          user.id,
          issueId,
          JSON.stringify({ category: input.issue.category, stage: milestone.stage_name }),
        ],
      );
    }

    for (const photo of input.photos ?? []) {
      await tx.query(
        `insert into production_photos
          (po_id, update_id, issue_id, url, public_id, width, height, bytes, caption,
           approved_for_buyer, uploaded_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10)`,
        [
          input.poId,
          updateId,
          issueId,
          photo.url,
          photo.publicId,
          photo.width,
          photo.height,
          photo.bytes,
          photo.caption ?? null,
          user.id,
        ],
      );
    }

    await tx.query(
      `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
       values ($1,$2,'production_submitted','production_update',$3,$4)`,
      [
        input.poId,
        user.id,
        updateId,
        JSON.stringify({
          stage: milestone.stage_name,
          quantity: input.quantity,
          cumulative,
          source: input.source,
        }),
      ],
    );

    return { id: updateId, cumulative, completed };
  });

  return {
    id: result.id,
    duplicate: false,
    cumulative: result.cumulative,
    milestoneCompleted: result.completed,
  };
}

async function cumulativeFor(milestoneId: string): Promise<number> {
  const rows = await sql<{ total: number }>(
    "select coalesce(sum(quantity), 0)::int as total from production_updates where milestone_id = $1",
    [milestoneId],
  );
  return Number(rows[0]?.total ?? 0);
}

export interface SupervisorHistoryItem {
  update: ProductionUpdate;
  po_number: string;
  style_name: string;
  stage_name: string;
  photos: ProductionPhoto[];
}

export async function getSupervisorHistory(user: SessionUser): Promise<SupervisorHistoryItem[]> {
  const rows = await sql<
    ProductionUpdate & { po_number: string; style_name: string; stage_name: string }
  >(
    `select pu.*, po.po_number, po.style_name, ps.name as stage_name
       from production_updates pu
       join purchase_orders po on po.id = pu.po_id
       join order_milestones om on om.id = pu.milestone_id
       join production_stages ps on ps.id = om.stage_id
      where pu.submitted_by = $1
      order by pu.update_date desc, pu.created_at desc
      limit 100`,
    [user.id],
  );

  const photos = await sql<ProductionPhoto>(
    `select * from production_photos
      where update_id in (
        select id from production_updates where submitted_by = $1
      )`,
    [user.id],
  );
  const photoMap = new Map<string, ProductionPhoto[]>();
  for (const photo of photos) {
    if (!photo.update_id) continue;
    const list = photoMap.get(photo.update_id) ?? [];
    list.push(photo);
    photoMap.set(photo.update_id, list);
  }

  return rows.map((row) => ({
    update: row,
    po_number: row.po_number,
    style_name: row.style_name,
    stage_name: row.stage_name,
    photos: photoMap.get(row.id) ?? [],
  }));
}

export interface SupervisorIssueItem {
  issue: ProductionIssue;
  po_number: string;
  style_name: string;
  stage_name: string | null;
  photos: ProductionPhoto[];
}

export async function getSupervisorIssues(user: SessionUser): Promise<SupervisorIssueItem[]> {
  const rows = await sql<
    ProductionIssue & { po_number: string; style_name: string; stage_name: string | null }
  >(
    `select pi.*, po.po_number, po.style_name, ps.name as stage_name
       from production_issues pi
       join purchase_orders po on po.id = pi.po_id
       left join order_milestones om on om.id = pi.milestone_id
       left join production_stages ps on ps.id = om.stage_id
      where pi.reported_by = $1
      order by pi.created_at desc
      limit 100`,
    [user.id],
  );

  const photos = await sql<ProductionPhoto>(
    `select * from production_photos
      where issue_id in (
        select id from production_issues where reported_by = $1
      )`,
    [user.id],
  );
  const photoMap = new Map<string, ProductionPhoto[]>();
  for (const photo of photos) {
    if (!photo.issue_id) continue;
    const list = photoMap.get(photo.issue_id) ?? [];
    list.push(photo);
    photoMap.set(photo.issue_id, list);
  }

  return rows.map((row) => ({
    issue: row,
    po_number: row.po_number,
    style_name: row.style_name,
    stage_name: row.stage_name,
    photos: photoMap.get(row.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Merchandiser review actions
// ---------------------------------------------------------------------------

export async function setPhotoBuyerVisibility(
  user: SessionUser,
  photoId: string,
  approved: boolean,
): Promise<void> {
  const rows = await sql<{ po_id: string }>(
    "select po_id from production_photos where id = $1",
    [photoId],
  );
  if (!rows[0]) throw new Error("Photo not found.");
  await assertCanEditOrder(user, rows[0].po_id);

  await sql(
    `update production_photos
        set approved_for_buyer = $2,
            approved_by = case when $2 then $3 else null end,
            approved_at = case when $2 then now() else null end
      where id = $1`,
    [photoId, approved, user.id],
  );

  await sql(
    `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
     values ($1,$2,$3,'production_photo',$4,$5)`,
    [
      rows[0].po_id,
      user.id,
      approved ? "photo_approved" : "photo_unapproved",
      photoId,
      JSON.stringify({ approved }),
    ],
  );
}

export async function setUpdateBuyerVisibility(
  user: SessionUser,
  updateId: string,
  visible: boolean,
): Promise<void> {
  const rows = await sql<{ po_id: string }>(
    "select po_id from production_updates where id = $1",
    [updateId],
  );
  if (!rows[0]) throw new Error("Update not found.");
  await assertCanEditOrder(user, rows[0].po_id);
  await sql("update production_updates set approved_for_buyer = $2 where id = $1", [
    updateId,
    visible,
  ]);
}

export async function updateIssue(
  user: SessionUser,
  issueId: string,
  input: { category?: IssueCategory; status?: string; severity?: IssueSeverity },
): Promise<void> {
  const rows = await sql<{ po_id: string; ai_suggested_category: string | null }>(
    "select po_id, ai_suggested_category from production_issues where id = $1",
    [issueId],
  );
  if (!rows[0]) throw new Error("Issue not found.");
  await assertCanEditOrder(user, rows[0].po_id);

  if (input.category && !ISSUE_CATEGORIES.includes(input.category)) {
    throw new Error("Invalid issue category.");
  }
  if (input.status && !["open", "in_progress", "resolved"].includes(input.status)) {
    throw new Error("Invalid issue status.");
  }

  const resolved = input.status === "resolved";
  const aiStatus =
    input.category && rows[0].ai_suggested_category
      ? input.category === rows[0].ai_suggested_category
        ? "accepted"
        : "corrected"
      : undefined;

  await sql(
    `update production_issues
        set category = coalesce($2, category),
            status = coalesce($3, status),
            severity = coalesce($4, severity),
            ai_status = coalesce($5, ai_status),
            resolved_by = case when $6 then $7 else resolved_by end,
            resolved_at = case when $6 then now() else resolved_at end,
            updated_at = now()
      where id = $1`,
    [
      issueId,
      input.category ?? null,
      input.status ?? null,
      input.severity ?? null,
      aiStatus ?? null,
      resolved,
      user.id,
    ],
  );

  await sql(
    `insert into audit_logs (po_id, actor_id, action, entity_type, entity_id, detail)
     values ($1,$2,$3,'production_issue',$4,$5)`,
    [
      rows[0].po_id,
      user.id,
      resolved ? "issue_resolved" : "issue_updated",
      issueId,
      JSON.stringify(input),
    ],
  );
}
