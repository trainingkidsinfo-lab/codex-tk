# Fase I - Prealta de Football Academy

## Decision aplicada

D5: las prealtas se guardan en una tabla propia, `service_interest_requests`, separada de las inscripciones. Asi nunca entran en documentos, pagos ni activacion de Training Kids. Football Academy no tiene tarifas ni cobros en esta fase.

## Que hace

- La familia pulsa **Solicitar informacion** en Football Academy y la prealta se guarda en el servidor para ese hijo.
- Solo se admite en servicios en estado `prelaunch`. No se duplica mientras haya una prealta abierta del mismo hijo.
- La familia ve "Prealta recibida", "Familia contactada" o "Prealta cerrada", sin pagos ni documentos.
- Administracion ve las prealtas en el panel (filtro Football Academy) con **Marcar contactada** y **Cerrar prealta**. Todo queda en la auditoria.
- Si se cierra una prealta, la familia puede volver a registrar interes.
- El modo demo mantiene su simulacion local.

## Que no hace

- No crea grupos, tarifas, contratos ni pagos de Football Academy.
- No envia correos a la familia.
- Gym Home sigue sin prealta.

## Archivos

- `supabase/migrations/202610290003_phase_i_football_interest.sql`
- `supabase/tests/phase_i_rls.sql`
- `data/remote-interest.js`, `data/supabase-adapter.js`, `data/errors.js`
- `areas/admin.js`, `areas/family.js`, `app.js`
- `tests/football-interest.test.mjs`

## Verificacion

- Pruebas automaticas en navegador (sin Node): 69 de 69 correctas.
- Modo demo revisado: la prealta local sigue igual.
- Migracion aplicada el 2026-10-29 en el proyecto de pruebas, con aprobacion expresa, sin errores.
- `supabase/tests/phase_i_rls.sql`: 12 comprobaciones correctas y deshechas al final:
  - Registrar dos veces devuelve la misma prealta; Training Kids no admite prealta; no se puede para un hijo ajeno.
  - La familia no puede insertar directamente ni cerrar su prealta.
  - Administracion la ve, la marca como contactada y la cierra; una prealta cerrada no se puede cambiar.
  - Tras cerrar, la familia puede registrar interes de nuevo.
  - Auditoria de cada paso.
- Permisos de la tabla para usuarios con sesion: solo lectura.
- Probada desde la app el 2026-10-29: la familia solicito informacion de Football Academy para Sofia y administracion la marco como contactada. Estado `contacted` con fecha y auditoria de ambos pasos.
- Modo demo: "Marcar contacto" ahora muestra aviso y estado; antes parecia no hacer nada.
