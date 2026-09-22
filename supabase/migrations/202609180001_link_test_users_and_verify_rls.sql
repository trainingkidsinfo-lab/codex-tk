-- Fase C: correccion idempotente de roles, vinculacion de usuarios Auth y pruebas RLS.
-- Ejecutar una sola vez en SQL Editor despues de la migracion y el seed principales.
-- Solo contiene usuarios y datos ficticios de prueba autorizados para este proyecto.

begin;

-- La clave primaria original hacia family_id implicaba NOT NULL y hacia imposible
-- representar correctamente un rol admin con family_id nulo.
alter table public.user_roles drop constraint if exists user_roles_pkey;
alter table public.user_roles alter column family_id drop not null;

create unique index if not exists user_roles_family_unique
  on public.user_roles (user_id, role, family_id)
  where family_id is not null;

create unique index if not exists user_roles_platform_unique
  on public.user_roles (user_id, role)
  where family_id is null;

insert into public.profiles (id, email, full_name, active)
values
  ('a87bb54e-9143-4290-92a4-6e919e77002e', 'alexsotokurko23@gmail.com', 'Tutor de prueba', true),
  ('8266239d-b676-4965-be6e-342138311623', 'trainingkids.info@gmail.com', 'Administracion de prueba', true)
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    active = true;

insert into public.family_members (
  family_id, user_id, email, relationship, can_sign, can_pay, status, joined_at
)
values (
  '99999999-9999-9999-9999-999999999999',
  'a87bb54e-9143-4290-92a4-6e919e77002e',
  'alexsotokurko23@gmail.com',
  'Tutor', true, true, 'active', now()
)
on conflict (family_id, email) do update
set user_id = excluded.user_id,
    relationship = excluded.relationship,
    can_sign = excluded.can_sign,
    can_pay = excluded.can_pay,
    status = 'active',
    joined_at = coalesce(public.family_members.joined_at, now());

insert into public.user_roles (user_id, role, family_id)
select 'a87bb54e-9143-4290-92a4-6e919e77002e', 'family', '99999999-9999-9999-9999-999999999999'
where not exists (
  select 1 from public.user_roles
  where user_id = 'a87bb54e-9143-4290-92a4-6e919e77002e'
    and role = 'family'
    and family_id = '99999999-9999-9999-9999-999999999999'
);

insert into public.user_roles (user_id, role, family_id)
select '8266239d-b676-4965-be6e-342138311623', 'admin', null
where not exists (
  select 1 from public.user_roles
  where user_id = '8266239d-b676-4965-be6e-342138311623'
    and role = 'admin'
    and family_id is null
);

-- Segunda familia minima y totalmente ficticia para demostrar aislamiento RLS.
insert into public.families (id, name, email, phone, address)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'Familia Aislamiento RLS',
  'aislamiento.rls@example.com',
  '600000002',
  'Direccion ficticia de aislamiento'
)
on conflict (id) do update
set name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    address = excluded.address;

insert into public.players (id, family_id, first_name, last_name, birth_date, team, active)
values (
  'aaaaaaaa-0000-0000-0000-000000000012',
  'aaaaaaaa-0000-0000-0000-000000000002',
  'Jugador', 'Aislamiento', '2017-01-01', 'Ficticio', true
)
on conflict (id) do update
set family_id = excluded.family_id,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    birth_date = excluded.birth_date,
    team = excluded.team,
    active = true;

-- Verificaciones de configuracion antes de simular sesiones autenticadas.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
  ) then
    raise exception 'RLS insegura: existe una politica abierta con true';
  end if;

  if exists (
    select 1 from storage.buckets
    where id in ('tk-original-documents', 'tk-generated-drafts', 'tk-signed-documents', 'tk-signature-evidence')
      and public = true
  ) then
    raise exception 'Storage inseguro: existe un bucket documental publico';
  end if;
end $$;

set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = 'a87bb54e-9143-4290-92a4-6e919e77002e';

do $$
begin
  if not exists (select 1 from public.families where id = '99999999-9999-9999-9999-999999999999') then
    raise exception 'RLS fallo: la familia no puede leer su propia cuenta';
  end if;
  if exists (select 1 from public.families where id = 'aaaaaaaa-0000-0000-0000-000000000002') then
    raise exception 'RLS fallo: la familia puede leer otra familia';
  end if;
  if exists (select 1 from public.user_roles where user_id = '8266239d-b676-4965-be6e-342138311623') then
    raise exception 'RLS fallo: la familia puede leer el rol administrador';
  end if;
end $$;

do $$
begin
  begin
    update public.user_roles
      set role = 'admin'
      where user_id = 'a87bb54e-9143-4290-92a4-6e919e77002e';
    raise exception 'RLS fallo: la familia pudo modificar roles';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.enrollments
      set operational_status = 'active'
      where family_id = '99999999-9999-9999-9999-999999999999';
    raise exception 'RLS fallo: la familia pudo activar inscripciones';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '8266239d-b676-4965-be6e-342138311623';

do $$
begin
  if (select count(*) from public.families where id in (
    '99999999-9999-9999-9999-999999999999',
    'aaaaaaaa-0000-0000-0000-000000000002'
  )) <> 2 then
    raise exception 'RLS fallo: el administrador no puede leer las familias de prueba';
  end if;
end $$;

reset role;
commit;

select 'Fase C vinculada y RLS verificada' as resultado;
