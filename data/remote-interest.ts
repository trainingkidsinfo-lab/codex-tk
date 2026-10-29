// Prealtas de servicios en lanzamiento (Fase I). Sin dependencias de navegador.

import type { Tables } from "./database.types.ts";
import { asErrorLike } from "./errors.ts";

export type InterestRow = Pick<
  Tables<"service_interest_requests">,
  "id" | "family_id" | "player_id" | "service_id" | "status" | "notes" | "admin_notes" | "contacted_at" | "closed_at" | "created_at"
>;

export const INTEREST_COLUMNS = "id,family_id,player_id,service_id,status,notes,admin_notes,contacted_at,closed_at,created_at";

export const INTEREST_STATUS_LABELS: Record<string, string> = {
  received: "Prealta recibida",
  contacted: "Familia contactada",
  closed: "Prealta cerrada",
};

// Se presenta como una tarjeta mas del hijo, igual que en el modo demo, pero marcada como prealta
// para que nunca entre en documentos, pagos ni activacion.
export function mapInterestToEnrollment(row: InterestRow) {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.player_id,
    service: row.service_id,
    status: INTEREST_STATUS_LABELS[row.status] || row.status,
    docs: "No requerido",
    payment: "No requerido",
    groupId: "",
    planId: "",
    centerId: "",
    operationalStatus: "draft",
    interest: true,
    interestStatus: row.status,
    notes: row.notes || "",
    adminNotes: row.admin_notes || "",
    createdAt: row.created_at,
    remote: true,
  };
}

export function isMissingRelation(error: unknown): boolean {
  return ["42P01", "PGRST205", "PGRST200"].includes(asErrorLike(error).code || "");
}
