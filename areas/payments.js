import { centerName, planName, serviceName } from "../ui/shared.js?v=e1";
import { escapeHtml, jsArg } from "../ui/escape.js?v=e1";

export const paymentStatusMeta = {
  pending: { label: "Pendiente", tone: "yellow" },
  paid: { label: "Pagado", tone: "green" },
  failed: { label: "Fallido", tone: "red" },
  canceled: { label: "Cancelado", tone: "" },
};

export function renderPayments({ state, services, centers, trainingKidsPlans }) {
  const payments = state.payments.filter((payment) => payment.service === "training_kids");
  return `
    <section class="hero-band">
      <div class="hero-content">
        <p class="eyebrow">Pagos simulados</p>
        <h1>Pagos Training Kids</h1>
        <p class="muted">Recorrido local de prueba. No hay Stripe real, tarjeta real, factura fiscal ni cobro externo.</p>
      </div>
      <div class="hero-side">
        <div class="hero-pill">${payments.filter((payment) => payment.status === "paid").length} pagados</div>
        <div class="hero-pill">${payments.filter((payment) => payment.status === "pending").length} pendientes</div>
        <div class="hero-pill">${escapeHtml(state.stripeCustomerRef)}</div>
      </div>
    </section>
    <section class="section-title">
      <div>
        <h2>Historial familiar</h2>
        <p class="muted">Pagos separados por inscripcion, con cliente Stripe familiar preparado para el futuro.</p>
      </div>
    </section>
    <div class="grid two">
      ${payments.length ? payments.map((payment) => renderPaymentCard({ payment, state, services, centers, trainingKidsPlans, familyView: true })).join("") : `<div class="empty">No hay pagos Training Kids todavia.</div>`}
    </div>
  `;
}

export function renderAdminPayments({ state, services, centers, trainingKidsPlans }) {
  const filteredByService = state.adminServiceFilter === "all"
    ? state.payments
    : state.payments.filter((payment) => payment.service === state.adminServiceFilter);
  const payments = state.paymentStatusFilter === "all"
    ? filteredByService
    : filteredByService.filter((payment) => payment.status === state.paymentStatusFilter);

  return `
    <section class="section-title">
      <div>
        <h2>Pagos</h2>
        <p class="muted">Importes y vencimientos simulados por inscripcion. Football Academy y Gym Home no tienen cobros activos.</p>
      </div>
    </section>
    <div class="doc-filter-row">
      ${paymentFilterButton("all", "Todos", state.paymentStatusFilter)}
      ${Object.entries(paymentStatusMeta).map(([key, meta]) => paymentFilterButton(key, meta.label, state.paymentStatusFilter)).join("")}
    </div>
    <div class="grid two">
      ${payments.length ? payments.map((payment) => renderPaymentCard({ payment, state, services, centers, trainingKidsPlans })).join("") : `<div class="empty">No hay pagos para este filtro.</div>`}
    </div>
  `;
}

function renderPaymentCard({ payment, state, services, centers, trainingKidsPlans, familyView = false }) {
  const enrollment = state.enrollments.find((item) => item.id === payment.enrollmentId);
  const children = state.adminChildren || state.family.children;
  const child = children.find((item) => item.id === payment.childId);
  const lineItems = payment.lineItems || [];
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return `
    <article class="payment-card" data-payment-id="${escapeHtml(payment.id)}">
      <div class="badge-row">
        <span class="badge ${paymentTone(payment.status)}">${escapeHtml(paymentLabel(payment.status))}</span>
        <span class="badge">${escapeHtml(serviceName(services, payment.service))}</span>
        <span class="badge">${escapeHtml(payment.period)}</span>
      </div>
      <h3>${escapeHtml(child?.name || "Hijo pendiente")}</h3>
      <ul class="small-list">
        <li><span>Inscripcion</span><strong>${escapeHtml(payment.enrollmentId)}</strong></li>
        <li><span>Centro</span><strong>${escapeHtml(centerName(centers, payment.centerId))}</strong></li>
        <li><span>Plan</span><strong>${escapeHtml(planName(trainingKidsPlans, payment.planId))}</strong></li>
        <li><span>Estado inscripcion</span><strong>${escapeHtml(enrollment?.status || "Pendiente")}</strong></li>
        <li><span>Vencimiento</span><strong>${escapeHtml(payment.nextDueLabel)}</strong></li>
      </ul>
      <div class="line-items">
        ${lineItems.map((item) => `
          <div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.amount)} €</strong></div>
        `).join("")}
        <div class="total"><span>Total</span><strong>${total} €</strong></div>
      </div>
      ${payment.receipt ? renderReceipt(payment) : ""}
      ${renderPaymentActions(payment, familyView)}
    </article>
  `;
}

function renderPaymentActions(payment, familyView) {
  if (payment.service !== "training_kids") return "";
  if (payment.remote) return `<p class="muted">Registro remoto en modo lectura.</p>`;
  if (payment.status === "paid") return `<p class="muted">Pago ya confirmado. No se puede duplicar.</p>`;
  if (payment.status === "canceled") return `<p class="muted">Pago cancelado en esta simulacion.</p>`;

  const id = jsArg(payment.id);
  return `
    <div class="actions payment-actions">
      <button class="button" data-payment-action="paid" onclick="simulateTrainingKidsPayment(${id}, 'paid')">${payment.status === "failed" ? "Reintentar pagado" : "Simular pagado"}</button>
      <button class="button ghost" data-payment-action="failed" onclick="simulateTrainingKidsPayment(${id}, 'failed')">Simular fallido</button>
      <button class="button ghost" data-payment-action="pending" onclick="simulateTrainingKidsPayment(${id}, 'pending')">Dejar pendiente</button>
      <button class="button ghost" data-payment-action="canceled" onclick="simulateTrainingKidsPayment(${id}, 'canceled')">Cancelar antes de pagar</button>
    </div>
  `;
}

function renderReceipt(payment) {
  return `
    <div class="receipt-box payment-receipt">
      <span class="badge green">RECIBO SIMULADO</span>
      <h3>No es factura fiscal</h3>
      <ul class="small-list">
        <li><span>Recibo</span><strong>${escapeHtml(payment.receipt.id)}</strong></li>
        <li><span>Fecha</span><strong>${escapeHtml(new Date(payment.receipt.createdAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }))}</strong></li>
        <li><span>Importe</span><strong>${escapeHtml(payment.receipt.amount)} €</strong></li>
        <li><span>Inscripcion</span><strong>${escapeHtml(payment.enrollmentId)}</strong></li>
      </ul>
    </div>
  `;
}

function paymentFilterButton(value, label, activeValue) {
  return `<button class="side-filter ${activeValue === value ? "active" : ""}" onclick="setState({paymentStatusFilter:${jsArg(value)}})">${escapeHtml(label)}</button>`;
}

export function paymentLabel(status) {
  return paymentStatusMeta[status]?.label || status;
}

function paymentTone(status) {
  return paymentStatusMeta[status]?.tone || "";
}
