-- Fase C: base real de pruebas Supabase.
-- Ejecutar en un proyecto Supabase de pruebas. No contiene datos reales.

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('owner', 'admin', 'family');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.member_status as enum ('invited', 'active', 'revoked');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.service_code as enum ('training_kids', 'football_academy', 'gym_home');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.enrollment_status as enum ('draft', 'pending_completion', 'ready_to_activate', 'active', 'withdrawn');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'canceled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.document_status as enum ('draft', 'pending_signature', 'signed', 'update_required', 'informative', 'not_applicable');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = lower(email))
);

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  address text,
  stripe_customer_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint families_email_lowercase check (email = lower(email))
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  relationship text not null default 'Tutor',
  can_sign boolean not null default true,
  can_pay boolean not null default true,
  status public.member_status not null default 'invited',
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  constraint family_members_email_lowercase check (email = lower(email)),
  constraint family_members_email_family_unique unique (family_id, email)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  family_id uuid references public.families(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role, family_id),
  constraint family_role_requires_family check ((role = 'family' and family_id is not null) or (role <> 'family' and family_id is null))
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date,
  team text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medical_profiles (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete cascade,
  allergies text,
  conditions text,
  medication text,
  limitations text,
  notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  priority integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id public.service_code primary key,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.service_locations (
  id uuid primary key default gen_random_uuid(),
  service_id public.service_code not null references public.services(id) on delete cascade,
  name text not null,
  city text,
  owner_type text not null default 'external',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.service_seasons (
  id uuid primary key default gen_random_uuid(),
  service_id public.service_code not null references public.services(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  active boolean not null default true
);

create table if not exists public.service_groups (
  id uuid primary key default gen_random_uuid(),
  service_id public.service_code not null references public.services(id) on delete cascade,
  location_id uuid not null references public.service_locations(id) on delete restrict,
  season_id uuid references public.service_seasons(id) on delete set null,
  name text not null,
  day_of_week text,
  starts_at time,
  ends_at time,
  capacity integer not null default 8,
  occupied_base integer not null default 0,
  active boolean not null default true,
  constraint service_groups_capacity_positive check (capacity >= 0 and occupied_base >= 0)
);

create table if not exists public.service_plans (
  id uuid primary key default gen_random_uuid(),
  service_id public.service_code not null references public.services(id) on delete cascade,
  name text not null,
  frequency_label text not null,
  active boolean not null default true
);

create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.service_plans(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'eur',
  billing_period text not null,
  enrollment_fee_cents integer not null default 0,
  admin_only boolean not null default false,
  valid_from date not null default current_date,
  valid_to date,
  active boolean not null default true,
  constraint plan_prices_amounts_positive check (amount_cents >= 0 and enrollment_fee_cents >= 0)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  service_id public.service_code not null references public.services(id) on delete restrict,
  location_id uuid references public.service_locations(id) on delete restrict,
  season_id uuid references public.service_seasons(id) on delete restrict,
  group_id uuid references public.service_groups(id) on delete restrict,
  plan_id uuid references public.service_plans(id) on delete restrict,
  plan_price_id uuid references public.plan_prices(id) on delete restrict,
  status public.enrollment_status not null default 'draft',
  operational_status public.enrollment_status not null default 'draft',
  start_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_player_family_unique unique (player_id, service_id, season_id),
  constraint enrollments_group_service_match check (group_id is null or service_id is not null)
);

create table if not exists public.availability_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  availability jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.service_documents (
  id uuid primary key default gen_random_uuid(),
  service_id public.service_code references public.services(id) on delete cascade,
  code text not null,
  title text not null,
  scope text not null default 'service',
  required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint service_documents_code_unique unique (service_id, code)
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  service_document_id uuid not null references public.service_documents(id) on delete cascade,
  version text not null,
  effective_date date not null,
  storage_path text,
  sha256 text,
  status public.document_status not null default 'draft',
  created_at timestamptz not null default now(),
  constraint document_versions_unique unique (service_document_id, version)
);

create table if not exists public.signature_records (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  enrollment_id uuid references public.enrollments(id) on delete cascade,
  document_version_id uuid not null references public.document_versions(id) on delete restrict,
  signer_user_id uuid references public.profiles(id) on delete set null,
  status public.document_status not null default 'pending_signature',
  signed_at timestamptz,
  completed_data jsonb not null default '{}'::jsonb,
  accepted_consents jsonb not null default '{}'::jsonb,
  final_storage_path text,
  final_sha256 text,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  provider text not null default 'stripe_test_future',
  provider_customer_ref text,
  status public.payment_status not null default 'pending',
  amount_cents integer not null,
  currency text not null default 'eur',
  due_on date,
  created_at timestamptz not null default now(),
  constraint payment_orders_amount_positive check (amount_cents >= 0)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_order_id uuid not null references public.payment_orders(id) on delete cascade,
  event_type text not null,
  status public.payment_status not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  role public.app_role not null default 'family',
  expires_at timestamptz not null,
  used_at timestamptz,
  status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint invitations_email_lowercase check (email = lower(email))
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  service_id public.service_code references public.services(id) on delete set null,
  channel text not null,
  subject text,
  body text,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  action text not null,
  table_name text,
  record_id uuid,
  service_id public.service_code references public.services(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_members_user on public.family_members(user_id) where status = 'active';
create index if not exists idx_players_family on public.players(family_id);
create index if not exists idx_enrollments_family on public.enrollments(family_id);
create index if not exists idx_enrollments_player on public.enrollments(player_id);
create index if not exists idx_signatures_family on public.signature_records(family_id);
create index if not exists idx_payment_orders_family on public.payment_orders(family_id);
create index if not exists idx_audit_family on public.audit_log(family_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists touch_families_updated_at on public.families;
create trigger touch_families_updated_at before update on public.families for each row execute function public.touch_updated_at();
drop trigger if exists touch_players_updated_at on public.players;
create trigger touch_players_updated_at before update on public.players for each row execute function public.touch_updated_at();
drop trigger if exists touch_medical_updated_at on public.medical_profiles;
create trigger touch_medical_updated_at before update on public.medical_profiles for each row execute function public.touch_updated_at();
drop trigger if exists touch_enrollments_updated_at on public.enrollments;
create trigger touch_enrollments_updated_at before update on public.enrollments for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_family(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.family_members
      where user_id = auth.uid()
        and family_id = target_family_id
        and status = 'active'
    );
$$;

create or replace function public.player_family_id(target_player_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select family_id from public.players where id = target_player_id;
$$;

create or replace function public.prevent_signed_signature_update()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'signed' or old.locked_at is not null then
    raise exception 'Signed documents are immutable. Create a new document version instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_signed_signature_update on public.signature_records;
create trigger prevent_signed_signature_update
before update on public.signature_records
for each row execute function public.prevent_signed_signature_update();

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.user_roles enable row level security;
alter table public.players enable row level security;
alter table public.medical_profiles enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.services enable row level security;
alter table public.service_locations enable row level security;
alter table public.service_seasons enable row level security;
alter table public.service_groups enable row level security;
alter table public.service_plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.enrollments enable row level security;
alter table public.availability_requests enable row level security;
alter table public.service_documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.signature_records enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.invitations enable row level security;
alter table public.communications enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists profiles_own_or_admin_select on public.profiles;
create policy profiles_own_or_admin_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists families_member_or_admin_select on public.families;
create policy families_member_or_admin_select on public.families for select using (public.can_access_family(id));
drop policy if exists families_member_update on public.families;
create policy families_member_update on public.families for update using (public.can_access_family(id)) with check (public.can_access_family(id));
drop policy if exists families_admin_insert on public.families;
create policy families_admin_insert on public.families for insert with check (public.is_admin());

drop policy if exists family_members_family_select on public.family_members;
create policy family_members_family_select on public.family_members for select using (public.can_access_family(family_id));
drop policy if exists family_members_admin_write on public.family_members;
create policy family_members_admin_write on public.family_members for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists user_roles_self_or_admin_select on public.user_roles;
create policy user_roles_self_or_admin_select on public.user_roles for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists players_family_select on public.players;
create policy players_family_select on public.players for select using (public.can_access_family(family_id));
drop policy if exists players_family_insert on public.players;
create policy players_family_insert on public.players for insert with check (public.can_access_family(family_id));
drop policy if exists players_family_update on public.players;
create policy players_family_update on public.players for update using (public.can_access_family(family_id)) with check (public.can_access_family(family_id));

drop policy if exists medical_family_select on public.medical_profiles;
create policy medical_family_select on public.medical_profiles for select using (public.can_access_family(public.player_family_id(player_id)));
drop policy if exists medical_family_insert on public.medical_profiles;
create policy medical_family_insert on public.medical_profiles for insert with check (public.can_access_family(public.player_family_id(player_id)));
drop policy if exists medical_family_update on public.medical_profiles;
create policy medical_family_update on public.medical_profiles for update using (public.can_access_family(public.player_family_id(player_id))) with check (public.can_access_family(public.player_family_id(player_id)));

drop policy if exists emergency_family_select on public.emergency_contacts;
create policy emergency_family_select on public.emergency_contacts for select using (public.can_access_family(public.player_family_id(player_id)));
drop policy if exists emergency_family_insert on public.emergency_contacts;
create policy emergency_family_insert on public.emergency_contacts for insert with check (public.can_access_family(public.player_family_id(player_id)));
drop policy if exists emergency_family_update on public.emergency_contacts;
create policy emergency_family_update on public.emergency_contacts for update using (public.can_access_family(public.player_family_id(player_id))) with check (public.can_access_family(public.player_family_id(player_id)));

drop policy if exists catalog_authenticated_select on public.services;
create policy catalog_authenticated_select on public.services for select using (auth.role() = 'authenticated');
drop policy if exists locations_authenticated_select on public.service_locations;
create policy locations_authenticated_select on public.service_locations for select using (auth.role() = 'authenticated');
drop policy if exists seasons_authenticated_select on public.service_seasons;
create policy seasons_authenticated_select on public.service_seasons for select using (auth.role() = 'authenticated');
drop policy if exists groups_authenticated_select on public.service_groups;
create policy groups_authenticated_select on public.service_groups for select using (auth.role() = 'authenticated');
drop policy if exists plans_authenticated_select on public.service_plans;
create policy plans_authenticated_select on public.service_plans for select using (auth.role() = 'authenticated');
drop policy if exists prices_authenticated_select on public.plan_prices;
create policy prices_authenticated_select on public.plan_prices for select using ((auth.role() = 'authenticated' and active = true and admin_only = false) or public.is_admin());

drop policy if exists catalog_admin_write on public.services;
create policy catalog_admin_write on public.services for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists locations_admin_write on public.service_locations;
create policy locations_admin_write on public.service_locations for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists seasons_admin_write on public.service_seasons;
create policy seasons_admin_write on public.service_seasons for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists groups_admin_write on public.service_groups;
create policy groups_admin_write on public.service_groups for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists plans_admin_write on public.service_plans;
create policy plans_admin_write on public.service_plans for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists prices_admin_write on public.plan_prices;
create policy prices_admin_write on public.plan_prices for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists enrollments_family_select on public.enrollments;
create policy enrollments_family_select on public.enrollments for select using (public.can_access_family(family_id));
drop policy if exists enrollments_family_insert on public.enrollments;
create policy enrollments_family_insert on public.enrollments for insert with check (public.can_access_family(family_id));
drop policy if exists enrollments_admin_write on public.enrollments;
create policy enrollments_admin_write on public.enrollments for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists availability_family_select on public.availability_requests;
create policy availability_family_select on public.availability_requests for select using (
  public.can_access_family((select family_id from public.enrollments where id = enrollment_id))
);
drop policy if exists availability_family_insert on public.availability_requests;
create policy availability_family_insert on public.availability_requests for insert with check (
  public.can_access_family((select family_id from public.enrollments where id = enrollment_id))
);
drop policy if exists availability_admin_write on public.availability_requests;
create policy availability_admin_write on public.availability_requests for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists documents_authenticated_select on public.service_documents;
create policy documents_authenticated_select on public.service_documents for select using (auth.role() = 'authenticated');
drop policy if exists document_versions_authenticated_select on public.document_versions;
create policy document_versions_authenticated_select on public.document_versions for select using (auth.role() = 'authenticated');
drop policy if exists documents_admin_write on public.service_documents;
create policy documents_admin_write on public.service_documents for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists document_versions_admin_write on public.document_versions;
create policy document_versions_admin_write on public.document_versions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists signatures_family_select on public.signature_records;
create policy signatures_family_select on public.signature_records for select using (public.can_access_family(family_id));
drop policy if exists signatures_family_insert on public.signature_records;
create policy signatures_family_insert on public.signature_records for insert with check (public.can_access_family(family_id));
drop policy if exists signatures_admin_write on public.signature_records;
create policy signatures_admin_write on public.signature_records for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payment_orders_family_select on public.payment_orders;
create policy payment_orders_family_select on public.payment_orders for select using (public.can_access_family(family_id));
drop policy if exists payment_orders_admin_write on public.payment_orders;
create policy payment_orders_admin_write on public.payment_orders for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists payment_events_family_select on public.payment_events;
create policy payment_events_family_select on public.payment_events for select using (
  exists (select 1 from public.payment_orders po where po.id = payment_order_id and public.can_access_family(po.family_id))
);
drop policy if exists payment_events_admin_write on public.payment_events;
create policy payment_events_admin_write on public.payment_events for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists invitations_admin_only on public.invitations;
create policy invitations_admin_only on public.invitations for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists communications_family_select on public.communications;
create policy communications_family_select on public.communications for select using (public.can_access_family(family_id));
drop policy if exists communications_admin_write on public.communications;
create policy communications_admin_write on public.communications for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists audit_family_select on public.audit_log;
create policy audit_family_select on public.audit_log for select using (family_id is not null and public.can_access_family(family_id));
drop policy if exists audit_family_insert on public.audit_log;
create policy audit_family_insert on public.audit_log for insert with check (family_id is not null and public.can_access_family(family_id));
drop policy if exists audit_admin_all on public.audit_log;
create policy audit_admin_all on public.audit_log for all using (public.is_admin()) with check (public.is_admin());

revoke update on public.user_roles from authenticated;
revoke update on public.plan_prices from authenticated;
revoke update on public.payment_orders from authenticated;
revoke update on public.payment_events from authenticated;
revoke update on public.enrollments from authenticated;
revoke delete on public.audit_log from authenticated;
revoke update on public.audit_log from authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.families to authenticated;
grant select, insert, update on public.family_members to authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, update on public.players to authenticated;
grant select, insert, update on public.medical_profiles to authenticated;
grant select, insert, update on public.emergency_contacts to authenticated;
grant select on public.services, public.service_locations, public.service_seasons, public.service_groups, public.service_plans, public.plan_prices to authenticated;
grant select, insert on public.enrollments to authenticated;
grant select, insert on public.availability_requests to authenticated;
grant select on public.service_documents, public.document_versions to authenticated;
grant select, insert on public.signature_records to authenticated;
grant select on public.payment_orders, public.payment_events to authenticated;
grant select on public.communications to authenticated;
grant select, insert on public.audit_log to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('tk-original-documents', 'tk-original-documents', false, 10485760),
  ('tk-generated-drafts', 'tk-generated-drafts', false, 10485760),
  ('tk-signed-documents', 'tk-signed-documents', false, 10485760),
  ('tk-signature-evidence', 'tk-signature-evidence', false, 5242880)
on conflict (id) do update set public = false;

drop policy if exists storage_admin_documents_all on storage.objects;
create policy storage_admin_documents_all on storage.objects
for all
using (bucket_id in ('tk-original-documents', 'tk-generated-drafts', 'tk-signed-documents', 'tk-signature-evidence') and public.is_admin())
with check (bucket_id in ('tk-original-documents', 'tk-generated-drafts', 'tk-signed-documents', 'tk-signature-evidence') and public.is_admin());

drop policy if exists storage_family_private_select on storage.objects;
create policy storage_family_private_select on storage.objects
for select
using (
  bucket_id in ('tk-generated-drafts', 'tk-signed-documents', 'tk-signature-evidence')
  and (storage.foldername(name))[1] = 'families'
  and public.can_access_family(((storage.foldername(name))[2])::uuid)
);

drop policy if exists storage_family_drafts_insert on storage.objects;
create policy storage_family_drafts_insert on storage.objects
for insert
with check (
  bucket_id in ('tk-generated-drafts', 'tk-signature-evidence')
  and (storage.foldername(name))[1] = 'families'
  and public.can_access_family(((storage.foldername(name))[2])::uuid)
);

drop policy if exists storage_family_drafts_update on storage.objects;
create policy storage_family_drafts_update on storage.objects
for update
using (
  bucket_id = 'tk-generated-drafts'
  and (storage.foldername(name))[1] = 'families'
  and public.can_access_family(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'tk-generated-drafts'
  and (storage.foldername(name))[1] = 'families'
  and public.can_access_family(((storage.foldername(name))[2])::uuid)
);
