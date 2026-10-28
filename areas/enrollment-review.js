export const ENROLLMENT_REVIEW = Object.freeze({
  approve: Object.freeze({
    remoteDecision: "approve",
    reviewStatus: "approved",
    confirmation: "¿Aprobar esta solicitud?",
    detail: "Se registrará la aprobación y, si has elegido grupo, su asignación.",
    successMessage: "Solicitud aprobada.",
    requiresNotes: false,
  }),
  request_changes: Object.freeze({
    remoteDecision: "request_changes",
    reviewStatus: "changes_requested",
    confirmation: "¿Solicitar cambios a la familia?",
    detail: "La familia verá tus observaciones en el estado de la solicitud.",
    successMessage: "Cambios solicitados a la familia.",
    requiresNotes: true,
  }),
  reject: Object.freeze({
    remoteDecision: "reject",
    reviewStatus: "rejected",
    confirmation: "¿Rechazar esta solicitud?",
    detail: "La solicitud quedará cerrada como baja.",
    successMessage: "Solicitud rechazada.",
    requiresNotes: false,
  }),
});

export function getEnrollmentReview(decision) {
  if (!Object.hasOwn(ENROLLMENT_REVIEW, decision)) throw new Error(`Decisión administrativa no válida: ${decision}`);
  return ENROLLMENT_REVIEW[decision];
}
