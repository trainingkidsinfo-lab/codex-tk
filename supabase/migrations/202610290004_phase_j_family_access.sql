-- Fase J: alta de familias desde administracion.
-- No contiene datos. Requiere las Fases C y D y el refuerzo 202610280002.
--
-- La edge function prepare-family-access comprueba que quien llama es administracion y crea,
-- si hace falta, el usuario de Auth (lo unico que exige la clave de servicio). Todo lo demas
-- ocurre aqui, en una sola transaccion:
--   familia nueva o existente, perfil, miembro con permiso de firma, rol family y auditoria.
-- Estas funciones solo las puede ejecutar service_role (es decir, la edge function).

-- 1. Buscar un usuario de Auth por correo -----------------------------------------------------
create or replace function public.service_lookup_auth_user(p_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;

-- 2. Preparar el acceso familiar ------------------------------------------------------------
create or replace function public.service_prepare_family_access(
  p_actor_user_id uuid,
  p_auth_user_id uuid,
  p_email text,
  p_family_name text default null,
  p_family_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := nullif(btrim(coalesce(p_family_name, '')), '');
  v_family_id uuid := p_family_id;
  v_created_family boolean := false;
  v_already_member boolean;
begin
  -- Doble comprobacion: el actor debe ser administracion aunque la edge function ya lo verifique.
  if not exists (select 1 from public.user_roles where user_id = p_actor_user_id and role in ('owner', 'admin')) then
    raise exception 'admin_access_required';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'email_invalid'; end if;
  if p_auth_user_id is null or not exists (select 1 from auth.users where id = p_auth_user_id and lower(email) = v_email) then
    raise exception 'auth_user_mismatch';
  end if;
  if exists (select 1 from public.user_roles where user_id = p_auth_user_id and role in ('owner', 'admin')) then
    raise exception 'email_belongs_to_admin';
  end if;

  if v_family_id is null then
    if v_name is null then raise exception 'family_name_required'; end if;
    if char_length(v_name) > 120 then raise exception 'family_name_too_long'; end if;
    insert into public.families (name, email) values (v_name, v_email) returning id into v_family_id;
    v_created_family := true;
  elsif not exists (select 1 from public.families where id = v_family_id and archived_at is null) then
    raise exception 'family_not_found';
  end if;

  -- La app asume una sola familia por tutor (current_family_id).
  if exists (
    select 1 from public.family_members
    where user_id = p_auth_user_id and status = 'active' and family_id <> v_family_id
  ) then
    raise exception 'email_belongs_to_other_family';
  end if;

  insert into public.profiles (id, email, full_name, active)
  values (p_auth_user_id, v_email, v_email, true)
  on conflict (id) do update set email = excluded.email, active = true;

  select exists (
    select 1 from public.family_members where family_id = v_family_id and user_id = p_auth_user_id and status = 'active'
  ) into v_already_member;

  insert into public.family_members (family_id, user_id, email, relationship, can_sign, can_pay, status, joined_at)
  values (v_family_id, p_auth_user_id, v_email, 'Tutor', true, true, 'active', now())
  on conflict (family_id, email) do update
  set user_id = excluded.user_id, status = 'active', joined_at = coalesce(public.family_members.joined_at, now());

  insert into public.user_roles (user_id, role, family_id)
  select p_auth_user_id, 'family', v_family_id
  where not exists (
    select 1 from public.user_roles where user_id = p_auth_user_id and role = 'family' and family_id = v_family_id
  );

  if not v_already_member then
    insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, metadata)
    values (v_family_id, p_actor_user_id, 'Administracion',
      case when v_created_family then 'Familia dada de alta' else 'Tutor anadido a la familia' end,
      'families', v_family_id, jsonb_build_object('tutor_email', v_email));
  end if;

  return jsonb_build_object('family_id', v_family_id, 'created_family', v_created_family, 'already_member', v_already_member);
end;
$$;

-- 3. Permisos: solo la edge function (service_role) --------------------------------------------
revoke all on function public.service_lookup_auth_user(text) from public, anon, authenticated;
revoke all on function public.service_prepare_family_access(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.service_lookup_auth_user(text) to service_role;
grant execute on function public.service_prepare_family_access(uuid, uuid, text, text, uuid) to service_role;
