import assert from "node:assert/strict";
import test from "node:test";
import {
  centers,
  documentTemplates,
  groups,
  initialState,
  legalDocumentSources,
  services,
  stepLabels,
  steps,
  trainingKidsPlans,
} from "../data/mock-data.js";
import { renderAdmin } from "../areas/admin.js";
import { renderDocuments } from "../areas/documents.js";
import { renderFamily } from "../areas/family.js";
import { renderPayments } from "../areas/payments.js";
import { appChrome } from "../ui/shared.js";

const HTML_PAYLOAD = `<img src=x onerror=alert(1)>`;
const ATTR_PAYLOAD = `"><svg onload=alert(1)>`;
const JS_PAYLOAD = `x');alert(1);//`;

function hostileState(patch = {}) {
  const state = structuredClone(initialState);
  state.appMode = "test";
  state.session = { email: "familia@example.com", isAdmin: true };
  state.family.name = HTML_PAYLOAD;
  state.family.address = ATTR_PAYLOAD;
  state.family.tutors[0].name = HTML_PAYLOAD;
  const child = state.family.children[0];
  child.name = HTML_PAYLOAD;
  child.medical = `</textarea>${HTML_PAYLOAD}`;
  child.emergencyName = ATTR_PAYLOAD;
  child.availability = [`</textarea>${HTML_PAYLOAD}`];
  state.enrollments[0].reviewStatus = "changes_requested";
  state.enrollments[0].reviewNotes = HTML_PAYLOAD;
  state.enrollments[0].remote = true;
  state.audit.unshift({ id: "a-x", date: HTML_PAYLOAD, actor: HTML_PAYLOAD, action: HTML_PAYLOAD, service: HTML_PAYLOAD });
  state.saveMessage = HTML_PAYLOAD;
  return Object.assign(state, patch);
}

function context(state) {
  return { state, steps, stepLabels, services, centers, groups, trainingKidsPlans, documentTemplates, legalDocumentSources };
}

function assertSafe(html, label) {
  assert.equal(html.includes("<img src=x"), false, `${label}: etiqueta img sin escapar`);
  assert.equal(html.includes("<svg onload"), false, `${label}: etiqueta svg sin escapar`);
  assert.equal(html.includes("');alert(1)"), false, `${label}: argumento JS sin escapar`);
}

test("todos los pasos del area familiar escapan datos de usuario", () => {
  for (let step = 0; step < steps.length; step += 1) {
    const state = hostileState({ familyStep: step });
    assertSafe(renderFamily(context(state)), `paso ${step}`);
  }
});

test("las observaciones de administracion se muestran escapadas a la familia", () => {
  const state = hostileState({ familyStep: 5, selectedChildId: initialState.family.children[0].id });
  const html = renderFamily(context(state));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("el panel administrativo escapa familias, auditoria y notas", () => {
  const state = hostileState({ activeView: "admin" });
  state.adminReviewNotes = { [state.enrollments[0].id]: `</textarea>${HTML_PAYLOAD}` };
  assertSafe(renderAdmin(context(state)), "admin");
});

test("los identificadores en manejadores inline no permiten inyectar JS", () => {
  const state = hostileState({ activeView: "admin", familyStep: 1 });
  state.family.children[0].id = JS_PAYLOAD;
  state.selectedChildId = JS_PAYLOAD;
  state.enrollments[0].id = JS_PAYLOAD;
  state.enrollments[0].childId = JS_PAYLOAD;
  assertSafe(renderFamily(context(state)), "familia con id hostil");
  assertSafe(renderAdmin(context(state)), "admin con id hostil");
});

test("documentos y pagos escapan nombres", () => {
  const state = hostileState();
  assertSafe(renderDocuments(context(state)), "documentos");
  assertSafe(renderPayments(context(state)), "pagos");
});

test("la pestaña Diseño no se muestra a familias en modo test", () => {
  const state = hostileState({ session: { email: "familia@example.com", isAdmin: false } });
  const html = appChrome({ state, content: "" });
  assert.equal(html.includes("activeView:'design'"), false);
  assert.equal(html.includes("activeView:'admin'"), false);
  assert.match(html, /aria-label="Cerrar sesión"/);
});
