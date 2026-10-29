import { serviceName } from "../ui/shared.js?v=i2";
import { escapeHtml, jsArg } from "../ui/escape.js?v=i2";
import { parqQuestions } from "./pdf-generator.js?v=i2";

// Documentos vigentes en el flujo activo. Cualquier otra plantilla queda fuera.
const ACTION_DOCUMENT_IDS = new Set(["tk-service-terms", "tk-image-rights"]);
const INFO_DOCUMENT_IDS = new Set(["tk-norms-guarantees", "global-family-account"]);
const ACTIVE_DOCUMENT_IDS = new Set([...ACTION_DOCUMENT_IDS, ...INFO_DOCUMENT_IDS]);

export const documentStatusMeta = {
  pending_complete: { label: "Pendiente de completar", tone: "red" },
  pending_signature: { label: "Pendiente de firma", tone: "yellow" },
  signed: { label: "Firmado", tone: "green" },
  update_required: { label: "Actualizacion necesaria", tone: "red" },
};

export function renderDocuments(context) {
  const { state, services, documentTemplates } = context;
  const selectedChild = state.family.children.find((child) => child.id === state.selectedChildId) || state.family.children[0];
  const visibleDocuments = activeDocumentsForChild(state.documents, selectedChild?.id);
  const activeDoc = visibleDocuments.find((document) => document.id === state.activeDocumentId);
  const signedActionable = visibleDocuments.filter((document) => ACTION_DOCUMENT_IDS.has(document.templateId) && document.status === "signed").length;
  const pendingActionable = visibleDocuments.filter((document) => ACTION_DOCUMENT_IDS.has(document.templateId) && ["pending_complete", "pending_signature", "update_required"].includes(document.status)).length;
  const childLabel = selectedChild?.name || "tu familia";

  return `
    <section class="hero-band">
      <div class="hero-content">
        <p class="eyebrow">Area documental</p>
        <h1>Documentos y firma</h1>
        <p class="muted">${state.appMode === "test"
          ? "Revisa, completa y firma los documentos. La firma se guarda en el proyecto de pruebas con huella SHA-256 y auditoria, sin validez juridica."
          : "Flujo simulado para revisar, completar y firmar documentos. Usa textos aportados, pero firma, auditoria y almacenamiento siguen sin validez de produccion."}</p>
      </div>
      <div class="hero-side">
        <div class="hero-pill">${signedActionable} firmados</div>
        <div class="hero-pill">${pendingActionable} pendientes</div>
        <div class="hero-pill">${escapeHtml(childLabel)}</div>
      </div>
    </section>

    <section class="section-title">
      <div>
        <h2>Documentos de ${escapeHtml(childLabel)}</h2>
        <p class="muted">Globales, por servicio y por inscripcion. Cada version queda identificada.</p>
      </div>
      <button type="button" class="button ghost" onclick="setState({activeDocumentId:''})">Ver lista</button>
    </section>

    ${activeDoc ? renderDocumentDetail({ ...context, document: activeDoc }) : renderDocumentList({ documents: visibleDocuments, state, services, documentTemplates })}
  `;
}

export function renderAdminDocuments({ state, services, documentTemplates, legalDocumentSources }) {
  const filteredByService = state.adminServiceFilter === "all"
    ? state.documents
    : state.documents.filter((document) => document.service === state.adminServiceFilter || (state.adminServiceFilter === "training_kids" && document.service === "platform"));
  const currentDocuments = filteredByService
    .filter((document) => ACTIVE_DOCUMENT_IDS.has(document.templateId))
    .sort((a, b) => activeDocumentOrder(a.templateId) - activeDocumentOrder(b.templateId));
  const documents = state.documentStatusFilter === "all"
    ? currentDocuments
    : currentDocuments.filter((document) => document.status === state.documentStatusFilter);

  return `
    <section class="section-title">
      <div>
        <h2>Documentos</h2>
        <p class="muted">Vista por familia, hijo, inscripcion, servicio y estado.</p>
      </div>
    </section>
    <div class="doc-filter-row">
      ${statusFilterButton("all", "Todos", state.documentStatusFilter)}
      ${Object.entries(documentStatusMeta).map(([key, meta]) => statusFilterButton(key, meta.label, state.documentStatusFilter)).join("")}
    </div>
    <div class="grid two">
      ${documents.length ? documents.map((document) => renderDocumentCard({ document, state, services, documentTemplates, legalDocumentSources, compact: true })).join("") : `<div class="empty">No hay documentos para este filtro.</div>`}
    </div>
  `;
}

function renderDocumentList({ documents, state, services, documentTemplates }) {
  const actionDocs = documents.filter((document) => ACTION_DOCUMENT_IDS.has(document.templateId));
  const infoDocs = documents.filter((document) => INFO_DOCUMENT_IDS.has(document.templateId));

  return `
    <div class="grid two">
      <section class="panel pad">
        <h3>Documentos para completar</h3>
        <p class="muted">Contrato y autorizacion que requieren datos o firma.</p>
        <div class="doc-stack">
          ${actionDocs.map((document) => renderDocumentCard({ document, state, services, documentTemplates })).join("") || `<div class="empty">Sin documentos pendientes de accion.</div>`}
        </div>
      </section>
      <section class="panel pad">
        <h3>Informacion y calendario</h3>
        <p class="muted">Documentos solo informativos para consultar y descargar.</p>
        <div class="doc-stack">
          ${infoDocs.map((document) => renderDocumentCard({ document, state, services, documentTemplates })).join("") || `<div class="empty">Sin documentos informativos.</div>`}
        </div>
      </section>
    </div>
  `;
}

function renderDocumentDetail({ document, state, services, documentTemplates, legalDocumentSources, centers, groups, trainingKidsPlans }) {
  const template = documentTemplates.find((item) => item.id === document.templateId);
  if (!template) return `<div class="empty">Documento no disponible.</div>`;
  const source = template.sourceId ? legalDocumentSources.find((item) => item.id === template.sourceId) : null;
  if (INFO_DOCUMENT_IDS.has(document.templateId)) {
    return renderInformativeDocumentDetail({ document, template, source, services });
  }
  const child = state.family.children.find((item) => item.id === document.childId);
  const enrollment = state.enrollments.find((item) => item.id === document.enrollmentId);
  const canSign = ["pending_complete", "pending_signature", "update_required"].includes(document.status);
  const formContext = { document, state, template, source, child, enrollment, centers, groups, trainingKidsPlans };
  const fields = getDocumentFields(formContext);
  const missingFields = getMissingRequiredFields({ document, fields });
  const snapshot = document.completedSnapshot;
  const flowStep = ["signed", "accepted"].includes(document.status)
    ? "signed"
    : state.documentFlowSteps?.[document.id] || (fields.length ? "fill" : "review");

  return `
    <section class="panel pad document-detail">
      <div class="section-title compact">
        <div>
          <span class="badge ${statusTone(document.status)}">${escapeHtml(statusLabel(document.status))}</span>
          <h2>${escapeHtml(template.title)}</h2>
          <p class="muted">${escapeHtml(template.description)}</p>
        </div>
        <button type="button" class="button ghost" onclick="setState({activeDocumentId:''})">Cerrar</button>
      </div>
      <div class="document-warning">${escapeHtml(document.validationNote || template.reviewFlag || "Textos definitivos aportados.")} ${state.appMode === "test" ? "La firma queda registrada en el proyecto de pruebas, sin validez juridica." : "Firma, almacenamiento, auditoria y justificante siguen siendo simulados."}</div>
      ${renderDocumentFlowSteps(flowStep)}
      <div class="grid two">
        <div class="demo-document">
          <p class="eyebrow">Documento definitivo aportado</p>
          <h3>${escapeHtml(template.title)}</h3>
          <ul class="small-list">
            <li><span>ID documento</span><strong>${escapeHtml(document.id)}</strong></li>
            <li><span>Version</span><strong>${escapeHtml(document.version)}</strong></li>
            <li><span>Vigencia</span><strong>${escapeHtml(document.effectiveDate || template.effectiveDate || "Pendiente")}</strong></li>
            <li><span>Servicio</span><strong>${escapeHtml(serviceName(services, document.service))}</strong></li>
            <li><span>Hijo</span><strong>${escapeHtml(child?.name || "Cuenta familiar")}</strong></li>
            <li><span>Inscripcion</span><strong>${escapeHtml(enrollment?.id || "Global")}</strong></li>
          </ul>
          ${source ? `
            <div class="document-actions">
              <a class="button ghost" href="${escapeHtml(source.originalPath)}" target="_blank" rel="noopener">Ver documento</a>
              <a class="button ghost" href="${escapeHtml(source.downloadPath)}" download>Descargar original</a>
            </div>
          ` : ""}
        </div>
        ${flowStep === "signed" ? renderReceipt(document) : renderDocumentActionPanel({ document, state, canSign, flowStep, missingFields })}
      </div>
      ${flowStep === "signed" ? renderImmutableSnapshot(snapshot) : ""}
      ${flowStep === "fill" ? renderFillableForm({ document, fields, missingFields }) : ""}
      ${flowStep === "review" ? renderDocumentBody({ document, template, source, fields, snapshot, state }) : ""}
      ${flowStep === "sign" ? renderSignatureForm({ document, state, canSign }) : ""}
    </section>
  `;
}

function renderInformativeDocumentDetail({ document, template, source, services }) {
  const viewLabel = document.templateId === "global-family-account" ? "Ver calendario" : "Ver documento";
  return `
    <section class="panel pad document-detail">
      <div class="section-title compact">
        <div>
          <span class="badge">Documento informativo</span>
          <h2>${escapeHtml(template.title)}</h2>
          <p class="muted">${escapeHtml(template.description)}</p>
        </div>
        <button type="button" class="button ghost" onclick="setState({activeDocumentId:''})">Cerrar</button>
      </div>
      <div class="grid two">
        <div class="demo-document">
          <p class="eyebrow">Informacion disponible</p>
          <h3>${escapeHtml(template.title)}</h3>
          <ul class="small-list">
            <li><span>Version</span><strong>${escapeHtml(document.version)}</strong></li>
            <li><span>Vigencia</span><strong>${escapeHtml(document.effectiveDate || template.effectiveDate || "Pendiente")}</strong></li>
            <li><span>Servicio</span><strong>${escapeHtml(serviceName(services, document.service))}</strong></li>
            <li><span>Tipo</span><strong>Documento informativo</strong></li>
          </ul>
          ${source ? `
            <div class="document-actions">
              <a class="button ghost" href="${escapeHtml(source.originalPath)}" target="_blank" rel="noopener">${viewLabel}</a>
              <a class="button ghost" href="${escapeHtml(source.downloadPath)}" download>Descargar</a>
            </div>
          ` : ""}
        </div>
        <div class="signature-panel">
          <h3>Solo consulta</h3>
          <p class="muted">Este documento no requiere datos, lectura obligatoria, casillas, firma ni justificante.</p>
        </div>
      </div>
    </section>
  `;
}

function renderDocumentFlowSteps(activeStep) {
  const steps = [
    ["fill", "Completar datos"],
    ["review", "Revisar documento"],
    ["sign", "Firmar"],
    ["signed", "Copia firmada"],
  ];
  const activeIndex = steps.findIndex((item) => item[0] === activeStep);
  return `
    <ol class="document-flow" aria-label="Pasos del documento">
      ${steps.map(([key, label], index) => `
        <li class="flow-step ${activeStep === key ? "active" : ""} ${activeIndex > index ? "done" : ""}" ${activeStep === key ? 'aria-current="step"' : ""}>
          <span>${index + 1}</span>
          <strong>${label}</strong>
        </li>
      `).join("")}
    </ol>
  `;
}

function renderFillableForm({ document, fields, missingFields }) {
  if (!fields.length || document.status === "signed") return "";
  const documentId = jsArg(document.id);
  return `
    <section class="panel pad fillable-panel">
      <div class="section-title compact">
        <div>
          <h3>Campos rellenables</h3>
          <p class="muted">Los importes, tarifa, servicio, centro y grupo vienen de la inscripcion y no son editables por la familia.</p>
        </div>
        <button type="button" class="button ghost" onclick="saveDocumentDraft(${documentId})">Guardar borrador</button>
      </div>
      ${missingFields.length ? `<div class="validation-box">Faltan: ${missingFields.map((field) => escapeHtml(field.label)).join(", ")}</div>` : ""}
      <div class="grid two">
        ${fields.map((field) => renderField({ document, field })).join("")}
      </div>
      <div class="actions document-step-actions">
        <button type="button" class="button" onclick="continueDocumentReview(${documentId})">Guardar datos y revisar documento</button>
      </div>
    </section>
  `;
}

function renderField({ document, field }) {
  const draftValue = document.formDraft?.[field.id]?.value ?? document.formDraft?.[field.id];
  const value = draftValue ?? field.value ?? "";
  const fieldId = escapeHtml(field.id);
  if (field.type === "radio") {
    return `
      <fieldset class="field radio-field">
        <legend>${escapeHtml(field.label)}${field.required ? " *" : ""}</legend>
        ${field.help ? `<small class="muted">${escapeHtml(field.help)}</small>` : ""}
        <div class="radio-options">
          ${field.options.map((option) => `
            <label class="radio-card">
              <input
                type="radio"
                name="field-${fieldId}"
                data-doc-field="${fieldId}"
                data-field-label="${escapeHtml(field.label)}"
                data-required="${field.required ? "true" : "false"}"
                value="${escapeHtml(option.value)}"
                ${value === option.value ? "checked" : ""}
              />
              <span>${escapeHtml(option.label)}</span>
            </label>
          `).join("")}
        </div>
      </fieldset>
    `;
  }
  const attrs = [
    `id="field-${fieldId}"`,
    `data-doc-field="${fieldId}"`,
    `data-field-label="${escapeHtml(field.label)}"`,
    field.required ? `data-required="true"` : "",
    field.readOnly ? "readonly" : "",
    field.readOnly ? "aria-readonly=\"true\"" : "",
  ].filter(Boolean).join(" ");
  return `
    <div class="field">
      <label for="field-${fieldId}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
      ${field.type === "textarea"
        ? `<textarea ${attrs} placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(value)}</textarea>`
        : `<input ${attrs} value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder || "")}" />`}
      ${field.readOnly ? `<small class="muted">Dato procedente de la inscripcion.</small>` : ""}
    </div>
  `;
}

function renderDocumentBody({ document, template, source, fields, snapshot, state }) {
  const text = snapshot?.documentText || source?.text || `${template.title}\n\nDocumento visible en esta fase, sin contenido legal adicional.`;
  const reviewed = Boolean(state.reviewedDocuments?.[document.id]);
  if (document.templateId === "tk-service-terms") return renderContractPdfReview({ document, reviewed });
  const documentId = jsArg(document.id);
  return `
    <section class="legal-reader">
      <div class="section-title compact">
        <div>
          <h3>Vista previa completa</h3>
          <p class="muted">Datos completados y documento original mostrado sin sustituciones generales de texto.</p>
        </div>
        <span class="badge">${text.length.toLocaleString("es-ES")} caracteres</span>
      </div>
      <div class="legal-text" tabindex="0" data-legal-reader="${escapeHtml(document.id)}" onscroll="markDocumentReadIfBottom(event, ${documentId})">
        ${renderCompletedFieldsPreview(snapshot?.fieldValues || document.formDraft || fieldsToValues(fields))}
        ${text.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("")}
        <span class="reader-end" data-reader-end="${escapeHtml(document.id)}" aria-hidden="true"></span>
      </div>
      <div class="actions document-step-actions">
        <button type="button" class="button ghost" onclick="setDocumentStep(${documentId}, 'fill')">Editar datos</button>
        <button type="button" id="continueSignatureButton" class="button" ${reviewed ? "" : "disabled"} onclick="startDocumentSignature(${documentId})">Continuar a firma</button>
      </div>
      ${reviewed ? "" : `<div class="validation-box reader-hint">Desplazate hasta el final del documento para activar la siguiente accion.</div>`}
    </section>
  `;
}

function renderContractPdfReview({ document, reviewed }) {
  const documentId = jsArg(document.id);
  const draftPdf = escapeHtml(document.generatedDraftPdf || "");
  return `
    <section class="legal-reader">
      <div class="section-title compact">
        <div>
          <h3>Vista previa del PDF cumplimentado</h3>
          <p class="muted">Copia generada localmente sobre el PDF original aportado. Revisa las paginas hasta el final antes de firmar.</p>
        </div>
        <span class="badge">${document.generatedDraftHash ? `Hash ${escapeHtml(String(document.generatedDraftHash).slice(0, 10))}...` : "Pendiente"}</span>
      </div>
      <div class="pdf-review-box" tabindex="0" data-legal-reader="${escapeHtml(document.id)}" onscroll="markDocumentReadIfBottom(event, ${documentId})">
        ${document.generatedDraftPdf ? renderContractPagePreview(document.generatedDraftData) : `<div class="empty">Generando PDF cumplimentado. Vuelve a pulsar revisar si no aparece.</div>`}
        <span class="reader-end" data-reader-end="${escapeHtml(document.id)}" aria-hidden="true"></span>
      </div>
      <div class="actions document-step-actions">
        <button type="button" class="button ghost" onclick="setDocumentStep(${documentId}, 'fill')">Editar datos</button>
        <button type="button" id="continueSignatureButton" class="button" ${reviewed ? "" : "disabled"} onclick="startDocumentSignature(${documentId})">Continuar a firma</button>
        ${document.generatedDraftPdf ? `<a class="button ghost" href="${draftPdf}" target="_blank" rel="noopener">Ver PDF generado</a><a class="button ghost" href="${draftPdf}" download="contrato-training-kids-cumplimentado-simulado.pdf">Descargar PDF cumplimentado</a>` : ""}
      </div>
      ${reviewed ? "" : `<div class="validation-box reader-hint">Llega al final de la vista previa para activar la firma. Si el PDF cabe completo, se activara automaticamente.</div>`}
    </section>
  `;
}

function renderContractPagePreview(data = {}) {
  const parq = data.parq || {};
  const page = (number, overlays = "") => `
    <article class="contract-page-preview">
      <img src="./assets/documents/contract-activity/page-${number}.jpg" alt="Contrato Training Kids pagina ${number}" />
      ${overlays}
    </article>
  `;
  const label = (value, left, top, width = 30) => `<span class="pdf-field" style="left:${left}%;top:${top}%;width:${width}%;">${escapeHtml(value || "")}</span>`;
  const mark = (value, left, top) => `<span class="pdf-mark" style="left:${left}%;top:${top}%;">${escapeHtml(value || "")}</span>`;
  const parqRows = [19.3, 28.7, 37.8, 48.8, 59.9, 70.8, 81.8];
  const parqMarksHtml = parqRows.map((top, index) => mark("X", 51.1, parq[`parq${index + 1}`] === "si" ? top + 2.7 : top)).join("");
  return `
    <div class="contract-preview-stack">
      ${page(1, [
        label(data.day, 26.2, 26.6, 7),
        label(data.month, 34.2, 26.6, 14),
        label(data.year, 51, 26.6, 6),
        label(data.tutorName, 17.3, 30, 60),
        label(data.childName, 14.4, 32, 60),
        label(data.tutorDocument, 79.1, 32, 15),
        label(data.phone, 21.3, 33.9, 20),
        label(data.email, 22.8, 35.7, 32),
      ].join(""))}
      ${page(2, `${mark("□", data.period === "Mensual" ? 47.3 : 56, 12.2)}${label(`${data.plan} - ${data.amount}`, 14.4, 18.1, 44)}`)}
      ${page(3)}
      ${page(4)}
      ${page(5, `${label(data.tutorName, 41.5, 44.5, 42)}${label(data.childName, 19.6, 46.2, 56)}`)}
      ${page(6, parqMarksHtml)}
      ${(data.medicalAdditional || data.emergencySummary || data.hasParqAlert) ? `
        <article class="contract-annex-preview">
          <h3>Anexo local de datos adicionales del prototipo</h3>
          <p>Este anexo no modifica las clausulas del contrato original. Solo recoge informacion sin espacio previsto en el PDF.</p>
          <ul class="small-list">
            <li><span>Menor</span><strong>${escapeHtml(data.childName || "Pendiente")}</strong></li>
            <li><span>Tutor/a</span><strong>${escapeHtml(data.tutorName || "Pendiente")}</strong></li>
            <li><span>Centro</span><strong>${escapeHtml(data.center || "Pendiente")}</strong></li>
            <li><span>Grupo</span><strong>${escapeHtml(data.group || "Pendiente")}</strong></li>
            <li><span>Tarifa</span><strong>${escapeHtml(`${data.plan || ""} - ${data.amount || ""}`)}</strong></li>
            <li><span>Emergencia</span><strong>${escapeHtml(data.emergencySummary || "Pendiente")}</strong></li>
          </ul>
          <p><strong>Informacion medica:</strong> ${escapeHtml(data.medicalAdditional || "Sin informacion adicional indicada.")}</p>
          ${data.hasParqAlert ? `<div class="validation-box compact-alert">Aviso PAR-Q: existe al menos una respuesta afirmativa. Requiere revision del equipo.</div>` : ""}
        </article>
      ` : ""}
    </div>
  `;
}

function renderDocumentActionPanel({ document, state, canSign, flowStep, missingFields }) {
  if (!canSign) {
    return `<div class="signature-panel"><h3>Documento no aplicable</h3><p class="muted">Este documento queda visible, pero no requiere firma en esta fase.</p></div>`;
  }

  if (flowStep === "fill") {
    return `
      <div class="signature-panel">
        <h3>1. Completar datos</h3>
        <p class="muted">Rellena los campos necesarios. Los datos disponibles ya vienen precargados.</p>
        ${missingFields.length ? `<div class="validation-box">Para revisar faltan: ${missingFields.map((field) => escapeHtml(field.label)).join(", ")}</div>` : `<div class="status-ok">Datos listos para revisar.</div>`}
      </div>
    `;
  }

  if (flowStep === "review") {
    return `
      <div class="signature-panel">
        <h3>2. Revisar documento</h3>
        <p class="muted">La vista previa es de solo lectura. Puedes volver a editar antes de firmar.</p>
        <div class="validation-box reader-hint">La firma se activa al llegar al final del documento.</div>
      </div>
    `;
  }

  return `
    <div class="signature-panel">
      <h3>3. Firma simulada</h3>
      <p class="muted">Escribe el nombre completo, acepta las casillas y dibuja la firma con raton o dedo.</p>
    </div>
  `;
}

function renderSignatureForm({ document, state, canSign }) {
  const tutorOptions = state.family.tutors.filter((tutor) => tutor.canSign);
  const isContract = document.templateId === "tk-service-terms";
  const documentId = jsArg(document.id);
  const disabled = canSign ? "" : "disabled";
  return `
    <div class="signature-panel">
      <h3>Revision y firma simulada</h3>
      <p class="muted">Confirma expresamente la version ${escapeHtml(document.version)}. La firma no tiene validez juridica real en esta fase.</p>
      <div class="validation-box hidden" id="signatureValidationBox" role="alert"></div>
      <div class="form-grid">
        <div class="field">
          <label for="docSigner">Tutor firmante</label>
          <select id="docSigner" ${disabled}>
            ${tutorOptions.map((tutor) => `<option value="${escapeHtml(tutor.id)}">${escapeHtml(tutor.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="docRequiredField">Nombre completo del firmante</label>
          <input id="docRequiredField" ${disabled} placeholder="Nombre y apellidos" autocomplete="name" />
        </div>
        <label class="check-row"><input id="docConsentReview" type="checkbox" ${disabled} /> He leido el documento completo.</label>
        <label class="check-row"><input id="docConsentVersion" type="checkbox" ${disabled} /> Confirmo que acepto la version ${escapeHtml(document.version)}.</label>
        ${isContract ? `
          <label class="check-row"><input id="docConsentContract" type="checkbox" ${disabled} /> Acepto el contrato de actividad cumplimentado.</label>
          <label class="check-row"><input id="docConsentRisk" type="checkbox" ${disabled} /> Acepto el Anexo 1 de riesgos de la actividad.</label>
          <label class="check-row"><input id="docConsentParq" type="checkbox" ${disabled} /> Confirmo las respuestas del Anexo 2 PAR-Q.</label>
        ` : ""}
        <label class="check-row"><input id="docConsentSignature" type="checkbox" ${disabled} /> Acepto realizar una firma simulada para esta prueba.</label>
        <div class="signature-pad-wrap">
          <label for="signaturePad">Firma dibujada simulada</label>
          <canvas id="signaturePad" class="signature-pad" width="640" height="220" role="img" aria-label="Zona de firma. Dibuja tu firma con el ratón o el dedo." onpointerdown="startSignatureDraw(event, ${documentId})" onpointermove="drawSignature(event, ${documentId})" onpointerup="endSignatureDraw(event, ${documentId})" onpointerleave="endSignatureDraw(event, ${documentId})"></canvas>
          <button type="button" class="button ghost" onclick="clearSignaturePad(${documentId})">Borrar firma</button>
        </div>
        <button type="button" class="button" ${disabled} onclick="confirmSimulatedSignature(${documentId})">Confirmar firma simulada</button>
      </div>
    </div>
  `;
}

function renderReceipt(document) {
  const evidence = document.evidence;
  if (!evidence) return `<div class="receipt-box"><span class="badge green">Firmado</span><p class="muted">Justificante no disponible.</p></div>`;
  const signedAt = evidence.signedAt ? new Date(evidence.signedAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "Pendiente";
  return `
    <div class="receipt-box">
      <span class="badge green">${evidence.remote ? "Justificante de prueba" : "Justificante simulado"}</span>
      <h3>Documento firmado</h3>
      <ul class="small-list">
        <li><span>Identificador</span><strong>${escapeHtml(evidence.evidenceId || evidence.id)}</strong></li>
        <li><span>Documento</span><strong>${escapeHtml(evidence.documentId || document.id)}</strong></li>
        <li><span>Version</span><strong>${escapeHtml(evidence.version || document.version)}</strong></li>
        <li><span>Firmante</span><strong>${escapeHtml(evidence.signerTutorName || "Registro remoto")}</strong></li>
        <li><span>Nombre escrito</span><strong>${escapeHtml(evidence.signatureName || evidence.signerTutorName || "Registro remoto")}</strong></li>
        <li><span>Fecha</span><strong>${escapeHtml(signedAt)}</strong></li>
        <li><span>${evidence.remote ? "Huella SHA-256" : "Huella simulada"}</span><strong>${escapeHtml(evidence.documentHash || evidence.hash)}</strong></li>
        ${evidence.imageDecision ? `<li><span>Uso de imagen</span><strong>${evidence.imageDecision === "authorize" ? "Autorizo" : "No autorizo"}</strong></li>` : ""}
        <li><span>Estado</span><strong>${escapeHtml(evidence.status)}</strong></li>
      </ul>
      ${isDataUrl(evidence.signatureDrawing, "image/png") ? `<img class="signature-preview" src="${escapeHtml(evidence.signatureDrawing)}" alt="Firma dibujada simulada" />` : ""}
      ${isDataUrl(document.finalPdfDataUrl, "application/pdf") ? `<a class="button ghost" href="${escapeHtml(document.finalPdfDataUrl)}" download="contrato-training-kids-firmado-simulado.pdf">Descargar copia firmada simulada</a>` : ""}
      ${renderSignedFileButtons(document)}
      <p class="muted">No se ha recogido IP real ni datos tecnicos reales.</p>
    </div>
  `;
}

function renderSignedFileButtons(document) {
  const evidence = document.evidence;
  if (!evidence?.remote) return "";
  const id = jsArg(document.id);
  return `
    <div class="actions">
      ${evidence.finalStoragePath ? `<button type="button" class="button ghost" onclick="openSignedFile(${id}, 'pdf')">Ver PDF firmado</button>` : ""}
      ${evidence.evidenceStoragePath ? `<button type="button" class="button ghost" onclick="openSignedFile(${id}, 'evidence')">Ver imagen de la firma</button>` : ""}
    </div>
  `;
}

function renderImmutableSnapshot(snapshot) {
  if (!snapshot) return "";
  const pdf = isDataUrl(snapshot.pdfDataUrl, "application/pdf") ? escapeHtml(snapshot.pdfDataUrl) : "";
  return `
    <section class="panel pad fillable-panel">
      <h3>Copia inmutable firmada</h3>
      <p class="muted">Se conserva la version documental y los datos completados en el momento de la firma simulada.</p>
      ${pdf ? `<object class="pdf-preview signed-preview" data="${pdf}" type="application/pdf"><a class="button ghost" href="${pdf}" target="_blank" rel="noopener">Abrir copia firmada</a></object>` : ""}
      ${renderCompletedFieldsPreview(snapshot.fieldValues)}
    </section>
  `;
}

function renderCompletedFieldsPreview(values = {}) {
  const entries = Object.entries(values || {});
  if (!entries.length) return "";
  return `
    <div class="completed-preview">
      <h3>Datos completados para este documento</h3>
      <div class="grid two">
        ${entries.map(([key, item]) => `
          <div class="preview-line">
            <span>${escapeHtml(item?.label || key)}</span>
            <strong>${escapeHtml(readableFieldValue(item?.value ?? item) || "Pendiente")}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderDocumentCard({ document, state, services, documentTemplates, compact = false }) {
  const template = documentTemplates.find((item) => item.id === document.templateId);
  if (!template) return "";
  const children = state.adminChildren || state.family.children;
  const child = children.find((item) => item.id === document.childId);
  const isInfo = INFO_DOCUMENT_IDS.has(document.templateId);
  const pending = ACTION_DOCUMENT_IDS.has(document.templateId) && ["pending_complete", "pending_signature", "update_required"].includes(document.status);
  const buttonLabel = isInfo
    ? (document.templateId === "global-family-account" ? "Ver calendario" : "Ver documento")
    : document.status === "signed" ? "Ver justificante" : compact ? "Abrir" : "Abrir documento";
  return `
    <article class="doc-card ${pending ? "needs-attention" : ""}" data-doc-id="${escapeHtml(document.id)}">
      <div class="badge-row">
        <span class="badge ${isInfo ? "" : statusTone(document.status)}">${escapeHtml(isInfo ? "Documento informativo" : statusLabel(document.status))}</span>
        <span class="badge">${escapeHtml(serviceName(services, document.service))}</span>
        <span class="badge">${escapeHtml(document.version)}</span>
      </div>
      <h3>${escapeHtml(template.title)}</h3>
      <p class="muted">${isInfo ? "Consulta general" : `${escapeHtml(child?.name || "Cuenta familiar")} · ${escapeHtml(document.enrollmentId || "Documento global")}`}</p>
      ${document.requiresTeamReview ? `<div class="validation-box compact-alert">PAR-Q con respuesta afirmativa: revisar por el equipo.</div>` : ""}
      <button type="button" class="button ${document.status === "signed" || isInfo ? "ghost" : ""}" data-action="open-document" data-doc-id="${escapeHtml(document.id)}" onclick="openDocument(${jsArg(document.id)})">${buttonLabel}</button>
      ${compact ? renderSignedFileButtons(document) : ""}
    </article>
  `;
}

function activeDocumentsForChild(documents, selectedChildId) {
  const candidates = documents
    .filter((document) => ACTIVE_DOCUMENT_IDS.has(document.templateId))
    .filter((document) => INFO_DOCUMENT_IDS.has(document.templateId) || (selectedChildId && document.childId === selectedChildId))
    .sort((a, b) => activeDocumentOrder(a.templateId) - activeDocumentOrder(b.templateId));
  const byTemplate = new Map();
  candidates.forEach((document) => {
    if (!byTemplate.has(document.templateId)) byTemplate.set(document.templateId, document);
  });
  return [...byTemplate.values()];
}

function activeDocumentOrder(templateId) {
  return ["tk-service-terms", "tk-image-rights", "tk-norms-guarantees", "global-family-account"].indexOf(templateId);
}

function getDocumentFields({ document, state, child, enrollment, centers, groups, trainingKidsPlans }) {
  const tutor = state.family.tutors[0];
  const center = centers.find((item) => item.id === (enrollment?.centerId || state.selectedCenter));
  const group = groups.find((item) => item.id === enrollment?.groupId);
  const plan = trainingKidsPlans.find((item) => item.id === enrollment?.planId);
  const planValue = plan ? `${plan.name} · ${plan.period} · ${plan.amount} €` : "Pendiente de inscripcion";
  const groupValue = group ? `${group.name} · ${group.day} ${group.time}` : "Pendiente de asignacion administrativa";
  const today = new Date();
  const basePersonal = [
    field("place", "Lugar de firma", "Ajalvir", true),
    field("day", "Dia", String(today.getDate()).padStart(2, "0"), true),
    field("month", "Mes", today.toLocaleDateString("es-ES", { month: "long" }), true),
    field("year", "Dos ultimos digitos del año indicado en contrato", String(today.getFullYear()).slice(-2), true),
    field("tutorName", "Tutor/a contratante", tutor?.name, true),
    field("tutorDocument", "DNI/NIE tutor/a", "", true),
    field("childName", "Menor participante", child?.name, true),
  ];

  if (document.templateId === "tk-service-terms") {
    return [
      ...basePersonal,
      field("phone", "Telefono", state.family.phone || tutor?.phone, true),
      field("email", "Email", state.family.email || tutor?.email, true),
      field("service", "Servicio contratado", "Training Kids", true, true),
      field("center", "Centro", center ? `${center.name} · ${center.city}` : "Pendiente", true, true),
      field("frequency", "Frecuencia / plan", planValue, true, true),
      field("group", "Grupo y horario definitivo", groupValue, true, true),
      field("price", "Precio procedente de tarifa", plan ? `${plan.amount} €` : "Pendiente", true, true),
      field("period", "Periodo contratado", plan?.period || "Pendiente", true, true),
      field("medicalAdditional", "Informacion medica relevante", child?.medical, true, false, "", "textarea"),
      field("emergencySummary", "Contacto de emergencia", child?.emergencyName && child?.emergencyPhone ? `${child.emergencyName} - ${child.emergencyPhone}` : "", true),
      ...parqQuestions.map((question, index) => radioField(`parq${index + 1}`, `PAR-Q ${index + 1}. ${question}`, "", true, [
        { value: "no", label: "No" },
        { value: "si", label: "Si" },
      ], "Responde el tutor sobre el menor participante.")),
    ];
  }

  if (document.templateId === "tk-image-rights") {
    return [
      field("place", "Lugar de firma", "Ajalvir", true),
      field("day", "Dia", String(today.getDate()).padStart(2, "0"), true),
      field("month", "Mes", today.toLocaleDateString("es-ES", { month: "long" }), true),
      field("tutorName", "Cedente / tutor", tutor?.name, true),
      field("tutorDocument", "DNI/NIF", "", true),
      field("tutorAddress", "Domicilio", state.family.address, true),
      field("representedChild", "En representacion de", child?.name, true),
      radioField("imageAuthorization", "Decision sobre derechos de imagen", "", true, [
        { value: "authorize", label: "Autorizo" },
        { value: "deny", label: "No autorizo" },
      ], "No viene marcado por defecto y no bloquea la inscripcion si eliges no autorizar."),
    ];
  }

  return [];
}

function field(id, label, value = "", required = false, readOnly = false, placeholder = "", type = "text") {
  return { id, label, value: value || "", required, readOnly, placeholder, type };
}

function radioField(id, label, value = "", required = false, options = [], help = "") {
  return { id, label, value, required, options, help, type: "radio" };
}

function getMissingRequiredFields({ document, fields }) {
  return fields.filter((field) => {
    const draftValue = document.formDraft?.[field.id]?.value ?? document.formDraft?.[field.id];
    return field.required && !(draftValue || field.value);
  });
}

function fieldsToValues(fields) {
  return Object.fromEntries(fields.map((field) => [field.id, { label: field.label, value: field.value || "" }]));
}

// Solo se aceptan data URLs generadas por la propia app; evita enlaces javascript: u otros esquemas.
function isDataUrl(value, mime) {
  return typeof value === "string" && value.startsWith(`data:${mime};base64,`);
}

function statusFilterButton(value, label, activeValue) {
  const active = activeValue === value;
  return `<button type="button" class="side-filter ${active ? "active" : ""}" aria-pressed="${active}" onclick="setState({documentStatusFilter:${jsArg(value)}})">${escapeHtml(label)}</button>`;
}

export function statusLabel(status) {
  return documentStatusMeta[status]?.label || status;
}

function statusTone(status) {
  return documentStatusMeta[status]?.tone || "";
}

function readableFieldValue(value) {
  if (value === "deny") return "No autorizo";
  if (value === "authorize") return "Autorizo";
  if (value === "si") return "Si";
  if (value === "no") return "No";
  return value;
}
