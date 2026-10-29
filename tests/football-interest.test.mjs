import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isMissingRelation, mapInterestToEnrollment } from "../data/remote-interest.ts";
import { renderAdmin } from "../areas/admin.js";
import { renderFamily } from "../areas/family.js";
import { centers, documentTemplates, groups, initialState, legalDocumentSources, services, stepLabels, steps, trainingKidsPlans } from "../data/mock-data.js";

const HOSTILE = `x');alert(1);//`;
const ROW = {
  id: "i1", family_id: "f1", player_id: initialState.family.children[0].id, service_id: "football_academy",
  status: "received", notes: "<b>hola</b>", admin_notes: null, created_at: "2026-10-29T10:00:00Z",
};

test("una prealta se presenta como tarjeta de prealta, sin pagos ni documentos", () => {
  const item = mapInterestToEnrollment(ROW);
  assert.equal(item.interest, true);
  assert.equal(item.service, "football_academy");
  assert.equal(item.status, "Prealta recibida");
  assert.equal(item.planId, "");
  assert.equal(item.payment, "No requerido");
  assert.equal(mapInterestToEnrollment({ ...ROW, status: "contacted" }).status, "Familia contactada");
});

test("sin la tabla de prealtas la carga sigue adelante", () => {
  assert.equal(isMissingRelation({ code: "PGRST205" }), true);
  assert.equal(isMissingRelation({ code: "42P01" }), true);
  assert.equal(isMissingRelation({ code: "42501" }), false);
});

function state(patch = {}) {
  const s = structuredClone(initialState);
  s.appMode = "test";
  s.session = { email: "admin@example.com", isAdmin: true };
  s.adminServiceFilter = "all";
  s.operationalStatusFilter = "all";
  s.documentStatusFilter = "all";
  s.paymentStatusFilter = "all";
  return Object.assign(s, patch);
}
const ctx = (s) => ({ state: s, steps, stepLabels, services, centers, groups, trainingKidsPlans, documentTemplates, legalDocumentSources });

test("administracion ve la prealta con sus acciones y los datos escapados", () => {
  const s = state();
  s.enrollments = [mapInterestToEnrollment({ ...ROW, id: HOSTILE })];
  const html = renderAdmin(ctx(s));
  assert.match(html, /data-interest-action="contacted"/);
  assert.match(html, /data-interest-action="closed"/);
  assert.doesNotMatch(html, /Falta para activar/);
  assert.equal(html.includes("');alert(1)"), false);
  assert.equal(html.includes("<b>hola</b>"), false);
});

test("una prealta cerrada no ofrece acciones", () => {
  const s = state();
  s.enrollments = [mapInterestToEnrollment({ ...ROW, status: "closed" })];
  const html = renderAdmin(ctx(s));
  assert.doesNotMatch(html, /data-interest-action/);
  assert.match(html, /Prealta cerrada/);
});

test("la familia ve su prealta sin revision, pagos ni documentos", () => {
  const s = state({ session: { email: "f@example.com", isAdmin: false }, familyStep: 5, selectedChildId: ROW.player_id });
  s.enrollments = [mapInterestToEnrollment(ROW)];
  const html = renderFamily(ctx(s));
  assert.match(html, /Hemos recibido vuestro interes/);
  assert.doesNotMatch(html, /Revisión:/);
});

test("la migracion I separa las prealtas y solo permite escribir mediante funciones", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202610290003_phase_i_football_interest.sql", import.meta.url), "utf8");
  assert.match(sql, /create table if not exists public\.service_interest_requests/);
  assert.match(sql, /alter table public\.service_interest_requests enable row level security;/);
  assert.match(sql, /revoke all on public\.service_interest_requests from anon, authenticated;\s+grant select on public\.service_interest_requests to authenticated;/);
  assert.match(sql, /where id = p_service_id and status = 'prelaunch'/);
  assert.match(sql, /create unique index if not exists service_interest_one_open_per_player/);
  assert.match(sql, /function public\.admin_update_interest[\s\S]*?if not public\.is_admin\(\) then raise exception 'admin_access_required'/);
  assert.doesNotMatch(sql, /to anon/);
  assert.doesNotMatch(sql, /plan_prices|payment_orders/, "Football Academy no tiene tarifas ni cobros");
});

test("la app registra la prealta en el servidor en modo test", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /if \(serviceId === "football_academy" && adapter\.isRemote\) \{\s+registerFootballInterest\(\);/);
  assert.match(app, /if \(adapter\.isRemote\) return updateFootballInterest\(enrollmentId, "contacted"\);/);
  const adapter = readFileSync(new URL("../data/supabase-adapter.ts", import.meta.url), "utf8");
  assert.match(adapter, /rpc\("family_register_interest"/);
  assert.doesNotMatch(adapter, /from\("service_interest_requests"\)\.(insert|update|upsert)/);
});
