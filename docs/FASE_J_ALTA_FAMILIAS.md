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
- Migracion aplicada el 2026-10-29 en el proyecto de pruebas, con aprobacion expresa, sin errores.
- `supabase/tests/phase_j_rls.sql`: 14 comprobaciones correctas y deshechas al final:
  - Una sesion de administracion normal no puede llamar a las funciones de servidor (42501).
  - El servidor busca el usuario por correo sin distinguir mayusculas, crea la familia y repetir el alta no duplica nada.
  - Rechaza actor que no es administracion, rol de familia para administracion, tutor de otra familia, correo que no coincide con el usuario y familia inexistente, sin dejar familias a medias.
  - El tutor nuevo solo ve su familia y tiene rol `family`; el alta queda en la auditoria.
- Edge function desplegada el 2026-10-29 (version 1, `verify_jwt` activado). Comprobado desde fuera:
  - sin cabecera de autorizacion: 401 de Supabase;
  - con la clave publica, sin usuario: 401 `authentication_required` (la funcion arranca y tiene su configuracion);
  - preflight desde `http://127.0.0.1:4181`: permitido; desde otro origen: no autorizado.
- Probado desde la app el 2026-10-29:
  - Administracion dio de alta "Familia prueba J" con el tutor `trainingkids.info+tutor1@gmail.com` (alias de la cuenta de Training Kids). La funcion acepto el token de la sesion con `verify_jwt` activado, asi que no hace falta desactivarlo.
  - El tutor pidio su enlace, entro y ve solo su familia, sin pestana Admin.
  - Comprobado en Supabase: familia creada, usuario de Auth confirmado, miembro activo con permiso de firma y pago, rol `family` en esa familia y una entrada "Familia dada de alta" en `audit_log`.
