import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getEnrollmentReview } from "../areas/enrollment-review.js";

const cases = [
  ["approve", "approved", "Solicitud aprobada."],
  ["request_changes", "changes_requested", "Cambios solicitados a la familia."],
  ["reject", "rejected", "Solicitud rechazada."],
];

for (const [decision, status, message] of cases) {
  test(`${decision} conserva su decisión, estado y mensaje`, () => {
    const review = getEnrollmentReview(decision);
    assert.equal(review.remoteDecision, decision);
    assert.equal(review.reviewStatus, status);
    assert.equal(review.successMessage, message);
  });
}

test("los tres botones llaman a manejadores distintos", async () => {
  const source = await readFile(new URL("../areas/admin.js", import.meta.url), "utf8");
  assert.match(source, /data-review-decision="approve" onclick="approveEnrollment/);
  assert.match(source, /data-review-decision="request_changes" onclick="requestEnrollmentChanges/);
  assert.match(source, /data-review-decision="reject" onclick="rejectEnrollment/);
});

test("una decisión desconocida se rechaza", () => {
  assert.throws(() => getEnrollmentReview("approve_everything"), /no válida/);
});
