export function createFootballAcademyEnrollment({ childId }) {
  return {
    id: `pre-${Date.now()}`,
    childId,
    service: "football_academy",
    status: "Interes/prealta",
    docs: "No requerido aun",
    payment: "No requerido aun",
    groupId: "",
    planId: "",
    centerId: "gym-home",
    operationalStatus: "draft",
  };
}

export function footballAcademyButtonLabel() {
  return "Solicitar informacion";
}
