import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderAdmin } from "../areas/admin.js";
import { translateDataError } from "../data/errors.js";
import { centers, documentTemplates, groups, initialState, legalDocumentSources, services, trainingKidsPlans } from "../data/mock-data.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("la clave de servicio no aparece en ningun archivo que llega al navegador", () => {
  const files = [
    "index.html", "app.js", ".env.example", "vite.config.js",
    "data/supabase-adapter.js", "data/app-config.js", "data/errors.js", "data/remote-documents.js",
    "data/remote-payments.js", "data/remote-interest.js", "data/local-adapter.js", "data/mock-data.js",
    "areas/admin.js", "areas/family.js", "areas/documents.js", "areas/payments.js", "ui/shared.js",
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /SUPABASE_SERVICE_ROLE_KEY|service_role_key|sb_secret_/i, file);
  }
});

test("la funcion de servidor solo atiende a administracion y no expone la clave", () => {
  const fn = read("supabase/functions/prepare-family-access/index.ts");
  assert.match(fn, /npm:@supabase\/supabase-js@2\.\d+\.\d+"/, "version exacta");
  assert.match(fn, /if \(request\.method !== "POST"\) fail\("method_not_allowed"\)/);
  assert.match(fn, /await caller\.rpc\("is_admin"\)/);
  assert.match(fn, /if \(roleError \|\| isAdmin !== true\) fail\("admin_access_required"\)/);
  assert.match(fn, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(fn, /admin\.rpc\("service_prepare_family_access"/);
  assert.match(fn, /if \(createdUser\) await admin\.auth\.admin\.deleteUser\(authUserId\)/);
  assert.doesNotMatch(fn, /"Access-Control-Allow-Origin": "\*"/);
  assert.doesNotMatch(fn, /\.from\("(families|family_members|user_roles|profiles)"\)\.(insert|upsert|update)/, "las escrituras van por la funcion SQL");
  assert.doesNotMatch(fn, /JSON\.stringify\([^)]*serviceKey/);
});

test("la migracion J solo deja ejecutar sus funciones al servidor", () => {
  const sql = read("supabase/migrations/202610290004_phase_j_family_access.sql");
  assert.match(sql, /revoke all on function public\.service_lookup_auth_user\(text\) from public, anon, authenticated;/);
  assert.match(sql, /revoke all on function public\.service_prepare_family_access\(uuid, uuid, text, text, uuid\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.service_prepare_family_access\(uuid, uuid, text, text, uuid\) to service_role;/);
  assert.doesNotMatch(sql, /to (anon|authenticated)\b/);
  assert.match(sql, /raise exception 'admin_access_required'/);
  assert.match(sql, /raise exception 'email_belongs_to_admin'/);
  assert.match(sql, /raise exception 'email_belongs_to_other_family'/);
  assert.match(sql, /'Familia dada de alta'/);
});

function adminState(patch = {}) {
  const state = structuredClone(initialState);
  state.appMode = "test";
  state.session = { email: "admin@example.com", isAdmin: true };
  state.adminServiceFilter = "all";
  state.operationalStatusFilter = "all";
  state.documentStatusFilter = "all";
  state.paymentStatusFilter = "all";
  state.adminFamilies = [{ ...state.family, id: `x"><img src=x onerror=alert(1)>`, name: `<img src=x onerror=alert(1)>` }];
  return Object.assign(state, patch);
}
const ctx = (state) => ({ state, services, centers, groups, trainingKidsPlans, documentTemplates, legalDocumentSources });

test("el formulario de alta aparece solo para administracion en modo test y escapa nombres", () => {
  const html = renderAdmin(ctx(adminState()));
  assert.match(html, /data-operation="family-access"/);
  assert.equal(html.includes("<img src=x"), false);
  assert.doesNotMatch(renderAdmin(ctx(adminState({ appMode: "demo" }))), /data-operation="family-access"/);
  assert.doesNotMatch(renderAdmin(ctx(adminState({ session: { email: "f@example.com", isAdmin: false } }))), /data-operation="family-access"/);
});

test("los errores del alta se explican a administracion", () => {
  assert.equal(translateDataError({ message: "email_belongs_to_other_family" }), "Ese correo ya es tutor de otra familia.");
  assert.equal(translateDataError({ message: "email_belongs_to_admin" }), "Ese correo pertenece a una cuenta de administración.");
  assert.match(translateDataError({ message: "family_access_unavailable" }), /se active la función/);
});

test("el adaptador llama a la funcion con la sesion del administrador", () => {
  const adapter = read("data/supabase-adapter.js");
  assert.match(adapter, /supabase\.functions\.invoke\("prepare-family-access", \{/);
  assert.match(adapter, /headers: \{ Authorization: `Bearer \$\{token\}` \}/);
});
