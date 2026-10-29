// Tipos globales mientras la app siga en JavaScript con comprobacion de tipos.

interface ImportMetaEnv {
  readonly VITE_TK_MODE?: "demo" | "test";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface Window {
  /** Configuracion antigua (config.local.js). Solo se usa si no hay variables VITE_. */
  TK_CONFIG?: { mode?: string; supabaseUrl?: string; supabaseAnonKey?: string };
  /**
   * Las pantallas llaman a las acciones desde onclick="..." y app.js las publica en window.
   * Se retirara al ordenar app.js (etapa 3 de K1).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [action: string]: any;
}
