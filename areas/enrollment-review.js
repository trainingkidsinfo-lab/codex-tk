export const ENROLLMENT_REVIEW = Object.freeze({
  approve: Object.freeze({
    remoteDecision: "approve",
    reviewStatus: "approved",
    confirmation: "¿Aprobar esta solicitud?",
    successMessage: "Solicitud aprobada.",
    requiresNotes: false,
  }),
  request_changes: Object.freeze({
    remoteDecision: "request_changes",
    reviewStatus: "changes_requested",
    confirmation: "¿Solicitar cambios a la familia?",
    successMessage: "Cambios solicitados a la familia.",
    requiresNotes: true,
  }),
  reject: Object.freeze({
    remoteDecision: "reject",
    reviewStatus: "rejected",
    confirmation: "¿Rechazar esta solicitud?",
    successMessage: "Solicitud rechazada.",
    requiresNotes: false,
  }),
});

export function getEnrollmentReview(decision) {
  const review = ENROLLMENT_REVIEW[decision];
  if (!review) throw new Error(`Decisión administrativa no válida: ${decision}`);
  return review;
}
