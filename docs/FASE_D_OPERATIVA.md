# Fase D - Operativa de familias, hijos e inscripciones

## Estado

Implementacion local terminada. Las lecturas existentes de Supabase siguen operativas. Las escrituras de Fase D quedan pendientes de aplicar y verificar remotamente mediante la migracion `202609230001_phase_d_family_operations.sql`.

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

La migracion anade el estado de revision, crea RPC transaccionales, valida catalogo y relaciones, y revoca escrituras directas sensibles. No modifica migraciones ejecutadas, no contiene datos reales y no se ejecuta automaticamente.

Las pruebas negativas remotas estan preparadas en `supabase/tests/phase_d_rls.sql`; usan marcadores y deben ejecutarse dentro de una transaccion con datos ficticios.

## Estado funcional

### Completado y verificado localmente

- Sintaxis, callback de Auth y contratos de seguridad.
- Arranque demo y test sin fallback.
- Gestion demo sin regresiones.
- Vistas familiar y administrativa sobre el diseno existente.
- Ausencia de secretos en Git y `config.local.js` ignorado.

### Implementado, pendiente de verificacion remota

- Actualizar familia.
- Crear y editar hijos, salud y emergencia.
- Enviar una solicitud sin duplicados.
- Aprobar, rechazar o solicitar cambios.
- Ver el estado actualizado tras refrescar.
- Pruebas negativas de nuevas escrituras y aislamiento.
- Despliegue de la funcion segura para nuevas familias.

### Simulado o posterior

- Stripe, cobros, facturacion y firma juridica.
- SMTP, dominio, emails de produccion y despliegue publico.
- Football Academy sigue en prealta y Gym Home como futuro.

## Unica accion manual inmediata

Ejecutar en el SQL Editor de pruebas el contenido completo de `supabase/migrations/202609230001_phase_d_family_operations.sql`. Despues deben realizarse las pruebas remotas de familia, administracion y RLS antes de considerar completada la fase.
