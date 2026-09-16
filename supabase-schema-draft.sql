-- Borrador Fase B. No ejecutado. Sin credenciales reales.
-- Plataforma comun modular Training Kids / Football Academy / Gym Home futuro.

create type app_role as enum ('owner_admin', 'admin', 'readonly', 'coach');
create type service_code as enum ('training_kids', 'football_academy', 'gym_home');
create type enrollment_status as enum (
  'draft',
  'documentation_pending',
  'signature_pending',
  'payment_pending',
  'pending_assignment',
  'active',
  'past_due',
  'scheduled_cancel',
  'cancelled',
  'interest'
);
create type payment_mode as enum ('monthly', 'quarterly', 'season_single', 'season_installments', 'custom');

create table families (
  id uuid primary key default gen_random_uuid(),
  primary_email text not null,
  phone text,
  address text,
  communication_preference text default 'whatsapp',
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  auth_user_id uuid,
  full_name text not null,
  dni_nie text,
  email text not null,
  phone text,
  relationship text,
  can_sign boolean not null default false,
  can_pay boolean not null default false,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  full_name text not null,
  birth_date date,
  current_team text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table medical_profiles (
  player_id uuid primary key references players(id) on delete cascade,
  allergies text,
  injuries text,
  conditions text,
  medication text,
  restrictions text,
  adaptation_notes text,
  last_confirmed_at timestamptz
);

create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  full_name text not null,
  phone text not null,
  relationship text,
  priority int not null default 1
);

create table services (
  id uuid primary key default gen_random_uuid(),
  code service_code not null unique,
  name text not null,
  active boolean not null default true
);

create table service_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  owner_type text not null default 'external',
  active boolean not null default true
);

create table location_services (
  location_id uuid not null references service_locations(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (location_id, service_id)
);

create table service_seasons (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  months_count int,
  active boolean not null default true
);

create table service_groups (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  season_id uuid references service_seasons(id) on delete set null,
  location_id uuid references service_locations(id) on delete set null,
  code text not null,
  name text not null,
  service_line text,
  day_of_week text,
  start_time time,
  end_time time,
  level text,
  category text,
  max_capacity int not null default 10,
  active boolean not null default true
);

create table service_plans (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  name text not null,
  sessions_per_week int,
  sessions_per_month int,
  active boolean not null default true
);

create table plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references service_plans(id) on delete cascade,
  location_id uuid references service_locations(id) on delete set null,
  label text not null,
  payment_mode payment_mode not null,
  amount numeric(10,2) not null,
  enrollment_fee numeric(10,2) default 0,
  visibility text not null default 'public',
  stripe_price_id text,
  active boolean not null default true
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  season_id uuid references service_seasons(id) on delete set null,
  plan_id uuid references service_plans(id) on delete set null,
  price_id uuid references plan_prices(id) on delete set null,
  status enrollment_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table availability_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  available_days text[] not null default '{}',
  available_time_slots text[] not null default '{}',
  preferred_service_line text,
  notes text
);

create table group_assignments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  group_id uuid not null references service_groups(id) on delete cascade,
  assignment_type text not null default 'main',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  family_id uuid references families(id) on delete set null,
  player_id uuid references players(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  created_at timestamptz not null default now()
);
