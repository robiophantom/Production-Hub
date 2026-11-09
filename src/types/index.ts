import type {
  Health,
  IssueCategory,
  IssueSeverity,
  IssueStatus,
  Role,
} from "@/lib/constants";

export type { Health, IssueCategory, IssueSeverity, IssueStatus, Role };

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  unit_id: string | null;
  buyer_id: string | null;
  password_hash?: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Buyer {
  id: string;
  name: string;
  code: string;
  country: string;
  contact_person: string | null;
  contact_email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProductionUnit {
  id: string;
  name: string;
  code: string;
  location: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  type: "printing" | "washing" | "other";
  contact_person: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  buyer_id: string;
  buyer_reference: string | null;
  order_received_date: string;
  style_name: string;
  style_number: string | null;
  description: string | null;
  total_quantity: number;
  ex_factory_date: string;
  shipping_method: string;
  priority: string;
  merchandiser_id: string | null;
  primary_unit_id: string | null;
  notes: string | null;
  status: "active" | "completed" | "cancelled";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderVariant {
  id: string;
  po_id: string;
  colour: string;
  size: string;
  quantity: number;
  created_at: string;
}

export interface ProductionStage {
  id: string;
  name: string;
  code: string;
  sequence: number;
  is_active: boolean;
  created_at: string;
}

export interface TnaTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TnaTemplateMilestone {
  id: string;
  template_id: string;
  stage_id: string;
  sequence: number;
  offset_days: number;
  is_optional: boolean;
}

export interface OrderMilestone {
  id: string;
  po_id: string;
  stage_id: string;
  sequence: number;
  planned_date: string;
  target_quantity: number;
  status: "pending" | "in_progress" | "completed";
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StageAssignment {
  id: string;
  milestone_id: string;
  unit_id: string | null;
  supervisor_id: string | null;
  subcontractor_id: string | null;
  assigned_at: string;
  assigned_by: string | null;
}

export interface ProductionUpdate {
  id: string;
  po_id: string;
  milestone_id: string;
  update_date: string;
  quantity: number;
  submitted_by: string;
  client_uuid: string;
  notes: string | null;
  source: "online" | "offline";
  approved_for_buyer: boolean;
  created_at: string;
}

export interface ProductionPhoto {
  id: string;
  po_id: string;
  update_id: string | null;
  issue_id: string | null;
  url: string;
  public_id: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  caption: string | null;
  approved_for_buyer: boolean;
  approved_by: string | null;
  approved_at: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ProductionIssue {
  id: string;
  po_id: string;
  milestone_id: string | null;
  update_id: string | null;
  description_tamil: string | null;
  description_english: string | null;
  category: IssueCategory;
  ai_suggested_category: string | null;
  ai_explanation: string | null;
  ai_status: "suggested" | "accepted" | "corrected" | "unavailable";
  voice_url: string | null;
  voice_transcript: string | null;
  voice_translation: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  reported_by: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DelayAlert {
  id: string;
  po_id: string;
  milestone_id: string;
  risk_level: "amber" | "red";
  warning_window: "14_day" | "7_day" | "3_day" | "overdue" | "none";
  alert_date: string;
  planned_date: string;
  remaining_qty: number;
  working_days_left: number;
  actual_daily: number;
  required_daily: number;
  projected_completion_date: string | null;
  shortfall: number;
  calculation: Record<string, unknown>;
  status: "open" | "confirmed" | "dismissed" | "resolved";
  confirmed_by: string | null;
  confirmed_at: string | null;
  dismiss_reason: string | null;
  buyer_notified: boolean;
  created_at: string;
  updated_at: string;
}

export interface BuyerNotification {
  id: string;
  po_id: string;
  alert_id: string | null;
  subject: string;
  message: string;
  status: "draft" | "approved" | "sent";
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrderDateHistory {
  id: string;
  po_id: string;
  milestone_id: string | null;
  field_name: string;
  previous_date: string;
  new_date: string;
  reason: string;
  changed_by: string | null;
  changed_at: string;
}

export interface AuditLog {
  id: string;
  po_id: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface BuyerShareToken {
  id: string;
  po_id: string;
  token_hash: string;
  scope: "summary" | "updates";
  label: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
  last_accessed_at: string | null;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface StageProgress {
  milestone: OrderMilestone;
  stage: ProductionStage;
  assignment: StageAssignment | null;
  unit: ProductionUnit | null;
  supervisor: Profile | null;
  subcontractor: Subcontractor | null;
  cumulative: number;
  remaining: number;
  progressPercent: number;
  isComplete: boolean;
}

export interface DelayCalculation {
  milestoneId: string;
  stageId: string;
  stageName: string;
  stageSequence: number;
  plannedDate: string;
  targetQuantity: number;
  cumulativeQuantity: number;
  remainingQuantity: number;
  workingDaysLeft: number;
  requiredDaily: number;
  actualDaily: number;
  projectedWorkingDays: number | null;
  projectedCompletionDate: string | null;
  shortfallPerDay: number;
  bufferDays: number | null;
  health: Health;
  warningWindow: "14_day" | "7_day" | "3_day" | "overdue" | "none";
  hasSufficientData: boolean;
  dataDays: number;
  calculatedAt: string;
  formula: string[];
  isComplete: boolean;
  isStarted: boolean;
  isActive: boolean;
}

export interface OrderHealth {
  health: Health;
  basis: string;
  criticalStage: string;
  plannedDate: string | null;
  projectedDate: string | null;
  daysRemaining: number;
}

export interface OrderSummary {
  order: PurchaseOrder;
  buyer: Buyer;
  unit: ProductionUnit | null;
  merchandiser: Profile | null;
  currentStage: string;
  currentStageProgress: number;
  producedQuantity: number;
  targetQuantity: number;
  health: OrderHealth;
  openIssues: number;
  variantCount: number;
}

export type SessionUser = Pick<
  Profile,
  "id" | "email" | "full_name" | "role" | "unit_id" | "buyer_id" | "is_active"
>;
