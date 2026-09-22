export function loadAppConfig() {
  const runtime = globalThis.window?.TK_CONFIG || {};
  const params = new URLSearchParams(globalThis.location?.search || "");
  const mode = params.get("mode") || runtime.mode || "demo";
  return {
    mode,
    supabaseUrl: runtime.supabaseUrl || "",
    supabaseAnonKey: runtime.supabaseAnonKey || "",
    isDemo: mode === "demo",
    isSupabaseTest: mode === "test",
  };
}

export function assertSupabaseConfig(config) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Falta configurar Supabase: supabaseUrl y supabaseAnonKey.");
  }
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(config.supabaseUrl)) {
    throw new Error("La URL publica de Supabase no es valida.");
  }
  if (!config.supabaseAnonKey.startsWith("sb_publishable_")) {
    throw new Error("Configura exclusivamente la publishable key de Supabase.");
  }
}
