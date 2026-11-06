import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { documentTemplates, initialState, legalDocumentSources } from "../data/mock-data.js";
import { getEnrollmentReview } from "../areas/enrollment-review.js";

const ACTIVE = ["global-family-account", "tk-service-terms", "tk-image-rights", "tk-norms-guarantees"];
const RETIRED = /sepa|tk-medical-info|tk-emergency-contact|tk-data-protection|fa-interest-info|contract-annual/i;

test("solo existen las cuatro plantillas documentales vigentes", () => {
  assert.deepEqual(documentTemplates.map((template) => template.id).sort(), [...ACTIVE].sort());
});

test("los documentos de ejemplo usan solo plantillas vigentes", () => {
  for (const document of initialState.documents) {
    assert.ok(ACTIVE.includes(document.templateId), document.templateId);
  }
});

test("no quedan fuentes legales retiradas", () => {
  for (const source of legalDocumentSources) {
    assert.doesNotMatch(source.id, RETIRED);
  }
  const usedSources = new Set(documentTemplates.map((template) => template.sourceId));
  for (const source of legalDocumentSources) assert.ok(usedSources.has(source.id), `fuente sin uso: ${source.id}`);
});

test("solo el contrato es obligatorio y la imagen no premarca decision", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appSource, /tk-service-terms"\) return \{ status: "pending_complete", required: true/);
  assert.match(appSource, /tk-image-rights"\) return \{ status: "pending_signature", required: false/);
  const documentsSource = readFileSync(new URL("../areas/documents.js", import.meta.url), "utf8");
  assert.match(documentsSource, /radioField\("imageAuthorization", "Decision sobre derechos de imagen", "", true/);
});

test("la revision administrativa no usa el dialogo nativo confirm", () => {
  const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.doesNotMatch(appSource, /window\.confirm\(/);
  assert.match(appSource, /type: "review"/);
  for (const decision of ["approve", "request_changes", "reject"]) {
    assert.ok(getEnrollmentReview(decision).detail);
  }
  assert.throws(() => getEnrollmentReview("toString"), /no válida/);
});

test("supabase-js se instala con version exacta y no se carga desde un CDN", () => {
  const adapter = readFileSync(new URL("../data/supabase-adapter.ts", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(pkg.dependencies["@supabase/supabase-js"], /^\d+\.\d+\.\d+$/);
  assert.match(adapter, /await import\("@supabase\/supabase-js"\)/);
  assert.doesNotMatch(adapter, /https:\/\/(esm\.sh|cdn\.|unpkg)/);
});
