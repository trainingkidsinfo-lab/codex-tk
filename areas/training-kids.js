import { centerName, planName, renderGroupCard } from "../ui/shared.js";

export function renderTrainingKidsEnrollment({ state, child, centers, groups, services, trainingKidsPlans }) {
  const availableCenters = centers.filter((center) => center.services.includes("training_kids"));
  const selectedCenter = centers.find((center) => center.id === state.selectedCenter) || availableCenters[0];
  const availableGroups = groups.filter((group) => group.service === "training_kids" && group.centerId === selectedCenter.id);
  const selectedPlan = trainingKidsPlans.find((plan) => plan.id === state.selectedPlan);

  return `
    <div class="grid two">
      <div>
        <h2>Inscripcion Training Kids</h2>
        <p class="muted">La familia indica disponibilidad y plan. Administracion asigna el grupo definitivo.</p>
        <div class="badge-row">
          <span class="badge turquoise">Matrícula 20 €</span>
          <span class="badge">Precios configurables</span>
          <span class="badge">Datos ficticios</span>
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Centro</label>
          <select onchange="setState({selectedCenter:this.value, selectedGroup:''})">
            ${availableCenters.map((center) => `<option value="${center.id}" ${center.id === state.selectedCenter ? "selected" : ""}>${center.name} · ${center.city}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Disponibilidad familiar</label>
          <textarea onchange="updateChild('${child.id}', {availability:this.value.split('\\n').filter(Boolean)})">${child.availability.join("\n")}</textarea>
        </div>
      </div>
    </div>
    <div class="section-title"><h3>Tarifas Training Kids</h3><span class="badge">${selectedPlan ? planName(trainingKidsPlans, selectedPlan.id) : "Sin plan"}</span></div>
    <div class="grid four">
      ${trainingKidsPlans.filter((plan) => plan.visibility === "Publica nuevos clientes").map((plan) => `
        <button class="price-card ${plan.id === state.selectedPlan ? "highlight" : ""}" onclick="setState({selectedPlan:'${plan.id}'})">
          <div class="price-top">${plan.name}<br>${plan.period}</div>
          <div class="price">${plan.amount} €</div>
          <p class="muted">${plan.visibility}</p>
        </button>
      `).join("")}
    </div>
    <div class="section-title"><h3>Grupos disponibles para administracion</h3><span class="badge">${centerName(centers, selectedCenter.id)}</span></div>
    <div class="grid two">
      ${availableGroups.length ? availableGroups.map((group) => renderGroupCard({ group, services, centers })).join("") : `<div class="empty">Este centro aun no tiene grupos simulados.</div>`}
    </div>
    <div class="actions" style="margin-top:16px">
      <button class="button ghost" onclick="prevStep()">Atras</button>
      <button class="button" onclick="saveTrainingEnrollment()">Guardar inscripcion simulada</button>
    </div>
  `;
}
