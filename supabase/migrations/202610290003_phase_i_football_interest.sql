-- Fase I: prealta de Football Academy (solicitudes de interes).
-- No contiene datos. Requiere las Fases C y D y el refuerzo 202610280002.
--
-- Decision D5: las prealtas van en una tabla propia, separada de enrollments, para no mezclarlas
-- con la logica de inscripcion, documentos, pagos y activacion de Training Kids.
-- Football Academy no tiene tarifas ni cobros en esta fase.
--
-- 1. service_interest_requests: una solicitud por hijo y servicio en prealta.
-- 2. family_register_interest: la familia registra el interes de su hijo. Idempotente
--    mientras haya una solicitud abierta.
-- 3. admin_update_interest: administracion la marca como contactada o cerrada.

-- 1. Tabla ---------------------------------------------------------------------------------
create table if not exists public.service_interest_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  service_id public.service_code not null references public.services(id) on delete restrict,
  status text not null default 'received',
  notes text,
  admin_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  contacted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_interest_status_allowed check (status in ('received', 'contacted', 'closed')),
  constraint service_interest_notes_length check (char_length(coalesce(notes, '')) <= 1000 and char_length(coalesce(admin_notes, '')) <= 1000)
);

create unique index if not exists service_interest_one_open_per_player
  on public.service_interest_requests (player_id, service_id) where status <> 'closed';
create index if not exists idx_service_interest_family on public.service_interest_requests (family_id);

drop trigger if exists touch_service_interest_updated_at on public.service_interest_requests;
create trigger touch_service_interest_updated_at before update on public.service_interest_requests
for each row execute function public.touch_updated_at();

alter table public.service_interest_requests enable row level security;

drop policy if exists service_interest_family_select on public.service_interest_requests;
create policy service_interest_family_select on public.service_interest_requests
for select using (public.can_access_family(family_id));

-- Solo lectura directa; las escrituras van por las funciones de abajo.
revoke all on public.service_interest_requests from anon, authenticated;
grant select on public.service_interest_requests to authenticated;

-- 2. Registrar interes (familia) -------------------------------------------------------------
create or replace function public.family_register_interest(
  p_player_id uuid,
  p_service_id public.service_code,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_request_id uuid;
begin
  if v_family_id is null then raise exception 'family_access_denied'; end if;
  if not exists (select 1 from public.players where id = p_player_id and family_id = v_family_id and active) then
    raise exception 'player_access_denied';
  end if;
  if not exists (select 1 from public.services where id = p_service_id and status = 'prelaunch') then
    raise exception 'service_not_in_prelaunch';
  end if;
  if char_length(coalesce(p_notes, '')) > 1000 then raise exception 'notes_too_long'; end if;

  select id into v_request_id from public.service_interest_requests
  where player_id = p_player_id and service_id = p_service_id and status <> 'closed';
  if v_request_id is not null then return v_request_id; end if;

  insert into public.service_interest_requests (family_id, player_id, service_id, notes, created_by)
  values (v_family_id, p_player_id, p_service_id, nullif(btrim(p_notes), ''), auth.uid())
  returning id into v_request_id;

  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id)
  values (v_family_id, auth.uid(), 'Familia', 'Prealta registrada', 'service_interest_requests', v_request_id, p_service_id);
  return v_request_id;
end;
$$;

-- 3. Seguimiento (administracion) ------------------------------------------------------------
create or replace function public.admin_update_interest(
  p_request_id uuid,
  p_status text,
  p_admin_notes text default null
)
returns public.service_interest_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_interest_requests;
begin
  if not public.is_admin() then raise exception 'admin_access_required'; end if;
  if p_status not in ('contacted', 'closed') then raise exception 'interest_status_invalid'; end if;
  if char_length(coalesce(p_admin_notes, '')) > 1000 then raise exception 'notes_too_long'; end if;
  select * into v_request from public.service_interest_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'interest_not_found'; end if;
  if v_request.status = 'closed' then raise exception 'interest_closed'; end if;

  update public.service_interest_requests
  set status = p_status,
      admin_notes = coalesce(nullif(btrim(p_admin_notes), ''), admin_notes),
      contacted_at = case when p_status = 'contacted' then now() else contacted_at end,
      closed_at = case when p_status = 'closed' then now() else closed_at end
  where id = v_request.id
  returning * into v_request;

  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id)
  values (v_request.family_id, auth.uid(), 'Administracion',
    case p_status when 'contacted' then 'Prealta: familia contactada' else 'Prealta cerrada' end,
    'service_interest_requests', v_request.id, v_request.service_id);
  return v_request;
end;
$$;

-- 4. Permisos ---------------------------------------------------------------------------------
revoke all on function public.family_register_interest(uuid, public.service_code, text) from public, anon;
revoke all on function public.admin_update_interest(uuid, text, text) from public, anon;
grant execute on function public.family_register_interest(uuid, public.service_code, text) to authenticated;
grant execute on function public.admin_update_interest(uuid, text, text) to authenticated;
grant all on public.service_interest_requests to service_role;
grant execute on all functions in schema public to service_role;
