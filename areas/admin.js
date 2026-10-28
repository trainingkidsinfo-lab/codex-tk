import { centerName, planName, serviceName } from "../ui/shared.js?v=f1";
import { escapeHtml, jsArg } from "../ui/escape.js?v=f1";
import { renderAdminDocuments } from "./documents.js?v=f1";
import { getEnrollmentReview } from "./enrollment-review.js?v=f1";
import { getEnrollmentOperationalSummary, getGroupOccupancy } from "./operational-status.js?v=f1";
import { renderAdminPayments } from "./payments.js?v=f1";

export function renderAdmin({ state, services, centers, groups, trainingKidsPlans, documentTemplates, legalDocumentSources }) {
  const filter = state.adminServiceFilter;
  const search = String(state.adminSearch || "").trim().toLowerCase();
  const summaries = state.enrollments.map((enrollment) => getEnrollmentOperationalSummary({ enrollment, state, services, centers, groups, trainingKidsPlans }));
  const filteredSummaries = summaries
    .filter((summary) => filter === "all" || summary.service === filter)
    .filter((summary) => !search || [summary.child?.name, summary.child?.familyName].some((value) => String(value || "").toLowerCase().includes(search)))
    .filter((summary) => (
      state.operationalStatusFilter === "all"
      || summary.status === state.operationalStatusFilter
      || (state.operationalStatusFilter === "pending" && summary.status === "draft")
    ));
  const filteredGroups = filter === "all" ? groups : groups.filter((item) => item.service === filter);
  const pendingCount = summaries.filter((item) => item.status === "pending" || item.status === "draft").length;
  const readyCount = summaries.filter((item) => item.status === "ready").length;
  const childCount = (state.adminChildren || state.family.children).length;

  return `
    <section class="admin-layout">
      <aside class="sidebar" aria-label="Filtrar por servicio">
        ${serviceFilterButton("all", "Todos", filter)}
        ${serviceFilterButton("training_kids", "Training Kids", filter)}
        ${serviceFilterButton("football_academy", "Football Academy", filter)}
        ${serviceFilterButton("gym_home", "Gym Home futuro", filter)}
      </aside>
      <div>
        <section class="hero-band">
          <div class="hero-content">
            <p class="eyebrow">Panel administrativo unico</p>
            <h1>Operativa por servicio</h1>
            <p class="muted">${state.appMode === "test" ? "Familias y solicitudes cargadas desde Supabase. Las decisiones se registran mediante operaciones protegidas." : "Filtros, estados y acciones simuladas del modo demo."}</p>
          </div>
          <div class="hero-side">
            <div class="hero-pill">${filteredSummaries.length} inscripciones</div>
            <div class="hero-pill">${filteredGroups.length} grupos</div>
            <div class="hero-pill">${state.audit.length} acciones registradas</div>
          </div>
        </section>
        <section class="section-title"><h2>Resumen</h2></section>
        <div class="stat-grid">
          <div class="stat"><strong>${childCount}</strong><span class="muted">Hijos</span></div>
          <div class="stat"><strong>${pendingCount}</strong><span class="muted">Pendientes</span></div>
          <div class="stat"><strong>${readyCount}</strong><span class="muted">Listas</span></div>
          <div class="stat"><strong>${groups.filter((g) => getGroupOccupancy({ group: g, state }).full).length}</strong><span class="muted">Grupos llenos</span></div>
          <div class="stat"><strong>0</strong><span class="muted">Impagos reales</span></div>
        </div>
        ${state.saveMessage ? `<div class="${state.saveState === "error" ? "document-warning" : "status-ok"}" role="status">${escapeHtml(state.saveMessage)}</div>` : ""}
        <section class="section-title"><h2>Familias</h2></section>
        <div class="field"><label for="admin-search">Buscar familia o hijo</label><input id="admin-search" type="search" value="${escapeHtml(state.adminSearch || "")}" onchange="setState({adminSearch:this.value})" placeholder="Nombre de familia o hijo" /></div>
        <div class="grid two">
          ${(state.adminFamilies || [state.family]).filter((family) => !search || [family.name, family.email, ...family.children.map((child) => child.name)].some((value) => String(value || "").toLowerCase().includes(search))).map((family) => `
            <article class="person-card">
              <h3>${escapeHtml(family.name)}</h3>
              <p class="muted">${escapeHtml(family.email)} · ${escapeHtml(family.phone || "Sin teléfono")}</p>
              <div class="badge-row"><span class="badge">${family.tutors.length} adultos</span><span class="badge turquoise">${family.children.length} hijos</span></div>
            </article>`).join("") || `<div class="empty">No hay familias para esta búsqueda.</div>`}
        </div>
        <section class="section-title"><h2>Solicitudes e inscripciones</h2>${state.appMode === "demo" ? `<button class="button ghost" onclick="simulatePayment()">Pago prueba simulado</button>` : ""}</section>
        <div class="doc-filter-row">
          ${operationalFilterButton("all", "Todas", state.operationalStatusFilter)}
          ${operationalFilterButton("pending", "Pendientes", state.operationalStatusFilter)}
          ${operationalFilterButton("ready", "Listas para activar", state.operationalStatusFilter)}
          ${operationalFilterButton("active", "Activas", state.operationalStatusFilter)}
          ${operationalFilterButton("withdrawn", "Bajas", state.operationalStatusFilter)}
        </div>
        <div class="grid two">
          ${filteredSummaries.length ? filteredSummaries.map((summary) => renderEnrollmentAdmin({ summary, enrollment: state.enrollments.find((item) => item.id === summary.enrollmentId), state, services, centers, groups, trainingKidsPlans })).join("") : `<div class="empty">No hay registros para este filtro.</div>`}
        </div>
        <section class="section-title"><h2>Grupos y capacidad</h2></section>
        <div class="grid two">
          ${filteredGroups.length ? filteredGroups.map((group) => renderAdminGroupCard({ group, state, services, centers })).join("") : `<div class="empty">Sin grupos en esta fase.</div>`}
        </div>
        ${renderAdminDocuments({ state, services, documentTemplates, legalDocumentSources })}
        ${renderAdminPayments({ state, services, centers, trainingKidsPlans })}
        <section class="section-title"><h2>Auditoria basica</h2></section>
        <div class="grid">
          ${state.audit.slice(0, 8).map((item) => `
            <article class="task-card">
              <div class="badge-row"><span class="badge">${escapeHtml(item.service)}</span><span class="badge">${escapeHtml(item.date)}</span></div>
              <h3>${escapeHtml(item.action)}</h3>
              <p class="muted">${escapeHtml(item.actor)}</p>
            </article>
          `).join("") || `<div class="empty">Sin acciones registradas.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderEnrollmentAdmin({ summary, enrollment, state, services, centers, groups, trainingKidsPlans }) {
  if (!enrollment) return "";
  const child = summary.child || (state.adminChildren || state.family.children).find((item) => item.id === enrollment.childId) || state.family.children[0] || {};
  const validGroups = groups.filter((group) => (
    group.service === enrollment.service
    && (!enrollment.centerId || group.centerId === enrollment.centerId)
    && (!getGroupOccupancy({ group, state }).full || group.id === enrollment.groupId)
  ));
  const pendingAction = state.pendingAdminAction?.enrollmentId === enrollment.id ? state.pendingAdminAction : null;
  const enrollmentId = jsArg(enrollment.id);
  const saving = state.saveState === "saving";
  const assignedGroup = groups.find((group) => group.id === enrollment.groupId);
  return `
    <article class="task-card ${summary.needsReview ? "needs-attention" : ""}">
      <div class="badge-row">
        <span class="badge ${enrollment.service === "training_kids" ? "turquoise" : "yellow"}">${escapeHtml(serviceName(services, enrollment.service))}</span>
        <span class="badge ${summary.tone}">${escapeHtml(summary.label)}</span>
        ${summary.needsReview ? `<span class="badge red">Revision administrativa</span>` : ""}
      </div>
      <h3>${escapeHtml(child.name || "Hijo sin nombre")}</h3>
      ${child.familyName ? `<p class="muted">${escapeHtml(child.familyName)}</p>` : ""}
      ${enrollment.remote ? `<div class="badge-row"><span class="badge">Revisión: ${escapeHtml(reviewLabel(enrollment.reviewStatus))}</span></div>` : ""}
      <ul class="small-list">
        <li><span>Centro</span><strong>${escapeHtml(summary.centerLabel)}</strong></li>
        <li><span>Plan</span><strong>${escapeHtml(enrollment.planId ? planName(trainingKidsPlans, enrollment.planId) : "Prealta")}</strong></li>
        <li><span>Datos</span><strong>${summary.requirements.personal.complete ? "Completos" : "Incompletos"}</strong></li>
        <li><span>Documentos obligatorios</span><strong>${summary.requirements.documents.complete ? "Completados" : "Pendientes"}</strong></li>
        <li><span>Pago inicial</span><strong>${escapeHtml(summary.requirements.payment.complete ? "Confirmado" : enrollment.payment)}</strong></li>
        <li><span>Grupo</span><strong>${escapeHtml(assignedGroup ? `${assignedGroup.name} · ${assignedGroup.day} ${assignedGroup.time}` : enrollment.groupId || "Sin asignar")}</strong></li>
      </ul>
      ${summary.validationNotes.length ? `<div class="validation-box">${summary.validationNotes.map(escapeHtml).join("<br>")}</div>` : ""}
      ${summary.missing.length ? `<div class="missing-list"><strong>Falta para activar</strong>${summary.missing.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : `<div class="status-ok">Requisitos operativos completos.</div>`}
      ${enrollment.service === "training_kids" ? `
        <div class="field">
          <label for="group-select-${escapeHtml(enrollment.id)}">Asignar grupo definitivo</label>
          <select id="group-select-${escapeHtml(enrollment.id)}" onchange="${state.appMode === "test" ? `setAdminGroupDraft(${enrollmentId}, this.value)` : `assignGroup(${enrollmentId}, this.value)`}">
            <option value="">Pendiente</option>
            ${validGroups.map((group) => {
              const occupancy = getGroupOccupancy({ group, state });
              const selected = (state.adminGroupDrafts?.[enrollment.id] ?? enrollment.groupId) === group.id;
              return `<option value="${escapeHtml(group.id)}" ${selected ? "selected" : ""}>${escapeHtml(group.name)} · ${escapeHtml(centerName(centers, group.centerId))} · ${escapeHtml(group.day)} ${escapeHtml(group.time)} · ${occupancy.available} plazas</option>`;
            }).join("")}
          </select>
        </div>
        <div class="field"><label for="review-note-${escapeHtml(enrollment.id)}">Observaciones para la familia</label><textarea id="review-note-${escapeHtml(enrollment.id)}" onchange="setAdminReviewNote(${enrollmentId}, this.value)" placeholder="Indica claramente qué debe revisar o completar">${escapeHtml(state.adminReviewNotes?.[enrollment.id] ?? enrollment.reviewNotes ?? "")}</textarea></div>
        <div class="actions">
          ${state.appMode === "test" ? `
            <button type="button" class="button" data-review-decision="approve" onclick="approveEnrollment(${enrollmentId})" ${saving || pendingAction ? "disabled" : ""}>Aprobar solicitud</button>
            <button type="button" class="button ghost" data-review-decision="request_changes" onclick="requestEnrollmentChanges(${enrollmentId})" ${saving || pendingAction ? "disabled" : ""}>Solicitar cambios</button>
            <button type="button" class="button ghost" data-review-decision="reject" onclick="rejectEnrollment(${enrollmentId})" ${saving || pendingAction ? "disabled" : ""}>Rechazar</button>
          ` : ""}
          ${state.appMode === "demo" ? `
            <button type="button" class="button ghost" data-review-decision="request_changes" onclick="requestEnrollmentChanges(${enrollmentId})" ${pendingAction ? "disabled" : ""}>Solicitar cambios</button>
            <button type="button" class="button" ${summary.status === "ready" && !pendingAction ? "" : "disabled"} onclick="activateEnrollment(${enrollmentId})">Activar</button>
            <button type="button" class="button ghost" ${summary.status === "active" && !pendingAction ? "" : "disabled"} onclick="withdrawEnrollment(${enrollmentId})">Dar de baja</button>
          ` : ""}
        </div>
        ${pendingAction ? renderAdminConfirmation(pendingAction, saving) : ""}
      ` : `
        <button type="button" class="button yellow" onclick="markFootballInterest(${enrollmentId})">Marcar contacto</button>
      `}
    </article>
  `;
}

function renderAdminConfirmation(action, saving) {
  let text;
  if (action.type === "review") {
    const review = getEnrollmentReview(action.decision);
    text = `${review.confirmation} ${review.detail}`;
  } else if (action.type === "activate") {
    text = "Confirmar activacion simulada. No cambia pagos ni envia comunicaciones.";
  } else {
    text = "Confirmar baja local. No cancela pagos ni suscripciones.";
  }
  return `
    <div class="admin-confirmation" role="alertdialog" aria-live="assertive">
      <strong>${escapeHtml(text)}</strong>
      <div class="actions">
        <button type="button" class="button" data-confirm-action="${escapeHtml(action.type)}" onclick="confirmAdminAction()" ${saving ? "disabled" : ""}>Confirmar</button>
        <button type="button" class="button ghost" onclick="cancelAdminAction()" ${saving ? "disabled" : ""}>Cancelar</button>
      </div>
    </div>
  `;
}

function renderAdminGroupCard({ group, state, services, centers }) {
  const occupancy = getGroupOccupancy({ group, state });
  const pct = occupancy.capacity ? Math.min(100, Math.round((occupancy.occupied / occupancy.capacity) * 100)) : 100;
  const cls = pct >= 100 ? "full" : pct >= 80 ? "hot" : "";
  return `
    <article class="group-card">
      <div class="badge-row">
        <span class="badge ${group.service === "training_kids" ? "turquoise" : "yellow"}">${escapeHtml(serviceName(services, group.service))}</span>
        <span class="badge">${escapeHtml(centerName(centers, group.centerId))}</span>
      </div>
      <h3>${escapeHtml(group.name)}</h3>
      <p class="muted">${escapeHtml(group.day)} · ${escapeHtml(group.time)}</p>
      <div class="capacity">
        <div class="progress-head"><span>Capacidad</span><span>${occupancy.occupied}/${occupancy.capacity}</span></div>
        <div class="capacity-line"><div class="capacity-fill ${cls}" style="width:${pct}%"></div></div>
      </div>
      <p class="muted">${occupancy.available} plazas disponibles · ${occupancy.assigned} asignadas desde el prototipo</p>
    </article>
  `;
}

function serviceFilterButton(value, label, activeValue) {
  const active = activeValue === value;
  return `<button type="button" class="side-filter ${active ? "active" : ""}" aria-pressed="${active}" onclick="setState({adminServiceFilter:${jsArg(value)}})">${escapeHtml(label)}</button>`;
}

function operationalFilterButton(value, label, activeValue) {
  const active = activeValue === value;
  return `<button type="button" class="side-filter ${active ? "active" : ""}" aria-pressed="${active}" onclick="setState({operationalStatusFilter:${jsArg(value)}})">${escapeHtml(label)}</button>`;
}

function reviewLabel(status) {
  return ({ pending: "Pendiente", approved: "Aprobada", changes_requested: "Cambios solicitados", rejected: "Rechazada" })[status] || "Pendiente";
}
