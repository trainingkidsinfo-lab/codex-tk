# Training Kids Platform V1

Aplicacion nueva para la plataforma comun modular de Training Kids, Football Academy y futuro Gym Home.

## Estado

Fase C conectada al proyecto Supabase de pruebas. El modo demo conserva `localStorage` y el codigo `123456`. El modo test usa Supabase Auth, sesion persistente, roles y lectura remota de familia, hijos, inscripciones, grupos, documentos y pagos. La vinculacion de usuarios y las comprobaciones RLS se ejecutaron correctamente. Solo queda pendiente la comprobacion visual del usuario administrador cuando finalice el limite temporal de emails de Supabase.

Fase C.1 usa temporalmente un magic link enviado por correo en modo test, compatible con la plantilla predeterminada de Supabase. El retorno se realiza en `http://127.0.0.1:4181/?mode=test`, el reenvio queda bloqueado durante 60 segundos y la sesion sigue gestionada y restaurada por el cliente oficial de Supabase. El codigo OTP queda pendiente hasta disponer de SMTP corporativo.

## Como abrir

Desde esta carpeta:

```bash
python3 -m http.server 4174
```

Despues abrir el modo demo:

```text
http://localhost:4174
```

Modo test:

```text
http://localhost:4174/?mode=test
```

## Acceso de prueba

Modo demo:

- Email: cualquiera.
- Codigo temporal: `123456`.
- Administracion: entrar primero y pulsar `Admin`.

Modo test Supabase:

- La URL y publishable key de pruebas estan en `config.local.js`, que permanece ignorado por Git.
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
  assets/
  docs/
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

Se han incorporado copias intactas de documentos aportados en `original-documents/training-kids/` y el texto extraido en `data/legal-documents.js`. La aplicacion muestra esos textos sin reescribir clausulas. Firma, almacenamiento, auditoria y justificante siguen siendo simulados/locales.

## Control 3C contratos rellenables

Los documentos con campos permiten guardar borrador local antes de firmar. Los datos comerciales proceden de la inscripcion y no son editables por la familia. Al firmar se conserva una copia local inmutable de la version, datos completados, texto documental y firma simulada.

## Control 4 pagos simulados

Training Kids tiene un modulo local de pagos por inscripcion. Usa un cliente Stripe familiar ficticio, tarifas aprobadas, matricula familiar no duplicada, estados de pago y recibo simulado no fiscal. Football Academy y Gym Home no tienen cobros activos.

## Control 5 estados operativos

Cada inscripcion calcula por separado datos, documentos obligatorios, grupo, pago y estado operativo. Administracion puede activar solo cuando todos los requisitos estan completos, y puede dar de baja localmente sin modificar pagos. Los documentos con version o servicio pendiente de validar se muestran como aviso y no se tratan como obligatorios de produccion.

## Control 6 correccion documental

El flujo documental queda separado en pasos visibles: completar datos, revisar documento, firmar y consultar copia firmada. El contrato actual usa `CONTRATO_ACTIVIDAD_TRAINING_KIDS.pdf`, no tiene campos PDF internos y por eso se genera una copia local cumplimentada mediante posiciones controladas sobre las paginas originales renderizadas. Guardar borrador es opcional; el boton principal guarda datos validos, genera el PDF cumplimentado y pasa a revision.

La revision del contrato se realiza pagina a pagina dentro de la app para poder validar el final del documento sin depender del visor PDF del navegador. La app tambien ofrece ver y descargar el PDF generado. Al firmar, se conserva una copia local fija con datos, firma, version, aceptaciones, respuestas PAR-Q y hash SHA-256 del PDF local cuando el navegador lo permite.

La autorizacion de imagen queda como documento independiente con decision explicita de autorizar o no autorizar, sin casilla premarcada y sin bloquear la inscripcion. Normativa y garantias sigue como lectura/descarga y aceptacion sin firma dibujada. SEPA y las fichas duplicadas de salud/emergencia quedan fuera del flujo actual, conservando historico si existieran copias firmadas.

## Fase C Supabase test

Archivos principales:

- `data/supabase-adapter.js`: adaptador test compatible con la app actual. No usa `localStorage` como fallback silencioso.
- `data/app-config.js`: seleccion explicita `demo` o `test`.
- `config.example.js`: plantilla sin secretos.
- `supabase/migrations/202609160001_phase_c_base.sql`: tablas, indices, RLS y buckets privados.
- `supabase/seed/phase_c_seed.sql`: datos ficticios y pasos seguros para vincular usuarios Auth.
- `supabase/tests/rls_isolation.sql`: plantilla de pruebas de aislamiento.
- `supabase/migrations/202609180001_link_test_users_and_verify_rls.sql`: correccion idempotente, vinculacion de los dos usuarios de prueba y verificaciones RLS.
- `docs/FASE_C_SUPABASE_TEST.md`: pasos para crear el proyecto y conectar la app.
- `docs/FASE_C1_OTP_CONFIGURACION.md`: mejora futura para activar OTP cuando exista SMTP corporativo.

No debe pegarse la `service_role` en ningun archivo frontend. Usar solo URL publica y anon public key.
