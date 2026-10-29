// Vite sustituye estas variables al arrancar o compilar. Solo llegan al navegador las que empiezan por VITE_.
// Fuera de Vite (pruebas con Node) no existen y se usa window.TK_CONFIG si alguien lo define.
const viteEnv = /** @type {Partial<ImportMetaEnv>} */ (import.meta.env || {});

/** @param {Partial<ImportMetaEnv>} [env] */
export function loadAppConfig(env = viteEnv) {
  const runtime = globalThis.window?.TK_CONFIG || {};
  const params = new URLSearchParams(globalThis.location?.search || "");
  const mode = params.get("mode") || env.VITE_TK_MODE || runtime.mode || "demo";
  return {
    mode,
    supabaseUrl: env.VITE_SUPABASE_URL || runtime.supabaseUrl || "",
    supabaseAnonKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || runtime.supabaseAnonKey || "",
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
