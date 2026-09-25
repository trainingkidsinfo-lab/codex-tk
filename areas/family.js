import { childServices, formatDate, planName, serviceName } from "../ui/shared.js";
import { footballAcademyButtonLabel } from "./football-academy.js";
import { gymHomeFutureButtonLabel } from "./gym-home.js";
import { getEnrollmentOperationalSummary } from "./operational-status.js?v=14";
import { renderTrainingKidsEnrollment } from "./training-kids.js?v=13";

export function renderFamily({ state, steps, stepLabels, services, centers, groups, trainingKidsPlans }) {
  const child = getSelectedChild(state);
  const progress = Math.round(((state.familyStep + 1) / steps.length) * 100);

  return `
    <section class="hero-band">
      <div class="hero-content">
        <p class="eyebrow">Plataforma comun modular</p>
        <h1>Hola, ${state.family.tutors[0].name.split(" ")[0]}</h1>
        <p class="muted">Una sola cuenta para Training Kids y Football Academy. Gym Home queda preparado para adultos en una fase posterior.</p>
        <div class="badge-row">
          <span class="badge turquoise">Training Kids operativo</span>
          <span class="badge yellow">Football Academy visible</span>
          <span class="badge">Gym Home futuro</span>
        </div>
        <div class="actions">
          <button class="button" onclick="setState({familyStep:3})">Elegir servicio</button>
          <button class="button secondary" onclick="setState({activeView:'documents'})">Documentos</button>
          <button class="button secondary" onclick="setState({activeView:'payments'})">Pagos</button>
        </div>
      </div>
      <div class="hero-side">
        <div class="hero-pill">Queremos ser parte de tu historia</div>
        <div class="hero-pill">${state.family.children.length} hijos registrados</div>
        <div class="hero-pill">${state.enrollments.length} solicitudes activas</div>
      </div>
    </section>

    <section class="panel pad">
      <div class="progress-wrap">
        ${state.saveMessage ? `<div class="${state.saveState === "error" ? "document-warning" : "status-ok"}" role="status">${state.saveMessage}</div>` : ""}
        <div class="progress-head"><span>Alta familiar</span><span>${progress}%</span></div>
        <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
      </div>
      <div class="stepper">
        ${stepLabels.map((label, index) => `<button class="step-chip ${index === state.familyStep ? "active" : ""}" onclick="setState({familyStep:${index}})">${label}</button>`).join("")}
      </div>
      ${renderFamilyStep({ state, child, services, centers, groups, trainingKidsPlans })}
    </section>
  `;
}

function renderFamilyStep(context) {
  const templates = [
    renderFamilyData,
    renderChildren,
    renderMedical,
    renderServiceSelector,
    renderTrainingKidsEnrollment,
    renderStatus,
  ];
  if (!context.child && context.state.familyStep > 1) {
    return `<div class="empty"><h2>Primero registra un hijo</h2><p>Necesitamos sus datos antes de iniciar una solicitud.</p><button class="button" onclick="setState({familyStep:1})">Ir a hijos</button></div>`;
  }
  return templates[context.state.familyStep](context);
}

function renderFamilyData({ state }) {
  return `
    <div class="grid two">
      <div>
        <h2>Datos familiares</h2>
        <p class="muted">Datos compartidos para todos los servicios. ${state.appMode === "test" ? "Los cambios se guardan de forma segura en Supabase." : "Guardado local del modo demo."}</p>
      </div>
      <div class="form-grid">
        <div class="field"><label>Nombre familiar</label><input value="${state.family.name}" onchange="updateFamily({name:this.value})" /></div>
        <div class="field"><label>Telefono principal</label><input value="${state.family.phone}" onchange="updateFamily({phone:this.value})" /></div>
        <div class="field"><label>Direccion</label><input value="${state.family.address}" onchange="updateFamily({address:this.value})" /></div>
        <div class="actions">
          <button class="button" onclick="saveFamilyDetails()" ${state.saveState === "saving" ? "disabled" : ""}>${state.saveState === "saving" ? "Guardando…" : "Guardar y seguir"}</button>
        </div>
      </div>
    </div>
    <div class="section-title"><h3>Tutores autorizados</h3>${state.appMode === "demo" ? `<button class="button ghost" onclick="simulateTutor()">Añadir tutor simulado</button>` : ""}</div>
    <div class="grid two">
      ${state.family.tutors.map((tutor) => `
        <article class="person-card">
          <h3>${tutor.name}</h3>
          <p class="muted">${tutor.relationship} · ${tutor.email}</p>
          <div class="badge-row">
            ${tutor.canSign ? `<span class="badge green">Puede firmar</span>` : ""}
            ${tutor.canPay ? `<span class="badge turquoise">Puede pagar</span>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderChildren({ state, child, services }) {
  if (!child) return `
    <div class="empty">
      <h2>Todavía no hay hijos registrados</h2>
      <p>Añade el primero para comenzar una solicitud.</p>
      <button class="button" onclick="simulateChild()">Añadir hijo</button>
    </div>`;
  return `
    <div class="section-title">
      <div>
        <h2>Hijos registrados</h2>
        <p class="muted">Cada hijo puede tener Training Kids, Football Academy o ambos.</p>
      </div>
      <button class="button ghost" onclick="simulateChild()">Añadir hijo</button>
    </div>
    <div class="panel pad" style="margin-top:16px">
      <h3>${child.isDraft ? "Nuevo hijo" : `Editar ${child.name}`}</h3>
      <div class="form-grid">
        <div class="field"><label for="child-name">Nombre y apellidos</label><input id="child-name" value="${escapeAttribute(child.name)}" onchange="updateChild('${child.id}', {name:this.value})" /></div>
        <div class="field"><label for="child-birth">Fecha de nacimiento</label><input id="child-birth" type="date" value="${escapeAttribute(child.birthDate || "")}" onchange="updateChild('${child.id}', {birthDate:this.value})" /></div>
        <div class="field"><label for="child-team">Equipo actual</label><input id="child-team" value="${escapeAttribute(child.team || "")}" onchange="updateChild('${child.id}', {team:this.value})" /></div>
      </div>
    </div>
    <div class="grid two">
      ${state.family.children.map((item) => `
        <button class="person-card ${item.id === child.id ? "active" : ""}" onclick="setState({selectedChildId:'${item.id}'})">
          <h3>${item.name}</h3>
          <p class="muted">Nacimiento: ${formatDate(item.birthDate)} · ${item.team || "Equipo pendiente"}</p>
          <div class="badge-row">${childServices({ state, services, childId: item.id })}</div>
        </button>
      `).join("")}
    </div>
    <div class="actions" style="margin-top:16px">
      <button class="button ghost" onclick="prevStep()">Atras</button>
      <button class="button" onclick="saveSelectedChild()" ${state.saveState === "saving" ? "disabled" : ""}>${state.saveState === "saving" ? "Guardando…" : "Guardar y continuar"}</button>
    </div>
  `;
}

function renderMedical({ state, child }) {
  return `
    <div class="grid two">
      <div>
        <h2>Salud y emergencia</h2>
        <p class="muted">Informacion compartida para proteger y adaptar la actividad. ${child.isDraft ? "Guarda primero los datos personales." : state.appMode === "test" ? "Se guarda en la ficha privada del hijo." : "Se guarda localmente en demo."}</p>
        <article class="panel pad">
          <h3>${child.name}</h3>
          <p class="muted">Estos datos seran comunes a todos sus servicios.</p>
        </article>
      </div>
      <div class="form-grid">
        <div class="field"><label>Informacion medica relevante</label><textarea onchange="updateChild('${child.id}', {medical:this.value})">${child.medical}</textarea></div>
        <div class="field"><label>Contacto de emergencia</label><input value="${child.emergencyName}" onchange="updateChild('${child.id}', {emergencyName:this.value})" /></div>
        <div class="field"><label>Telefono emergencia</label><input value="${child.emergencyPhone}" onchange="updateChild('${child.id}', {emergencyPhone:this.value})" /></div>
        <div class="actions">
          <button class="button ghost" onclick="prevStep()">Atras</button>
          <button class="button" onclick="saveSelectedChild()" ${state.saveState === "saving" ? "disabled" : ""}>${state.saveState === "saving" ? "Guardando…" : "Guardar y seguir"}</button>
        </div>
      </div>
    </div>
  `;
}

function renderServiceSelector({ state, child, services }) {
  return `
    <h2>Elige servicio para ${child.name}</h2>
    <p class="muted">Training Kids ya puede operar en V1. Football Academy queda visible como interes o prealta. Gym Home adultos queda previsto.</p>
    <div class="grid three">
      ${services.map((service) => `
        <article class="service-card ${service.id === "football_academy" ? "featured" : ""} ${state.selectedService === service.id ? "active" : ""}">
          <img class="service-logo" src="${service.logo}" alt="${service.name}" />
          <div class="badge-row"><span class="badge ${service.id === "training_kids" ? "turquoise" : service.id === "football_academy" ? "yellow" : ""}">${service.label}</span></div>
          <h3>${service.name}</h3>
          <p class="muted">${service.description}</p>
          <p><strong>${service.status}</strong></p>
          <button class="button ${service.id === "football_academy" ? "yellow" : service.id === "gym_home" ? "ghost" : ""}" ${service.id === "gym_home" ? "disabled" : ""} onclick="selectService('${service.id}')">${service.id === "football_academy" ? footballAcademyButtonLabel() : service.id === "gym_home" ? gymHomeFutureButtonLabel() : "Inscribir"}</button>
        </article>
      `).join("")}
    </div>
    <div class="actions" style="margin-top:16px">
      <button class="button ghost" onclick="prevStep()">Atras</button>
    </div>
  `;
}

function renderStatus({ state, child, services, centers, groups, trainingKidsPlans }) {
  const childEnrollments = state.enrollments.filter((item) => item.childId === child.id);
  return `
    <div class="section-title">
      <div>
        <h2>Estado de ${child.name}</h2>
        <p class="muted">Resumen familiar separado por servicio.</p>
      </div>
      <button class="button ghost" onclick="setState({familyStep:3})">Nuevo servicio</button>
    </div>
    <div class="grid two">
      ${childEnrollments.map((enrollment) => {
        const summary = getEnrollmentOperationalSummary({ enrollment, state, services, centers, groups, trainingKidsPlans });
        return `
        <article class="service-card ${enrollment.service === "football_academy" ? "featured" : ""}">
          <div class="badge-row">
            <span class="badge ${enrollment.service === "training_kids" ? "turquoise" : "yellow"}">${serviceName(services, enrollment.service)}</span>
            <span class="badge ${summary.tone}">${summary.label}</span>
          </div>
          <h3>${familyStatusHeadline(summary)}</h3>
          <p class="muted">${summary.nextStep}</p>
          ${enrollment.remote || enrollment.reviewStatus ? `<div class="badge-row"><span class="badge">Revisión: ${reviewLabel(enrollment.reviewStatus)}</span></div>${enrollment.reviewNotes ? `<div class="validation-box">${enrollment.reviewNotes}</div>` : ""}` : ""}
          <ul class="small-list">
            <li><span>Plan</span><strong>${enrollment.planId ? planName(trainingKidsPlans, enrollment.planId) : "Pendiente"}</strong></li>
            <li><span>Documentos obligatorios</span><strong>${summary.requirements.documents.complete ? "Completados" : "Pendientes"}</strong></li>
            <li><span>Pago</span><strong>${summary.requirements.payment.complete ? "Confirmado" : enrollment.payment}</strong></li>
            <li><span>Grupo</span><strong>${summary.group ? `${summary.group.name} · ${summary.group.day} ${summary.group.time}` : "Pendiente admin"}</strong></li>
            ${summary.status === "active" && summary.group ? `<li><span>Centro asignado</span><strong>${summary.centerLabel}</strong></li>` : ""}
          </ul>
        </article>
      `;
      }).join("")}
    </div>
    <div class="actions" style="margin-top:16px">
      <button class="button ghost" onclick="prevStep()">Atras</button>
      <button class="button" onclick="setState({activeView:'documents'})">Ver documentos</button>
      <button class="button" onclick="setState({activeView:'payments'})">Ver pagos</button>
    </div>
  `;
}

function familyStatusHeadline(summary) {
  if (summary.status === "active") return "Inscripcion activa";
  if (summary.status === "ready") return "Todo listo para confirmar plaza";
  if (summary.status === "withdrawn") return "Inscripcion dada de baja";
  if (summary.service === "football_academy") return "Prealta recibida";
  return "Estamos completando el alta";
}

function reviewLabel(status) {
  return ({ pending: "Pendiente", approved: "Aprobada", changes_requested: "Cambios solicitados", rejected: "Rechazada" })[status] || "Pendiente";
}

function getSelectedChild(state) {
  return state.family.children.find((child) => child.id === state.selectedChildId) || state.family.children[0];
}

function escapeAttribute(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
