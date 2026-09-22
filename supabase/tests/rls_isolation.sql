-- Pruebas dirigidas RLS Fase C.
-- Ejecutar despues de la migracion y seed. Sustituir UUID_AUTH_* por usuarios Auth reales de prueba.
-- Si una comprobacion falla, se lanza una excepcion.

begin;

-- Familias ficticias para aislamiento.
insert into public.families (id, name, email)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Familia A Test RLS', 'familia.a.rls@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Familia B Test RLS', 'familia.b.rls@example.com')
on conflict (id) do nothing;

-- Crear los usuarios en Auth Dashboard y sustituir antes de ejecutar:
-- \set family_a_user 'UUID_AUTH_FAMILIA_A'
-- \set family_b_user 'UUID_AUTH_FAMILIA_B'
-- \set admin_user 'UUID_AUTH_ADMIN'

-- Ejemplo manual:
-- insert into public.profiles (id, email, full_name) values ('UUID_AUTH_FAMILIA_A', 'familia.a.rls@example.com', 'Familia A') on conflict (id) do nothing;
-- insert into public.profiles (id, email, full_name) values ('UUID_AUTH_FAMILIA_B', 'familia.b.rls@example.com', 'Familia B') on conflict (id) do nothing;
-- insert into public.profiles (id, email, full_name) values ('UUID_AUTH_ADMIN', 'admin.rls@example.com', 'Admin RLS') on conflict (id) do nothing;
-- insert into public.family_members (family_id, user_id, email, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'UUID_AUTH_FAMILIA_A', 'familia.a.rls@example.com', 'active') on conflict (family_id, email) do update set user_id = excluded.user_id, status = 'active';
-- insert into public.family_members (family_id, user_id, email, status) values ('aaaaaaaa-0000-0000-0000-000000000002', 'UUID_AUTH_FAMILIA_B', 'familia.b.rls@example.com', 'active') on conflict (family_id, email) do update set user_id = excluded.user_id, status = 'active';
-- insert into public.user_roles (user_id, role, family_id) values ('UUID_AUTH_FAMILIA_A', 'family', 'aaaaaaaa-0000-0000-0000-000000000001') on conflict do nothing;
-- insert into public.user_roles (user_id, role, family_id) values ('UUID_AUTH_FAMILIA_B', 'family', 'aaaaaaaa-0000-0000-0000-000000000002') on conflict do nothing;
-- insert into public.user_roles (user_id, role, family_id) values ('UUID_AUTH_ADMIN', 'admin', null) on conflict do nothing;

-- Esta prueba esta escrita como plantilla para evitar guardar UUID reales en repo.
-- Ejecutar los bloques siguientes sustituyendo los UUID directamente.

-- Familia A no debe ver Familia B.
set local role authenticated;
set local "request.jwt.claim.sub" = 'UUID_AUTH_FAMILIA_A';

do $$
begin
  if exists (select 1 from public.families where id = 'aaaaaaaa-0000-0000-0000-000000000002') then
    raise exception 'RLS fallo: Familia A puede ver Familia B';
  end if;
end $$;

-- Familia no puede tocar roles.
do $$
begin
  begin
    update public.user_roles set role = 'admin' where user_id = 'UUID_AUTH_FAMILIA_A';
    raise exception 'RLS fallo: familia pudo actualizar roles';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like '%violates row-level security%' then
      null;
    else
      raise;
    end if;
  end;
end $$;

-- Familia no puede cambiar importes ni pagos.
do $$
begin
  begin
    update public.plan_prices set amount_cents = 1;
    raise exception 'RLS fallo: familia pudo modificar tarifas';
  exception when insufficient_privilege then
    null;
  when others then
    if sqlerrm like '%violates row-level security%' then
      null;
    else
      raise;
    end if;
  end;
end $$;

-- Admin autorizado puede ver ambas familias.
set local "request.jwt.claim.sub" = 'UUID_AUTH_ADMIN';

do $$
begin
  if (select count(*) from public.families where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002')) <> 2 then
    raise exception 'RLS fallo: admin no puede ver familias de prueba';
  end if;
end $$;

rollback;
