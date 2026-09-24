# Fase D - Operativa de familias, hijos e inscripciones

## Estado

La migracion `202609230001_phase_d_family_operations.sql` fue aplicada correctamente en el proyecto Supabase de pruebas. El modo test carga datos remotos sin fallback a demo y el modo demo permanece aislado.

## Roles y permisos

- `family`: lee su familia, adultos, hijos, solicitudes, documentos y pagos. Las escrituras usan RPC que derivan la familia exclusivamente de `auth.uid()`.
- `admin` y `owner`: consultan todas las familias y revisan solicitudes. La decision administrativa vuelve a comprobar el rol en base de datos.
- El navegador nunca decide `family_id`, `user_id` o rol.
- No existe fallback de test a demo. El modo demo conserva su adaptador local aislado.

## Flujo familiar

1. Acceso mediante magic link.
2. Edicion de nombre, telefono y direccion familiar.
3. Creacion o edicion de un hijo, salud y contacto de emergencia.
4. Seleccion de Training Kids, centro, disponibilidad y tarifa publica.
5. Envio idempotente de la solicitud para la temporada activa.
6. Consulta del estado de revision y observaciones administrativas.

La familia no puede elegir grupo definitivo, tarifa administrativa, estado operativo ni familia propietaria.

## Flujo administrativo

1. Panel distinto para roles `admin` y `owner`.
2. Listado y busqueda de familias e hijos.
3. Filtros de solicitudes por servicio y estado.
4. Revision con `approve`, `request_changes` o `reject`.
5. Grupo opcional durante la aprobacion, validado por servicio, centro y capacidad.
6. Auditoria con usuario y fecha.

## Alta de nuevas familias

La estructura segura esta en `supabase/functions/prepare-family-access/index.ts`. Comprueba el JWT del administrador, usa `SUPABASE_SERVICE_ROLE_KEY` solo en el servidor, crea o selecciona la familia y vincula exclusivamente el rol `family`.

La funcion no esta desplegada y su accion no se muestra en la interfaz. El acceso normal mantiene `shouldCreateUser: false`. Nunca debe copiarse la clave de servicio al navegador ni a `config.local.js`.

## Migracion nueva

La migracion anade el estado de revision, crea RPC transaccionales, valida catalogo y relaciones, y revoca escrituras directas sensibles. No contiene datos reales y no debe volver a ejecutarse ni modificarse.

Las pruebas negativas remotas estan preparadas en `supabase/tests/phase_d_rls.sql`; usan marcadores y deben ejecutarse dentro de una transaccion con datos ficticios.

## Estado funcional

### Completado y verificado

- Sintaxis, callback de Auth y contratos de seguridad.
- Arranque demo y test sin fallback.
- Gestion demo sin regresiones.
- Vistas familiar y administrativa sobre el diseno existente.
- Ausencia de secretos en Git y `config.local.js` ignorado.
- Acceso familiar real, persistencia y cierre de sesion.
- Identidad familiar vinculada solo a su familia.
- Actualizacion remota de telefono y direccion familiar con datos ficticios.
- Creacion remota de un hijo ficticio y guardado de salud y emergencia.
- Solicitud remota de Training Kids y reenvio idempotente sin duplicados.
- Acceso administrativo real y resolucion del rol `admin`.
- La vinculacion de usuarios y las pruebas RLS transaccionales de Fase C finalizaron con `Fase C vinculada y RLS verificada`.
- El contrato de seguridad de Fase D comprueba RPC, revocaciones, identidad derivada de `auth.uid()`, tarifa no administrativa y autorizacion de administrador.

### Pendiente de comprobacion manual final

- Ejecutar desde el panel administrativo una decision sobre la solicitud ficticia y comprobar el cambio desde la familia.
- Repetir las pruebas negativas remotas especificas de las RPC de Fase D solo si se aprueba previamente una ejecucion SQL transaccional adicional.
- Despliegue de la funcion segura para nuevas familias.

### Simulado o posterior

- Stripe, cobros, facturacion y firma juridica.
- SMTP, dominio, emails de produccion y despliegue publico.
- Football Academy sigue en prealta y Gym Home como futuro.

## Incidencia PGRST303

El cliente Auth validaba la identidad, pero la primera peticion PostgREST podia conservar la publishable key como cabecera `Authorization`. El adaptador mantiene una sola instancia de Supabase y fuerza el JWT de sesion exclusivamente en peticiones al `/rest/v1` del mismo proyecto. El diagnostico registra solo estado HTTP, codigo, mensaje, tipo de cabecera y coincidencia de proyecto; nunca registra tokens. La regresion queda cubierta por `tests/postgrest-auth-header.test.mjs`.
