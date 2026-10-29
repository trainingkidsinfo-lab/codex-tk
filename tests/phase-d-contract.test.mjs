import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../supabase/migrations/202609230001_phase_d_family_operations.sql", import.meta.url), "utf8");
const adapter = readFileSync(new URL("../data/supabase-adapter.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

for (const rpc of ["family_update_details", "family_save_player", "family_submit_enrollment", "admin_review_enrollment"]) {
  assert.match(migration, new RegExp(`create or replace function public\\.${rpc}`));
  assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}`));
  assert.match(adapter, new RegExp(`rpc\\("${rpc}"`));
}
assert.match(migration, /security definer/g);
assert.match(migration, /public\.current_family_id\(\)/);
assert.match(migration, /not pp\.admin_only/);
assert.match(migration, /if not public\.is_admin\(\)/);
assert.match(migration, /revoke insert, update on public\.enrollments from authenticated/);
assert.doesNotMatch(migration, /@[a-z0-9.-]+\.[a-z]{2,}/i);
assert.doesNotMatch(migration, /service_role|sb_secret_/i);
assert.match(adapter, /operationsInFlight\.has\(key\)/);
assert.match(app, /adapter\.isRemote/);
assert.match(app, /translateDataError/);

console.log("Phase D security contract tests passed.");
