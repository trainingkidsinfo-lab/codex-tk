-- Fase G: pagos de prueba sin Stripe real.
-- No contiene datos. Requiere las Fases C, D y F y el refuerzo 202610280002.
--
-- Reglas:
-- 1. Al aprobar una inscripcion de Training Kids se prepara su pago inicial en el servidor.
--    El importe sale de plan_prices; el navegador nunca decide importes.
-- 2. Matricula (decision D6, 2026-10-29): se cobra UNA SOLA VEZ por familia, para siempre.
--    Se incluye solo si la familia no tiene otro pago con matricula pendiente o pagado.
--    Un indice unico lo garantiza en la base de datos.
-- 3. Una inscripcion tiene como maximo un pago inicial pendiente o pagado.
-- 4. Solo administracion registra el resultado (pagado, fallido, cancelado), con historial
--    en payment_events, recibo numerado de prueba y auditoria. Un pago pagado es definitivo.
-- 5. Rechazar una solicitud cancela su pago pendiente.
-- 6. Football Academy y Gym Home no generan pagos.
-- 7. Sin fecha de vencimiento: es una decision de negocio pendiente.

-- 1. Columnas -------------------------------------------------------------------------------
alter table public.payment_orders add column if not exists plan_price_id uuid references public.plan_prices(id) on delete restrict;
alter table public.payment_orders add column if not exists plan_amount_cents integer;
alter table public.payment_orders add column if not exists enrollment_fee_cents integer not null default 0;
alter table public.payment_orders add column if not exists billing_period text;
alter table public.payment_orders add column if not exists description text;
alter table public.payment_orders add column if not exists paid_at timestamptz;
alter table public.payment_orders add column if not exists receipt_number text;

do $$ begin
  alter table public.payment_orders add constraint payment_orders_parts_valid
    check (
      enrollment_fee_cents >= 0
      and (plan_amount_cents is null or plan_amount_cents >= 0)
      and (plan_amount_cents is null or amount_cents = plan_amount_cents + enrollment_fee_cents)
    ) not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.payment_orders add constraint payment_orders_paid_has_receipt
    check (status <> 'paid' or plan_amount_cents is null or (paid_at is not null and receipt_number is not null)) not valid;
exception when duplicate_object then null;
end $$;

create unique index if not exists payment_orders_receipt_unique
  on public.payment_orders (receipt_number) where receipt_number is not null;
create unique index if not exists payment_orders_one_active_per_enrollment
  on public.payment_orders (enrollment_id) where status in ('pending', 'paid');
create unique index if not exists payment_orders_one_fee_per_family
  on public.payment_orders (family_id) where enrollment_fee_cents > 0 and status in ('pending', 'paid');
create index if not exists idx_payment_orders_enrollment on public.payment_orders (enrollment_id);
create index if not exists idx_payment_events_order on public.payment_events (payment_order_id);

create sequence if not exists public.payment_receipt_seq;

-- 2. Preparacion interna del pago inicial ----------------------------------------------------
create or replace function public.prepare_initial_payment_order(p_enrollment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
  v_price public.plan_prices;
  v_existing uuid;
  v_fee integer;
  v_customer text;
  v_order_id uuid;
begin
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment.id is null then raise exception 'enrollment_not_found'; end if;
  if v_enrollment.service_id <> 'training_kids' then return null; end if;
  if v_enrollment.status = 'withdrawn' then raise exception 'enrollment_not_payable'; end if;

  select id into v_existing from public.payment_orders
  where enrollment_id = v_enrollment.id and status in ('pending', 'paid')
  order by created_at desc limit 1;
  if v_existing is not null then return v_existing; end if;

  select * into v_price from public.plan_prices where id = v_enrollment.plan_price_id;
  if v_price.id is null or not v_price.active then raise exception 'plan_price_missing'; end if;

  -- Serializa el calculo de la matricula por familia.
  select stripe_customer_ref into v_customer from public.families where id = v_enrollment.family_id for update;

  v_fee := case when exists (
    select 1 from public.payment_orders
    where family_id = v_enrollment.family_id and enrollment_fee_cents > 0 and status in ('pending', 'paid')
  ) then 0 else v_price.enrollment_fee_cents end;

  insert into public.payment_orders (
    family_id, enrollment_id, provider, provider_customer_ref, status, amount_cents, currency,
    plan_price_id, plan_amount_cents, enrollment_fee_cents, billing_period, description
  ) values (
    v_enrollment.family_id, v_enrollment.id, 'simulated_test', v_customer, 'pending',
    v_price.amount_cents + v_fee, v_price.currency,
    v_price.id, v_price.amount_cents, v_fee, v_price.billing_period,
    case v_price.billing_period when 'monthly' then 'Primera mensualidad' when 'quarterly' then 'Primer trimestre' else 'Primer periodo' end
  ) returning id into v_order_id;

  insert into public.payment_events (payment_order_id, event_type, status, payload)
  values (v_order_id, 'order_created', 'pending', jsonb_build_object(
    'plan_amount_cents', v_price.amount_cents, 'enrollment_fee_cents', v_fee, 'billing_period', v_price.billing_period
  ));
  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id, metadata)
  values (v_enrollment.family_id, auth.uid(), 'Administracion', 'Pago inicial preparado', 'payment_orders', v_order_id,
    v_enrollment.service_id, jsonb_build_object('amount_cents', v_price.amount_cents + v_fee, 'enrollment_fee_cents', v_fee));
  return v_order_id;
end;
$$;

-- 3. Revision administrativa: aprobar prepara el pago, rechazar cancela el pendiente --------
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
  v_order record;
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

  if p_decision = 'approve' then
    perform public.prepare_initial_payment_order(v_enrollment.id);
  elsif p_decision = 'reject' then
    for v_order in
      update public.payment_orders set status = 'canceled'
      where enrollment_id = v_enrollment.id and status = 'pending'
      returning id
    loop
      insert into public.payment_events (payment_order_id, event_type, status, payload)
      values (v_order.id, 'canceled_by_rejection', 'canceled', '{}'::jsonb);
    end loop;
  end if;
  return v_enrollment;
end;
$$;

-- 4. Preparar de nuevo un pago (tras cancelar) -----------------------------------------------
create or replace function public.admin_prepare_payment_order(p_enrollment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enrollment public.enrollments;
begin
  if not public.is_admin() then raise exception 'admin_access_required'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id;
  if v_enrollment.id is null then raise exception 'enrollment_not_found'; end if;
  if v_enrollment.review_status <> 'approved' then raise exception 'enrollment_not_approved'; end if;
  return public.prepare_initial_payment_order(p_enrollment_id);
end;
$$;

-- 5. Registrar el resultado de un pago de prueba ---------------------------------------------
create or replace function public.admin_record_payment(
  p_payment_order_id uuid,
  p_result text,
  p_note text default null
)
returns public.payment_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders;
  v_service public.service_code;
begin
  if not public.is_admin() then raise exception 'admin_access_required'; end if;
  if p_result not in ('paid', 'failed', 'canceled') then raise exception 'payment_result_invalid'; end if;
  select * into v_order from public.payment_orders where id = p_payment_order_id for update;
  if v_order.id is null then raise exception 'payment_not_found'; end if;
  if v_order.status = 'paid' then raise exception 'payment_already_paid'; end if;
  if v_order.status = 'canceled' then raise exception 'payment_closed'; end if;
  if v_order.status = p_result then raise exception 'payment_result_unchanged'; end if;

  update public.payment_orders
  set status = p_result::public.payment_status,
      paid_at = case when p_result = 'paid' then now() else null end,
      receipt_number = case when p_result = 'paid'
        then 'TK-PRUEBA-' || lpad(nextval('public.payment_receipt_seq')::text, 6, '0') else null end
  where id = v_order.id
  returning * into v_order;

  insert into public.payment_events (payment_order_id, event_type, status, payload)
  values (v_order.id, 'admin_recorded', v_order.status,
    jsonb_strip_nulls(jsonb_build_object('note', nullif(btrim(p_note), ''), 'receipt_number', v_order.receipt_number)));

  select service_id into v_service from public.enrollments where id = v_order.enrollment_id;
  insert into public.audit_log (family_id, actor_user_id, actor_label, action, table_name, record_id, service_id, metadata)
  values (v_order.family_id, auth.uid(), 'Administracion', 'Pago de prueba: ' || p_result, 'payment_orders', v_order.id,
    v_service, jsonb_strip_nulls(jsonb_build_object('amount_cents', v_order.amount_cents, 'receipt_number', v_order.receipt_number)));
  return v_order;
end;
$$;

-- 6. Permisos ---------------------------------------------------------------------------------
-- Pagos e historial solo se escriben mediante estas funciones.
revoke insert, update, delete, truncate on public.payment_orders, public.payment_events from anon, authenticated;
revoke all on sequence public.payment_receipt_seq from public, anon, authenticated;

revoke all on function public.prepare_initial_payment_order(uuid) from public, anon, authenticated;
revoke all on function public.admin_prepare_payment_order(uuid) from public, anon;
revoke all on function public.admin_record_payment(uuid, text, text) from public, anon;
revoke all on function public.admin_review_enrollment(uuid, text, uuid, text) from public, anon;
grant execute on function public.admin_prepare_payment_order(uuid) to authenticated;
grant execute on function public.admin_record_payment(uuid, text, text) to authenticated;
grant execute on function public.admin_review_enrollment(uuid, text, uuid, text) to authenticated;
grant execute on all functions in schema public to service_role;
