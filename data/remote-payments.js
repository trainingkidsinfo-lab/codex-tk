// Pagos de prueba remotos (Fase G). Sin dependencias de navegador para poder probarlo en Node.

export const PAYMENT_COLUMNS = "id,enrollment_id,status,amount_cents,currency,due_on,provider_customer_ref,created_at,plan_price_id,plan_amount_cents,enrollment_fee_cents,billing_period,description,paid_at,receipt_number,payment_events(id,event_type,status,created_at)";
export const LEGACY_PAYMENT_COLUMNS = "id,enrollment_id,status,amount_cents,currency,due_on,provider_customer_ref,created_at,payment_events(id,event_type,status,created_at)";

export const PAYMENT_RESULTS = ["paid", "failed", "canceled"];

const PERIOD_LABELS = { monthly: "Mensual", quarterly: "Trimestral" };
const euros = (cents) => Math.round(Number(cents || 0)) / 100;

export function mapRemotePayment(item, enrollments = []) {
  const enrollment = enrollments.find((candidate) => candidate.id === item.enrollment_id);
  const detailed = item.plan_amount_cents !== null && item.plan_amount_cents !== undefined;
  const lineItems = detailed
    ? [
        { type: "training_plan", label: item.description || "Primer periodo", amount: euros(item.plan_amount_cents) },
        ...(Number(item.enrollment_fee_cents) > 0
          ? [{ type: "enrollment_fee", label: "Matricula familiar (una sola vez)", amount: euros(item.enrollment_fee_cents) }]
          : []),
      ]
    : [{ type: "total", label: "Total registrado", amount: euros(item.amount_cents) }];
  const events = [...(item.payment_events || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return {
    id: item.id,
    enrollmentId: item.enrollment_id,
    childId: enrollment?.player_id || "",
    service: enrollment?.service_id || "training_kids",
    centerId: enrollment?.location_id || "",
    planId: enrollment?.plan_id || "",
    period: PERIOD_LABELS[item.billing_period] || "Registro remoto",
    status: item.status,
    nextDueLabel: item.due_on || "Sin vencimiento definido",
    lineItems,
    totalAmount: euros(item.amount_cents),
    receipt: item.status === "paid"
      ? { id: item.receipt_number || item.id, createdAt: item.paid_at || item.created_at, amount: euros(item.amount_cents), remote: true }
      : null,
    attempts: events.map((event) => ({ id: event.id, result: event.status, attemptedAt: event.created_at, type: event.event_type })),
    createdAt: item.created_at,
    remote: true,
  };
}

export function canPrepareNewPayment(payment, payments) {
  if (!payment?.remote || !["canceled", "failed"].includes(payment.status)) return false;
  return !payments.some((other) => other.enrollmentId === payment.enrollmentId && ["pending", "paid"].includes(other.status));
}
