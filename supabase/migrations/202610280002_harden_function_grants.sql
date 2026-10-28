-- Refuerzo de permisos de funciones (tras la Fase F).
-- No contiene datos. Corrige los avisos del asesor de seguridad de Supabase heredados de la Fase C.
--
-- 1. Nadie sin sesion (rol anon) puede ejecutar funciones del esquema public. La app y la
--    edge function prepare-family-access solo llaman con sesion o con service_role.
-- 2. Los usuarios con sesion conservan, de forma explicita, las funciones que usan las
--    politicas RLS y las RPC de las Fases D y F.
-- 3. player_family_id solo devuelve la familia si quien pregunta tiene acceso a ella.
--    Las politicas que la usan siguen funcionando igual.
-- 4. search_path fijo en las dos funciones de trigger que no lo tenian.
--
-- Avisos que se mantienen a proposito: las RPC SECURITY DEFINER son llamables por usuarios
-- con sesion. Es el diseno: cada una deriva la identidad de auth.uid() y valida permisos.

-- 3. Sin fuga de familia por identificador de jugador ---------------------------------------
create or replace function public.player_family_id(target_player_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.family_id
  from public.players p
  where p.id = target_player_id
    and public.can_access_family(p.family_id);
$$;

-- 4. search_path fijo ----------------------------------------------------------------------
alter function public.touch_updated_at() set search_path = public;
alter function public.prevent_signed_signature_update() set search_path = public;

-- 1. Sin ejecucion anonima -------------------------------------------------------------------
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- 2. Permisos explicitos ---------------------------------------------------------------------
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_access_family(uuid) to authenticated;
grant execute on function public.player_family_id(uuid) to authenticated;
grant execute on function public.current_family_id() to authenticated;
grant execute on function public.family_update_details(text, text, text) to authenticated;
grant execute on function public.family_save_player(uuid, text, text, date, text, text, text, text, text) to authenticated;
grant execute on function public.family_submit_enrollment(uuid, public.service_code, uuid, uuid, uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.admin_review_enrollment(uuid, text, uuid, text) to authenticated;
grant execute on function public.family_sign_document(uuid, uuid, text, jsonb, jsonb, text, text, text, text) to authenticated;
grant execute on all functions in schema public to service_role;
