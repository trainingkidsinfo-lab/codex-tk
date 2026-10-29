import { centerName, planName, serviceName } from "../ui/shared.js?v=g1";
import { escapeHtml, jsArg } from "../ui/escape.js?v=g1";
import { canPrepareNewPayment } from "../data/remote-payments.js?v=g1";

export const paymentStatusMeta = {
  pending: { label: "Pendiente", tone: "yellow" },
  paid: { label: "Pagado", tone: "green" },
  failed: { label: "Fallido", tone: "red" },
  canceled: { label: "Cancelado", tone: "" },
};

export function renderPayments({ state, services, centers, trainingKidsPlans }) {
  const payments = state.payments.filter((payment) => payment.service === "training_kids");
  const testMode = state.appMode === "test";
  return `
    <section class="hero-band">
      <div class="hero-content">
        <p class="eyebrow">${testMode ? "Pagos de prueba" : "Pagos simulados"}</p>
        <h1>Pagos Training Kids</h1>
        <p class="muted">${testMode
          ? "Importes calculados por el servidor al aprobar la solicitud. La matricula familiar se cobra una sola vez. Sin cobro real: administracion registra el resultado."
          : "Recorrido local de prueba. No hay Stripe real, tarjeta real, factura fiscal ni cobro externo."}</p>
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
        <p class="muted">${state.appMode === "test"
          ? "Pagos de prueba por inscripcion, sin cobro real. Registra aqui el resultado. Football Academy y Gym Home no tienen cobros activos."
          : "Importes y vencimientos simulados por inscripcion. Football Academy y Gym Home no tienen cobros activos."}</p>
      </div>
    </section>
    <div class="doc-filter-row">
      ${paymentFilterButton("all", "Todos", state.paymentStatusFilter)}
      ${Object.entries(paymentStatusMeta).map(([key, meta]) => paymentFilterButton(key, meta.label, state.paymentStatusFilter)).join("")}
    </div>
    <div class="grid two">
      ${payments.length ? payments.map((payment) => renderPaymentCard({ payment, state, services, centers, trainingKidsPlans, allPayments: state.payments })).join("") : `<div class="empty">No hay pagos para este filtro.</div>`}
    </div>
  `;
}

function renderPaymentCard({ payment, state, services, centers, trainingKidsPlans, familyView = false, allPayments = [] }) {
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
      ${renderPaymentActions({ payment, familyView, state, allPayments })}
    </article>
  `;
}

function renderPaymentActions({ payment, familyView, state, allPayments }) {
  if (payment.service !== "training_kids") return "";
  if (payment.remote) return renderRemotePaymentActions({ payment, familyView, state, allPayments });
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

const REMOTE_RESULT_TEXT = {
  paid: "Confirmar que el pago de prueba se ha cobrado. Genera un recibo de prueba y no se podra deshacer.",
  failed: "Confirmar que el pago de prueba ha fallado. Podras marcarlo despues como pagado o cancelarlo.",
  canceled: "Confirmar la cancelacion del pago de prueba. Para cobrar despues habra que preparar uno nuevo.",
};

function renderRemotePaymentActions({ payment, familyView, state, allPayments }) {
  if (familyView || !state.session?.isAdmin) {
    return `<p class="muted">${payment.status === "paid" ? "Pago confirmado." : "Administracion registra el resultado de este pago de prueba. No hay cobro real."}</p>`;
  }
  if (!state.remotePaymentsReady) {
    return `<p class="muted">Acciones de pago disponibles cuando se aplique la migracion de la Fase G.</p>`;
  }
  const pending = state.pendingAdminAction?.paymentId === payment.id ? state.pendingAdminAction : null;
  const saving = state.saveState === "saving";
  if (pending) return renderPaymentConfirmation(pending, saving);
  const id = jsArg(payment.id);
  const disabled = saving ? "disabled" : "";
  if (payment.status === "pending" || payment.status === "failed") {
    return `
      <div class="actions payment-actions">
        <button type="button" class="button" data-payment-action="paid" onclick="requestPaymentResult(${id}, 'paid')" ${disabled}>Marcar pagado</button>
        ${payment.status === "pending" ? `<button type="button" class="button ghost" data-payment-action="failed" onclick="requestPaymentResult(${id}, 'failed')" ${disabled}>Marcar fallido</button>` : ""}
        <button type="button" class="button ghost" data-payment-action="canceled" onclick="requestPaymentResult(${id}, 'canceled')" ${disabled}>Cancelar pago</button>
      </div>
    `;
  }
  if (canPrepareNewPayment(payment, allPayments)) {
    return `
      <div class="actions payment-actions">
        <button type="button" class="button ghost" data-payment-action="prepare" onclick="requestPaymentPreparation(${id}, ${jsArg(payment.enrollmentId)})" ${disabled}>Preparar nuevo pago</button>
      </div>
    `;
  }
  return `<p class="muted">${payment.status === "paid" ? "Pago confirmado. No se puede modificar." : "Pago cerrado."}</p>`;
}

function renderPaymentConfirmation(action, saving) {
  const text = action.type === "prepare_payment"
    ? "Confirmar que se prepara un pago nuevo con la tarifa vigente. La matricula solo se incluye si la familia no la tiene ya."
    : REMOTE_RESULT_TEXT[action.result] || "Confirmar el cambio del pago de prueba.";
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

function renderReceipt(payment) {
  return `
    <div class="receipt-box payment-receipt">
      <span class="badge green">${payment.receipt.remote ? "RECIBO DE PRUEBA" : "RECIBO SIMULADO"}</span>
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
