-- Pruebas de Fase J (alta de familias). Ejecutar tras aplicar 202610290004_phase_j_family_access.sql.
-- Usa los usuarios ficticios del proyecto de pruebas actual (docs/PROYECTO_PRUEBAS.md) y crea,
-- solo dentro de la transaccion, un usuario de Auth de prueba. Todo termina en rollback.

begin;
create temp table resultado_j (orden int, prueba text, resultado text);
grant all on resultado_j to authenticated, service_role;

-- Usuario de Auth de prueba (solo en esta transaccion).
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('0000000a-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'tutor.prueba.j@example.com', now(), now(), now());

-- 1. Un administrador con sesion normal no puede llamar a las funciones de servidor.
set local role authenticated;
set local "request.jwt.claim.sub" = 'bc09a31b-2936-4466-bbe9-0868d7c53fde';
do $$ declare v text; begin
  begin perform public.service_prepare_family_access('bc09a31b-2936-4466-bbe9-0868d7c53fde', '0000000a-0000-4000-8000-00000000000a', 'tutor.prueba.j@example.com', 'Familia Prueba J', null);
    v := 'FALLO';
  exception when others then v := 'ok: ' || sqlstate; end;
  insert into resultado_j values (1, 'administracion llama directamente a la funcion de servidor', v);
  begin perform public.service_lookup_auth_user('tutor.prueba.j@example.com'); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlstate; end;
  insert into resultado_j values (2, 'administracion busca usuarios de Auth', v);
end $$;
reset role;

-- 2. Como la edge function (service_role).
set local role service_role;
insert into resultado_j select 3, 'buscar usuario por correo',
  case when public.service_lookup_auth_user('TUTOR.prueba.j@example.com') = '0000000a-0000-4000-8000-00000000000a' then 'ok' else 'FALLO' end;
insert into resultado_j select 4, 'alta de familia nueva',
  public.service_prepare_family_access('bc09a31b-2936-4466-bbe9-0868d7c53fde', '0000000a-0000-4000-8000-00000000000a', 'tutor.prueba.j@example.com', 'Familia Prueba J', null)::text;
insert into resultado_j select 5, 'repetir el alta',
  (public.service_prepare_family_access('bc09a31b-2936-4466-bbe9-0868d7c53fde', '0000000a-0000-4000-8000-00000000000a', 'tutor.prueba.j@example.com', null,
    (select id from public.families where name = 'Familia Prueba J')) ->> 'already_member');
do $$ declare v text; begin
  begin perform public.service_prepare_family_access('37bbca73-e898-4681-aaa5-01a15b465aa3', '0000000a-0000-4000-8000-00000000000a', 'tutor.prueba.j@example.com', 'Otra', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_j values (6, 'actor que no es administracion', v);
  begin perform public.service_prepare_family_access('bc09a31b-2936-4466-bbe9-0868d7c53fde', 'bc09a31b-2936-4466-bbe9-0868d7c53fde', 'trainingkids.info@gmail.com', 'Familia Admin', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_j values (7, 'dar rol de familia a administracion', v);
  begin perform public.service_prepare_family_access('bc09a31b-2936-4466-bbe9-0868d7c53fde', '37bbca73-e898-4681-aaa5-01a15b465aa3', 'alexsotokurko23@gmail.com', 'Segunda familia', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_j values (8, 'tutor que ya es de otra familia', v);
  begin perform public.service_prepare_family_access('bc09a31b-2936-4466-bbe9-0868d7c53fde', '0000000a-0000-4000-8000-00000000000a', 'otro@example.com', 'Familia X', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_j values (9, 'correo que no coincide con el usuario', v);
  begin perform public.service_prepare_family_access('bc09a31b-2936-4466-bbe9-0868d7c53fde', '0000000a-0000-4000-8000-00000000000a', 'tutor.prueba.j@example.com', null, gen_random_uuid()); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_j values (10, 'familia inexistente', v);
end $$;
insert into resultado_j select 11, 'familias de prueba creadas (rol de servidor)',
  count(*)::text from public.families where name in ('Familia Admin', 'Segunda familia', 'Familia X');
reset role;

-- 3. El tutor nuevo ve solo su familia y no la familia demo.
set local role authenticated;
set local "request.jwt.claim.sub" = '0000000a-0000-4000-8000-00000000000a';
insert into resultado_j select 12, 'tutor nuevo: familias visibles', string_agg(name, ', ') from public.families;
insert into resultado_j select 13, 'tutor nuevo: rol', string_agg(role::text, ', ') from public.user_roles;
reset role;

insert into resultado_j select 14, 'auditoria del alta', string_agg(action, ' | ') from public.audit_log where action = 'Familia dada de alta';

select prueba, resultado from resultado_j order by orden;
rollback;
