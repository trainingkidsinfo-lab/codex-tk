-- Fase C: seed ficticio. No crea usuarios Auth por SQL.
-- Primero crea usuarios desde Supabase Auth y despues sustituye los UUID marcados.

insert into public.services (id, name, status)
values
  ('training_kids', 'Training Kids', 'active'),
  ('football_academy', 'Training Kids Football Academy', 'prelaunch'),
  ('gym_home', 'Gym Home', 'future')
on conflict (id) do update set name = excluded.name, status = excluded.status;

insert into public.service_locations (id, service_id, name, city, owner_type, active)
values
  ('11111111-1111-1111-1111-111111111111', 'training_kids', 'Gym Home Training Kids', 'Ajalvir', 'own', true),
  ('22222222-2222-2222-2222-222222222222', 'training_kids', 'Rebel Gym', 'Nuevos Ministerios', 'external', true),
  ('33333333-3333-3333-3333-333333333333', 'training_kids', 'Centro Comercial La Guitarra', 'Torrejon', 'external', true),
  ('44444444-4444-4444-4444-444444444444', 'training_kids', 'CrossFit Alcala', 'Alcala', 'external', true),
  ('55555555-5555-5555-5555-555555555555', 'training_kids', 'Colegio Tres Cantos', 'Tres Cantos', 'external', true),
  ('66666666-6666-6666-6666-666666666666', 'training_kids', 'Colegio Cardenal Cisneros', 'Alcala', 'external', true)
on conflict (id) do update set name = excluded.name, city = excluded.city, owner_type = excluded.owner_type, active = excluded.active;

insert into public.service_seasons (id, service_id, name, starts_on, ends_on, active)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'training_kids', 'Temporada Training Kids 2026-2027', '2026-09-01', '2027-06-30', true)
on conflict (id) do update set name = excluded.name, starts_on = excluded.starts_on, ends_on = excluded.ends_on, active = excluded.active;

insert into public.service_groups (id, service_id, location_id, season_id, name, day_of_week, starts_at, ends_at, capacity, occupied_base, active)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'training_kids', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Grupo TK Ajalvir Lunes', 'Lunes', '17:30', '18:30', 8, 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'training_kids', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Grupo TK Ajalvir Miercoles', 'Miercoles', '17:30', '18:30', 8, 0, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'training_kids', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Grupo Nuevos Ministerios', 'Martes', '18:00', '19:00', 8, 0, true)
on conflict (id) do update set capacity = excluded.capacity, occupied_base = excluded.occupied_base, active = excluded.active;

insert into public.service_plans (id, service_id, name, frequency_label, active)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'training_kids', 'Training Kids 1 dia mensual', '1 dia/semana', true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'training_kids', 'Training Kids 1 dia trimestral', '1 dia/semana', true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'training_kids', 'Training Kids 2 dias mensual', '2 dias/semana', true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc4', 'training_kids', 'Training Kids 2 dias trimestral', '2 dias/semana', true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc5', 'training_kids', 'Training Kids historica trimestral', '2 dias/semana', true)
on conflict (id) do update set name = excluded.name, frequency_label = excluded.frequency_label, active = excluded.active;

insert into public.plan_prices (id, plan_id, amount_cents, currency, billing_period, enrollment_fee_cents, admin_only, valid_from, active)
values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 6000, 'eur', 'monthly', 2000, false, '2026-09-01', true),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 15000, 'eur', 'quarterly', 2000, false, '2026-09-01', true),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 10000, 'eur', 'monthly', 2000, false, '2026-09-01', true),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd4', 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 24000, 'eur', 'quarterly', 2000, false, '2026-09-01', true),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd5', 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 21000, 'eur', 'quarterly', 0, true, '2026-09-01', true)
on conflict (id) do update set amount_cents = excluded.amount_cents, admin_only = excluded.admin_only, active = excluded.active;

insert into public.service_documents (id, service_id, code, title, scope, required, active)
values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'training_kids', 'activity_contract', 'Contrato de actividad Training Kids', 'enrollment', true, true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'training_kids', 'image_authorization', 'Autorizacion de derechos de imagen', 'enrollment', false, true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'training_kids', 'rules_and_guarantees', 'Normativa y garantias Training Kids', 'informative', false, true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'football_academy', 'calendar_2026_2027', 'Calendario Football Academy 2026-2027', 'informative', false, true)
on conflict (service_id, code) do update set title = excluded.title, scope = excluded.scope, required = excluded.required, active = excluded.active;

insert into public.document_versions (id, service_document_id, version, effective_date, storage_path, sha256, status)
values
  ('ffffffff-ffff-ffff-ffff-fffffffffff1', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '2026-09-test', '2026-09-01', 'originals/training-kids/CONTRATO_ACTIVIDAD_TRAINING_KIDS.pdf', null, 'pending_signature'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff2', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', '2026-09-test', '2026-09-01', 'originals/training-kids/AUTORIZACION_PUBLICACION_DE_IMAGENES_TRAINING_KIDS.pdf', null, 'pending_signature'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff3', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '2026-09-test', '2026-09-01', 'originals/training-kids/Normativa_y_Garantias_Training_Kids.pdf', null, 'informative'),
  ('ffffffff-ffff-ffff-ffff-fffffffffff4', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', '2026-2027-test', '2026-09-01', 'originals/football-academy/Calendario_Training_Kids_Football_Academy_2026_2027.pdf', null, 'informative')
on conflict (service_document_id, version) do update set storage_path = excluded.storage_path, status = excluded.status;

insert into public.families (id, name, email, phone, address)
values ('99999999-9999-9999-9999-999999999999', 'Familia Demo Training Kids', 'familia.demo@example.com', '600000000', 'Direccion ficticia')
on conflict (id) do update set name = excluded.name, email = excluded.email, phone = excluded.phone, address = excluded.address;

insert into public.players (id, family_id, first_name, last_name, birth_date, team, active)
values
  ('88888888-8888-8888-8888-888888888881', '99999999-9999-9999-9999-999999999999', 'Leo', 'Demo', '2016-04-12', 'Sin equipo', true),
  ('88888888-8888-8888-8888-888888888882', '99999999-9999-9999-9999-999999999999', 'Sofia', 'Demo', '2018-09-20', 'Sin equipo', true)
on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name, birth_date = excluded.birth_date, team = excluded.team, active = excluded.active;

insert into public.medical_profiles (player_id, notes)
values
  ('88888888-8888-8888-8888-888888888881', 'Sin observaciones medicas ficticias.'),
  ('88888888-8888-8888-8888-888888888882', 'Sin observaciones medicas ficticias.')
on conflict (player_id) do update set notes = excluded.notes;

insert into public.emergency_contacts (player_id, name, phone, relationship, priority)
values
  ('88888888-8888-8888-8888-888888888881', 'Contacto Demo', '611111111', 'Madre/Padre', 1),
  ('88888888-8888-8888-8888-888888888882', 'Contacto Demo', '611111111', 'Madre/Padre', 1);

insert into public.enrollments (id, family_id, player_id, service_id, location_id, season_id, group_id, plan_id, plan_price_id, status, operational_status, start_on)
values
  ('77777777-7777-7777-7777-777777777771', '99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888881', 'training_kids', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'pending_completion', 'pending_completion', '2026-09-15')
on conflict (id) do update set status = excluded.status, operational_status = excluded.operational_status;

-- Vinculacion segura despues de crear usuarios Auth en Dashboard:
-- 1) Crea familia.demo@example.com en Authentication > Users y copia su UUID.
-- 2) Crea admin.demo@example.com en Authentication > Users y copia su UUID.
-- 3) Ejecuta estas lineas sustituyendo los UUID:
--
-- insert into public.profiles (id, email, full_name, active)
-- values ('UUID_AUTH_FAMILIA', 'familia.demo@example.com', 'Tutor Demo', true)
-- on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, active = true;
--
-- update public.family_members
-- set user_id = 'UUID_AUTH_FAMILIA', status = 'active', joined_at = now()
-- where family_id = '99999999-9999-9999-9999-999999999999' and email = 'familia.demo@example.com';
--
-- insert into public.family_members (family_id, user_id, email, relationship, can_sign, can_pay, status, joined_at)
-- values ('99999999-9999-9999-9999-999999999999', 'UUID_AUTH_FAMILIA', 'familia.demo@example.com', 'Tutor', true, true, 'active', now())
-- on conflict (family_id, email) do update set user_id = excluded.user_id, status = 'active', joined_at = now();
--
-- insert into public.user_roles (user_id, role, family_id)
-- values ('UUID_AUTH_FAMILIA', 'family', '99999999-9999-9999-9999-999999999999')
-- on conflict do nothing;
--
-- insert into public.profiles (id, email, full_name, active)
-- values ('UUID_AUTH_ADMIN', 'admin.demo@example.com', 'Admin Demo', true)
-- on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, active = true;
--
-- insert into public.user_roles (user_id, role, family_id)
-- values ('UUID_AUTH_ADMIN', 'admin', null)
-- on conflict do nothing;
