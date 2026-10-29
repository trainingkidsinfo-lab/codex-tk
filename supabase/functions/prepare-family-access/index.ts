// prepare-family-access (Fase J): alta de familias y tutores desde administracion.
//
// - Solo administracion puede llamarla: se comprueba el JWT del usuario y su rol con is_admin().
// - La clave de servicio la inyecta Supabase en el entorno de la funcion. Nunca sale de aqui.
// - Aqui solo se crea, si hace falta, el usuario de Auth (confirmado, sin contrasena). El resto
//   (familia, perfil, miembro, rol y auditoria) lo hace service_prepare_family_access en una
//   sola transaccion.
// - No envia correos: el tutor entra pidiendo su enlace en la pantalla de acceso.
import { createClient } from "npm:@supabase/supabase-js@2.103.0";

const DEFAULT_ORIGINS = ["http://127.0.0.1:4181", "http://localhost:4181", "http://localhost:4174"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const STATUS_BY_ERROR: Record<string, number> = {
  method_not_allowed: 405,
  authentication_required: 401,
  admin_access_required: 403,
  server_configuration_missing: 500,
};

function allowedOrigins(): string[] {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((item) => item.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_ORIGINS;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  return {
    "Access-Control-Allow-Origin": origin && allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function reply(origin: string | null, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function fail(code: string): never {
  throw new Error(code);
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  try {
    if (request.method !== "POST") fail("method_not_allowed");
    const authorization = request.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceKey) fail("server_configuration_missing");
    if (!authorization.startsWith("Bearer ")) fail("authentication_required");

    // 1. Quien llama, con su propio token y las reglas RLS normales.
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) fail("authentication_required");
    const { data: isAdmin, error: roleError } = await caller.rpc("is_admin");
    if (roleError || isAdmin !== true) fail("admin_access_required");

    // 2. Datos de entrada.
    const payload = await request.json().catch(() => ({}));
    const email = String(payload.email || "").trim().toLowerCase();
    const familyName = String(payload.familyName || "").trim();
    const familyId = payload.familyId ? String(payload.familyId) : null;
    if (!EMAIL_PATTERN.test(email) || email.length > 254) fail("email_invalid");
    if (familyId && !UUID_PATTERN.test(familyId)) fail("family_not_found");
    if (!familyId && !familyName) fail("family_name_required");
    if (familyName.length > 120) fail("family_name_too_long");

    // 3. Usuario de Auth: se reutiliza si existe; si no, se crea confirmado y sin contrasena.
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existingUserId, error: lookupError } = await admin.rpc("service_lookup_auth_user", { p_email: email });
    if (lookupError) throw lookupError;
    let authUserId = existingUserId as string | null;
    let createdUser = false;
    if (!authUserId) {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (error) throw error;
      authUserId = data.user.id;
      createdUser = true;
    }

    // 4. Familia, perfil, miembro, rol y auditoria en una sola transaccion.
    const { data: result, error: linkError } = await admin.rpc("service_prepare_family_access", {
      p_actor_user_id: authData.user.id,
      p_auth_user_id: authUserId,
      p_email: email,
      p_family_name: familyName || null,
      p_family_id: familyId,
    });
    if (linkError) {
      // Si el usuario se acaba de crear y la vinculacion falla, se borra para no dejarlo huerfano.
      if (createdUser) await admin.auth.admin.deleteUser(authUserId);
      throw linkError;
    }

    return reply(origin, 200, { ok: true, createdUser, ...result });
  } catch (error) {
    const code = String((error as Error)?.message || "unknown_error");
    console.error("prepare-family-access failed", { code });
    return reply(origin, STATUS_BY_ERROR[code] || 400, { ok: false, error: code });
  }
});
