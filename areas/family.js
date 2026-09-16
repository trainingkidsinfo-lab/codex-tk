import { childServices, formatDate, planName, serviceName } from "../ui/shared.js";
import { footballAcademyButtonLabel } from "./football-academy.js";
import { gymHomeFutureButtonLabel } from "./gym-home.js";
import { getEnrollmentOperationalSummary } from "./operational-status.js";
import { renderTrainingKidsEnrollment } from "./training-kids.js";

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
  return templates[context.state.familyStep](context);
}

function renderFamilyData({ state }) {
  return `
    <div class="grid two">
      <div>
        <h2>Datos familiares</h2>
        <p class="muted">Datos compartidos para todos los servicios. Guardado progresivo local en Fase B.</p>
      </div>
      <div class="form-grid">
        <div class="field"><label>Nombre familiar</label><input value="${state.family.name}" onchange="updateFamily({name:this.value})" /></div>
        <div class="field"><label>Telefono principal</label><input value="${state.family.phone}" onchange="updateFamily({phone:this.value})" /></div>
        <div class="field"><label>Direccion</label><input value="${state.family.address}" onchange="updateFamily({address:this.value})" /></div>
        <div class="actions">
          <button class="button" onclick="nextStep()">Guardar y seguir</button>
        </div>
      </div>
    </div>
    <div class="section-title"><h3>Tutores</h3><button class="button ghost" onclick="simulateTutor()">Añadir tutor simulado</button></div>
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
  return `
    <div class="section-title">
      <div>
        <h2>Hijos registrados</h2>
        <p class="muted">Cada hijo puede tener Training Kids, Football Academy o ambos.</p>
      </div>
      <button class="button ghost" onclick="simulateChild()">Añadir hijo simulado</button>
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
      <button class="button" onclick="nextStep()">Continuar</button>
    </div>
  `;
}

function renderMedical({ child }) {
  return `
    <div class="grid two">
      <div>
        <h2>Salud y emergencia</h2>
        <p class="muted">Informacion compartida para proteger y adaptar la actividad. En Fase B se guarda solo en este navegador.</p>
        <article class="panel pad">
          <h3>${child.name}</h3>
          <p class="muted">Estos datos seran comunes a todos sus servicios.</p>
        </article>
      </div>
      <div class="form-grid">
        <div class="field"><label>Informacion medica relevante</label><textarea oninput="updateChild('${child.id}', {medical:this.value})">${child.medical}</textarea></div>
        <div class="field"><label>Contacto de emergencia</label><input value="${child.emergencyName}" oninput="updateChild('${child.id}', {emergencyName:this.value})" /></div>
        <div class="field"><label>Telefono emergencia</label><input value="${child.emergencyPhone}" oninput="updateChild('${child.id}', {emergencyPhone:this.value})" /></div>
        <div class="actions">
          <button class="button ghost" onclick="prevStep()">Atras</button>
          <button class="button" onclick="nextStep()">Guardar y seguir</button>
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

function getSelectedChild(state) {
  return state.family.children.find((child) => child.id === state.selectedChildId) || state.family.children[0];
}
