-- Pruebas de Fase G (pagos de prueba). Ejecutar tras aplicar 202610290001_phase_g_payments.sql.
-- Usa los usuarios y datos ficticios del proyecto de pruebas actual (docs/PROYECTO_PRUEBAS.md).
-- Todo termina en rollback: no deja datos. Devuelve una tabla con cada comprobacion.

begin;
create temp table resultado_g (orden int, prueba text, resultado text);
grant all on resultado_g to authenticated;

set local role authenticated;

-- Familia: no puede crear ni cambiar pagos.
set local "request.jwt.claim.sub" = '37bbca73-e898-4681-aaa5-01a15b465aa3';
do $$ declare v text; begin
  begin
    insert into public.payment_orders (family_id, enrollment_id, amount_cents, status)
    values ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777771', 1, 'paid');
    v := 'FALLO';
  exception when others then v := 'ok: ' || sqlstate; end;
  insert into resultado_g values (1, 'familia inserta un pago', v);
  begin perform public.admin_record_payment(gen_random_uuid(), 'paid', null); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_g values (2, 'familia registra un pago', v);
  begin perform public.prepare_initial_payment_order('77777777-7777-7777-7777-777777777771'); v := 'FALLO';
  exception when others then v := 'ok: ' || sqlstate; end;
  insert into resultado_g values (3, 'familia llama a la funcion interna', v);
end $$;

-- Familia: segunda solicitud, para Sofia, con la tarifa de 2 dias mensual.
select public.family_submit_enrollment(
  '88888888-8888-8888-8888-888888888882', 'training_kids', '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'dddddddd-dddd-dddd-dddd-ddddddddddd3',
  '[]'::jsonb, 'Prueba fase G'
) is not null as solicitud_sofia;

-- Administracion: aprueba Leo y Sofia.
set local "request.jwt.claim.sub" = 'bc09a31b-2936-4466-bbe9-0868d7c53fde';
select (public.admin_review_enrollment('77777777-7777-7777-7777-777777777771', 'approve', null, 'Fase G')).review_status as leo;
select (public.admin_review_enrollment(
  (select id from public.enrollments where player_id = '88888888-8888-8888-8888-888888888882'), 'approve', null, 'Fase G'
)).review_status as sofia;

insert into resultado_g
select 4, 'pago Leo: tarifa + matricula = total',
  plan_amount_cents || ' + ' || enrollment_fee_cents || ' = ' || amount_cents || ' (' || status || ')'
from public.payment_orders where enrollment_id = '77777777-7777-7777-7777-777777777771';
insert into resultado_g
select 5, 'pago Sofia: tarifa + matricula = total',
  po.plan_amount_cents || ' + ' || po.enrollment_fee_cents || ' = ' || po.amount_cents || ' (' || po.status || ')'
from public.payment_orders po join public.enrollments e on e.id = po.enrollment_id
where e.player_id = '88888888-8888-8888-8888-888888888882';

-- Aprobar otra vez no duplica el pago.
select (public.admin_review_enrollment('77777777-7777-7777-7777-777777777771', 'approve', null, 'Fase G bis')).review_status as leo_otra_vez;
insert into resultado_g select 6, 'pagos de Leo tras aprobar dos veces', count(*)::text
from public.payment_orders where enrollment_id = '77777777-7777-7777-7777-777777777771';

-- Pagado con recibo; segundo intento rechazado.
insert into resultado_g
select 7, 'Leo marcado pagado', (r).status || ' ' || coalesce((r).receipt_number, 'sin recibo')
from (select public.admin_record_payment(
  (select id from public.payment_orders where enrollment_id = '77777777-7777-7777-7777-777777777771'), 'paid', 'Prueba') as r) x;
do $$ declare v text; begin
  begin perform public.admin_record_payment(
    (select id from public.payment_orders where enrollment_id = '77777777-7777-7777-7777-777777777771'), 'canceled', null);
    v := 'FALLO';
  exception when others then v := 'ok: ' || sqlerrm; end;
  insert into resultado_g values (8, 'cancelar un pago ya pagado', v);
end $$;

-- Sofia: cancelar y preparar de nuevo, sigue sin matricula.
do $$ declare v_order uuid; v_new uuid; v text; begin
  select po.id into v_order from public.payment_orders po join public.enrollments e on e.id = po.enrollment_id
  where e.player_id = '88888888-8888-8888-8888-888888888882' and po.status = 'pending';
  perform public.admin_record_payment(v_order, 'canceled', null);
  v_new := public.admin_prepare_payment_order((select enrollment_id from public.payment_orders where id = v_order));
  select amount_cents || ' (matricula ' || enrollment_fee_cents || ')' into v from public.payment_orders where id = v_new;
  insert into resultado_g values (9, 'Sofia: pago nuevo tras cancelar', v);
end $$;

insert into resultado_g select 10, 'eventos de pago / entradas de auditoria',
  (select count(*) from public.payment_events) || ' / ' ||
  (select count(*) from public.audit_log where table_name = 'payment_orders');

-- Familia: ve sus pagos y el recibo, sin poder cambiarlos.
set local "request.jwt.claim.sub" = '37bbca73-e898-4681-aaa5-01a15b465aa3';
insert into resultado_g select 11, 'familia ve pagos / recibos',
  count(*) || ' / ' || count(receipt_number) from public.payment_orders;
do $$ declare v text; begin
  begin update public.payment_orders set status = 'paid'; v := case when found then 'FALLO' else 'ok: sin filas' end;
  exception when others then v := 'ok: ' || sqlstate; end;
  insert into resultado_g values (12, 'familia cambia un pago', v);
end $$;

reset role;
select prueba, resultado from resultado_g order by orden;
rollback;
