# Training Kids Platform V1

Aplicacion nueva para la plataforma comun modular de Training Kids, Football Academy y futuro Gym Home.

## Estado

Fase B, Control 6. Sigue siendo una vista privada local con documentos aportados, campos rellenables, firma simulada, pagos simulados y estados operativos de inscripcion.

## Como abrir

Desde esta carpeta:

```bash
python3 -m http.server 4174
```

Despues abrir:

```text
http://localhost:4174
```

## Acceso de prueba

- Email: cualquiera.
- Codigo temporal: `123456`.
- Administracion: entrar primero y pulsar `Admin`.

## Estructura actual

```text
tk-platform-v1/
  index.html
  styles.css
  app.js
  data/
    mock-data.js
    local-adapter.js
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

## No conectado aun

- Supabase.
- Stripe.
- Firma real.
- Emails reales.
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
