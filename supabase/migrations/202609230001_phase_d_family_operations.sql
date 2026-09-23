-- Fase D: operativa segura de familias, jugadores e inscripciones.
-- No contiene datos ni correos reales. Ejecutar una sola vez tras revisar.

alter table public.enrollments add column if not exists review_status text not null default 'pending';
alter table public.enrollments add column if not exists review_notes text;
do $$ begin
  alter table public.enrollments add constraint enrollments_review_status_allowed
    check (review_status in ('pending', 'approved', 'changes_requested', 'rejected'));
exception when duplicate_object then null;
end $$;

create or replace function public.current_family_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select fm.family_id
  from public.family_members fm
  where fm.user_id = auth.uid() and fm.status = 'active'
  order by fm.joined_at nulls last, fm.invited_at
  limit 1;
$$;

create or replace function public.family_update_details(
  p_name text,
  p_phone text,
  p_address text
)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_result public.families;
begin
  if v_family_id is null then raise exception 'family_access_denied'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'family_name_required'; end if;

  update public.families
  set name = btrim(p_name), phone = nullif(btrim(p_phone), ''), address = nullif(btrim(p_address), '')
  where id = v_family_id
  returning * into v_result;

  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id)
  values (v_family_id, auth.uid(), 'Familia', 'Datos familiares actualizados', 'families', v_family_id);
  return v_result;
end;
$$;

create or replace function public.family_save_player(
  p_player_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_team text,
  p_medical_notes text,
  p_emergency_name text,
  p_emergency_phone text,
  p_emergency_relationship text default 'Tutor'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_player_id uuid;
  v_contact_id uuid;
begin
  if v_family_id is null then raise exception 'family_access_denied'; end if;
  if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null then
    raise exception 'player_name_required';
  end if;
  if p_birth_date is not null and (p_birth_date > current_date or p_birth_date < current_date - interval '25 years') then
    raise exception 'player_birth_date_invalid';
  end if;

  if p_player_id is null then
    insert into public.players (family_id, first_name, last_name, birth_date, team)
    values (v_family_id, btrim(p_first_name), btrim(p_last_name), p_birth_date, nullif(btrim(p_team), ''))
    returning id into v_player_id;
  else
    update public.players
    set first_name = btrim(p_first_name), last_name = btrim(p_last_name), birth_date = p_birth_date,
        team = nullif(btrim(p_team), '')
    where id = p_player_id and family_id = v_family_id and active = true
    returning id into v_player_id;
    if v_player_id is null then raise exception 'player_access_denied'; end if;
  end if;

  insert into public.medical_profiles (player_id, notes, updated_by)
  values (v_player_id, nullif(btrim(p_medical_notes), ''), auth.uid())
  on conflict (player_id) do update
  set notes = excluded.notes, updated_by = auth.uid();

  select id into v_contact_id from public.emergency_contacts
  where player_id = v_player_id and priority = 1 order by created_at limit 1;
  if nullif(btrim(p_emergency_name), '') is not null and nullif(btrim(p_emergency_phone), '') is not null then
    if v_contact_id is null then
      insert into public.emergency_contacts (player_id, name, phone, relationship, priority)
      values (v_player_id, btrim(p_emergency_name), btrim(p_emergency_phone), nullif(btrim(p_emergency_relationship), ''), 1);
    else
      update public.emergency_contacts
      set name = btrim(p_emergency_name), phone = btrim(p_emergency_phone), relationship = nullif(btrim(p_emergency_relationship), '')
      where id = v_contact_id and player_id = v_player_id;
    end if;
  end if;

  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id)
  values (v_family_id, auth.uid(), 'Familia', case when p_player_id is null then 'Jugador creado' else 'Jugador actualizado' end, 'players', v_player_id);
  return v_player_id;
end;
$$;

create or replace function public.family_submit_enrollment(
  p_player_id uuid,
  p_service_id public.service_code,
  p_location_id uuid,
  p_season_id uuid,
  p_plan_id uuid,
  p_plan_price_id uuid,
  p_availability jsonb default '[]'::jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid := public.current_family_id();
  v_enrollment_id uuid;
begin
  if v_family_id is null then raise exception 'family_access_denied'; end if;
  if not exists (select 1 from public.players where id = p_player_id and family_id = v_family_id and active) then
    raise exception 'player_access_denied';
  end if;
  if not exists (select 1 from public.services where id = p_service_id and status = 'active') then
    raise exception 'service_not_available';
  end if;
  if not exists (select 1 from public.service_locations where id = p_location_id and service_id = p_service_id and active) then
    raise exception 'location_not_available';
  end if;
  if not exists (select 1 from public.service_seasons where id = p_season_id and service_id = p_service_id and active) then
    raise exception 'season_not_available';
  end if;
  if not exists (
    select 1 from public.service_plans sp join public.plan_prices pp on pp.plan_id = sp.id
    where sp.id = p_plan_id and pp.id = p_plan_price_id and sp.service_id = p_service_id
      and sp.active and pp.active and not pp.admin_only
      and pp.valid_from <= current_date and (pp.valid_to is null or pp.valid_to >= current_date)
  ) then raise exception 'plan_not_available'; end if;

  select id into v_enrollment_id from public.enrollments
  where family_id = v_family_id and player_id = p_player_id and service_id = p_service_id
    and season_id = p_season_id and status <> 'withdrawn'
  limit 1;
  if v_enrollment_id is null then
    insert into public.enrollments (
      family_id, player_id, service_id, location_id, season_id, plan_id, plan_price_id,
      group_id, status, operational_status
    ) values (
      v_family_id, p_player_id, p_service_id, p_location_id, p_season_id, p_plan_id, p_plan_price_id,
      null, 'pending_completion', 'pending_completion'
    ) returning id into v_enrollment_id;
  else
    update public.enrollments
    set location_id = p_location_id, plan_id = p_plan_id, plan_price_id = p_plan_price_id,
        group_id = null, status = 'pending_completion', operational_status = 'pending_completion'
    where id = v_enrollment_id;
    delete from public.availability_requests where enrollment_id = v_enrollment_id;
  end if;

  insert into public.availability_requests (enrollment_id, availability, notes)
  values (v_enrollment_id, coalesce(p_availability, '[]'::jsonb), nullif(btrim(p_notes), ''));
  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id)
  values (v_family_id, auth.uid(), 'Familia', 'Solicitud de inscripcion enviada', 'enrollments', v_enrollment_id, p_service_id);
  return v_enrollment_id;
end;
$$;

create or replace function public.admin_review_enrollment(
  p_enrollment_id uuid,
  p_decision text,
  p_group_id uuid default null,
  p_notes text default null
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
begin
  if not public.is_admin() then raise exception 'admin_access_required'; end if;
  if p_decision not in ('approve', 'request_changes', 'reject') then raise exception 'decision_invalid'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then raise exception 'enrollment_not_found'; end if;
  if p_group_id is not null and not exists (
    select 1 from public.service_groups g
    where g.id = p_group_id and g.service_id = v_enrollment.service_id
      and g.location_id = v_enrollment.location_id and g.active
      and g.occupied_base + (select count(*) from public.enrollments e where e.group_id = g.id and e.status <> 'withdrawn' and e.id <> p_enrollment_id) < g.capacity
  ) then raise exception 'group_not_available'; end if;

  update public.enrollments
  set group_id = case when p_decision = 'approve' then p_group_id else group_id end,
      review_status = case p_decision when 'approve' then 'approved' when 'request_changes' then 'changes_requested' else 'rejected' end,
      review_notes = nullif(btrim(p_notes), ''),
      status = case when p_decision = 'reject' then 'withdrawn'::public.enrollment_status else status end,
      operational_status = case when p_decision = 'reject' then 'withdrawn'::public.enrollment_status else operational_status end
  where id = p_enrollment_id returning * into v_enrollment;
  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id, metadata)
  values (v_enrollment.family_id, auth.uid(), 'Administracion', 'Solicitud: ' || p_decision,
    'enrollments', v_enrollment.id, v_enrollment.service_id, jsonb_build_object('notes', coalesce(p_notes, '')));
  return v_enrollment;
end;
$$;

-- Las escrituras sensibles se realizan solo por funciones con identidad derivada de auth.uid().
revoke insert, update on public.enrollments from authenticated;
revoke insert, update, delete on public.availability_requests from authenticated;
revoke insert, update on public.families from authenticated;
revoke insert, update on public.players from authenticated;
revoke insert, update on public.medical_profiles from authenticated;
revoke insert, update on public.emergency_contacts from authenticated;
revoke insert on public.audit_log from authenticated;

revoke all on function public.family_update_details(text, text, text) from public;
revoke all on function public.family_save_player(uuid, text, text, date, text, text, text, text, text) from public;
revoke all on function public.family_submit_enrollment(uuid, public.service_code, uuid, uuid, uuid, uuid, jsonb, text) from public;
revoke all on function public.admin_review_enrollment(uuid, text, uuid, text) from public;
grant execute on function public.family_update_details(text, text, text) to authenticated;
grant execute on function public.family_save_player(uuid, text, text, date, text, text, text, text, text) to authenticated;
grant execute on function public.family_submit_enrollment(uuid, public.service_code, uuid, uuid, uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.admin_review_enrollment(uuid, text, uuid, text) to authenticated;
