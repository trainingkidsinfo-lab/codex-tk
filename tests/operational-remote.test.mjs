import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getEnrollmentOperationalSummary, getGroupOccupancy, validateGroupAssignment } from "../areas/operational-status.js";
import { renderAdmin } from "../areas/admin.js";
import { translateDataError } from "../data/errors.ts";
import { centers, documentTemplates, groups, initialState, legalDocumentSources, services, trainingKidsPlans } from "../data/mock-data.js";

const GROUP = { id: "g1", service: "training_kids", centerId: "c1", name: "Grupo", day: "Lunes", time: "17:30", capacity: 8, occupied: 2, serverAssigned: 5 };

test("la ocupacion remota usa el recuento del servidor y no lo duplica", () => {
  const state = { enrollments: [{ id: "e1", groupId: "g1", operationalStatus: "active" }] };
  const occupancy = getGroupOccupancy({ group: GROUP, state });
  assert.equal(occupancy.occupied, 7);
  assert.equal(occupancy.available, 1);
  const local = getGroupOccupancy({ group: { ...GROUP, serverAssigned: undefined }, state });
  assert.equal(local.occupied, 3);
});

test("validar un grupo no cuenta dos veces la propia inscripcion", () => {
  const full = { ...GROUP, occupied: 0, capacity: 5, serverAssigned: 5 };
  const state = { enrollments: [] };
  const inside = { id: "e1", service: "training_kids", centerId: "c1", childId: "p1", groupId: "g1", operationalStatus: "pending" };
  assert.equal(validateGroupAssignment({ enrollment: inside, groupId: "g1", state, centers: [], groups: [full] }).ok, true);
  const outside = { ...inside, id: "e2", groupId: "" };
  assert.equal(validateGroupAssignment({ enrollment: outside, groupId: "g1", state, centers: [], groups: [full] }).ok, false);
});

test("en modo test la solicitud debe estar aprobada para estar lista", () => {
  const state = structuredClone(initialState);
  const enrollment = { ...state.enrollments[0], remote: true, reviewStatus: "pending" };
  const summary = getEnrollmentOperationalSummary({ enrollment, state, services, centers, groups, trainingKidsPlans });
  assert.ok(summary.missing.includes("Revision: la solicitud no esta aprobada"));
  const demo = getEnrollmentOperationalSummary({ enrollment: { ...enrollment, remote: false }, state, services, centers, groups, trainingKidsPlans });
  assert.ok(!demo.missing.includes("Revision: la solicitud no esta aprobada"));
});

test("el error de activacion explica que falta", () => {
  assert.equal(
    translateDataError({ message: "enrollment_not_ready: Grupo: pendiente de asignacion administrativa" }),
    "No se puede activar todavía. Grupo: pendiente de asignacion administrativa.",
  );
  assert.equal(translateDataError({ message: "group_full" }), "El grupo ya está lleno.");
});

function adminState(patch = {}) {
  const state = structuredClone(initialState);
  state.appMode = "test";
  state.session = { email: "admin@example.com", isAdmin: true };
  state.adminServiceFilter = "all";
  state.operationalStatusFilter = "all";
  state.documentStatusFilter = "all";
  state.paymentStatusFilter = "all";
  state.enrollments = state.enrollments.map((item) => ({ ...item, remote: true, reviewStatus: "approved", id: `x');alert(1);//` }));
  return Object.assign(state, patch);
}
const context = (state) => ({ state, services, centers, groups, trainingKidsPlans, documentTemplates, legalDocumentSources });

test("con la migracion H el panel ofrece grupo, activar y baja, con ids escapados", () => {
  const html = renderAdmin(context(adminState({ remoteOperationsReady: true })));
  assert.match(html, /data-operation="assign-group"/);
  assert.match(html, /data-operation="activate"/);
  assert.match(html, /data-operation="withdraw"/);
  assert.equal(html.includes("');alert(1)"), false);
});

test("sin la migracion H el panel lo indica y no ofrece las acciones", () => {
  const html = renderAdmin(context(adminState({ remoteOperationsReady: false })));
  assert.match(html, /migracion de la Fase H/);
  assert.doesNotMatch(html, /data-operation="activate"/);
});

test("la migracion H activa solo con todos los requisitos y reserva las acciones a administracion", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202610290002_phase_h_operational_status.sql", import.meta.url), "utf8");
  for (const name of ["admin_assign_group", "admin_activate_enrollment", "admin_withdraw_enrollment"]) {
    assert.match(sql, new RegExp(`function public\\.${name}[\\s\\S]*?if not public\\.is_admin\\(\\) then raise exception 'admin_access_required'`), name);
  }
  assert.match(sql, /raise exception 'enrollment_not_ready: %', v_missing\[1\]/);
  assert.match(sql, /not public\.can_access_family\(v_enrollment\.family_id\)/);
  assert.match(sql, /status = 'paid'\) then\s+v_missing := array_append/);
  assert.match(sql, /sr\.document_version_id = v_doc\.version_id and sr\.status = 'signed'/);
  assert.match(sql, /select \* into v_group from public\.service_groups where id = p_group_id for update/);
  assert.match(sql, /canceled_by_withdrawal/);
  assert.doesNotMatch(sql, /v_missing := v_missing \|\|/, "usar array_append");
  assert.doesNotMatch(sql, /to anon/);
});

test("la app usa las operaciones del servidor en modo test", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /await adapter\.activateEnrollment\(enrollmentId\)/);
  assert.match(app, /await adapter\.withdrawEnrollment\(enrollmentId\)/);
  assert.match(app, /await adapter\.assignGroup\(enrollmentId, groupId\)/);
  const adapter = readFileSync(new URL("../data/supabase-adapter.ts", import.meta.url), "utf8");
  assert.match(adapter, /supabase\.rpc\("group_occupancy"\)/);
  assert.doesNotMatch(adapter, /from\("enrollments"\)\.(insert|update|upsert)/);
});
