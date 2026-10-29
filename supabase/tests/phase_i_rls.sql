-- Pruebas de Fase I (prealta de Football Academy). Ejecutar tras aplicar 202610290003_phase_i_football_interest.sql.
-- Usa los usuarios y datos ficticios del proyecto de pruebas actual (docs/PROYECTO_PRUEBAS.md).
-- Todo termina en rollback: no deja datos. Devuelve una tabla con cada comprobacion.

begin;
create temp table resultado_i (orden int, prueba text, resultado text);
grant all on resultado_i to authenticated;

set local role authenticated;

-- Familia
set local "request.jwt.claim.sub" = '37bbca73-e898-4681-aaa5-01a15b465aa3';
do $$ declare v1 uuid; v2 uuid; v text; begin
  v1 := public.family_register_interest('88888888-8888-8888-8888-888888888881', 'football_academy', 'Interes de prueba');
  v2 := public.family_register_interest('88888888-8888-8888-8888-888888888881', 'football_academy', null);
  insert into resultado_i values (1, 'registrar dos veces devuelve la misma prealta', case when v1 = v2 then 'ok' else 'FALLO' end);
  begin perform public.family_register_interest('88888888-8888-8888-8888-888888888881', 'training_kids', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_i values (2, 'prealta en un servicio que no esta en prealta', v);
  begin perform public.family_register_interest('aaaaaaaa-0000-0000-0000-000000000012', 'football_academy', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_i values (3, 'prealta para un hijo ajeno', v);
  begin
    insert into public.service_interest_requests (family_id, player_id, service_id)
    values ('99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888882', 'football_academy');
    v := 'FALLO';
  exception when others then v := 'ok: ' || sqlstate; end;
  insert into resultado_i values (4, 'insercion directa', v);
  begin perform public.admin_update_interest(v1, 'closed', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_i values (5, 'familia cierra su prealta', v);
end $$;
insert into resultado_i select 6, 'familia ve sus prealtas', count(*)::text from public.service_interest_requests;

-- Administracion
set local "request.jwt.claim.sub" = 'bc09a31b-2936-4466-bbe9-0868d7c53fde';
insert into resultado_i select 7, 'administracion ve prealtas', count(*)::text from public.service_interest_requests;
insert into resultado_i select 8, 'marcar contactada',
  (public.admin_update_interest((select id from public.service_interest_requests limit 1), 'contacted', 'Llamada de prueba')).status;
insert into resultado_i select 9, 'cerrar',
  (public.admin_update_interest((select id from public.service_interest_requests limit 1), 'closed', null)).status;
do $$ declare v text; begin
  begin perform public.admin_update_interest((select id from public.service_interest_requests limit 1), 'contacted', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_i values (10, 'cambiar una prealta cerrada', v);
end $$;

-- Familia: tras cerrar puede volver a registrar interes.
set local "request.jwt.claim.sub" = '37bbca73-e898-4681-aaa5-01a15b465aa3';
insert into resultado_i select 11, 'nueva prealta tras cerrar',
  case when public.family_register_interest('88888888-8888-8888-8888-888888888881', 'football_academy', null) is not null then 'ok' else 'FALLO' end;
insert into resultado_i select 12, 'auditoria de prealtas',
  string_agg(action, ' | ' order by created_at) from public.audit_log where table_name = 'service_interest_requests';

reset role;
select prueba, resultado from resultado_i order by orden;
rollback;
