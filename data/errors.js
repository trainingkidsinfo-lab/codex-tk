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
  [/signature_schema_missing/i, "La firma remota estará disponible cuando se aplique la migración de la Fase F en el proyecto de pruebas."],
  [/signer_not_allowed/i, "Tu usuario no está autorizado para firmar documentos de esta familia."],
  [/enrollment_not_signable/i, "Esta inscripción ya no admite firmas."],
  [/document_version_not_signable/i, "Esta versión del documento no se puede firmar."],
  [/signer_name_required/i, "Escribe el nombre completo del firmante."],
  [/completed_data_invalid/i, "Faltan los datos completados del documento."],
  [/consents_missing/i, "Faltan aceptaciones obligatorias para firmar."],
  [/image_decision_required/i, "Indica si autorizas o no el uso de imagen."],
  [/signature_hash_invalid|signed_pdf_required|signature_file_missing/i, "No se pudo guardar la copia firmada. Vuelve a intentarlo."],
  [/document_already_signed/i, "Este documento ya está firmado."],
  [/payment_schema_missing/i, "Los pagos de prueba estarán disponibles cuando se aplique la migración de la Fase G."],
  [/payment_already_paid/i, "Este pago ya está confirmado y no se puede cambiar."],
  [/payment_closed/i, "Este pago está cancelado. Prepara un pago nuevo si hace falta."],
  [/payment_result_unchanged/i, "El pago ya tiene ese estado."],
  [/payment_result_invalid/i, "Resultado de pago no válido."],
  [/payment_not_found/i, "No se encontró el pago."],
  [/plan_price_missing/i, "La inscripción no tiene una tarifa válida para preparar el pago."],
  [/enrollment_not_approved/i, "La solicitud debe estar aprobada para preparar el pago."],
  [/enrollment_not_payable/i, "Esta inscripción está dada de baja y no admite pagos."],
  [/operations_schema_missing/i, "Activar, asignar grupo y dar de baja estarán disponibles cuando se aplique la migración de la Fase H."],
  [/enrollment_not_ready: (.+)/i, (match) => `No se puede activar todavía. ${match[1]}.`],
  [/group_full/i, "El grupo ya está lleno."],
  [/enrollment_withdrawn/i, "Esta inscripción está dada de baja."],
  [/interest_schema_missing/i, "La prealta estará disponible cuando se aplique la migración de la Fase I."],
  [/service_not_in_prelaunch/i, "Este servicio no admite prealtas ahora mismo."],
  [/interest_closed/i, "Esta prealta ya está cerrada."],
  [/interest_not_found/i, "No se encontró la prealta."],
  [/notes_too_long/i, "El texto es demasiado largo."],
  [/duplicate key|unique constraint/i, "Ya existe un registro equivalente."],
  [/failed to fetch|network/i, "No se pudo conectar. Comprueba tu conexión y vuelve a intentarlo."],
];

export function translateDataError(error, fallback = "No se pudo guardar el cambio. Vuelve a intentarlo.") {
  const technical = String(error?.message || error || "");
  const entry = ERROR_MESSAGES.find(([pattern]) => pattern.test(technical));
  if (!entry) return fallback;
  const [pattern, message] = entry;
  return typeof message === "function" ? message(technical.match(pattern)) : message;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
