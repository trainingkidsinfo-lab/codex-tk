-- Pruebas de Fase H (estados operativos). Ejecutar tras aplicar 202610290002_phase_h_operational_status.sql.
-- Parte del estado real de Leo en el proyecto de pruebas: aprobado, contrato firmado, pago pagado, sin grupo.
-- Todo termina en rollback: no deja datos. Devuelve una tabla con cada comprobacion.

begin;
create temp table resultado_h (orden int, prueba text, resultado text);
grant all on resultado_h to authenticated;

set local role authenticated;

-- Familia
set local "request.jwt.claim.sub" = '37bbca73-e898-4681-aaa5-01a15b465aa3';
do $$ declare v text; begin
  begin perform public.admin_activate_enrollment('77777777-7777-7777-7777-777777777771'); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_h values (1, 'familia activa una inscripcion', v);
  begin perform public.admin_assign_group('77777777-7777-7777-7777-777777777771', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_h values (2, 'familia asigna grupo', v);
  begin perform public.enrollment_missing_requirements(gen_random_uuid()); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_h values (3, 'familia consulta una inscripcion ajena', v);
end $$;
insert into resultado_h select 4, 'familia: requisitos de Leo',
  array_to_string(public.enrollment_missing_requirements('77777777-7777-7777-7777-777777777771'), ' | ');
insert into resultado_h select 5, 'familia: grupos con ocupacion', count(*)::text from public.group_occupancy();

-- Administracion
set local "request.jwt.claim.sub" = 'bc09a31b-2936-4466-bbe9-0868d7c53fde';
do $$ declare v text; begin
  begin perform public.admin_activate_enrollment('77777777-7777-7777-7777-777777777771'); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_h values (6, 'activar sin grupo', v);
  begin perform public.admin_assign_group('77777777-7777-7777-7777-777777777771', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_h values (7, 'grupo de otro centro', v);
end $$;

-- Grupo lleno (solo dentro de esta transaccion).
reset role;
update public.service_groups set occupied_base = capacity where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
set local role authenticated;
set local "request.jwt.claim.sub" = 'bc09a31b-2936-4466-bbe9-0868d7c53fde';
do $$ declare v text; begin
  begin perform public.admin_assign_group('77777777-7777-7777-7777-777777777771', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_h values (8, 'grupo lleno', v);
end $$;

insert into resultado_h select 9, 'asignar grupo Ajalvir Lunes',
  coalesce((public.admin_assign_group('77777777-7777-7777-7777-777777777771', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1')).group_id::text, 'sin grupo');
insert into resultado_h select 10, 'ocupacion del grupo tras asignar', assigned::text
from public.group_occupancy() where group_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
insert into resultado_h select 11, 'requisitos pendientes antes de activar',
  coalesce(nullif(array_to_string(public.enrollment_missing_requirements('77777777-7777-7777-7777-777777777771'), ' | '), ''), 'ninguno');
insert into resultado_h select 12, 'activar',
  (r).status || '/' || (r).operational_status
from (select public.admin_activate_enrollment('77777777-7777-7777-7777-777777777771') as r) x;
insert into resultado_h select 13, 'activar otra vez',
  (r).status || '/' || (r).operational_status
from (select public.admin_activate_enrollment('77777777-7777-7777-7777-777777777771') as r) x;
insert into resultado_h select 14, 'dar de baja',
  (r).status || '/' || (r).operational_status
from (select public.admin_withdraw_enrollment('77777777-7777-7777-7777-777777777771', 'Prueba fase H') as r) x;
insert into resultado_h select 15, 'ocupacion tras la baja', assigned::text
from public.group_occupancy() where group_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
insert into resultado_h select 16, 'pago pagado tras la baja', status::text
from public.payment_orders where enrollment_id = '77777777-7777-7777-7777-777777777771';
do $$ declare v text; begin
  begin perform public.admin_activate_enrollment('77777777-7777-7777-7777-777777777771'); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_h values (17, 'activar tras la baja', v);
end $$;
insert into resultado_h select 18, 'auditoria de la fase H',
  string_agg(action, ' | ' order by created_at) from public.audit_log
  where action in ('Grupo asignado: Grupo TK Ajalvir Lunes', 'Inscripcion activada', 'Inscripcion dada de baja');

reset role;
select prueba, resultado from resultado_h order by orden;
rollback;
