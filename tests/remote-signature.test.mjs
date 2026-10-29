import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  dataUrlToBytes,
  mapRemoteDocuments,
  remoteConsentsFor,
  sha256Hex,
  signRemoteDocument,
  signatureFolder,
} from "../data/remote-documents.js";
import {
  centers,
  documentTemplates,
  groups,
  initialState,
  legalDocumentSources,
  services,
  trainingKidsPlans,
} from "../data/mock-data.js";
import { renderAdminDocuments, renderDocuments } from "../areas/documents.js";

const FAMILY = "99999999-9999-9999-9999-999999999999";
const ENROLLMENT = "77777777-7777-7777-7777-777777777771";
const CONTRACT_VERSION = "ffffffff-ffff-ffff-ffff-fffffffffff1";
const IMAGE_VERSION = "ffffffff-ffff-ffff-ffff-fffffffffff2";
const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const PNG_ABC = "data:image/png;base64,YWJj";
const PDF_ABC = "data:application/pdf;base64,YWJj";

function fakeSupabase({ uploadError = null, rpcResult = { data: "sig-1", error: null } } = {}) {
  const calls = { uploads: [], rpc: [] };
  return {
    calls,
    storage: {
      from(bucket) {
        return {
          async upload(path, blob, options) {
            calls.uploads.push({ bucket, path, type: blob.type, size: blob.size, options });
            return { data: uploadError ? null : { path }, error: uploadError };
          },
        };
      },
    },
    async rpc(name, params) {
      calls.rpc.push({ name, params });
      return rpcResult;
    },
  };
}

test("la ruta de firma queda dentro de la carpeta de la familia y la inscripcion", () => {
  assert.equal(
    signatureFolder({ familyId: FAMILY, enrollmentId: ENROLLMENT, versionId: CONTRACT_VERSION }),
    `families/${FAMILY}/enrollments/${ENROLLMENT}/${CONTRACT_VERSION}`,
  );
  assert.throws(() => signatureFolder({ familyId: "../otra", enrollmentId: ENROLLMENT, versionId: CONTRACT_VERSION }), /no valido/);
  assert.throws(() => signatureFolder({ familyId: FAMILY, enrollmentId: "", versionId: CONTRACT_VERSION }), /no valido/);
});

test("el contrato exige aceptar anexos y la imagen solo las aceptaciones basicas", () => {
  assert.deepEqual(Object.keys(remoteConsentsFor("tk-service-terms")).sort(), [
    "anexo_1_riesgos", "anexo_2_parq", "contrato_actividad", "firma_simulada", "lectura_completa", "version_aceptada",
  ]);
  assert.deepEqual(Object.keys(remoteConsentsFor("tk-image-rights")).sort(), ["firma_simulada", "lectura_completa", "version_aceptada"]);
});

test("solo se aceptan data URLs del tipo esperado", async () => {
  assert.deepEqual([...dataUrlToBytes(PNG_ABC, "image/png")], [97, 98, 99]);
  assert.throws(() => dataUrlToBytes(PNG_ABC, "application/pdf"), /application\/pdf/);
  assert.throws(() => dataUrlToBytes("javascript:alert(1)", "image/png"), /image\/png/);
  assert.equal(await sha256Hex(new TextEncoder().encode("abc")), ABC_SHA256);
});

test("el contrato sube firma y PDF sin sobrescribir y registra huellas calculadas", async () => {
  const supabase = fakeSupabase();
  const document = { id: "doc", templateId: "tk-service-terms", enrollmentId: ENROLLMENT, remoteVersionId: CONTRACT_VERSION };
  const result = await signRemoteDocument({
    supabase,
    familyId: FAMILY,
    document,
    signerName: "Tutor Prueba",
    completedData: { tutorName: { label: "Tutor", value: "Tutor Prueba" } },
    signaturePngDataUrl: PNG_ABC,
    pdfDataUrl: PDF_ABC,
    randomId: () => "file-1",
  });
  const folder = `families/${FAMILY}/enrollments/${ENROLLMENT}/${CONTRACT_VERSION}`;
  assert.deepEqual(supabase.calls.uploads.map(({ bucket, path, type, options }) => ({ bucket, path, type, upsert: options.upsert })), [
    { bucket: "tk-signature-evidence", path: `${folder}/file-1-firma.png`, type: "image/png", upsert: false },
    { bucket: "tk-signed-documents", path: `${folder}/file-1-documento.pdf`, type: "application/pdf", upsert: false },
  ]);
  assert.equal(supabase.calls.rpc.length, 1);
  const { name, params } = supabase.calls.rpc[0];
  assert.equal(name, "family_sign_document");
  assert.equal(params.p_enrollment_id, ENROLLMENT);
  assert.equal(params.p_document_version_id, CONTRACT_VERSION);
  assert.equal(params.p_evidence_sha256, ABC_SHA256);
  assert.equal(params.p_final_sha256, ABC_SHA256);
  assert.equal(params.p_final_storage_path, `${folder}/file-1-documento.pdf`);
  assert.equal(params.p_accepted_consents.anexo_2_parq, true);
  assert.equal(result.signatureId, "sig-1");
});

test("la autorizacion de imagen se firma sin PDF", async () => {
  const supabase = fakeSupabase();
  await signRemoteDocument({
    supabase,
    familyId: FAMILY,
    document: { id: "img", templateId: "tk-image-rights", enrollmentId: ENROLLMENT, remoteVersionId: IMAGE_VERSION },
    signerName: "Tutor Prueba",
    completedData: { imageAuthorization: { label: "Decision", value: "deny" } },
    signaturePngDataUrl: PNG_ABC,
    randomId: () => "file-2",
  });
  assert.equal(supabase.calls.uploads.length, 1);
  assert.equal(supabase.calls.rpc[0].params.p_final_storage_path, null);
  assert.equal(supabase.calls.rpc[0].params.p_final_sha256, null);
});

test("si falla la subida no se registra la firma", async () => {
  const supabase = fakeSupabase({ uploadError: { message: "new row violates row-level security policy" } });
  await assert.rejects(() => signRemoteDocument({
    supabase,
    familyId: FAMILY,
    document: { id: "img", templateId: "tk-image-rights", enrollmentId: ENROLLMENT, remoteVersionId: IMAGE_VERSION },
    signerName: "Tutor Prueba",
    completedData: { imageAuthorization: { value: "authorize" } },
    signaturePngDataUrl: PNG_ABC,
  }), { message: /row-level security/ });
  assert.equal(supabase.calls.rpc.length, 0);
});

test("los documentos remotos conservan su identificador al firmarse", () => {
  const serviceDocuments = [
    { id: "d1", service_id: "training_kids", code: "activity_contract", title: "Contrato", scope: "enrollment", required: true, document_versions: [{ id: CONTRACT_VERSION, version: "2026-09-test", effective_date: "2026-09-01" }] },
    { id: "d2", service_id: "training_kids", code: "image_authorization", title: "Imagen", scope: "enrollment", required: false, document_versions: [{ id: IMAGE_VERSION, version: "2026-09-test", effective_date: "2026-09-01" }] },
    { id: "d3", service_id: "training_kids", code: "sepa_mandate", title: "SEPA", scope: "enrollment", required: true, document_versions: [{ id: "v-sepa", version: "1", effective_date: "2026-09-01" }] },
  ];
  const enrollments = [{ id: ENROLLMENT, service_id: "training_kids", player_id: "p1" }];
  const before = mapRemoteDocuments({ familyId: FAMILY, enrollments, serviceDocuments, signatures: [] });
  const after = mapRemoteDocuments({
    familyId: FAMILY,
    enrollments,
    serviceDocuments,
    signatures: [{
      id: "sig-1", enrollment_id: ENROLLMENT, document_version_id: IMAGE_VERSION, status: "signed",
      signed_at: "2026-10-28T10:00:00Z", signer_name: "Tutor Prueba", image_decision: "deny",
      completed_data: { imageAuthorization: { label: "Decision", value: "deny" } },
      evidence_sha256: ABC_SHA256, evidence_storage_path: "families/x/firma.png",
    }],
  });
  assert.equal(before.length, 2, "un codigo desconocido como SEPA no genera documento");
  assert.deepEqual(before.map((item) => item.id), after.map((item) => item.id));
  const image = after.find((item) => item.templateId === "tk-image-rights");
  assert.equal(image.status, "signed");
  assert.equal(image.evidence.remote, true);
  assert.equal(image.evidence.imageDecision, "deny");
  assert.equal(image.evidence.hash, ABC_SHA256);
  assert.equal(image.completedSnapshot.fieldValues.imageAuthorization.value, "deny");
  assert.equal(after.find((item) => item.templateId === "tk-service-terms").status, "pending_complete");
});

test("la migracion F cierra la insercion directa y valida la firma en servidor", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202610280001_phase_f_remote_signature.sql", import.meta.url), "utf8");
  assert.match(sql, /drop policy if exists signatures_family_insert on public\.signature_records/);
  assert.match(sql, /revoke insert, update, delete on public\.signature_records from authenticated/);
  assert.match(sql, /create or replace function public\.family_sign_document\([\s\S]*?security definer\s+set search_path = public/);
  assert.match(sql, /can_sign/);
  assert.match(sql, /\^\[0-9a-f\]\{64\}\$/);
  assert.match(sql, /from storage\.objects where bucket_id = 'tk-signature-evidence'/);
  assert.match(sql, /create unique index if not exists signature_records_one_signed_per_version/);
  assert.match(sql, /grant execute on function public\.family_sign_document\([^)]*\) to authenticated/);
  assert.doesNotMatch(sql, /for update[\s\S]{0,80}tk-signed-documents/, "el PDF firmado no debe poder sobrescribirse");
  assert.doesNotMatch(sql, /service_role/);
});

test("la app usa la RPC remota y no simula la firma en modo test", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /if \(adapter\.isRemote\) \{\s+try \{\s+await adapter\.signDocument\(/);
  assert.match(app, /remoteSignatureReady/);
  const adapter = readFileSync(new URL("../data/supabase-adapter.js", import.meta.url), "utf8");
  assert.doesNotMatch(adapter, /from\("signature_records"\)\.insert/);
  assert.match(adapter, /result\.error\?\.code !== "42703"/);
});

test("el justificante remoto escapa el firmante y ofrece abrir los archivos firmados", () => {
  const state = structuredClone(initialState);
  state.appMode = "test";
  state.adminServiceFilter = "all";
  state.documentStatusFilter = "all";
  const doc = state.documents.find((item) => item.templateId === "tk-image-rights");
  const hostileId = `x');alert(1);//`;
  doc.id = hostileId;
  doc.status = "signed";
  doc.evidence = {
    id: "sig-1",
    remote: true,
    signerTutorName: `<img src=x onerror=alert(1)>`,
    signatureName: `"><svg onload=alert(1)>`,
    hash: ABC_SHA256,
    status: "Firmado",
    signedAt: "2026-10-28T10:00:00Z",
    imageDecision: "deny",
    finalStoragePath: "families/x/doc.pdf",
    evidenceStoragePath: "families/x/firma.png",
  };
  state.activeDocumentId = hostileId;
  state.selectedChildId = doc.childId;
  const context = { state, services, centers, groups, trainingKidsPlans, documentTemplates, legalDocumentSources };
  for (const [label, html] of [["familia", renderDocuments(context)], ["admin", renderAdminDocuments(context)]]) {
    assert.equal(html.includes("<img src=x"), false, `${label}: img sin escapar`);
    assert.equal(html.includes("<svg onload"), false, `${label}: svg sin escapar`);
    assert.equal(html.includes("');alert(1)"), false, `${label}: id sin escapar`);
    assert.match(html, /Ver PDF firmado/, label);
    assert.match(html, /Ver imagen de la firma/, label);
  }
  const familyHtml = renderDocuments(context);
  assert.match(familyHtml, /Justificante de prueba/);
  assert.match(familyHtml, /Huella SHA-256/);
  assert.match(familyHtml, /Uso de imagen<\/span><strong>No autorizo/);
  assert.match(familyHtml, /proyecto de pruebas/);
});
