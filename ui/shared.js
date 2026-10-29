import { escapeHtml } from "./escape.js?v=j1";

export function appChrome({ state, content }) {
  const canSeeAdmin = state.appMode === "demo" || state.session?.isAdmin;
  const canSeeDesign = state.appMode === "demo" || state.session?.isAdmin;
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <div class="brand-logo" aria-label="Training Kids">
              <img src="./assets/logo-training-kids-symbol.png" alt="" />
              <span class="tk-wordmark"><strong>Training Kids</strong><span>Plataforma familiar</span></span>
            </div>
          </div>
          <nav class="nav-tabs" aria-label="Navegacion principal">
            <button class="nav-button ${state.activeView === "family" ? "active" : ""}" onclick="setState({activeView:'family'})">Familia</button>
            <button class="nav-button ${state.activeView === "documents" ? "active" : ""}" onclick="setState({activeView:'documents'})">Documentos</button>
            <button class="nav-button ${state.activeView === "payments" ? "active" : ""}" onclick="setState({activeView:'payments'})">Pagos</button>
            ${canSeeAdmin ? `<button class="nav-button ${state.activeView === "admin" ? "active" : ""}" onclick="setState({activeView:'admin'})">Admin</button>` : ""}
            ${canSeeDesign ? `<button class="nav-button ${state.activeView === "design" ? "active" : ""}" onclick="setState({activeView:'design'})">Diseño</button>` : ""}
            <button class="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión" onclick="logout()">X</button>
          </nav>
        </div>
      </header>
      <main class="container">${content}</main>
      <div id="toast" class="toast" role="status"></div>
    </div>
  `;
}

export function toast(message) {
  const el = document.querySelector("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  window.setTimeout(() => el.classList.remove("show"), 2600);
}

// Devuelven texto plano: escapar siempre en el punto de render.
export function serviceName(services, serviceId) {
  return services.find((service) => service.id === serviceId)?.name || serviceId;
}

export function centerName(centers, centerId) {
  return centers.find((center) => center.id === centerId)?.name || "Sin centro";
}

export function planName(trainingKidsPlans, planId) {
  const plan = trainingKidsPlans.find((item) => item.id === planId);
  return plan ? `${plan.name} · ${plan.period} · ${plan.amount} €` : "Pendiente";
}

export function formatDate(value) {
  if (!value) return "Pendiente";
  return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function childServices({ state, services, childId }) {
  const items = state.enrollments.filter((enrollment) => enrollment.childId === childId);
  if (!items.length) return `<span class="badge">Sin inscripciones</span>`;
  return items.map((enrollment) => {
    const tone = enrollment.service === "training_kids" ? "turquoise" : "yellow";
    return `<span class="badge ${tone}">${escapeHtml(serviceName(services, enrollment.service))}</span>`;
  }).join("");
}

export function renderGroupCard({ group, services, centers }) {
  const pct = Math.min(100, Math.round((group.occupied / group.capacity) * 100));
  const cls = pct >= 100 ? "full" : pct >= 80 ? "hot" : "";
  return `
    <article class="group-card">
      <div class="badge-row">
        <span class="badge ${group.service === "training_kids" ? "turquoise" : "yellow"}">${escapeHtml(serviceName(services, group.service))}</span>
        <span class="badge">${escapeHtml(centerName(centers, group.centerId))}</span>
      </div>
      <h3>${escapeHtml(group.id)} · ${escapeHtml(group.name)}</h3>
      <p class="muted">${escapeHtml(group.day)} · ${escapeHtml(group.time)}</p>
      <div class="capacity">
        <div class="progress-head"><span>Capacidad</span><span>${Number(group.occupied) || 0}/${Number(group.capacity) || 0}</span></div>
        <div class="capacity-line"><div class="capacity-fill ${cls}" style="width:${pct}%"></div></div>
      </div>
    </article>
  `;
}
