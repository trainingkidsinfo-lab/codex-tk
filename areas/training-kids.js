import { centerName, planName, renderGroupCard } from "../ui/shared.js?v=i2";
import { escapeHtml, jsArg } from "../ui/escape.js?v=i2";

export function renderTrainingKidsEnrollment({ state, child, centers, groups, services, trainingKidsPlans }) {
  const availableCenters = centers.filter((center) => center.services.includes("training_kids"));
  const selectedCenter = centers.find((center) => center.id === state.selectedCenter) || availableCenters[0];
  const availableGroups = selectedCenter
    ? groups.filter((group) => group.service === "training_kids" && group.centerId === selectedCenter.id)
    : [];
  const selectedPlan = trainingKidsPlans.find((plan) => plan.id === state.selectedPlan);
  const availability = Array.isArray(child.availability) ? child.availability : [];

  return `
    <div class="grid two">
      <div>
        <h2>Inscripcion Training Kids</h2>
        <p class="muted">La familia indica disponibilidad y plan. Administracion asigna el grupo definitivo.</p>
        <div class="badge-row">
          <span class="badge turquoise">Matrícula 20 €</span>
          <span class="badge">Precios configurables</span>
          <span class="badge">${state.appMode === "test" ? "Solicitud real de prueba" : "Datos ficticios"}</span>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="tk-center">Centro</label>
          <select id="tk-center" onchange="setState({selectedCenter:this.value, selectedGroup:''})">
            ${availableCenters.map((center) => `<option value="${escapeHtml(center.id)}" ${center.id === state.selectedCenter ? "selected" : ""}>${escapeHtml(center.name)} · ${escapeHtml(center.city)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="tk-availability">Disponibilidad familiar</label>
          <textarea id="tk-availability" onchange="updateChild(${jsArg(child.id)}, {availability:this.value.split('\\n').filter(Boolean)})">${escapeHtml(availability.join("\n"))}</textarea>
        </div>
      </div>
    </div>
    <div class="section-title"><h3>Tarifas Training Kids</h3><span class="badge">${selectedPlan ? escapeHtml(planName(trainingKidsPlans, selectedPlan.id)) : "Sin plan"}</span></div>
    <div class="grid four">
      ${trainingKidsPlans.filter((plan) => plan.visibility === "Publica nuevos clientes").map((plan) => `
        <button class="price-card ${plan.id === state.selectedPlan ? "highlight" : ""}" onclick="setState({selectedPlan:${jsArg(plan.id)}})">
          <div class="price-top">${escapeHtml(plan.name)}<br>${escapeHtml(plan.period)}</div>
          <div class="price">${escapeHtml(plan.amount)} €</div>
          <p class="muted">${escapeHtml(plan.visibility)}</p>
        </button>
      `).join("")}
    </div>
    <div class="section-title"><h3>Grupos disponibles para administracion</h3><span class="badge">${escapeHtml(centerName(centers, selectedCenter?.id))}</span></div>
    <div class="grid two">
      ${availableGroups.length ? availableGroups.map((group) => renderGroupCard({ group, services, centers })).join("") : `<div class="empty">Este centro aun no tiene grupos simulados.</div>`}
    </div>
    <div class="actions" style="margin-top:16px">
      <button class="button ghost" onclick="prevStep()">Atras</button>
      ${state.appMode === "test" && state.enrollmentSubmitConfirmed ? `
        <button class="button ghost" onclick="setState({enrollmentSubmitConfirmed:false})">Cancelar</button>
        <button class="button" onclick="saveTrainingEnrollment()" ${state.saveState === "saving" ? "disabled" : ""}>${state.saveState === "saving" ? "Enviando…" : "Confirmar envío"}</button>
      ` : `
        <button class="button" onclick="saveTrainingEnrollment()" ${state.saveState === "saving" ? "disabled" : ""}>${state.saveState === "saving" ? "Enviando…" : state.appMode === "test" ? "Enviar solicitud" : "Guardar inscripción simulada"}</button>
      `}
    </div>
    ${state.appMode === "test" && state.enrollmentSubmitConfirmed ? `<p class="notice warning" role="status">La solicitud se enviará a administración. Confirma el envío para continuar.</p>` : ""}
  `;
}
