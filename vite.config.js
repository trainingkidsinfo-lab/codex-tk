import { defineConfig } from "vite";

// Mismo origen que usaba el servidor de Python: los enlaces de acceso de Supabase
// y los origenes permitidos de prepare-family-access apuntan a 127.0.0.1:4181.
const server = { host: "127.0.0.1", port: 4181, strictPort: true };

export default defineConfig({
  server,
  preview: server,
  // Solo las variables VITE_ llegan al navegador.
  envPrefix: "VITE_",
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: false,
    // public/assets ya existe (logos y paginas del contrato); el codigo compilado va aparte.
    assetsDir: "build",
  },
});
