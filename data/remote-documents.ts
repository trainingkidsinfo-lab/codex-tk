// Documentos y firma remota (Fase F). Sin dependencias de navegador salvo Web Crypto y Blob,
// disponibles tambien en Node 20, para poder probarlo con un cliente Supabase simulado.

import type { Json, Tables } from "./database.types.ts";
import { callRpc, type TkSupabaseClient } from "./supabase-client.ts";

type SignatureRecord = Tables<"signature_records">;

// Antes de la migracion F solo existen las columnas antiguas: las de evidencia pueden faltar.
export type SignatureRow = Pick<SignatureRecord, "id" | "player_id" | "enrollment_id" | "document_version_id" | "status" | "signed_at" | "completed_data" | "accepted_consents" | "final_sha256" | "locked_at">
  & Partial<Pick<SignatureRecord, "final_storage_path" | "signer_name" | "evidence_storage_path" | "evidence_sha256" | "image_decision">>;

export type ServiceDocumentRow = Pick<Tables<"service_documents">, "id" | "service_id" | "code" | "title" | "scope" | "required" | "active"> & {
  document_versions: Array<Pick<Tables<"document_versions">, "id" | "version" | "effective_date" | "storage_path" | "status">> | null;
};

export type DocumentEnrollmentRow = Pick<Tables<"enrollments">, "id" | "player_id" | "service_id">;

// Documento de la app que se va a firmar: solo se usan estos campos.
export interface SignableDocument {
  id?: string;
  templateId: string;
  enrollmentId: string;
  remoteVersionId: string;
}

export const TEMPLATE_BY_CODE: Record<string, string> = {
  activity_contract: "tk-service-terms",
  image_authorization: "tk-image-rights",
  rules_and_guarantees: "tk-norms-guarantees",
  calendar_2026_2027: "global-family-account",
};

export const SIGNATURE_BUCKETS = {
  pdf: "tk-signed-documents",
  evidence: "tk-signature-evidence",
};

export const SIGNATURE_COLUMNS = "id,player_id,enrollment_id,document_version_id,status,signed_at,completed_data,accepted_consents,final_sha256,final_storage_path,locked_at,signer_name,evidence_storage_path,evidence_sha256,image_decision";
export const LEGACY_SIGNATURE_COLUMNS = "id,player_id,enrollment_id,document_version_id,status,signed_at,completed_data,accepted_consents,final_sha256,locked_at";

const BASE_CONSENTS = ["lectura_completa", "version_aceptada", "firma_simulada"];
const CONTRACT_CONSENTS = ["contrato_actividad", "anexo_1_riesgos", "anexo_2_parq"];
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function remoteConsentsFor(templateId: string): Record<string, boolean> {
  const keys = templateId === "tk-service-terms" ? [...BASE_CONSENTS, ...CONTRACT_CONSENTS] : BASE_CONSENTS;
  return Object.fromEntries(keys.map((key) => [key, true]));
}

export function signatureFolder({ familyId, enrollmentId, versionId }: { familyId: string; enrollmentId: string; versionId: string }): string {
  for (const [label, value] of [["familia", familyId], ["inscripcion", enrollmentId], ["version", versionId]] as const) {
    if (!ID_PATTERN.test(String(value || ""))) throw new Error(`Identificador de ${label} no valido para la firma.`);
  }
  return `families/${familyId}/enrollments/${enrollmentId}/${versionId}`;
}

export function dataUrlToBytes(dataUrl: unknown, mime: string): Uint8Array<ArrayBuffer> {
  const prefix = `data:${mime};base64,`;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(prefix)) {
    throw new Error(`Se esperaba un archivo ${mime}.`);
  }
  const binary = atob(dataUrl.slice(prefix.length));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function uploadOnce(supabase: TkSupabaseClient, bucket: string, path: string, bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, new Blob([bytes], { type: contentType }), {
    contentType,
    upsert: false,
  });
  if (error) throw error;
}

// Sube la evidencia y el PDF firmado (si lo hay) y registra la firma mediante la RPC protegida.
// Las huellas se recalculan aqui sobre los bytes que realmente se suben.
export async function signRemoteDocument({
  supabase,
  familyId,
  document,
  signerName,
  completedData,
  signaturePngDataUrl,
  pdfDataUrl = "",
  randomId = () => crypto.randomUUID(),
}: {
  supabase: TkSupabaseClient;
  familyId: string;
  document: SignableDocument;
  signerName: string;
  completedData: Json;
  signaturePngDataUrl: string;
  pdfDataUrl?: string;
  randomId?: () => string;
}) {
  if (!document?.enrollmentId || !document?.remoteVersionId) throw new Error("Documento remoto incompleto.");
  const folder = signatureFolder({ familyId, enrollmentId: document.enrollmentId, versionId: document.remoteVersionId });
  const fileId = randomId();

  const evidenceBytes = dataUrlToBytes(signaturePngDataUrl, "image/png");
  const evidenceSha256 = await sha256Hex(evidenceBytes);
  const evidencePath = `${folder}/${fileId}-firma.png`;

  let pdfBytes: Uint8Array<ArrayBuffer> | null = null;
  let pdfSha256: string | null = null;
  let pdfPath: string | null = null;
  if (pdfDataUrl) {
    pdfBytes = dataUrlToBytes(pdfDataUrl, "application/pdf");
    pdfSha256 = await sha256Hex(pdfBytes);
    pdfPath = `${folder}/${fileId}-documento.pdf`;
  }

  await uploadOnce(supabase, SIGNATURE_BUCKETS.evidence, evidencePath, evidenceBytes, "image/png");
  if (pdfBytes && pdfPath) await uploadOnce(supabase, SIGNATURE_BUCKETS.pdf, pdfPath, pdfBytes, "application/pdf");

  const { data, error } = await callRpc(supabase, "family_sign_document", {
    p_enrollment_id: document.enrollmentId,
    p_document_version_id: document.remoteVersionId,
    p_signer_name: signerName,
    p_completed_data: completedData,
    p_accepted_consents: remoteConsentsFor(document.templateId),
    p_evidence_storage_path: evidencePath,
    p_evidence_sha256: evidenceSha256,
    p_final_storage_path: pdfPath,
    p_final_sha256: pdfSha256,
  });
  if (error) throw error;
  return { signatureId: data, evidencePath, evidenceSha256, pdfPath, pdfSha256 };
}

export function mapRemoteDocuments({ familyId, enrollments, serviceDocuments, signatures }: {
  familyId: string;
  enrollments: DocumentEnrollmentRow[];
  serviceDocuments: ServiceDocumentRow[];
  signatures: SignatureRow[];
}) {
  const documents: RemoteDocument[] = [];
  for (const definition of serviceDocuments) {
    const templateId = TEMPLATE_BY_CODE[definition.code];
    if (!templateId) continue;
    const versions = definition.document_versions || [];
    const version = [...versions].sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)))[0];
    if (!version) continue;
    if (definition.scope === "informative") {
      documents.push(mapRemoteDocument({ definition, version, templateId, familyId }));
      continue;
    }
    for (const enrollment of enrollments.filter((item) => item.service_id === definition.service_id)) {
      const signature = signatures.find((item) => item.enrollment_id === enrollment.id && item.document_version_id === version.id && item.status === "signed")
        || signatures.find((item) => item.enrollment_id === enrollment.id && item.document_version_id === version.id);
      documents.push(mapRemoteDocument({ definition, version, templateId, familyId, enrollment, signature }));
    }
  }
  return documents;
}

function mapRemoteDocument({ definition, version, templateId, familyId, enrollment, signature }: {
  definition: ServiceDocumentRow;
  version: NonNullable<ServiceDocumentRow["document_versions"]>[number];
  templateId: string;
  familyId: string;
  enrollment?: DocumentEnrollmentRow;
  signature?: SignatureRow;
}) {
  const signed = signature?.status === "signed" ? signature : null;
  const informative = definition.scope === "informative";
  return {
    // Identificador estable: no cambia al firmar, para no perder el documento abierto.
    id: `remote-${version.id}-${enrollment?.id || "info"}`,
    remoteVersionId: version.id,
    remoteSignatureId: signature?.id || "",
    templateId,
    scope: informative ? "global" : "enrollment",
    service: definition.service_id,
    familyId,
    childId: enrollment?.player_id || "",
    enrollmentId: enrollment?.id || "",
    status: informative ? "info" : signed ? "signed" : definition.required ? "pending_complete" : "pending_signature",
    required: Boolean(definition.required),
    title: definition.title,
    version: version.version,
    effectiveDate: version.effective_date,
    signedAt: signed ? signed.signed_at || "" : "",
    completedSnapshot: signed ? {
      version: version.version,
      effectiveDate: version.effective_date,
      fieldValues: signed.completed_data || {},
      lockedAt: signed.locked_at || signed.signed_at || "",
    } : null,
    evidence: signed ? {
      id: signed.id,
      remote: true,
      version: version.version,
      signerTutorName: signed.signer_name || "Tutor de la familia",
      signatureName: signed.signer_name || "",
      hash: signed.final_sha256 || signed.evidence_sha256 || "Huella remota pendiente",
      status: "Firmado",
      signedAt: signed.signed_at,
      consents: signed.accepted_consents || {},
      imageDecision: signed.image_decision || "",
      finalStoragePath: signed.final_storage_path || "",
      evidenceStoragePath: signed.evidence_storage_path || "",
    } : null,
  };
}

export type RemoteDocument = ReturnType<typeof mapRemoteDocument>;
