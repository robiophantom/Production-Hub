-- Row Level Security for the production hub.
-- All application access also goes through server-side role checks; these
-- policies are the database-level defense in depth (and protect any future
-- direct Supabase client access).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active = true;
$$;

create or replace function public.current_profile_buyer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.buyer_id from public.profiles p where p.id = auth.uid() and p.is_active = true;
$$;

create or replace function public.is_internal()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_profile_role() in ('super_admin', 'managing_director', 'merchandiser'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_profile_role() = 'super_admin', false);
$$;

create or replace function public.can_view_order(order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_orders po
    where po.id = order_id
      and (
        public.current_profile_role() in ('super_admin', 'managing_director')
        or (
          public.current_profile_role() = 'merchandiser'
          and po.merchandiser_id = auth.uid()
        )
        or (
          public.current_profile_role() = 'buyer'
          and po.buyer_id = public.current_profile_buyer_id()
        )
        or (
          public.current_profile_role() = 'unit_supervisor'
          and exists (
            select 1
            from public.order_milestones om
            join public.stage_assignments sa on sa.milestone_id = om.id
            where om.po_id = po.id and sa.supervisor_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.can_edit_order(order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.purchase_orders po
    where po.id = order_id
      and (
        public.current_profile_role() = 'super_admin'
        or (
          public.current_profile_role() = 'merchandiser'
          and po.merchandiser_id = auth.uid()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.buyers enable row level security;
alter table public.production_units enable row level security;
alter table public.subcontractors enable row level security;
alter table public.profiles enable row level security;
alter table public.production_stages enable row level security;
alter table public.tna_templates enable row level security;
alter table public.tna_template_milestones enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.order_variants enable row level security;
alter table public.order_milestones enable row level security;
alter table public.stage_assignments enable row level security;
alter table public.production_updates enable row level security;
alter table public.production_issues enable row level security;
alter table public.production_photos enable row level security;
alter table public.delay_alerts enable row level security;
alter table public.buyer_notifications enable row level security;
alter table public.order_date_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.buyer_share_tokens enable row level security;
alter table public.app_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Reference / configuration tables
-- ---------------------------------------------------------------------------

drop policy if exists buyers_select on public.buyers;
create policy buyers_select on public.buyers
for select to authenticated
using (public.is_internal() or id = public.current_profile_buyer_id());

drop policy if exists buyers_write on public.buyers;
create policy buyers_write on public.buyers
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists units_select on public.production_units;
create policy units_select on public.production_units
for select to authenticated using (true);

drop policy if exists units_write on public.production_units;
create policy units_write on public.production_units
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists subcontractors_select on public.subcontractors;
create policy subcontractors_select on public.subcontractors
for select to authenticated using (true);

drop policy if exists subcontractors_write on public.subcontractors;
create policy subcontractors_write on public.subcontractors
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists stages_select on public.production_stages;
create policy stages_select on public.production_stages
for select to authenticated using (true);

drop policy if exists stages_write on public.production_stages;
create policy stages_write on public.production_stages
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists templates_select on public.tna_templates;
create policy templates_select on public.tna_templates
for select to authenticated using (true);

drop policy if exists templates_write on public.tna_templates;
create policy templates_write on public.tna_templates
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists template_milestones_select on public.tna_template_milestones;
create policy template_milestones_select on public.tna_template_milestones
for select to authenticated using (true);

drop policy if exists template_milestones_write on public.tna_template_milestones;
create policy template_milestones_write on public.tna_template_milestones
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists settings_select on public.app_settings;
create policy settings_select on public.app_settings
for select to authenticated using (true);

drop policy if exists settings_write on public.app_settings;
create policy settings_write on public.app_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_internal());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

drop policy if exists orders_select on public.purchase_orders;
create policy orders_select on public.purchase_orders
for select to authenticated
using (public.can_view_order(id));

drop policy if exists orders_insert on public.purchase_orders;
create policy orders_insert on public.purchase_orders
for insert to authenticated
with check (
  public.is_admin()
  or (
    public.current_profile_role() = 'merchandiser'
    and (merchandiser_id = auth.uid() or merchandiser_id is null)
  )
);

drop policy if exists orders_update on public.purchase_orders;
create policy orders_update on public.purchase_orders
for update to authenticated
using (public.can_edit_order(id))
with check (
  public.is_admin()
  or (public.current_profile_role() = 'merchandiser' and merchandiser_id = auth.uid())
);

drop policy if exists orders_delete on public.purchase_orders;
create policy orders_delete on public.purchase_orders
for delete to authenticated using (public.is_admin());

drop policy if exists variants_select on public.order_variants;
create policy variants_select on public.order_variants
for select to authenticated using (public.can_view_order(po_id));

drop policy if exists variants_write on public.order_variants;
create policy variants_write on public.order_variants
for all to authenticated using (public.can_edit_order(po_id)) with check (public.can_edit_order(po_id));

drop policy if exists milestones_select on public.order_milestones;
create policy milestones_select on public.order_milestones
for select to authenticated using (public.can_view_order(po_id));

drop policy if exists milestones_write on public.order_milestones;
create policy milestones_write on public.order_milestones
for all to authenticated using (public.can_edit_order(po_id)) with check (public.can_edit_order(po_id));

drop policy if exists assignments_select on public.stage_assignments;
create policy assignments_select on public.stage_assignments
for select to authenticated
using (
  supervisor_id = auth.uid()
  or exists (
    select 1 from public.order_milestones om
    where om.id = stage_assignments.milestone_id and public.can_view_order(om.po_id)
  )
);

drop policy if exists assignments_write on public.stage_assignments;
create policy assignments_write on public.stage_assignments
for all to authenticated
using (
  exists (
    select 1 from public.order_milestones om
    where om.id = stage_assignments.milestone_id and public.can_edit_order(om.po_id)
  )
)
with check (
  exists (
    select 1 from public.order_milestones om
    where om.id = stage_assignments.milestone_id and public.can_edit_order(om.po_id)
  )
);

-- ---------------------------------------------------------------------------
-- Production
-- ---------------------------------------------------------------------------

drop policy if exists updates_select on public.production_updates;
create policy updates_select on public.production_updates
for select to authenticated
using (
  public.can_view_order(po_id)
  and (
    public.current_profile_role() <> 'buyer'
    or approved_for_buyer = true
  )
);

drop policy if exists updates_insert_supervisor on public.production_updates;
create policy updates_insert_supervisor on public.production_updates
for insert to authenticated
with check (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.stage_assignments sa
    where sa.milestone_id = production_updates.milestone_id
      and sa.supervisor_id = auth.uid()
  )
);

drop policy if exists updates_update_manage on public.production_updates;
create policy updates_update_manage on public.production_updates
for update to authenticated
using (public.can_edit_order(po_id))
with check (public.can_edit_order(po_id));

drop policy if exists issues_select on public.production_issues;
create policy issues_select on public.production_issues
for select to authenticated using (public.is_internal() and public.can_view_order(po_id));

drop policy if exists issues_insert on public.production_issues;
create policy issues_insert on public.production_issues
for insert to authenticated
with check (
  reported_by = auth.uid()
  and public.can_view_order(po_id)
);

drop policy if exists issues_update on public.production_issues;
create policy issues_update on public.production_issues
for update to authenticated
using (public.can_edit_order(po_id))
with check (public.can_edit_order(po_id));

drop policy if exists photos_select on public.production_photos;
create policy photos_select on public.production_photos
for select to authenticated
using (
  public.can_view_order(po_id)
  and (
    public.current_profile_role() <> 'buyer'
    or approved_for_buyer = true
  )
);

drop policy if exists photos_insert on public.production_photos;
create policy photos_insert on public.production_photos
for insert to authenticated
with check (uploaded_by = auth.uid() and public.can_view_order(po_id));

drop policy if exists photos_update on public.production_photos;
create policy photos_update on public.production_photos
for update to authenticated
using (public.can_edit_order(po_id))
with check (public.can_edit_order(po_id));

drop policy if exists photos_delete on public.production_photos;
create policy photos_delete on public.production_photos
for delete to authenticated using (public.can_edit_order(po_id));

-- ---------------------------------------------------------------------------
-- Alerts, notifications, audit
-- ---------------------------------------------------------------------------

drop policy if exists alerts_select on public.delay_alerts;
create policy alerts_select on public.delay_alerts
for select to authenticated
using (public.is_internal() and public.can_view_order(po_id));

drop policy if exists alerts_write on public.delay_alerts;
create policy alerts_write on public.delay_alerts
for all to authenticated
using (public.can_edit_order(po_id))
with check (public.can_edit_order(po_id));

drop policy if exists notifications_select on public.buyer_notifications;
create policy notifications_select on public.buyer_notifications
for select to authenticated
using (
  public.can_view_order(po_id)
  and (
    public.current_profile_role() <> 'buyer'
    or status in ('approved', 'sent')
  )
);

drop policy if exists notifications_write on public.buyer_notifications;
create policy notifications_write on public.buyer_notifications
for all to authenticated
using (public.can_edit_order(po_id))
with check (public.can_edit_order(po_id));

drop policy if exists date_history_select on public.order_date_history;
create policy date_history_select on public.order_date_history
for select to authenticated
using (public.is_internal() and public.can_view_order(po_id));

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
for select to authenticated
using (public.is_internal());

-- buyer_share_tokens intentionally has no policies: only the server-side
-- privileged connection may read or write token hashes.

-- ---------------------------------------------------------------------------
-- Grants. RLS still restricts every row. Password hashes are excluded from the
-- authenticated role's column grant.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke select on public.profiles from authenticated;
grant select (id, email, full_name, role, phone, unit_id, buyer_id, is_active, avatar_url, created_at, updated_at)
  on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

revoke insert, update, delete on public.order_date_history from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke all on public.buyer_share_tokens from authenticated, anon;
