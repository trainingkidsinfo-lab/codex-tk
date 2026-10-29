# Fase K1 - Herramientas (etapa 1)

## Decision aplicada

D2, decidida el 2026-10-29: K1, mejorar la app actual con Vite y TypeScript poco a poco, sin rehacer las pantallas. Esta primera etapa solo cambia herramientas. Ni las pantallas ni Supabase cambian.

## Que cambia

- **Node 22** instalado en el equipo de desarrollo con Homebrew (`node@22`). Hasta ahora las pruebas se ejecutaban en el navegador con sustitutos; ahora se ejecuta `npm test` de verdad.
- **Vite** abre la app en `http://127.0.0.1:4181`, el mismo origen de antes, asi que no cambian los enlaces de acceso de Supabase ni los origenes permitidos de `prepare-family-access`.
  - Se retiran los sufijos `?v=j1`: Vite gestiona la cache y Chrome deja de usar archivos viejos.
  - `npm run build` genera `dist/` con nombres de archivo con huella, lista para publicar en la Fase M.
- **Configuracion** en `.env.local` (ignorado por Git), con `VITE_TK_MODE`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Plantilla en `.env.example`. Solo las variables `VITE_` llegan al navegador. `config.local.js` deja de cargarse y puede borrarse.
- **supabase-js** se instala con npm en la version exacta `2.103.0` y ya no se descarga de `esm.sh` al abrir la app. Sigue cargandose solo en modo test.
- Archivos estaticos (logos, paginas del contrato y documentos originales) movidos a `public/`. Sus direcciones no cambian.
- **TypeScript** comprueba el JavaScript actual (`checkJs`) en modo no estricto. Se corrigieron los 87 avisos iniciales:
  - campos de formulario leidos con `ui/dom.js` (`inputAt`, `inputsAt`);
  - tipos globales en `types/globals.d.ts`;
  - parametros que nunca se usaban, eliminados (`renderDesign`, `renderAdminDocuments`, `renderDocumentActionPanel`, `getGroupRequirement`, `nextStepText`);
  - errores con codigo creados con `Object.assign`.
- **ESLint** con las reglas recomendadas. Se retiro la funcion `addAudit`, que no se usaba.
- **GitHub Actions** (`.github/workflows/check.yml`) ejecuta en cada PR y en `main` el revisor, los tipos, las pruebas y la compilacion, y comprueba que la compilacion no contiene una clave de servicio.

## Comandos

| Comando | Que hace |
| --- | --- |
| `npm install` | Instala las herramientas (solo la primera vez o si cambian). |
| `npm run dev` | Abre la app en `127.0.0.1:4181`. |
| `npm run check` | Revisor, tipos, pruebas y compilacion. |
| `npm run build` / `npm run preview` | Compila en `dist/` y la sirve. |

## Verificacion (2026-10-29)

- `npm run check` sin errores: revisor limpio, tipos sin errores y 66 de 66 pruebas correctas con Node 22.23.4.
- Con Node real aparecio un fallo que el sustituto del navegador no detectaba. La prueba "si falla la subida no se registra la firma" comparaba un objeto de error con una expresion regular. Se ha corregido la prueba; la app ya se comportaba bien.
- App con Vite (servidor de desarrollo y version compilada), en un puerto temporal:
  - modo demo: acceso con `123456`, logo, paginas del contrato y PDF originales cargan; el PDF del contrato se genera;
  - modo test: carga supabase-js desde npm, lee `.env.local`, conecta con el proyecto de pruebas y muestra el acceso por enlace, sin errores en consola.
- La compilacion no contiene claves de servicio.

## Siguientes etapas de K1

2. Pasar a TypeScript la capa de datos (`data/`) con tipos generados desde Supabase.
3. Dividir `app.js` (unas 1.400 lineas) por areas, retirar los `onclick` que dependen de `window` y activar el modo estricto.
