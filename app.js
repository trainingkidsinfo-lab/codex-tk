import {
  STORAGE_KEY,
  TEST_CODE,
  centers,
  documentTemplates,
  groups,
  initialState,
  legalDocumentSources,
  services,
  stepLabels,
  steps,
  trainingKidsPlans,
} from "./data/mock-data.js?v=e1";
import { loadAppConfig } from "./data/app-config.js?v=e1";
import { createLocalDataAdapter } from "./data/local-adapter.js?v=e1";
import { createSupabaseDataAdapter } from "./data/supabase-adapter.js?v=e1";
import { translateDataError } from "./data/errors.js?v=e1";
import { renderAuth, renderLoading } from "./areas/access.js?v=e1";
import { renderAdmin } from "./areas/admin.js?v=e1";
import { renderDesign } from "./areas/design.js?v=e1";
import { renderDocuments } from "./areas/documents.js?v=e1";
import { renderFamily } from "./areas/family.js?v=e1";
import { getEnrollmentReview } from "./areas/enrollment-review.js?v=e1";
import { createFootballAcademyEnrollment } from "./areas/football-academy.js?v=e1";
import { getEnrollmentOperationalSummary, validateGroupAssignment } from "./areas/operational-status.js?v=e1";
import { generateContractActivityPdf } from "./areas/pdf-generator.js?v=e1";
import { renderPayments } from "./areas/payments.js?v=e1";
import { appChrome, serviceName, toast } from "./ui/shared.js?v=e1";

const appConfig = loadAppConfig();
const adapter = appConfig.isSupabaseTest
  ? await createSupabaseDataAdapter({
      initialState,
      config: appConfig,
      onChange: () => render(),
    })
  : createLocalDataAdapter({
      initialState: { ...initialState, appMode: "demo" },
      storageKey: STORAGE_KEY,
      onChange: () => render(),
    });

let activeSignatureDrawing = false;
let resendCountdownTimer = null;
const signatureDrafts = {};
const processingPaymentIds = new Set();

function getState() {
  return adapter.getState();
}

function setState(patch) {
  adapter.setState(patch);
}

function updateFamily(patch) {
  adapter.mutate((state) => {
    state.family = { ...state.family, ...patch };
    state.formDirty = true;
  });
}

async function saveFamilyDetails() {
  if (!adapter.isRemote) {
    adapter.setState({ formDirty: false });
    return nextStep();
  }
  try {
    await adapter.saveFamily(getState().family);
    adapter.setState({ formDirty: false });
    toast("Datos familiares guardados.");
    nextStep();
  } catch (error) {
    toast(translateDataError(error));
  }
}

function getChild(id = getState().selectedChildId) {
  const state = getState();
  return state.family.children.find((child) => child.id === id) || state.family.children[0];
}

function addAudit(action, service = "Training Kids") {
  adapter.mutate((state) => {
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: state.activeView === "admin" ? "Administracion" : "Familia",
      action,
      service,
    });
  });
}

async function login() {
  const email = document.querySelector("#email").value.trim();
  const code = (document.querySelector("#code")?.value || "").replace(/\s+/g, "");
  if (!email) return toast("Introduce un correo electrónico.");
  if (appConfig.isSupabaseTest) return requestLoginLink(email);
  if (code !== TEST_CODE) return toast("Codigo de prueba incorrecto. Usa 123456.");

  adapter.mutate((state) => {
    state.uiLoading = true;
  });

  window.setTimeout(() => {
    adapter.mutate((state) => {
      state.session = { email, createdAt: new Date().toISOString() };
      state.family.email = email;
      state.uiLoading = false;
      state.audit.unshift({
        id: `a-${Date.now()}`,
        date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
        actor: "Familia",
        action: "Acceso familiar simulado",
        service: "Plataforma",
      });
    });
  }, 450);
}

async function requestLoginLink(email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || getState().authRequestInFlight) return;
  const resendRemaining = secondsUntilResend(getState());
  if (getState().pendingLinkEmail && resendRemaining > 0) return;
  adapter.mutate((state) => {
    state.authRequestInFlight = true;
    state.authEmailDraft = normalizedEmail;
    state.authNotice = "";
    state.authError = "";
  });
  try {
    await adapter.requestLoginLink(normalizedEmail);
    const resendAvailableAt = Date.now() + 60_000;
    adapter.setState({
      authRequestInFlight: false,
      pendingLinkEmail: normalizedEmail,
      authEmailDraft: normalizedEmail,
      resendAvailableAt,
      connectionError: "",
      authError: "",
      authNotice: "Te hemos enviado un enlace de acceso. Ábrelo en este mismo navegador.",
    });
    startResendCountdown();
  } catch (error) {
    console.warn("Supabase login link request failed:", error?.message || error);
    adapter.setState({
      authRequestInFlight: false,
      authEmailDraft: normalizedEmail,
      authNotice: "",
      authError: translateAuthError(error),
    });
  }
}

function secondsUntilResend(state = getState()) {
  return Math.max(0, Math.ceil(((state.resendAvailableAt || 0) - Date.now()) / 1000));
}

function startResendCountdown() {
  window.clearInterval(resendCountdownTimer);
  resendCountdownTimer = window.setInterval(() => {
    if (!getState().pendingLinkEmail || secondsUntilResend() <= 0) {
      window.clearInterval(resendCountdownTimer);
      resendCountdownTimer = null;
      adapter.setState({ authCountdownTick: Date.now() });
      return;
    }
    adapter.setState({ authCountdownTick: Date.now() });
  }, 1000);
}

function changeLoginEmail() {
  window.clearInterval(resendCountdownTimer);
  resendCountdownTimer = null;
  adapter.setState({
    pendingLinkEmail: "",
    authEmailDraft: "",
    resendAvailableAt: 0,
    authNotice: "",
    authError: "",
    authRequestInFlight: false,
  });
}

function translateAuthError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || error?.status || "").toLowerCase();
  if (message.includes("email rate limit exceeded") || code.includes("over_email_send_rate_limit") || code === "429") {
    return "Se ha alcanzado temporalmente el límite de correos de acceso. Espera unos minutos antes de solicitar otro enlace.";
  }
  if (message.includes("invalid email")) {
    return "El formato del correo no es válido. Revísalo e inténtalo de nuevo.";
  }
  if (message.includes("expired")) {
    return "El enlace ha caducado. Solicita uno nuevo.";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "No se pudo conectar con el servicio de acceso. Comprueba tu conexión y vuelve a intentarlo.";
  }
  if (message.includes("user not found") || message.includes("signups not allowed") || message.includes("not authorized")) {
    return "No se ha podido autorizar este correo. Comprueba que sea el correo facilitado a Training Kids.";
  }
  if (message.includes("too many") || message.includes("request rate limit") || code.includes("over_request_rate_limit")) {
    return "Se han realizado demasiados intentos. Espera unos minutos antes de volver a probar.";
  }
  return "No se pudo enviar el enlace de acceso. Vuelve a intentarlo en unos minutos.";
}

async function logout() {
  window.clearInterval(resendCountdownTimer);
  resendCountdownTimer = null;
  if (appConfig.isSupabaseTest && adapter.logout) {
    try {
      await adapter.logout();
    } catch {
      toast("No se pudo cerrar la sesion. Reintenta.");
    }
    return;
  }
  adapter.setState({ session: null });
}

function nextStep() {
  const state = getState();
  setState({ familyStep: Math.min(steps.length - 1, state.familyStep + 1) });
}

function prevStep() {
  const state = getState();
  setState({ familyStep: Math.max(0, state.familyStep - 1) });
}

function updateChild(childId, patch) {
  adapter.mutate((state) => {
    state.family.children = state.family.children.map((child) => child.id === childId ? { ...child, ...patch } : child);
    const childName = state.family.children.find((child) => child.id === childId)?.name || "hijo";
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Familia",
      action: `Datos compartidos actualizados para ${childName}`,
      service: "Plataforma",
    });
    state.formDirty = true;
  });
}

async function saveSelectedChild() {
  const child = getChild();
  if (!child) return toast("Selecciona un hijo.");
  if (!child.name?.trim() || child.name.trim().split(/\s+/).length < 2) return toast("Indica nombre y apellidos.");
  if (!adapter.isRemote) {
    adapter.setState({ formDirty: false });
    return nextStep();
  }
  try {
    await adapter.savePlayer(child);
    adapter.setState({ formDirty: false });
    toast("Datos del hijo guardados.");
    nextStep();
  } catch (error) {
    toast(translateDataError(error));
  }
}

function selectService(serviceId) {
  if (serviceId === "gym_home") return;

  if (serviceId === "football_academy") {
    adapter.mutate((state) => {
      const exists = state.enrollments.some((item) => item.childId === state.selectedChildId && item.service === "football_academy");
      if (!exists) state.enrollments.push(createFootballAcademyEnrollment({ childId: state.selectedChildId }));
      const childName = state.family.children.find((child) => child.id === state.selectedChildId)?.name || "hijo";
      state.preEnrollmentSent = true;
      state.familyStep = 5;
      state.audit.unshift({
        id: `a-${Date.now()}`,
        date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
        actor: "Familia",
        action: `Prealta Football Academy registrada para ${childName}`,
        service: "Football Academy",
      });
    });
    window.setTimeout(() => toast("Interes en Football Academy registrado."), 100);
    return;
  }

  setState({ selectedService: serviceId, familyStep: 4 });
}

async function saveTrainingEnrollment() {
  if (adapter.isRemote) {
    const state = getState();
    const plan = state.remoteCatalog?.plans?.find((item) => item.id === state.selectedPlan);
    const season = state.remoteCatalog?.seasons?.find((item) => item.service === "training_kids");
    const child = getChild();
    if (!child || !state.selectedCenter || !plan || !season) return toast("Completa centro, temporada y tarifa antes de enviar.");
    if (!state.enrollmentSubmitConfirmed) {
      setState({ enrollmentSubmitConfirmed: true });
      return;
    }
    try {
      await adapter.submitEnrollment({
        playerId: child.id,
        serviceId: "training_kids",
        locationId: state.selectedCenter,
        seasonId: season.id,
        planId: plan.id,
        planPriceId: plan.priceId,
        availability: child.availability || [],
      });
      setState({ enrollmentSubmitConfirmed: false });
      toast("Solicitud enviada a administración.");
    } catch (error) {
      setState({ enrollmentSubmitConfirmed: false });
      toast(translateDataError(error));
    }
    return;
  }
  adapter.mutate((state) => {
    let existing = state.enrollments.find((item) => item.childId === state.selectedChildId && item.service === "training_kids");
    if (existing) {
      existing.planId = state.selectedPlan;
      existing.centerId = state.selectedCenter;
      existing.operationalStatus = ["active", "withdrawn"].includes(existing.operationalStatus) ? existing.operationalStatus : "draft";
      existing.status = "Pendiente de asignacion";
      existing.payment = "Stripe prueba pendiente";
    } else {
      existing = {
        id: `enr-${Date.now()}`,
        childId: state.selectedChildId,
        service: "training_kids",
        status: "Pendiente de asignacion",
        docs: "Pendientes",
        payment: "Stripe prueba pendiente",
        groupId: "",
        planId: state.selectedPlan,
        centerId: state.selectedCenter,
        operationalStatus: "draft",
      };
      state.enrollments.push(existing);
    }

    const childName = state.family.children.find((child) => child.id === state.selectedChildId)?.name || "hijo";
    ensureTrainingKidsDocuments(state, existing);
    ensureTrainingKidsPayment(state, existing);
    state.familyStep = 5;
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Familia",
      action: `Inscripcion Training Kids guardada para ${childName}`,
      service: "Training Kids",
    });
  });
  window.setTimeout(() => toast("Inscripcion simulada guardada."), 100);
}

async function reviewEnrollment(enrollmentId, decision) {
  let review;
  try {
    review = getEnrollmentReview(decision);
  } catch (error) {
    console.error("Decisión administrativa rechazada:", { decision, message: error.message });
    return toast("La acción administrativa no es válida. Recarga la aplicación.");
  }
  const state = getState();
  const notes = String(state.adminReviewNotes?.[enrollmentId] || "").trim();
  if (review.requiresNotes && !notes) return toast("Escribe las observaciones que debe revisar la familia.");
  adapter.setState({ pendingAdminAction: { type: "review", enrollmentId, decision: review.remoteDecision } });
}

async function applyEnrollmentReview(enrollmentId, decision) {
  const review = getEnrollmentReview(decision);
  const state = getState();
  const groupId = review.remoteDecision === "approve" ? (state.adminGroupDrafts?.[enrollmentId] || null) : null;
  const notes = String(state.adminReviewNotes?.[enrollmentId] || "").trim();
  adapter.setState({ pendingAdminAction: null });
  if (!adapter.isRemote) {
    adapter.mutate((draft) => {
      const enrollment = draft.enrollments.find((item) => item.id === enrollmentId);
      if (!enrollment) return;
      enrollment.reviewStatus = review.reviewStatus;
      enrollment.reviewNotes = notes;
      const child = draft.family.children.find((item) => item.id === enrollment.childId);
      draft.audit.unshift({
        id: `a-${Date.now()}`,
        date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
        actor: "Administración",
        action: review.remoteDecision === "request_changes" ? `Cambios solicitados para ${child?.name || "inscripción"}: ${notes}` : `Solicitud ${review.remoteDecision}`,
        service: enrollment.service === "training_kids" ? "Training Kids" : "Football Academy",
      });
    });
    toast(review.successMessage);
    return;
  }
  try {
    await adapter.reviewEnrollment(enrollmentId, review.remoteDecision, groupId, notes);
    toast(review.successMessage);
  } catch (error) {
    toast(translateDataError(error));
  }
}

function approveEnrollment(enrollmentId) {
  return reviewEnrollment(enrollmentId, "approve");
}

function requestEnrollmentChanges(enrollmentId) {
  return reviewEnrollment(enrollmentId, "request_changes");
}

function rejectEnrollment(enrollmentId) {
  return reviewEnrollment(enrollmentId, "reject");
}

function setAdminGroupDraft(enrollmentId, groupId) {
  adapter.setState({
    adminGroupDrafts: { ...(getState().adminGroupDrafts || {}), [enrollmentId]: groupId },
  });
}

function setAdminReviewNote(enrollmentId, notes) {
  adapter.setState({
    adminReviewNotes: { ...(getState().adminReviewNotes || {}), [enrollmentId]: notes },
  });
}

function assignGroup(enrollmentId, groupId) {
  const stateBefore = getState();
  const enrollmentBefore = stateBefore.enrollments.find((item) => item.id === enrollmentId);
  if (!enrollmentBefore) return toast("Inscripcion no encontrada.");
  const validation = validateGroupAssignment({ enrollment: enrollmentBefore, groupId, state: stateBefore, centers, groups });
  if (!validation.ok) return toast(validation.reason);

  adapter.mutate((state) => {
    const enrollment = state.enrollments.find((item) => item.id === enrollmentId);
    if (!enrollment) return;
    const childName = state.family.children.find((child) => child.id === enrollment.childId)?.name || "hijo";
    enrollment.groupId = groupId;
    enrollment.status = groupId ? "Grupo asignado" : "Pendiente de asignacion";
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Administracion",
      action: `Grupo ${groupId || "pendiente"} asignado a ${childName}`,
      service: serviceName(services, enrollment.service),
    });
  });
  window.setTimeout(() => toast("Asignacion simulada actualizada."), 100);
}

function activateEnrollment(enrollmentId) {
  const state = getState();
  const enrollment = state.enrollments.find((item) => item.id === enrollmentId);
  if (!enrollment) return toast("Inscripcion no encontrada.");
  const summary = getEnrollmentOperationalSummary({ enrollment, state, services, centers, groups, trainingKidsPlans });
  if (summary.status !== "ready") return toast(`No se puede activar. ${summary.missing[0] || "Faltan requisitos."}`);
  adapter.mutate((currentState) => {
    currentState.pendingAdminAction = { type: "activate", enrollmentId };
  });
}

function confirmAdminAction() {
  const state = getState();
  const action = state.pendingAdminAction;
  if (!action) return;
  if (action.type === "review") {
    applyEnrollmentReview(action.enrollmentId, action.decision);
    return;
  }
  if (action.type === "activate") {
    applyEnrollmentActivation(action.enrollmentId);
    return;
  }
  if (action.type === "withdraw") {
    applyEnrollmentWithdrawal(action.enrollmentId);
  }
}

function cancelAdminAction() {
  adapter.setState({ pendingAdminAction: null });
}

function applyEnrollmentActivation(enrollmentId) {
  const state = getState();
  const enrollment = state.enrollments.find((item) => item.id === enrollmentId);
  const summary = enrollment ? getEnrollmentOperationalSummary({ enrollment, state, services, centers, groups, trainingKidsPlans }) : null;
  if (!enrollment || summary.status !== "ready") {
    adapter.setState({ pendingAdminAction: null });
    return toast("No se puede activar porque faltan requisitos.");
  }
  adapter.mutate((currentState) => {
    const currentEnrollment = currentState.enrollments.find((item) => item.id === enrollmentId);
    if (!currentEnrollment) return;
    const childName = currentState.family.children.find((child) => child.id === currentEnrollment.childId)?.name || "hijo";
    currentEnrollment.operationalStatus = "active";
    currentEnrollment.status = "Activa";
    currentState.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Administracion",
      action: `Inscripcion activada para ${childName}`,
      service: serviceName(services, currentEnrollment.service),
    });
    currentState.pendingAdminAction = null;
  });
  window.setTimeout(() => toast("Inscripcion activada."), 100);
}

function withdrawEnrollment(enrollmentId) {
  const enrollment = getState().enrollments.find((item) => item.id === enrollmentId);
  if (!enrollment) return toast("Inscripcion no encontrada.");
  adapter.mutate((state) => {
    state.pendingAdminAction = { type: "withdraw", enrollmentId };
  });
}

function applyEnrollmentWithdrawal(enrollmentId) {
  adapter.mutate((state) => {
    const currentEnrollment = state.enrollments.find((item) => item.id === enrollmentId);
    if (!currentEnrollment) return;
    const childName = state.family.children.find((child) => child.id === currentEnrollment.childId)?.name || "hijo";
    currentEnrollment.operationalStatus = "withdrawn";
    currentEnrollment.status = "Baja";
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Administracion",
      action: `Baja local registrada para ${childName}; pagos sin modificar`,
      service: serviceName(services, currentEnrollment.service),
    });
    state.pendingAdminAction = null;
  });
  window.setTimeout(() => toast("Baja local registrada."), 100);
}

function simulatePayment() {
  const payment = getState().payments.find((item) => item.service === "training_kids");
  if (!payment) return toast("No hay pago Training Kids.");
  simulateTrainingKidsPayment(payment.id, "paid");
}

function ensureTrainingKidsPayment(state, enrollment) {
  if (!enrollment || enrollment.service !== "training_kids") return null;
  const plan = trainingKidsPlans.find((item) => item.id === enrollment.planId);
  if (!plan) return null;
  const existingPayment = state.payments.find((payment) => payment.enrollmentId === enrollment.id);
  const familyAlreadyHasEnrollmentFee = state.payments.some((payment) => payment.lineItems?.some((item) => item.type === "enrollment_fee"));
  const includesEnrollmentFee = existingPayment
    ? existingPayment.lineItems?.some((item) => item.type === "enrollment_fee")
    : !familyAlreadyHasEnrollmentFee;
  const lineItems = [
    { type: "training_plan", label: `${plan.name} · ${plan.period}`, amount: plan.amount },
    ...(includesEnrollmentFee ? [{ type: "enrollment_fee", label: "Matricula familiar", amount: 20 }] : []),
  ];
  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const paymentPatch = {
    familyId: state.family.id,
    enrollmentId: enrollment.id,
    childId: enrollment.childId,
    service: "training_kids",
    planId: enrollment.planId,
    centerId: enrollment.centerId || state.selectedCenter,
    period: plan.period,
    nextDueLabel: "Vencimiento simulado pendiente de configurar",
    stripeCustomerRef: state.stripeCustomerRef,
    lineItems,
    totalAmount,
  };

  if (existingPayment) {
    Object.assign(existingPayment, paymentPatch);
    return existingPayment;
  }

  const payment = {
    id: `pay-${enrollment.id}`,
    status: "pending",
    attempts: [],
    receipt: null,
    ...paymentPatch,
  };
  state.payments.push(payment);
  return payment;
}

function ensureTrainingKidsDocuments(state, enrollment) {
  if (!enrollment || enrollment.service !== "training_kids") return;
  const currentFlowTemplates = new Set(["tk-service-terms", "tk-image-rights"]);
  const templates = documentTemplates.filter((template) => template.service === "training_kids" && currentFlowTemplates.has(template.id));
  templates.forEach((template) => {
    const exists = state.documents.some((document) => document.enrollmentId === enrollment.id && document.templateId === template.id);
    if (exists) return;
    const setup = documentSetup(template);
    state.documents.push({
      id: `doc-${template.id}-${enrollment.childId}-${Date.now()}`,
      templateId: template.id,
      scope: template.scope === "global" ? "global" : template.scope,
      service: "training_kids",
      familyId: state.family.id,
      childId: enrollment.childId,
      enrollmentId: enrollment.id,
      status: setup.status,
      required: setup.required,
      title: template.title,
      validationNote: setup.validationNote,
      version: template.version,
      effectiveDate: template.effectiveDate,
      signedAt: "",
      evidence: null,
    });
  });
}

function documentSetup(template) {
  if (template.id === "tk-service-terms") return { status: "pending_complete", required: true, validationNote: "" };
  if (template.id === "tk-norms-guarantees") return { status: "info", required: false, validationNote: "" };
  if (template.id === "tk-image-rights") return { status: "pending_signature", required: false, validationNote: "" };
  return { status: "not_applicable", required: false, validationNote: "" };
}

function simulateTrainingKidsPayment(paymentId, result) {
  if (processingPaymentIds.has(paymentId)) return toast("Procesando simulacion de pago.");
  if (!["paid", "failed", "pending", "canceled"].includes(result)) return;
  const current = getState().payments.find((payment) => payment.id === paymentId);
  if (!current) return toast("Pago no encontrado.");
  if (current.service !== "training_kids") return toast("Solo Training Kids puede simular pagos en esta fase.");
  if (current.status === "paid") return toast("Este pago ya esta confirmado.");

  processingPaymentIds.add(paymentId);
  window.setTimeout(() => {
    adapter.mutate((state) => {
      const payment = state.payments.find((item) => item.id === paymentId);
      if (!payment || payment.status === "paid") return;
      const enrollment = state.enrollments.find((item) => item.id === payment.enrollmentId);
      const childName = state.family.children.find((child) => child.id === payment.childId)?.name || "hijo";
      const attemptedAt = new Date().toISOString();
      payment.status = result;
      payment.attempts.push({ id: `att-${Date.now()}`, result, attemptedAt });

      if (result === "paid") {
        payment.receipt = {
          id: `REC-SIM-${Date.now()}`,
          createdAt: attemptedAt,
          amount: payment.totalAmount,
          note: "Recibo simulado. No es factura fiscal.",
        };
        if (enrollment) {
          enrollment.payment = "Pago de prueba confirmado";
          enrollment.status = enrollment.groupId ? "Grupo asignado" : "Pago confirmado · pendiente de grupo";
        }
      } else if (result === "failed") {
        payment.receipt = null;
        if (enrollment) enrollment.payment = "Pago de prueba fallido";
      } else if (result === "pending") {
        payment.receipt = null;
        if (enrollment) enrollment.payment = "Pago de prueba pendiente";
      } else if (result === "canceled") {
        payment.receipt = null;
        if (enrollment) enrollment.payment = "Pago de prueba cancelado";
      }

      state.audit.unshift({
        id: `a-${Date.now()}`,
        date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
        actor: state.activeView === "admin" ? "Administracion" : "Familia",
        action: `Pago simulado ${result} para ${childName}`,
        service: "Training Kids",
      });
    });
    processingPaymentIds.delete(paymentId);
    toast("Resultado de pago simulado actualizado.");
  }, 260);
}

function markFootballInterest(enrollmentId) {
  adapter.mutate((state) => {
    const enrollment = state.enrollments.find((item) => item.id === enrollmentId);
    if (!enrollment) return;
    const childName = state.family.children.find((child) => child.id === enrollment.childId)?.name || "hijo";
    enrollment.status = "Contactar para Football Academy";
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Administracion",
      action: `Contacto Football Academy marcado para ${childName}`,
      service: "Football Academy",
    });
  });
}

function openDocument(documentId) {
  adapter.mutate((state) => {
    const doc = state.documents.find((item) => item.id === documentId);
    state.activeView = "documents";
    state.activeDocumentId = documentId;
    state.signingDocumentId = "";
    state.documentFlowSteps = {
      ...(state.documentFlowSteps || {}),
      [documentId]: ["signed", "accepted"].includes(doc?.status) ? "signed" : state.documentFlowSteps?.[documentId] || "fill",
    };
  });
}

function setDocumentStep(documentId, step) {
  adapter.mutate((state) => {
    state.documentFlowSteps = { ...(state.documentFlowSteps || {}), [documentId]: step };
    if (step !== "sign") state.signingDocumentId = "";
    const doc = state.documents.find((item) => item.id === documentId);
    if (doc && step === "fill" && doc.status !== "signed" && doc.status !== "accepted") {
      state.reviewedDocuments = { ...(state.reviewedDocuments || {}), [documentId]: false };
      doc.generatedDraftPdf = "";
      doc.generatedDraftHash = "";
    }
  });
}

async function continueDocumentReview(documentId) {
  const missing = missingRequiredDocumentFields();
  if (missing.length) {
    showSignatureValidation(`Faltan campos para revisar: ${missing.join(", ")}`);
    return;
  }
  saveDocumentDraft(documentId, { silent: true, preserveStatus: true });
  const stateAfterDraft = getState();
  const docAfterDraft = stateAfterDraft.documents.find((item) => item.id === documentId);
  if (docAfterDraft?.templateId === "tk-service-terms") {
    try {
      const generated = await generateContractActivityPdf({
        document: docAfterDraft,
        state: stateAfterDraft,
        centers,
        groups,
        trainingKidsPlans,
      });
      adapter.mutate((state) => {
        const doc = state.documents.find((item) => item.id === documentId);
        if (!doc || doc.status === "signed") return;
        doc.generatedDraftPdf = generated.dataUrl;
        doc.generatedDraftHash = generated.hash;
        doc.generatedDraftData = generated.data;
        doc.requiresTeamReview = generated.data.hasParqAlert;
        doc.status = "pending_signature";
        state.reviewedDocuments = { ...(state.reviewedDocuments || {}), [documentId]: false };
      });
    } catch (error) {
      showSignatureValidation(`No se pudo generar el PDF cumplimentado: ${error.message}`);
      return;
    }
  }
  adapter.mutate((state) => {
    state.documentFlowSteps = { ...(state.documentFlowSteps || {}), [documentId]: "review" };
  });
}

function startDocumentSignature(documentId) {
  const state = getState();
  const doc = state.documents.find((item) => item.id === documentId);
  if (!doc) return toast("Documento no encontrado.");
  if (!state.reviewedDocuments?.[documentId]) {
    showSignatureValidation("Revisa el documento completo hasta el final antes de firmar.");
    return;
  }
  if (!doc.formDraft || !Object.keys(doc.formDraft).length) {
    showSignatureValidation("Completa los datos del documento antes de firmar.");
    return;
  }
  adapter.mutate((currentState) => {
    currentState.signingDocumentId = documentId;
    currentState.documentFlowSteps = { ...(currentState.documentFlowSteps || {}), [documentId]: "sign" };
  });
  prepareSignaturePad(documentId);
}

function initializeDocumentReview() {
  const state = getState();
  const documentId = state.activeDocumentId;
  if (!documentId || state.documentFlowSteps?.[documentId] !== "review") return;
  const reader = document.querySelector(`[data-legal-reader="${documentId}"]`);
  if (!reader) return;
  const markRead = () => {
    if (getState().reviewedDocuments?.[documentId]) return;
    adapter.mutate((currentState) => {
      currentState.reviewedDocuments = { ...(currentState.reviewedDocuments || {}), [documentId]: true };
    });
  };
  if (reader.scrollHeight <= reader.clientHeight + 12) {
    markRead();
    return;
  }
  const sentinel = reader.querySelector(`[data-reader-end="${documentId}"]`);
  if (!sentinel || typeof IntersectionObserver !== "function") return;
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      markRead();
    }
  }, { root: reader, threshold: 1 });
  observer.observe(sentinel);
}

function markDocumentReadIfBottom(event) {
  const element = event.currentTarget;
  if (element.scrollTop + element.clientHeight < element.scrollHeight - 12) return;
  const documentId = element.dataset.legalReader;
  if (!documentId) return;
  adapter.mutate((state) => {
    state.reviewedDocuments = { ...(state.reviewedDocuments || {}), [documentId]: true };
  });
}

function prepareSignaturePad(documentId) {
  const canvas = document.querySelector("#signaturePad");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#06254a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  signatureDrafts[documentId] = "";
}

function signaturePoint(event) {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function startSignatureDraw(event, documentId) {
  activeSignatureDrawing = true;
  const point = signaturePoint(event);
  const ctx = event.currentTarget.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  event.currentTarget.setPointerCapture(event.pointerId);
  signatureDrafts[documentId] = event.currentTarget.toDataURL("image/png");
}

function drawSignature(event, documentId) {
  if (!activeSignatureDrawing) return;
  const point = signaturePoint(event);
  const ctx = event.currentTarget.getContext("2d");
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  signatureDrafts[documentId] = event.currentTarget.toDataURL("image/png");
}

function endSignatureDraw(event, documentId) {
  if (!activeSignatureDrawing) return;
  activeSignatureDrawing = false;
  signatureDrafts[documentId] = event.currentTarget.toDataURL("image/png");
}

function clearSignaturePad(documentId) {
  prepareSignaturePad(documentId);
  toast("Firma dibujada borrada.");
}

function collectDocumentFieldValues() {
  const inputs = [...document.querySelectorAll("[data-doc-field]")];
  if (!inputs.length) return null;
  const values = {};
  inputs.forEach((input) => {
    const key = input.dataset.docField;
    if (input.type === "radio" && !input.checked) {
      if (!values[key]) {
        values[key] = {
          label: input.dataset.fieldLabel,
          value: "",
          readOnly: false,
          required: input.dataset.required === "true",
        };
      }
      return;
    }
    values[key] = {
      label: input.dataset.fieldLabel,
      value: input.type === "radio" ? input.value : input.value.trim(),
      readOnly: input.hasAttribute("readonly"),
      required: input.dataset.required === "true",
    };
  });
  return values;
}

function missingRequiredDocumentFields() {
  const values = collectDocumentFieldValues() || {};
  return Object.values(values)
    .filter((item) => item.required && !item.value)
    .map((item) => item.label);
}

function saveDocumentDraft(documentId, options = {}) {
  const fieldValues = collectDocumentFieldValues();
  if (!fieldValues) return;
  const missing = missingRequiredDocumentFields();
  adapter.mutate((state) => {
    const doc = state.documents.find((item) => item.id === documentId);
    if (!doc || doc.status === "signed" || doc.status === "accepted") return;
    doc.formDraft = fieldValues;
    syncSharedChildDataFromDocument(state, doc, fieldValues);
    if (doc.status === "validation_pending" || doc.validationNote) {
      doc.status = "validation_pending";
    } else if (!options.preserveStatus) {
      doc.status = missing.length ? "pending_complete" : "pending_signature";
    }
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Familia",
      action: `Borrador documental guardado en ${doc.id}`,
      service: serviceName(services, doc.service),
    });
  });
  if (!options.silent) {
    window.setTimeout(() => toast(missing.length ? `Borrador guardado. Faltan: ${missing.join(", ")}` : "Borrador documental guardado."), 100);
  }
}

function showSignatureValidation(message) {
  const box = document.querySelector("#signatureValidationBox") || document.querySelector(".signature-panel .validation-box");
  if (box) {
    box.textContent = message;
    box.classList.remove("hidden");
  }
  toast(message);
}

function confirmSimulatedSignature(documentId) {
  const signerId = document.querySelector("#docSigner")?.value;
  const requiredField = document.querySelector("#docRequiredField")?.value.trim();
  const consentReview = document.querySelector("#docConsentReview")?.checked;
  const consentVersion = document.querySelector("#docConsentVersion")?.checked;
  const consentSignature = document.querySelector("#docConsentSignature")?.checked;
  const consentContract = document.querySelector("#docConsentContract")?.checked;
  const consentRisk = document.querySelector("#docConsentRisk")?.checked;
  const consentParq = document.querySelector("#docConsentParq")?.checked;
  const signatureDrawing = signatureDrafts[documentId];
  const stateBefore = getState();
  const docBefore = stateBefore.documents.find((item) => item.id === documentId);
  const missing = missingRequiredDocumentFields();

  if (missing.length) return showSignatureValidation(`Faltan campos obligatorios: ${missing.join(", ")}`);
  if (!docBefore?.formDraft || !Object.keys(docBefore.formDraft).length) return toast("Completa y revisa los datos antes de firmar.");
  if (docBefore.templateId === "tk-service-terms" && !docBefore.generatedDraftHash) {
    return showSignatureValidation("Primero revisa la copia PDF cumplimentada generada para esta version.");
  }
  if (!requiredField) return toast("Escribe el nombre completo del firmante.");
  if (!consentReview || !consentVersion || !consentSignature) return toast("Acepta las casillas obligatorias.");
  if (docBefore?.templateId === "tk-service-terms" && (!consentContract || !consentRisk || !consentParq)) {
    return toast("Acepta contrato, Anexo 1 y Anexo 2 PAR-Q.");
  }
  if (!signatureDrawing) return toast("Dibuja la firma simulada.");

  const fieldValues = collectDocumentFieldValues() || docBefore.formDraft;
  const finalize = async () => {
    let finalPdf = null;
    if (docBefore.templateId === "tk-service-terms") {
      finalPdf = await generateContractActivityPdf({
        document: { ...docBefore, formDraft: fieldValues },
        state: stateBefore,
        centers,
        groups,
        trainingKidsPlans,
        signatureDrawing,
        signed: true,
      });
    }

  adapter.mutate((state) => {
    const doc = state.documents.find((item) => item.id === documentId);
    const signer = state.family.tutors.find((tutor) => tutor.id === signerId) || state.family.tutors[0];
    if (!doc || doc.status === "signed") return;
    const signedAt = new Date().toISOString();
    const template = documentTemplates.find((item) => item.id === doc.templateId);
    const source = template?.sourceId ? legalDocumentSources.find((item) => item.id === template.sourceId) : null;
    const hashSeed = `${doc.id}-${doc.version}-${signer.id}-${signedAt}`;
    const simulatedHash = finalPdf?.hash || `SIM-${Math.abs(hashSeed.split("").reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)).toString(16).toUpperCase()}`;

    doc.formDraft = fieldValues;
    syncSharedChildDataFromDocument(state, doc, fieldValues);
    doc.status = "signed";
    doc.signedAt = signedAt;
    if (finalPdf) {
      doc.finalPdfDataUrl = finalPdf.dataUrl;
      doc.finalPdfHash = finalPdf.hash;
      doc.generatedDraftPdf = "";
      doc.generatedDraftHash = "";
      doc.requiresTeamReview = finalPdf.data.hasParqAlert;
    }
    state.signingDocumentId = "";
    state.documentFlowSteps = { ...(state.documentFlowSteps || {}), [documentId]: "signed" };
    doc.completedSnapshot = {
      documentId: doc.id,
      templateId: doc.templateId,
      sourceId: template?.sourceId || "",
      title: template?.title || doc.id,
      version: doc.version,
      effectiveDate: doc.effectiveDate,
      documentText: source?.text || "",
      pdfDataUrl: finalPdf?.dataUrl || "",
      pdfHash: finalPdf?.hash || "",
      generatedData: finalPdf?.data || doc.generatedDraftData || null,
      fieldValues,
      lockedAt: signedAt,
    };
    doc.evidence = {
      evidenceId: `EV-SIM-${Date.now()}`,
      documentId: doc.id,
      version: doc.version,
      signerTutorId: signer.id,
      signerTutorName: signer.name,
      childId: doc.childId,
      enrollmentId: doc.enrollmentId,
      signedAt,
      status: "Firmado",
      acceptedConsents: doc.templateId === "tk-service-terms"
        ? ["lectura-completa", `version-${doc.version}`, "contrato-actividad", "anexo-1-riesgos", "anexo-2-parq", "firma-simulada"]
        : ["lectura-completa", `version-${doc.version}`, "firma-simulada", fieldValues.imageAuthorization?.value ? `imagen-${fieldValues.imageAuthorization.value}` : ""].filter(Boolean),
      documentHash: simulatedHash,
      signatureName: requiredField,
      signatureDrawing,
    };

    const childName = state.family.children.find((child) => child.id === doc.childId)?.name || "cuenta familiar";
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: signer.name,
      action: `Firma simulada registrada en ${doc.id} para ${childName}`,
      service: serviceName(services, doc.service),
    });
  });
  window.setTimeout(() => toast("Firma simulada registrada."), 100);
  };
  finalize().catch((error) => showSignatureValidation(`No se pudo cerrar la copia firmada: ${error.message}`));
}

function syncSharedChildDataFromDocument(state, doc, fieldValues = {}) {
  const child = state.family.children.find((item) => item.id === doc.childId);
  if (!child) return;
  if (doc.templateId === "tk-service-terms" && fieldValues.medicalAdditional?.value) {
    child.medical = fieldValues.medicalAdditional.value;
  }
  if (doc.templateId === "tk-service-terms" && fieldValues.emergencySummary?.value) {
    const [name, phone] = fieldValues.emergencySummary.value.split(" - ");
    if (name?.trim()) child.emergencyName = name.trim();
    if (phone?.trim()) child.emergencyPhone = phone.trim();
  }
}

function simulateTutor() {
  adapter.mutate((state) => {
    state.family.tutors.push({
      id: `t-${Date.now()}`,
      name: "Tutor autorizado",
      relationship: "Autorizado",
      email: "autorizado@example.com",
      phone: "622 333 444",
      canSign: false,
      canPay: false,
    });
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Familia",
      action: "Tutor simulado añadido",
      service: "Plataforma",
    });
  });
}

function simulateChild() {
  if (adapter.isRemote) {
    const id = `draft-${Date.now()}`;
    adapter.mutate((state) => {
      state.family.children.push({
        id,
        name: "",
        birthDate: "",
        team: "",
        medical: "",
        emergencyName: state.family.tutors[0]?.name || "",
        emergencyPhone: state.family.phone || "",
        availability: [],
        isDraft: true,
      });
      state.selectedChildId = id;
    });
    return;
  }
  adapter.mutate((state) => {
    const id = `child-${Date.now()}`;
    state.family.children.push({
      id,
      name: "Nuevo hijo",
      birthDate: "2018-01-01",
      team: "",
      medical: "",
      emergencyName: state.family.tutors[0].name,
      emergencyPhone: state.family.phone,
      availability: [],
    });
    state.selectedChildId = id;
    state.audit.unshift({
      id: `a-${Date.now()}`,
      date: new Date().toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
      actor: "Familia",
      action: "Hijo simulado añadido",
      service: "Plataforma",
    });
  });
}

function render() {
  const app = document.querySelector("#app");
  const state = getState();

  if (state.uiLoading) {
    app.innerHTML = renderLoading(appConfig.isSupabaseTest ? "Conectando con Supabase" : "Verificando codigo", appConfig.isSupabaseTest);
    return;
  }

  if (!state.session) {
    app.innerHTML = renderAuth({ state, testCode: TEST_CODE, appConfig });
    return;
  }

  const context = {
    state,
    steps,
    stepLabels,
    services,
    centers: state.remoteCatalog?.centers || centers,
    groups: state.remoteCatalog?.groups || groups,
    trainingKidsPlans: state.remoteCatalog?.plans || trainingKidsPlans,
    documentTemplates,
    legalDocumentSources,
  };
  if (state.activeView === "admin" && (state.appMode === "demo" || state.session?.isAdmin)) app.innerHTML = appChrome({ state, content: renderAdmin(context) });
  else if (state.activeView === "admin") app.innerHTML = appChrome({ state, content: renderFamily(context) });
  else if (state.activeView === "documents") app.innerHTML = appChrome({ state, content: renderDocuments(context) });
  else if (state.activeView === "payments") app.innerHTML = appChrome({ state, content: renderPayments(context) });
  else if (state.activeView === "design") app.innerHTML = appChrome({ state, content: renderDesign(context) });
  else app.innerHTML = appChrome({ state, content: renderFamily(context) });
  initializeDocumentReview();
}

window.setState = setState;
window.updateFamily = updateFamily;
window.saveFamilyDetails = saveFamilyDetails;
window.login = login;
window.requestLoginLink = requestLoginLink;
window.changeLoginEmail = changeLoginEmail;
window.logout = logout;
window.nextStep = nextStep;
window.prevStep = prevStep;
window.updateChild = updateChild;
window.saveSelectedChild = saveSelectedChild;
window.selectService = selectService;
window.saveTrainingEnrollment = saveTrainingEnrollment;
window.assignGroup = assignGroup;
window.reviewEnrollment = reviewEnrollment;
window.approveEnrollment = approveEnrollment;
window.requestEnrollmentChanges = requestEnrollmentChanges;
window.rejectEnrollment = rejectEnrollment;
window.setAdminGroupDraft = setAdminGroupDraft;
window.setAdminReviewNote = setAdminReviewNote;
window.activateEnrollment = activateEnrollment;
window.withdrawEnrollment = withdrawEnrollment;
window.confirmAdminAction = confirmAdminAction;
window.cancelAdminAction = cancelAdminAction;
window.simulatePayment = simulatePayment;
window.simulateTrainingKidsPayment = simulateTrainingKidsPayment;
window.markFootballInterest = markFootballInterest;
window.openDocument = openDocument;
window.setDocumentStep = setDocumentStep;
window.continueDocumentReview = continueDocumentReview;
window.startDocumentSignature = startDocumentSignature;
window.markDocumentReadIfBottom = markDocumentReadIfBottom;
window.saveDocumentDraft = saveDocumentDraft;
window.startSignatureDraw = startSignatureDraw;
window.drawSignature = drawSignature;
window.endSignatureDraw = endSignatureDraw;
window.clearSignaturePad = clearSignaturePad;
window.confirmSimulatedSignature = confirmSimulatedSignature;
window.simulateTutor = simulateTutor;
window.simulateChild = simulateChild;

window.addEventListener("beforeunload", (event) => {
  if (!getState().formDirty) return;
  event.preventDefault();
  event.returnValue = "";
});

render();
