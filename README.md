# Training Kids Platform V1

Aplicacion nueva para la plataforma comun modular de Training Kids, Football Academy y futuro Gym Home.

## Estado

Fase C conectada al proyecto Supabase de pruebas. El modo demo conserva `localStorage` y el codigo `123456`. El modo test usa Supabase Auth, sesion persistente, roles y datos remotos. La vinculacion de usuarios, las comprobaciones RLS y el acceso visual familiar y administrativo se verificaron correctamente.

Fase D incorpora escrituras mediante RPC protegidas para datos familiares, hijos, salud, emergencia, solicitudes y revision administrativa. La migracion se aplico en el proyecto de pruebas. Se verificaron remotamente las escrituras familiares, la persistencia, el envio idempotente de solicitudes y el acceso administrativo, siempre sin fallback a demo. Consulta `docs/FASE_D_OPERATIVA.md`.

Fase C.1 usa temporalmente un magic link enviado por correo en modo test, compatible con la plantilla predeterminada de Supabase. La aplicacion estatica usa el flujo implicito del cliente oficial, procesa el retorno antes de limpiar la URL y conserva la sesion local. El retorno se realiza en `http://127.0.0.1:4181/?mode=test` y el reenvio queda bloqueado durante 60 segundos. El codigo OTP queda pendiente hasta disponer de SMTP corporativo.

Fase E sanea el frontend sin tocar Supabase: escapado sistematico de datos en plantillas, confirmacion en pagina para las decisiones administrativas, retirada de plantillas documentales obsoletas, `supabase-js` con version exacta y pruebas nuevas. Consulta `docs/FASE_E_SANEAMIENTO.md`.

Fase F prepara la firma remota: RPC `family_sign_document`, subida del PDF firmado y de la imagen de la firma a buckets privados, huellas SHA-256 y fin de la insercion directa de firmas por las familias. Aplicada y verificada con pruebas SQL en el proyecto de pruebas nuevo. Consulta `docs/FASE_F_FIRMA_REMOTA.md` y `docs/PROYECTO_PRUEBAS.md`.

Fase G prepara pagos de prueba sin Stripe: al aprobar una solicitud el servidor calcula el pago inicial con la tarifa y, una sola vez por familia, la matricula. Administracion registra pagado, fallido o cancelado con recibo de prueba. Consulta `docs/FASE_G_PAGOS.md`.

Fase H lleva al servidor la activacion: solo se activa una inscripcion con solicitud aprobada, datos completos, contrato firmado, grupo con plaza y pago confirmado. Incluye asignar grupo, dar de baja y la ocupacion de grupos. Consulta `docs/FASE_H_ESTADOS.md`.

Fase I guarda en el servidor la prealta de Football Academy, separada de las inscripciones y sin cobros. Administracion la marca como contactada o cerrada. Consulta `docs/FASE_I_PREALTA_FA.md`.

Fase J permite dar de alta familias y tutores desde el panel mediante la edge function `prepare-family-access`, que usa la clave de servicio solo dentro de Supabase. Consulta `docs/FASE_J_ALTA_FAMILIAS.md`.

Fase K1 (etapa 1) incorpora herramientas sin cambiar pantallas: Vite para abrir y compilar la app, comprobacion de tipos con TypeScript sobre el JavaScript actual, revisor de codigo ESLint y comprobaciones automaticas en GitHub. Consulta `docs/FASE_K1_HERRAMIENTAS.md`.

## Pruebas

Con Node 22.12 o superior, despues de `npm install`:

```bash
npm run check
```

Ejecuta el revisor de codigo, los tipos, las pruebas y la compilacion. Por separado: `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`. GitHub ejecuta lo mismo en cada PR.

## Como abrir

Desde esta carpeta:

```bash
npm run dev
```

Despues abrir el modo demo:

```text
http://127.0.0.1:4181/?mode=demo
```

Modo test:

```text
http://127.0.0.1:4181/?mode=test
```

`npm run build` deja la version compilada en `dist/` y `npm run preview` la sirve en la misma direccion.

## Acceso de prueba

Modo demo:

- Email: cualquiera.
- Codigo temporal: `123456`.
- Administracion: entrar primero y pulsar `Admin`.

Modo test Supabase:

- La URL y la publishable key de pruebas estan en `.env.local` (copia de `.env.example`), que permanece ignorado por Git.
- Abrir `http://127.0.0.1:4181/?mode=test` y solicitar el enlace de acceso por email.
- Abrir el enlace recibido en ese mismo navegador.
- Para salir, pulsar el boton `X` de la cabecera.
- El boton `Admin` solo aparece si el usuario tiene rol `admin` u `owner`.

## Estructura actual

```text
tk-platform-v1/
  index.html
  styles.css
  app.js
  data/
    mock-data.js
    local-adapter.js
    supabase-adapter.js
    remote-documents.js
    app-config.js
  supabase/
    migrations/
    seed/
    tests/
  areas/
    access.js
    family.js
    admin.js
    operational-status.js
    training-kids.js
    football-academy.js
    gym-home.js
    design.js
  ui/
    shared.js
    escape.js
    dom.js
  types/
    globals.d.ts
  public/
    assets/
    original-documents/
  docs/
  vite.config.js
  tsconfig.json
  eslint.config.js
  .github/workflows/check.yml
```

## Separacion por areas

- `data/mock-data.js`: familias, tutores, hijos, centros, grupos, tarifas e inscripciones ficticias.
- `data/local-adapter.js`: capa local de lectura/escritura. Hoy usa `localStorage`; mañana podra cambiarse por Supabase manteniendo las pantallas.
- `areas/access.js`: acceso familiar simulado por email y codigo temporal.
- `areas/family.js`: area privada familiar, alta paso a paso, hijos, salud, selector de servicios y estado.
- `areas/admin.js`: panel administrativo unico con filtros por servicio.
- `areas/operational-status.js`: calculo local de requisitos y estado operativo por inscripcion.
- `areas/training-kids.js`: modulo operativo principal de Training Kids.
- `areas/football-academy.js`: modulo visible de informacion/prealta.
- `areas/gym-home.js`: modulo futuro, sin contratacion ni reservas en esta fase.
- `areas/documents.js`: area documental y firma simulada preparada para adaptador real.
- `ui/shared.js`: piezas comunes reutilizables como cabecera, nombres, tarjetas de grupo y avisos.
- `data/remote-documents.js`: firma remota (subida de archivos, huellas y RPC) y mapeo de documentos de Supabase.
- `ui/escape.js`: escapado obligatorio para cualquier dato insertado en plantillas HTML (`escapeHtml`) o en manejadores inline (`jsArg`).

## Conectado en modo test

- Supabase Auth temporal por magic link y cierre de sesion real.
- Sesion persistente al recargar.
- Perfil, rol, familia, tutores, hijos e inscripciones.
- Catalogo remoto de centros, grupos y tarifas.
- Estados, documentos, firmas registradas y pagos existentes en modo lectura.
- RLS y buckets privados definidos en la base de pruebas.

## Sigue simulado

- Stripe.
- Firma real.
- Cambios funcionales de formularios, firma y pagos; se muestran registros remotos existentes, pero estas operaciones todavia no escriben en produccion.
- Produccion.

## Regla de arquitectura

La familia, tutores, hijos, salud, emergencia, comunicaciones, auditoria y cliente Stripe son compartidos.

Las inscripciones, tarifas, contratos, grupos, calendarios, pagos y reglas operativas se separan por servicio.

El ZIP original de Lovable se mantiene intacto y solo puede usarse como referencia visual o funcional.

## Control 3 documental

El flujo documental usa documentos de demostracion con titulos y estados, sin clausulas legales reales. La firma crea evidencia tecnica simulada con identificador, version, tutor, hijo, inscripcion, fecha, consentimientos y huella ficticia. No recopila IP real ni datos tecnicos reales.

## Control 3B documental definitivo

Se han incorporado copias intactas de documentos aportados en `public/original-documents/training-kids/` y el texto extraido en `data/legal-documents.js`. La aplicacion muestra esos textos sin reescribir clausulas. Firma, almacenamiento, auditoria y justificante siguen siendo simulados/locales.

## Control 3C contratos rellenables

Los documentos con campos permiten guardar borrador local antes de firmar. Los datos comerciales proceden de la inscripcion y no son editables por la familia. Al firmar se conserva una copia local inmutable de la version, datos completados, texto documental y firma simulada.

## Control 4 pagos simulados

Training Kids tiene un modulo local de pagos por inscripcion. Usa un cliente Stripe familiar ficticio, tarifas aprobadas, matricula familiar no duplicada, estados de pago y recibo simulado no fiscal. Football Academy y Gym Home no tienen cobros activos.

## Control 5 estados operativos

Cada inscripcion calcula por separado datos, documentos obligatorios, grupo, pago y estado operativo. Administracion puede activar solo cuando todos los requisitos estan completos, y puede dar de baja localmente sin modificar pagos. Los documentos con version o servicio pendiente de validar se muestran como aviso y no se tratan como obligatorios de produccion.

## Control 6 correccion documental

El flujo documental queda separado en pasos visibles: completar datos, revisar documento, firmar y consultar copia firmada. El contrato actual usa `CONTRATO_ACTIVIDAD_TRAINING_KIDS.pdf`, no tiene campos PDF internos y por eso se genera una copia local cumplimentada mediante posiciones controladas sobre las paginas originales renderizadas. Guardar borrador es opcional; el boton principal guarda datos validos, genera el PDF cumplimentado y pasa a revision.

La revision del contrato se realiza pagina a pagina dentro de la app para poder validar el final del documento sin depender del visor PDF del navegador. La app tambien ofrece ver y descargar el PDF generado. Al firmar, se conserva una copia local fija con datos, firma, version, aceptaciones, respuestas PAR-Q y hash SHA-256 del PDF local cuando el navegador lo permite.

La autorizacion de imagen queda como documento independiente con decision explicita de autorizar o no autorizar, sin casilla premarcada y sin bloquear la inscripcion. Normativa y garantias es solo lectura y descarga, sin aceptacion ni firma. SEPA, las fichas duplicadas de salud/emergencia y el contrato anual se retiraron del codigo en la Fase E; el adaptador local sigue archivando copias antiguas que existan en `localStorage`.

## Fase C Supabase test

Archivos principales:

- `data/supabase-adapter.js`: adaptador test compatible con la app actual. No usa `localStorage` como fallback silencioso.
- `data/app-config.js`: seleccion explicita `demo` o `test`.
- `.env.example`: plantilla sin secretos.
- `supabase/migrations/202609160001_phase_c_base.sql`: tablas, indices, RLS y buckets privados.
- `supabase/seed/phase_c_seed.sql`: datos ficticios y pasos seguros para vincular usuarios Auth.
- `supabase/tests/rls_isolation.sql`: plantilla de pruebas de aislamiento.
- `supabase/migrations/202609180001_link_test_users_and_verify_rls.sql`: correccion idempotente, vinculacion de los dos usuarios de prueba y verificaciones RLS.
- `docs/FASE_C_SUPABASE_TEST.md`: pasos para crear el proyecto y conectar la app.
- `docs/FASE_C1_OTP_CONFIGURACION.md`: mejora futura para activar OTP cuando exista SMTP corporativo.
- `supabase/migrations/202609230001_phase_d_family_operations.sql`: RPC y permisos de escritura de Fase D, aplicada en pruebas.
- `supabase/functions/prepare-family-access/index.ts`: alta de familias y tutores (Fase J), reforzada.
- `docs/FASE_D_OPERATIVA.md`: roles, flujos, estado verificado y paso manual.
- `supabase/migrations/202610280001_phase_f_remote_signature.sql`: firma remota de Fase F, pendiente de aplicar.
- `supabase/tests/phase_f_rls.sql`: pruebas manuales de la firma remota.
- `supabase/migrations/202610280002_harden_function_grants.sql`: sin ejecucion de funciones sin sesion y sin fuga de familia por jugador. Aplicada en pruebas.
- `supabase/migrations/202610290001_phase_g_payments.sql`: pagos de prueba de Fase G. Matricula una sola vez por familia.
- `docs/FASE_G_PAGOS.md`: reglas, limites y verificacion de la Fase G.
- `supabase/migrations/202610290002_phase_h_operational_status.sql`: requisitos, grupo, activacion y baja en el servidor.
- `docs/FASE_H_ESTADOS.md`: reglas y verificacion de la Fase H.
- `supabase/migrations/202610290003_phase_i_football_interest.sql`: prealtas de Football Academy en tabla propia.
- `docs/FASE_I_PREALTA_FA.md`: reglas y verificacion de la Fase I.
- `supabase/migrations/202610290004_phase_j_family_access.sql`: alta de familias en una sola transaccion, solo para la edge function.
- `docs/FASE_J_ALTA_FAMILIAS.md`: alta de familias y tutores desde administracion.
- `docs/FASE_F_FIRMA_REMOTA.md`: alcance, limites y pasos para aplicar la Fase F.
- `docs/PROYECTO_PRUEBAS.md`: proyecto Supabase de pruebas actual, que se ha cargado y como se ha verificado.

No debe pegarse la `service_role` en ningun archivo frontend. Usar solo URL publica y anon public key.
