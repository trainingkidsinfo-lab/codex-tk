import assert from "node:assert/strict";
import { cleanAuthReturnHref, parseAuthReturn } from "../data/supabase-adapter.ts";

const implicitReturn = "http://127.0.0.1:4181/?mode=test#access_token=test-token&expires_in=3600&refresh_token=test-refresh&type=magiclink";
const parsedImplicit = parseAuthReturn(implicitReturn);

assert.equal(parsedImplicit.present, true);
assert.equal(parsedImplicit.error, "");
assert.equal(cleanAuthReturnHref(implicitReturn), "/?mode=test");

const errorReturn = "http://127.0.0.1:4181/?mode=test&error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid";
const parsedError = parseAuthReturn(errorReturn);

assert.equal(parsedError.present, true);
assert.equal(parsedError.errorCode, "otp_expired");
assert.equal(parsedError.error, "Email link is invalid");
assert.equal(cleanAuthReturnHref(errorReturn), "/?mode=test");

assert.equal(parseAuthReturn("http://127.0.0.1:4181/?mode=test").present, false);

console.log("Auth callback tests passed.");
