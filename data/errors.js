const ERROR_MESSAGES = [
  [/family_access_denied|row-level security/i, "No tienes permiso para acceder a esta familia."],
  [/player_access_denied/i, "No tienes permiso para modificar este hijo."],
  [/family_name_required/i, "Indica el nombre de la familia."],
  [/player_name_required/i, "Indica el nombre y los apellidos del niño."],
  [/player_birth_date_invalid/i, "Revisa la fecha de nacimiento."],
  [/service_not_available/i, "Este servicio todavía no admite solicitudes."],
  [/location_not_available/i, "El centro seleccionado no está disponible."],
  [/season_not_available/i, "No hay una temporada activa para esta solicitud."],
  [/plan_not_available/i, "La tarifa seleccionada no está disponible."],
  [/group_not_available/i, "El grupo no es válido o ya no tiene plazas."],
  [/admin_access_required/i, "Esta acción está reservada a administración."],
  [/enrollment_not_found/i, "No se encontró la inscripción."],
  [/duplicate key|unique constraint/i, "Ya existe un registro equivalente."],
  [/failed to fetch|network/i, "No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo."],
];

export function translateDataError(error, fallback = "No se pudo guardar el cambio. Vuelve a intentarlo.") {
  const technical = String(error?.message || error || "");
  return ERROR_MESSAGES.find(([pattern]) => pattern.test(technical))?.[1] || fallback;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
