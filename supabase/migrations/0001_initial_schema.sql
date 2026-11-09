-- Company A Production Hub — initial schema
-- Target: PostgreSQL 15+ (Supabase). Also applied to the embedded PGlite
-- development database so local and hosted behavior share one dialect.

-- gen_random_uuid() is built into PostgreSQL 13+.

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  country text not null,
  contact_person text,
  contact_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.production_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('printing', 'washing', 'other')),
  contact_person text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  full_name text not null,
  role text not null check (
    role in ('super_admin', 'managing_director', 'merchandiser', 'unit_supervisor', 'buyer')
  ),
  phone text,
  unit_id uuid references public.production_units (id),
  buyer_id uuid references public.buyers (id),
  password_hash text,
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buyer_requires_buyer_company check (role <> 'buyer' or buyer_id is not null),
  constraint supervisor_requires_unit check (role <> 'unit_supervisor' or unit_id is not null)
);

create table if not exists public.production_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  sequence integer not null unique check (sequence > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tna_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tna_template_milestones (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.tna_templates (id) on delete cascade,
  stage_id uuid not null references public.production_stages (id),
  sequence integer not null check (sequence > 0),
  offset_days integer not null,
  is_optional boolean not null default false,
  unique (template_id, stage_id),
  unique (template_id, sequence)
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  buyer_id uuid not null references public.buyers (id),
  buyer_reference text,
  order_received_date date not null,
  style_name text not null,
  style_number text,
  description text,
  total_quantity integer not null check (total_quantity > 0),
  ex_factory_date date not null,
  shipping_method text not null default 'sea' check (shipping_method in ('sea', 'air', 'courier', 'road')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  merchandiser_id uuid references public.profiles (id),
  primary_unit_id uuid references public.production_units (id),
  notes text,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ex_factory_after_received check (ex_factory_date >= order_received_date)
);

create table if not exists public.order_variants (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  colour text not null,
  size text not null,
  quantity integer not null check (quantity >= 0),
  created_at timestamptz not null default now(),
  unique (po_id, colour, size)
);

create table if not exists public.order_milestones (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  stage_id uuid not null references public.production_stages (id),
  sequence integer not null check (sequence > 0),
  planned_date date not null,
  target_quantity integer not null check (target_quantity >= 0),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (po_id, stage_id)
);

create table if not exists public.stage_assignments (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null unique references public.order_milestones (id) on delete cascade,
  unit_id uuid references public.production_units (id),
  supervisor_id uuid references public.profiles (id),
  subcontractor_id uuid references public.subcontractors (id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id)
);

create table if not exists public.production_updates (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  milestone_id uuid not null references public.order_milestones (id) on delete cascade,
  update_date date not null,
  quantity integer not null check (quantity >= 0),
  submitted_by uuid not null references public.profiles (id),
  client_uuid uuid not null unique,
  notes text,
  source text not null default 'online' check (source in ('online', 'offline')),
  approved_for_buyer boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.production_issues (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  milestone_id uuid references public.order_milestones (id) on delete set null,
  update_id uuid references public.production_updates (id) on delete set null,
  description_tamil text,
  description_english text,
  category text not null default 'Other' check (
    category in (
      'Machine Breakdown', 'Labour Shortage', 'Raw Material Shortage', 'Quality Issue',
      'Printing Delay', 'Washing Delay', 'Power Interruption',
      'Production Capacity Issue', 'Other'
    )
  ),
  ai_suggested_category text,
  ai_explanation text,
  ai_status text not null default 'unavailable' check (
    ai_status in ('suggested', 'accepted', 'corrected', 'unavailable')
  ),
  voice_url text,
  voice_transcript text,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  reported_by uuid not null references public.profiles (id),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_photos (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  update_id uuid references public.production_updates (id) on delete cascade,
  issue_id uuid references public.production_issues (id) on delete cascade,
  url text not null,
  public_id text,
  width integer,
  height integer,
  bytes integer,
  caption text,
  approved_for_buyer boolean not null default false,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint photo_has_parent check (update_id is not null or issue_id is not null)
);

create table if not exists public.delay_alerts (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  milestone_id uuid not null references public.order_milestones (id) on delete cascade,
  risk_level text not null check (risk_level in ('amber', 'red')),
  warning_window text not null default 'none' check (
    warning_window in ('14_day', '7_day', '3_day', 'overdue', 'none')
  ),
  alert_date date not null default current_date,
  planned_date date not null,
  remaining_qty integer not null check (remaining_qty >= 0),
  working_days_left integer not null,
  actual_daily numeric(12, 2) not null default 0,
  required_daily numeric(12, 2) not null default 0,
  projected_completion_date date,
  shortfall numeric(12, 2) not null default 0,
  calculation jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'confirmed', 'dismissed', 'resolved')),
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  dismiss_reason text,
  buyer_notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buyer_notifications (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  alert_id uuid references public.delay_alerts (id) on delete set null,
  subject text not null,
  message text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create table if not exists public.order_date_history (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  milestone_id uuid references public.order_milestones (id) on delete set null,
  field_name text not null,
  previous_date date not null,
  new_date date not null,
  reason text not null,
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  po_id uuid references public.purchase_orders (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_share_tokens (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes for the filters and joins used by the application
-- ---------------------------------------------------------------------------

create index if not exists idx_purchase_orders_buyer on public.purchase_orders (buyer_id);
create index if not exists idx_purchase_orders_merchandiser on public.purchase_orders (merchandiser_id);
create index if not exists idx_purchase_orders_unit on public.purchase_orders (primary_unit_id);
create index if not exists idx_purchase_orders_ex_factory on public.purchase_orders (ex_factory_date);
create index if not exists idx_purchase_orders_status on public.purchase_orders (status);
create index if not exists idx_order_variants_po on public.order_variants (po_id);
create index if not exists idx_order_milestones_po on public.order_milestones (po_id);
create index if not exists idx_order_milestones_planned on public.order_milestones (planned_date);
create index if not exists idx_stage_assignments_supervisor on public.stage_assignments (supervisor_id);
create index if not exists idx_stage_assignments_unit on public.stage_assignments (unit_id);
create index if not exists idx_production_updates_milestone_date on public.production_updates (milestone_id, update_date);
create index if not exists idx_production_updates_po on public.production_updates (po_id);
create index if not exists idx_production_updates_submitted_by on public.production_updates (submitted_by);
create index if not exists idx_production_issues_po on public.production_issues (po_id, status);
create index if not exists idx_production_photos_po on public.production_photos (po_id);
create index if not exists idx_delay_alerts_po on public.delay_alerts (po_id, status);
create index if not exists idx_buyer_notifications_po on public.buyer_notifications (po_id, status);
create index if not exists idx_order_date_history_po on public.order_date_history (po_id, changed_at desc);
create index if not exists idx_audit_logs_po on public.audit_logs (po_id, created_at desc);
create index if not exists idx_profiles_buyer on public.profiles (buyer_id);

create unique index if not exists idx_delay_alerts_one_open
  on public.delay_alerts (milestone_id)
  where status in ('open', 'confirmed');

-- ---------------------------------------------------------------------------
-- Initial configuration (idempotent defaults; editable in Administration)
-- ---------------------------------------------------------------------------

insert into public.app_settings (key, value) values
  ('working_days', '{"excludedWeekdays":[0],"label":"Monday to Saturday (Sunday off)"}'::jsonb),
  ('risk_thresholds', '{"healthyBufferWorkingDays":2,"insufficientDataDays":3,"historyWindowDays":7,"amberRateTolerancePercent":5}'::jsonb),
  ('defaults', '{"language":"en","alertReviewDays":14,"escalationDays":7,"criticalDays":3}'::jsonb)
on conflict (key) do nothing;
