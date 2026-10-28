import { centerName, planName, serviceName } from "../ui/shared.js?v=f1";

export const operationalStatusMeta = {
  draft: { label: "Borrador", tone: "" },
  pending: { label: "Pendiente de completar", tone: "yellow" },
  ready: { label: "Lista para activar", tone: "green" },
  active: { label: "Activa", tone: "turquoise" },
  withdrawn: { label: "Baja", tone: "red" },
};

export function operationalStatusLabel(status) {
  return operationalStatusMeta[status]?.label || status;
}

export function getEnrollmentOperationalSummary({ enrollment, state, services, centers, groups, trainingKidsPlans }) {
  const child = (state.adminChildren || state.family.children).find((item) => item.id === enrollment.childId);
  const family = state.adminFamilies?.find((item) => item.id === enrollment.familyId) || state.family;
  const payment = state.payments.find((item) => item.enrollmentId === enrollment.id);
  const group = groups.find((item) => item.id === enrollment.groupId);
  const personal = getPersonalRequirement({ family, child });
  const documents = getDocumentRequirement({ enrollment, state });
  const groupRequirement = getGroupRequirement({ enrollment, group, state, groups, centers });
  const paymentRequirement = getPaymentRequirement({ enrollment, payment });
  const validationNotes = getValidationNotes({ enrollment, state });
  const requirements = { personal, documents, group: groupRequirement, payment: paymentRequirement };
  const missing = Object.values(requirements).filter((item) => !item.complete).flatMap((item) => item.missing);
  const isReady = enrollment.service === "training_kids" && missing.length === 0;
  const storedStatus = enrollment.operationalStatus || "draft";
  const isActive = storedStatus === "active";
  const isWithdrawn = storedStatus === "withdrawn";
  const status = isWithdrawn ? "withdrawn" : isActive ? "active" : isReady ? "ready" : hasDraftSignals(enrollment) ? "pending" : "draft";
  const needsReview = isActive && missing.length > 0;

  return {
    enrollmentId: enrollment.id,
    service: enrollment.service,
    status,
    label: operationalStatusLabel(status),
    tone: operationalStatusMeta[status]?.tone || "",
    requirements,
    missing,
    validationNotes,
    needsReview,
    nextStep: nextStepText({ status, missing, validationNotes, enrollment, group, centers, groups, payment }),
    child,
    payment,
    group,
    serviceLabel: serviceName(services, enrollment.service),
    centerLabel: centerName(centers, enrollment.centerId || group?.centerId),
    planLabel: enrollment.planId ? planName(trainingKidsPlans, enrollment.planId) : "Pendiente",
  };
}

export function getGroupOccupancy({ group, state }) {
  const assigned = state.enrollments.filter((enrollment) => (
    enrollment.groupId === group.id && enrollment.operationalStatus !== "withdrawn"
  )).length;
  const occupied = Math.min(group.capacity, group.occupied + assigned);
  return {
    occupied,
    assigned,
    capacity: group.capacity,
    available: Math.max(0, group.capacity - occupied),
    full: occupied >= group.capacity,
  };
}

export function validateGroupAssignment({ enrollment, groupId, state, centers, groups }) {
  if (!groupId) return { ok: true };
  const group = groups.find((item) => item.id === groupId);
  if (!group) return { ok: false, reason: "El grupo seleccionado no existe." };
  if (group.service !== enrollment.service) return { ok: false, reason: "El grupo pertenece a otro servicio." };
  if (enrollment.centerId && group.centerId !== enrollment.centerId) {
    return { ok: false, reason: `El grupo no pertenece al centro ${centerName(centers, enrollment.centerId)}.` };
  }
  const duplicate = state.enrollments.some((item) => (
    item.id !== enrollment.id
    && item.childId === enrollment.childId
    && item.groupId === groupId
    && item.operationalStatus !== "withdrawn"
  ));
  if (duplicate) return { ok: false, reason: "Este hijo ya tiene una inscripcion en ese grupo." };
  const assignedByOthers = state.enrollments.filter((item) => (
    item.id !== enrollment.id && item.groupId === groupId && item.operationalStatus !== "withdrawn"
  )).length;
  if (group.occupied + assignedByOthers >= group.capacity) return { ok: false, reason: "El grupo ya esta lleno." };
  return { ok: true };
}

function getPersonalRequirement({ family, child }) {
  const missing = [];
  if (!family?.name?.trim()) missing.push("nombre familiar");
  if (!family?.phone?.trim()) missing.push("telefono familiar");
  if (!family?.address?.trim()) missing.push("direccion familiar");
  if (!family?.tutors?.some((tutor) => tutor.name?.trim() && tutor.email?.trim())) {
    missing.push("tutor con nombre, email y telefono");
  }
  if (!child?.name?.trim()) missing.push("nombre del hijo");
  if (!child?.birthDate?.trim()) missing.push("fecha de nacimiento");
  if (!child?.medical?.trim()) missing.push("informacion medica");
  if (!child?.emergencyName?.trim()) missing.push("contacto de emergencia");
  if (!child?.emergencyPhone?.trim()) missing.push("telefono de emergencia");
  return { complete: missing.length === 0, missing: missing.map((item) => `Datos: falta ${item}`) };
}

function getDocumentRequirement({ enrollment, state }) {
  if (enrollment.service !== "training_kids") return { complete: true, missing: [] };
  const mandatoryDocs = state.documents.filter((document) => (
    document.enrollmentId === enrollment.id
    && document.required === true
    && !document.archived
    && document.templateId === "tk-service-terms"
  ));
  if (!mandatoryDocs.length) return { complete: false, missing: ["Documentos: faltan documentos obligatorios de la inscripcion"] };
  const missing = mandatoryDocs
    .filter((document) => !["signed", "accepted"].includes(document.status))
    .map((document) => `Documentos: ${document.title || document.templateId || document.id} pendiente`);
  return { complete: missing.length === 0, missing };
}

function getGroupRequirement({ enrollment, group, state, groups, centers }) {
  if (enrollment.service !== "training_kids") return { complete: true, missing: [] };
  if (!enrollment.groupId) return { complete: false, missing: ["Grupo: pendiente de asignacion administrativa"] };
  const validation = validateGroupAssignment({ enrollment, groupId: enrollment.groupId, state, centers, groups });
  return validation.ok ? { complete: true, missing: [] } : { complete: false, missing: [`Grupo: ${validation.reason}`] };
}

function getPaymentRequirement({ enrollment, payment }) {
  if (enrollment.service !== "training_kids") return { complete: true, missing: [] };
  if (!payment) return { complete: false, missing: ["Pago: no existe pago inicial simulado"] };
  if (payment.status !== "paid") return { complete: false, missing: [`Pago: estado ${payment.status}`] };
  return { complete: true, missing: [] };
}

function getValidationNotes({ enrollment, state }) {
  return state.documents
    .filter((document) => document.enrollmentId === enrollment.id && !document.archived)
    .flatMap((document) => {
      const notes = [];
      if (document.status === "validation_pending" && document.templateId === "tk-service-terms") notes.push(`Pendiente de validacion: ${document.title || document.templateId || document.id}`);
      if (document.requiresTeamReview) notes.push(`Revision equipo: PAR-Q con respuesta afirmativa en ${document.title || document.templateId || document.id}`);
      return notes;
    });
}

function hasDraftSignals(enrollment) {
  return Boolean(enrollment.planId || enrollment.centerId || enrollment.status || enrollment.payment || enrollment.groupId);
}

function nextStepText({ status, missing, validationNotes, enrollment, group, centers }) {
  if (status === "withdrawn") return "Inscripcion dada de baja localmente por administracion.";
  if (status === "active") {
    if (missing.length) return `Administracion revisara: ${missing[0]}.`;
    return group ? `Inscripcion activa en ${centerName(centers, group.centerId)}, ${group.day} ${group.time}.` : "Inscripcion activa.";
  }
  if (status === "ready") return "Todo listo. Administracion puede activar la inscripcion.";
  if (enrollment.service !== "training_kids") return "Prealta informativa. Administracion contactara cuando abra la contratacion.";
  if (missing.length) return missing[0];
  if (validationNotes.length) return validationNotes[0];
  return "Completa los datos basicos para avanzar.";
}
