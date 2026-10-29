# Fase J - Alta de familias desde administracion

## Decision aplicada

D7, aprobada el 2026-10-29: activar la edge function `prepare-family-access` en el proyecto de pruebas, reforzada antes de desplegarla. La clave de servicio la inyecta Supabase en el entorno de la funcion; nadie la copia y no aparece en el repositorio ni en el navegador.

## Que hace

- En el panel de administracion (solo modo test) hay un formulario **Dar de alta una familia o un tutor**: familia nueva o existente, nombre y correo del tutor.
- La edge function:
  - solo acepta `POST` con el token de una sesion de administracion (`is_admin()`);
  - valida correo, nombre e identificador de familia;
  - reutiliza el usuario de Auth si ya existe o lo crea confirmado y sin contrasena;
  - delega el resto en `service_prepare_family_access`;
  - si la vinculacion falla y acababa de crear el usuario, lo borra para no dejarlo huerfano;
  - CORS limitado a los origenes locales de la app (configurable con `ALLOWED_ORIGINS`).
- `service_prepare_family_access`, en una sola transaccion: familia nueva o existente, perfil, miembro con permiso de firma, rol `family` y auditoria. Comprueba de nuevo que el actor es administracion, impide dar rol de familia a una cuenta de administracion y rechaza tutores que ya pertenecen a otra familia.
- Las funciones de servidor solo las puede ejecutar `service_role`.
- No envia correos: el tutor entra pidiendo su enlace en la pantalla de acceso (sujeto al limite de correos del plan gratuito).

## Que no hace

- No usa la tabla `invitations` ni enlaces de invitacion propios.
- No permite que un tutor pertenezca a varias familias.
- No da de baja familias ni tutores.

## Archivos

- `supabase/migrations/202610290004_phase_j_family_access.sql`
- `supabase/functions/prepare-family-access/index.ts`
- `supabase/tests/phase_j_rls.sql`
- `data/supabase-adapter.js`, `data/errors.js`, `areas/admin.js`, `app.js`
- `tests/family-access.test.mjs`

## Verificacion

- Pruebas automaticas en navegador (sin Node): 76 de 76 correctas, incluida la comprobacion de que la clave de servicio no aparece en ningun archivo del navegador.
- Modo demo revisado: sin formulario de alta.
- La edge function no se puede ejecutar en este equipo (no hay Deno); se probara tras desplegarla.
- Migracion, despliegue y pruebas: pendientes, con aviso previo.
