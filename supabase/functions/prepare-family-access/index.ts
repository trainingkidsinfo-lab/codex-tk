import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!authorization || !supabaseUrl || !anonKey || !serviceKey) throw new Error("server_configuration_missing");

    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) throw new Error("authentication_required");
    const { data: role } = await caller.from("user_roles").select("role").eq("user_id", authData.user.id).in("role", ["admin", "owner"]).maybeSingle();
    if (!role) throw new Error("admin_access_required");

    const payload = await request.json();
    const email = String(payload.email || "").trim().toLowerCase();
    const familyName = String(payload.familyName || "").trim();
    const existingFamilyId = payload.familyId ? String(payload.familyId) : null;
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("email_invalid");
    if (!existingFamilyId && !familyName) throw new Error("family_name_required");

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    let familyId = existingFamilyId;
    if (!familyId) {
      const { data: family, error } = await admin.from("families").insert({ name: familyName, email }).select("id").single();
      if (error) throw error;
      familyId = family.id;
    }

    const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    let userId = existingProfile?.id;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: false });
      if (error) throw error;
      userId = data.user.id;
      const { error: profileError } = await admin.from("profiles").upsert({ id: userId, email, full_name: email, active: true });
      if (profileError) throw profileError;
    }

    const { error: memberError } = await admin.from("family_members").upsert({
      family_id: familyId,
      user_id: userId,
      email,
      relationship: "Tutor",
      status: "active",
      joined_at: new Date().toISOString(),
    }, { onConflict: "family_id,email" });
    if (memberError) throw memberError;
    const { data: existingRole } = await admin.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "family").eq("family_id", familyId).maybeSingle();
    if (!existingRole) {
      const { error: roleError } = await admin.from("user_roles").insert({ user_id: userId, role: "family", family_id: familyId });
      if (roleError) throw roleError;
    }

    return new Response(JSON.stringify({ ok: true, familyId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("prepare-family-access failed", { message: error?.message });
    return new Response(JSON.stringify({ ok: false, error: error?.message || "unknown_error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
