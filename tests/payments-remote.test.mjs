import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { canPrepareNewPayment, mapRemotePayment } from "../data/remote-payments.ts";
import { renderAdminPayments, renderPayments } from "../areas/payments.js";
import { centers, initialState, services, trainingKidsPlans } from "../data/mock-data.js";

const ENROLLMENT = { id: "77777777-7777-7777-7777-777777777771", player_id: "p1", service_id: "training_kids", location_id: "c1", plan_id: "pl1" };
const ROW = {
  id: "o1", enrollment_id: ENROLLMENT.id, status: "pending", amount_cents: 8000, currency: "eur", due_on: null,
  created_at: "2026-10-29T10:00:00Z", plan_amount_cents: 6000, enrollment_fee_cents: 2000, billing_period: "monthly",
  description: "Primera mensualidad", paid_at: null, receipt_number: null,
  payment_events: [{ id: "e1", event_type: "order_created", status: "pending", created_at: "2026-10-29T10:00:00Z" }],
};
const HOSTILE = `x');alert(1);//`;

test("el pago remoto separa tarifa y matricula y calcula el total", () => {
  const payment = mapRemotePayment(ROW, [ENROLLMENT]);
  assert.deepEqual(payment.lineItems.map((item) => [item.type, item.amount]), [["training_plan", 60], ["enrollment_fee", 20]]);
  assert.equal(payment.totalAmount, 80);
  assert.equal(payment.period, "Mensual");
  assert.equal(payment.receipt, null);
  assert.equal(payment.childId, "p1");
  assert.equal(payment.remote, true);
});

test("sin matricula no aparece la linea de matricula y el recibo usa su numero", () => {
  const payment = mapRemotePayment({ ...ROW, amount_cents: 10000, plan_amount_cents: 10000, enrollment_fee_cents: 0, status: "paid", paid_at: "2026-10-29T11:00:00Z", receipt_number: "TK-PRUEBA-000001" }, [ENROLLMENT]);
  assert.deepEqual(payment.lineItems.map((item) => item.type), ["training_plan"]);
  assert.equal(payment.receipt.id, "TK-PRUEBA-000001");
  assert.equal(payment.receipt.amount, 100);
});

test("un registro anterior a la Fase G se muestra como total", () => {
  const payment = mapRemotePayment({ id: "old", enrollment_id: ENROLLMENT.id, status: "pending", amount_cents: 6000, created_at: "x" }, [ENROLLMENT]);
  assert.deepEqual(payment.lineItems, [{ type: "total", label: "Total registrado", amount: 60 }]);
});

test("solo se ofrece preparar un pago nuevo si no hay otro activo para la inscripcion", () => {
  const canceled = mapRemotePayment({ ...ROW, status: "canceled" }, [ENROLLMENT]);
  const pending = mapRemotePayment({ ...ROW, id: "o2" }, [ENROLLMENT]);
  const paid = mapRemotePayment({ ...ROW, id: "o3", status: "paid" }, [ENROLLMENT]);
  assert.equal(canPrepareNewPayment(canceled, [canceled]), true);
  assert.equal(canPrepareNewPayment(canceled, [canceled, pending]), false);
  assert.equal(canPrepareNewPayment(paid, [paid]), false);
});

function stateWith(payment, patch = {}) {
  const state = structuredClone(initialState);
  state.appMode = "test";
  state.session = { email: "admin@example.com", isAdmin: true };
  state.remotePaymentsReady = true;
  state.adminServiceFilter = "all";
  state.paymentStatusFilter = "all";
  state.payments = [payment];
  return Object.assign(state, patch);
}

test("administracion ve acciones escapadas y la familia no ve ninguna", () => {
  const payment = mapRemotePayment({ ...ROW, id: HOSTILE }, [ENROLLMENT]);
  const admin = renderAdminPayments({ state: stateWith(payment), services, centers, trainingKidsPlans });
  assert.match(admin, /Marcar pagado/);
  assert.match(admin, /Marcar fallido/);
  assert.match(admin, /Cancelar pago/);
  assert.equal(admin.includes("');alert(1)"), false);
  const family = renderPayments({ state: stateWith(payment, { session: { email: "f@example.com", isAdmin: false } }), services, centers, trainingKidsPlans });
  assert.doesNotMatch(family, /Marcar pagado|Cancelar pago/);
  assert.match(family, /Matricula familiar \(una sola vez\)/);
});

test("la confirmacion aparece en la tarjeta del pago y sin migracion no hay acciones", () => {
  const payment = mapRemotePayment(ROW, [ENROLLMENT]);
  const confirm = renderAdminPayments({ state: stateWith(payment, { pendingAdminAction: { type: "payment", paymentId: "o1", result: "paid" } }), services, centers, trainingKidsPlans });
  assert.match(confirm, /Genera un recibo de prueba/);
  assert.doesNotMatch(confirm, /Marcar fallido/);
  const legacy = renderAdminPayments({ state: stateWith(payment, { remotePaymentsReady: false }), services, centers, trainingKidsPlans });
  assert.match(legacy, /migracion de la Fase G/);
  assert.doesNotMatch(legacy, /Marcar pagado/);
});

test("la migracion G aplica la matricula una sola vez y reserva los cambios a administracion", () => {
  const sql = readFileSync(new URL("../supabase/migrations/202610290001_phase_g_payments.sql", import.meta.url), "utf8");
  assert.match(sql, /create unique index if not exists payment_orders_one_fee_per_family\s+on public\.payment_orders \(family_id\) where enrollment_fee_cents > 0 and status in \('pending', 'paid'\)/);
  assert.match(sql, /create unique index if not exists payment_orders_one_active_per_enrollment/);
  assert.match(sql, /from public\.plan_prices where id = v_enrollment\.plan_price_id/);
  assert.match(sql, /if v_enrollment\.service_id <> 'training_kids' then return null; end if;/);
  assert.match(sql, /function public\.admin_record_payment[\s\S]*?if not public\.is_admin\(\) then raise exception 'admin_access_required'/);
  assert.match(sql, /if v_order\.status = 'paid' then raise exception 'payment_already_paid'/);
  assert.match(sql, /revoke insert, update, delete, truncate on public\.payment_orders, public\.payment_events from anon, authenticated;/);
  assert.match(sql, /revoke all on function public\.prepare_initial_payment_order\(uuid\) from public, anon, authenticated;/);
  assert.match(sql, /if v_order\.status::text = p_result then/, "el estado (enum) se compara como texto");
  assert.doesNotMatch(sql, /to anon/);
  assert.doesNotMatch(sql, /service_role'|sb_secret/);
});

test("la app confirma en pagina y no escribe pagos directamente", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /if \(action\.type === "payment"\) \{\s+applyPaymentResult/);
  assert.match(app, /pendingAdminAction: \{ type: "prepare_payment", paymentId, paymentEnrollmentId: enrollmentId \}/);
  const adapter = readFileSync(new URL("../data/supabase-adapter.ts", import.meta.url), "utf8");
  assert.doesNotMatch(adapter, /from\("payment_orders"\)\.(insert|update|upsert)/);
  assert.match(adapter, /rpc\("admin_record_payment"/);
});
