# Fase H - Estados operativos en el servidor

## Que hace

- `enrollment_missing_requirements`: el servidor lista lo que falta para activar una inscripcion de Training Kids:
  - solicitud aprobada;
  - datos de familia (nombre, telefono, direccion), un tutor con nombre y email, y del hijo (nombre, fecha de nacimiento, informacion medica, contacto de emergencia);
  - documentos obligatorios firmados en su version vigente (hoy, el contrato);
  - grupo activo del mismo servicio y centro, con plaza;
  - pago inicial pagado.
  La familia puede consultarlo para sus inscripciones; nadie puede consultar inscripciones ajenas.
- `admin_assign_group`: asigna o cambia el grupo tras aprobar, bloqueando el grupo para que dos asignaciones a la vez no superen la capacidad.
- `admin_activate_enrollment`: activa solo si no falta nada; si falta algo, explica el primer requisito pendiente. Activar dos veces no cambia nada.
- `admin_withdraw_enrollment`: baja con motivo opcional. Cancela los pagos pendientes y conserva los pagados (sin devoluciones).
- `group_occupancy`: plazas ocupadas por grupo calculadas en el servidor. Solo devuelve recuentos, nunca datos de otras familias.
- En la app, modo test: botones **Guardar grupo**, **Activar** y **Dar de baja** con confirmacion en pagina. Modo demo sin cambios.

## Que no hace

- No envia comunicaciones a la familia.
- No gestiona devoluciones ni cuotas siguientes.
- No define fecha de inicio de la actividad.
- La validacion PAR-Q por el equipo sigue siendo un aviso, no un bloqueo.

## Archivos

- `supabase/migrations/202610290002_phase_h_operational_status.sql`
- `supabase/tests/phase_h_rls.sql`
- `areas/operational-status.js`, `areas/admin.js`, `app.js`, `data/supabase-adapter.js`, `data/errors.js`
- `tests/operational-remote.test.mjs`

## Verificacion

- Pruebas automaticas en navegador (sin Node): 61 de 61 correctas.
- Modo demo revisado.
- Migracion aplicada el 2026-10-29 en el proyecto de pruebas, con aprobacion expresa, sin errores.
- `supabase/tests/phase_h_rls.sql`: 18 comprobaciones correctas y deshechas al final:
  - La familia no puede activar ni asignar grupo, ni consultar inscripciones ajenas; si puede ver sus requisitos y la ocupacion.
  - Sin grupo no se activa y el servidor explica por que.
  - Grupo de otro centro y grupo lleno, rechazados.
  - Asignar grupo suma una plaza; con todo completo se activa; activar dos veces no cambia nada.
  - La baja libera la plaza, conserva el pago pagado e impide reactivar.
  - Auditoria de grupo, activacion y baja.
- Nota: al aprobar a Leo desde la app se eligio el grupo Ajalvir Lunes, asi que ya cumple todos los requisitos. El script quita el grupo dentro de la transaccion para probar el caso sin grupo.
- Probada desde la app el 2026-10-29: administracion cambio a Leo al grupo Ajalvir Miercoles con **Guardar grupo** y lo activo. Estado `active`, una plaza ocupada en el grupo, pago pagado y auditoria de grupo y activacion.
