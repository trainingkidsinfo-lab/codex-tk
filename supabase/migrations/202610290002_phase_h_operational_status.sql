-- Fase H: estados operativos en el servidor.
-- No contiene datos. Requiere las Fases C, D, F y G y el refuerzo 202610280002.
--
-- 1. enrollment_missing_requirements: lista en el servidor lo que falta para activar
--    (solicitud aprobada, datos, documentos obligatorios firmados en su version vigente,
--    grupo valido con plaza y pago inicial pagado).
-- 2. admin_assign_group: asignar o cambiar grupo tras aprobar, comprobando plaza.
-- 3. admin_activate_enrollment: activa solo si no falta nada. Idempotente.
-- 4. admin_withdraw_enrollment: baja; cancela pagos pendientes y conserva los pagados.
-- 5. group_occupancy: plazas ocupadas por grupo calculadas en el servidor.
-- Ocupa plaza toda inscripcion con grupo que no este dada de baja, igual que en la Fase D.

-- 1. Requisitos ------------------------------------------------------------------------------
create or replace function public.enrollment_missing_requirements(p_enrollment_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_enrollment public.enrollments;
  v_family public.families;
  v_player public.players;
  v_group public.service_groups;
  v_missing text[] := array[]::text[];
  v_doc record;
  v_taken integer;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment_id;
  if v_enrollment.id is null or not public.can_access_family(v_enrollment.family_id) then
    raise exception 'enrollment_not_found';
  end if;
  if v_enrollment.service_id <> 'training_kids' then
    return array['Servicio: sin activacion en esta fase'];
  end if;
  if v_enrollment.status = 'withdrawn' then
    return array['Inscripcion dada de baja'];
  end if;

  if v_enrollment.review_status <> 'approved' then
    v_missing := array_append(v_missing, 'Revision: la solicitud no esta aprobada'::text);
  end if;

  select * into v_family from public.families where id = v_enrollment.family_id;
  if nullif(btrim(v_family.name), '') is null then v_missing := array_append(v_missing, 'Datos: falta nombre familiar'::text); end if;
  if nullif(btrim(v_family.phone), '') is null then v_missing := array_append(v_missing, 'Datos: falta telefono familiar'::text); end if;
  if nullif(btrim(v_family.address), '') is null then v_missing := array_append(v_missing, 'Datos: falta direccion familiar'::text); end if;
  if not exists (
    select 1 from public.family_members fm join public.profiles p on p.id = fm.user_id
    where fm.family_id = v_family.id and fm.status = 'active'
      and nullif(btrim(p.full_name), '') is not null and nullif(btrim(p.email), '') is not null
  ) then v_missing := array_append(v_missing, 'Datos: falta tutor con nombre y email'::text); end if;

  select * into v_player from public.players where id = v_enrollment.player_id;
  if nullif(btrim(v_player.first_name), '') is null then v_missing := array_append(v_missing, 'Datos: falta nombre del hijo'::text); end if;
  if v_player.birth_date is null then v_missing := array_append(v_missing, 'Datos: falta fecha de nacimiento'::text); end if;
  if not exists (select 1 from public.medical_profiles where player_id = v_player.id and nullif(btrim(notes), '') is not null) then
    v_missing := array_append(v_missing, 'Datos: falta informacion medica'::text);
  end if;
  if not exists (
    select 1 from public.emergency_contacts
    where player_id = v_player.id and nullif(btrim(name), '') is not null and nullif(btrim(phone), '') is not null
  ) then v_missing := array_append(v_missing, 'Datos: falta contacto de emergencia'::text); end if;

  for v_doc in
    select sd.title,
      (select dv.id from public.document_versions dv where dv.service_document_id = sd.id
       order by dv.effective_date desc, dv.created_at desc limit 1) as version_id
    from public.service_documents sd
    where sd.service_id = v_enrollment.service_id and sd.scope = 'enrollment' and sd.required and sd.active
  loop
    if v_doc.version_id is null or not exists (
      select 1 from public.signature_records sr
      where sr.enrollment_id = v_enrollment.id and sr.document_version_id = v_doc.version_id and sr.status = 'signed'
    ) then
      v_missing := array_append(v_missing, ('Documentos: ' || v_doc.title || ' pendiente')::text);
    end if;
  end loop;

  if v_enrollment.group_id is null then
    v_missing := array_append(v_missing, 'Grupo: pendiente de asignacion administrativa'::text);
  else
    select * into v_group from public.service_groups where id = v_enrollment.group_id;
    if v_group.id is null or not v_group.active or v_group.service_id <> v_enrollment.service_id
       or v_group.location_id is distinct from v_enrollment.location_id then
      v_missing := array_append(v_missing, 'Grupo: el grupo asignado no es valido'::text);
    else
      select count(*) into v_taken from public.enrollments e
      where e.group_id = v_group.id and e.status <> 'withdrawn' and e.id <> v_enrollment.id;
      if v_group.occupied_base + v_taken >= v_group.capacity then
        v_missing := array_append(v_missing, 'Grupo: el grupo ya esta lleno'::text);
      end if;
    end if;
  end if;

  if not exists (select 1 from public.payment_orders where enrollment_id = v_enrollment.id and status = 'paid') then
    v_missing := array_append(v_missing, 'Pago: pago inicial pendiente'::text);
  end if;

  return v_missing;
end;
$$;

-- 2. Asignar o cambiar grupo -----------------------------------------------------------------
create or replace function public.admin_assign_group(p_enrollment_id uuid, p_group_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_group public.service_groups;
  v_taken integer;
begin
  if not public.is_admin() then raise exception 'admin_access_required'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then raise exception 'enrollment_not_found'; end if;
  if v_enrollment.status = 'withdrawn' then raise exception 'enrollment_withdrawn'; end if;
  if v_enrollment.review_status <> 'approved' then raise exception 'enrollment_not_approved'; end if;
  if v_enrollment.group_id is not distinct from p_group_id then return v_enrollment; end if;

  -- Bloquea el grupo para que dos asignaciones simultaneas no superen la capacidad.
  select * into v_group from public.service_groups where id = p_group_id for update;
  if v_group.id is null or not v_group.active or v_group.service_id <> v_enrollment.service_id
     or v_group.location_id is distinct from v_enrollment.location_id then
    raise exception 'group_not_available';
  end if;
  select count(*) into v_taken from public.enrollments e
  where e.group_id = v_group.id and e.status <> 'withdrawn' and e.id <> v_enrollment.id;
  if v_group.occupied_base + v_taken >= v_group.capacity then raise exception 'group_full'; end if;

  update public.enrollments set group_id = v_group.id where id = v_enrollment.id returning * into v_enrollment;
  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id, metadata)
  values (v_enrollment.family_id, auth.uid(), 'Administracion', 'Grupo asignado: ' || v_group.name, 'enrollments',
    v_enrollment.id, v_enrollment.service_id, jsonb_build_object('group_id', v_group.id));
  return v_enrollment;
end;
$$;

-- 3. Activar -------------------------------------------------------------------------------
create or replace function public.admin_activate_enrollment(p_enrollment_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_missing text[];
begin
  if not public.is_admin() then raise exception 'admin_access_required'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then raise exception 'enrollment_not_found'; end if;
  if v_enrollment.operational_status = 'active' and v_enrollment.status = 'active' then return v_enrollment; end if;
  if v_enrollment.status = 'withdrawn' then raise exception 'enrollment_withdrawn'; end if;
  if v_enrollment.group_id is not null then
    perform 1 from public.service_groups where id = v_enrollment.group_id for update;
  end if;

  v_missing := public.enrollment_missing_requirements(v_enrollment.id);
  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'enrollment_not_ready: %', v_missing[1];
  end if;

  update public.enrollments set status = 'active', operational_status = 'active'
  where id = v_enrollment.id returning * into v_enrollment;
  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id, metadata)
  values (v_enrollment.family_id, auth.uid(), 'Administracion', 'Inscripcion activada', 'enrollments',
    v_enrollment.id, v_enrollment.service_id, jsonb_build_object('group_id', v_enrollment.group_id));
  return v_enrollment;
end;
$$;

-- 4. Baja ----------------------------------------------------------------------------------
create or replace function public.admin_withdraw_enrollment(p_enrollment_id uuid, p_reason text default null)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_order record;
  v_canceled integer := 0;
begin
  if not public.is_admin() then raise exception 'admin_access_required'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then raise exception 'enrollment_not_found'; end if;
  if v_enrollment.status = 'withdrawn' then return v_enrollment; end if;

  update public.enrollments set status = 'withdrawn', operational_status = 'withdrawn'
  where id = v_enrollment.id returning * into v_enrollment;

  for v_order in
    update public.payment_orders set status = 'canceled'
    where enrollment_id = v_enrollment.id and status = 'pending'
    returning id
  loop
    insert into public.payment_events (payment_order_id, event_type, status, payload)
    values (v_order.id, 'canceled_by_withdrawal', 'canceled', '{}'::jsonb);
    v_canceled := v_canceled + 1;
  end loop;

  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id, metadata)
  values (v_enrollment.family_id, auth.uid(), 'Administracion', 'Inscripcion dada de baja', 'enrollments',
    v_enrollment.id, v_enrollment.service_id,
    jsonb_strip_nulls(jsonb_build_object('reason', nullif(btrim(p_reason), ''), 'pending_payments_canceled', v_canceled)));
  return v_enrollment;
end;
$$;

-- 5. Ocupacion de grupos -------------------------------------------------------------------
-- Solo devuelve recuentos por grupo, nunca datos de otras familias.
create or replace function public.group_occupancy()
returns table (group_id uuid, assigned integer)
language sql
security definer
set search_path = public
stable
as $$
  select g.id, count(e.id)::integer
  from public.service_groups g
  left join public.enrollments e on e.group_id = g.id and e.status <> 'withdrawn'
  where g.active
  group by g.id;
$$;

-- 6. Permisos ---------------------------------------------------------------------------------
revoke all on function public.enrollment_missing_requirements(uuid) from public, anon;
revoke all on function public.admin_assign_group(uuid, uuid) from public, anon;
revoke all on function public.admin_activate_enrollment(uuid) from public, anon;
revoke all on function public.admin_withdraw_enrollment(uuid, text) from public, anon;
revoke all on function public.group_occupancy() from public, anon;
grant execute on function public.enrollment_missing_requirements(uuid) to authenticated;
grant execute on function public.admin_assign_group(uuid, uuid) to authenticated;
grant execute on function public.admin_activate_enrollment(uuid) to authenticated;
grant execute on function public.admin_withdraw_enrollment(uuid, text) to authenticated;
grant execute on function public.group_occupancy() to authenticated;
grant execute on all functions in schema public to service_role;
