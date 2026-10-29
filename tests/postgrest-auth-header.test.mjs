import assert from "node:assert/strict";
import { createAuthenticatedFetch } from "../data/supabase-adapter.ts";

const projectUrl = "https://project-ref.supabase.co";
const sessionToken = "eyJhbGciOiJFUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature";
let receivedAuthorization = "";
let diagnostic = null;

const authenticatedFetch = createAuthenticatedFetch({
  projectUrl,
  getToken: () => sessionToken,
  fetchImpl: async (_input, init) => {
    receivedAuthorization = new Headers(init.headers).get("Authorization");
    return new Response(JSON.stringify({ code: "PGRST303", message: "JWT claims validation failed" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  },
  onDiagnostic: (value) => { diagnostic = value; },
});

await authenticatedFetch(`${projectUrl}/rest/v1/profiles?select=id`, {
  headers: { Authorization: "Bearer sb_publishable_public-key" },
});

assert.equal(receivedAuthorization, `Bearer ${sessionToken}`);
assert.equal(diagnostic.code, "PGRST303");
assert.equal(diagnostic.authorization, "session_jwt");
assert.equal(diagnostic.projectHost, "project-ref.supabase.co");
assert.equal(JSON.stringify(diagnostic).includes(sessionToken), false);

console.log("PostgREST authenticated header regression test passed.");
