import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/202610280002_harden_function_grants.sql", import.meta.url), "utf8");

test("ninguna funcion de public se puede ejecutar sin sesion", () => {
  assert.match(sql, /revoke execute on all functions in schema public from anon;/);
  assert.match(sql, /revoke execute on all functions in schema public from public;/);
  assert.match(sql, /alter default privileges in schema public revoke execute on functions from anon;/);
  assert.doesNotMatch(sql, /grant execute[^;]*to anon/);
});

test("las funciones usadas por RLS y las RPC siguen disponibles con sesion", () => {
  for (const name of [
    "is_admin", "can_access_family", "player_family_id", "current_family_id",
    "family_update_details", "family_save_player", "family_submit_enrollment",
    "admin_review_enrollment", "family_sign_document",
  ]) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`), name);
  }
});

test("player_family_id no revela la familia de un jugador ajeno", () => {
  assert.match(sql, /create or replace function public\.player_family_id[\s\S]*?and public\.can_access_family\(p\.family_id\)/);
});

test("las funciones de trigger fijan search_path", () => {
  assert.match(sql, /alter function public\.touch_updated_at\(\) set search_path = public;/);
  assert.match(sql, /alter function public\.prevent_signed_signature_update\(\) set search_path = public;/);
});
