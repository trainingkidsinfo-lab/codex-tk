import { centerName, planName, serviceName } from "../ui/shared.js";
import { renderAdminDocuments } from "./documents.js";
import { getEnrollmentOperationalSummary, getGroupOccupancy } from "./operational-status.js";
import { renderAdminPayments } from "./payments.js";

export function renderAdmin({ state, services, centers, groups, trainingKidsPlans, documentTemplates, legalDocumentSources }) {
  const filter = state.adminServiceFilter;
  const summaries = state.enrollments.map((enrollment) => getEnrollmentOperationalSummary({ enrollment, state, services, centers, groups, trainingKidsPlans }));
  const filteredSummaries = summaries
    .filter((summary) => filter === "all" || summary.service === filter)
    .filter((summary) => (
      state.operationalStatusFilter === "all"
      || summary.status === state.operationalStatusFilter
      || (state.operationalStatusFilter === "pending" && summary.status === "draft")
    ));
  const filteredGroups = filter === "all" ? groups : groups.filter((item) => item.service === filter);
  const pendingCount = summaries.filter((item) => item.status === "pending" || item.status === "draft").length;
  const readyCount = summaries.filter((item) => item.status === "ready").length;

  return `
    <section class="admin-layout">
      <aside class="sidebar">
        <button class="side-filter ${filter === "all" ? "active" : ""}" onclick="setState({adminServiceFilter:'all'})">Todos</button>
        <button class="side-filter ${filter === "training_kids" ? "active" : ""}" onclick="setState({adminServiceFilter:'training_kids'})">Training Kids</button>
        <button class="side-filter ${filter === "football_academy" ? "active" : ""}" onclick="setState({adminServiceFilter:'football_academy'})">Football Academy</button>
        <button class="side-filter ${filter === "gym_home" ? "active" : ""}" onclick="setState({adminServiceFilter:'gym_home'})">Gym Home futuro</button>
      </aside>
      <div>
        <section class="hero-band">
          <div class="hero-content">
            <p class="eyebrow">Panel administrativo unico</p>
            <h1>Operativa por servicio</h1>
            <p class="muted">Filtros, estados y acciones simuladas. Las reglas comerciales se mantienen separadas por modulo.</p>
          </div>
          <div class="hero-side">
            <div class="hero-pill">${filteredSummaries.length} inscripciones</div>
            <div class="hero-pill">${filteredGroups.length} grupos</div>
            <div class="hero-pill">${state.audit.length} acciones registradas</div>
          </div>
        </section>
        <section class="section-title"><h2>Resumen</h2></section>
        <div class="stat-grid">
          <div class="stat"><strong>${state.family.children.length}</strong><span class="muted">Hijos</span></div>
          <div class="stat"><strong>${pendingCount}</strong><span class="muted">Pendientes</span></div>
          <div class="stat"><strong>${readyCount}</strong><span class="muted">Listas</span></div>
          <div class="stat"><strong>${groups.filter((g) => getGroupOccupancy({ group: g, state }).full).length}</strong><span class="muted">Grupos llenos</span></div>
          <div class="stat"><strong>0</strong><span class="muted">Impagos reales</span></div>
        </div>
        <section class="section-title"><h2>Inscripciones</h2><button class="button ghost" onclick="simulatePayment()">Pago prueba simulado</button></section>
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
              <div class="badge-row"><span class="badge">${item.service}</span><span class="badge">${item.date}</span></div>
              <h3>${item.action}</h3>
              <p class="muted">${item.actor}</p>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderEnrollmentAdmin({ summary, enrollment, state, services, centers, groups, trainingKidsPlans }) {
  if (!enrollment) return "";
  const child = summary.child || state.family.children.find((item) => item.id === enrollment.childId) || state.family.children[0];
  const validGroups = groups.filter((group) => (
    group.service === enrollment.service
    && (!enrollment.centerId || group.centerId === enrollment.centerId)
    && (!getGroupOccupancy({ group, state }).full || group.id === enrollment.groupId)
  ));
  const pendingAction = state.pendingAdminAction?.enrollmentId === enrollment.id ? state.pendingAdminAction : null;
  return `
    <article class="task-card ${summary.needsReview ? "needs-attention" : ""}">
      <div class="badge-row">
        <span class="badge ${enrollment.service === "training_kids" ? "turquoise" : "yellow"}">${serviceName(services, enrollment.service)}</span>
        <span class="badge ${summary.tone}">${summary.label}</span>
        ${summary.needsReview ? `<span class="badge red">Revision administrativa</span>` : ""}
      </div>
      <h3>${child.name}</h3>
      <ul class="small-list">
        <li><span>Centro</span><strong>${summary.centerLabel}</strong></li>
        <li><span>Plan</span><strong>${enrollment.planId ? planName(trainingKidsPlans, enrollment.planId) : "Prealta"}</strong></li>
        <li><span>Datos</span><strong>${summary.requirements.personal.complete ? "Completos" : "Incompletos"}</strong></li>
        <li><span>Documentos obligatorios</span><strong>${summary.requirements.documents.complete ? "Completados" : "Pendientes"}</strong></li>
        <li><span>Pago inicial</span><strong>${summary.requirements.payment.complete ? "Confirmado" : enrollment.payment}</strong></li>
        <li><span>Grupo</span><strong>${enrollment.groupId || "Sin asignar"}</strong></li>
      </ul>
      ${summary.validationNotes.length ? `<div class="validation-box">${summary.validationNotes.join("<br>")}</div>` : ""}
      ${summary.missing.length ? `<div class="missing-list"><strong>Falta para activar</strong>${summary.missing.map((item) => `<span>${item}</span>`).join("")}</div>` : `<div class="status-ok">Requisitos operativos completos.</div>`}
      ${enrollment.service === "training_kids" ? `
        <div class="field">
          <label>Asignar grupo definitivo</label>
          <select onchange="assignGroup('${enrollment.id}', this.value)">
            <option value="">Pendiente</option>
            ${validGroups.map((group) => {
              const occupancy = getGroupOccupancy({ group, state });
              return `<option value="${group.id}" ${enrollment.groupId === group.id ? "selected" : ""}>${group.id} · ${centerName(centers, group.centerId)} · ${group.day} ${group.time} · ${occupancy.available} plazas</option>`;
            }).join("")}
          </select>
        </div>
        <div class="actions">
          <button class="button" ${summary.status === "ready" ? "" : "disabled"} onclick="activateEnrollment('${enrollment.id}')">Activar</button>
          <button class="button ghost" ${summary.status === "active" ? "" : "disabled"} onclick="withdrawEnrollment('${enrollment.id}')">Dar de baja</button>
        </div>
        ${pendingAction ? renderAdminConfirmation(pendingAction) : ""}
      ` : `
        <button class="button yellow" onclick="markFootballInterest('${enrollment.id}')">Marcar contacto</button>
      `}
    </article>
  `;
}

function renderAdminConfirmation(action) {
  const text = action.type === "activate"
    ? "Confirmar activacion simulada. No cambia pagos ni envia comunicaciones."
    : "Confirmar baja local. No cancela pagos ni suscripciones.";
  return `
    <div class="admin-confirmation">
      <strong>${text}</strong>
      <div class="actions">
        <button class="button" onclick="confirmAdminAction()">Confirmar</button>
        <button class="button ghost" onclick="cancelAdminAction()">Cancelar</button>
      </div>
    </div>
  `;
}

function renderAdminGroupCard({ group, state, services, centers }) {
  const occupancy = getGroupOccupancy({ group, state });
  const pct = Math.min(100, Math.round((occupancy.occupied / occupancy.capacity) * 100));
  const cls = pct >= 100 ? "full" : pct >= 80 ? "hot" : "";
  return `
    <article class="group-card">
      <div class="badge-row">
        <span class="badge ${group.service === "training_kids" ? "turquoise" : "yellow"}">${serviceName(services, group.service)}</span>
        <span class="badge">${centerName(centers, group.centerId)}</span>
      </div>
      <h3>${group.id} · ${group.name}</h3>
      <p class="muted">${group.day} · ${group.time}</p>
      <div class="capacity">
        <div class="progress-head"><span>Capacidad</span><span>${occupancy.occupied}/${occupancy.capacity}</span></div>
        <div class="capacity-line"><div class="capacity-fill ${cls}" style="width:${pct}%"></div></div>
      </div>
      <p class="muted">${occupancy.available} plazas disponibles · ${occupancy.assigned} asignadas desde el prototipo</p>
    </article>
  `;
}

function operationalFilterButton(value, label, activeValue) {
  const realValue = value === "pending" ? "pending" : value;
  return `<button class="side-filter ${activeValue === realValue ? "active" : ""}" onclick="setState({operationalStatusFilter:'${realValue}'})">${label}</button>`;
}
