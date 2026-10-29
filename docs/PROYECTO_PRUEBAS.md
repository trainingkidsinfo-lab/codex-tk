# Proyecto Supabase de pruebas

## Proyecto actual

| Dato | Valor |
|---|---|
| Nombre | Training Kids Pruebas |
| Referencia | `yqvymjryecmfsoilkxgj` |
| Organizacion | La de la cuenta de Supabase de Training Kids |
| Region | eu-central-2 (Zurich) |
| Plan | Gratuito. Se pausa tras unos dias sin uso; se reactiva con "Resume project" sin perder datos. |
| Creado | 2026-10-28 |

La app se conecta a el mediante `config.local.js`, que no esta en Git. Solo lleva la URL del proyecto y la clave publica `sb_publishable_...`. Nunca `service_role` ni contrasenas.

## Por que hay un proyecto nuevo

El proyecto anterior (`rfjezamdapdmtsxspwrc`), donde se aplicaron las fases C y D en septiembre, se creo con una cuenta de Supabase que no se ha podido identificar. Para no depender de ella, el 2026-10-28 se monto un proyecto nuevo en la cuenta de Training Kids, con autorizacion expresa, y se cargo desde cero. El proyecto anterior solo contenia datos ficticios. El proyecto pausado `kzfpyrltgrfrqmlxpbpv` de la cuenta de Training Kids es otro distinto y no se usa.

## Que se ha cargado

En este orden, todo el 2026-10-28:

1. `202609160001_phase_c_base.sql`, sin cambios.
2. `supabase/seed/phase_c_seed.sql`, la parte de datos ficticios (sin los comentarios de vinculacion).
3. `202609180001_link_test_users_and_verify_rls.sql`, con los identificadores de los dos usuarios de Auth del proyecto nuevo en lugar de los del anterior, y sin `begin`/`commit` porque la herramienta ya usa una transaccion. Incluye sus propias comprobaciones de aislamiento, que pasaron.
4. `202609230001_phase_d_family_operations.sql`, sin cambios.
5. `202610280001_phase_f_remote_signature.sql`, sin cambios.
6. `202610280002_harden_function_grants.sql`, ver mas abajo.
7. `202610290001_phase_g_payments.sql` (2026-10-29) y su correccion `phase_g_payments_fix_status_compare`. Ver `docs/FASE_G_PAGOS.md`.
8. `202610290002_phase_h_operational_status.sql` (2026-10-29). Ver `docs/FASE_H_ESTADOS.md`.

Usuarios de Auth, creados a mano en el panel y confirmados:

- Familia: el correo personal de prueba, vinculado a la familia demo con permiso de firma.
- Administracion: el correo de Training Kids, con rol `admin`.

La inscripcion ficticia `77777777-7777-7777-7777-777777777771` empieza en revision `pending`. En el proyecto anterior estaba en `changes_requested`.

## Comprobaciones realizadas

| Comprobacion | Resultado |
|---|---|
| Objetos de Fase C frente al archivo | 23 tablas con RLS, 53 politicas en `public`, 4 en Storage, 5 funciones, 6 triggers, 7 indices, 4 buckets privados. Coincide. |
| Datos ficticios | 3 servicios, 6 centros, 3 grupos, 5 planes, precios 60, 100, 150, 240 y 210 (solo admin), 4 documentos, 2 jugadores, 1 inscripcion. |
| Vinculacion y aislamiento (Fase C) | La familia ve su cuenta y no la ajena, no puede tocar roles ni activar inscripciones; administracion ve ambas familias. |
| `supabase/tests/phase_d_rls.sql` | Correcto. |
| Fase F, consulta de verificacion | `true`, `true`, `4`, `true`. |
| Fase F, pruebas negativas | Insercion directa, inscripcion ajena, contrato sin anexos ni PDF, huella invalida y archivo inexistente: todas rechazadas. |
| Fase F, recorrido completo | Autorizacion de imagen ("No autorizo") y contrato con PDF firmados, reintento idempotente, segunda firma distinta rechazada, familia y administracion ven las 2 firmas, 2 entradas de auditoria, firma no modificable. |
| Restos tras las pruebas | Ninguno: 0 firmas, 0 archivos, 0 auditoria, revision `pending`. |

Las pruebas de firma simularon los archivos insertando filas en `storage.objects` dentro de la misma transaccion, que se deshizo al final.

## Refuerzo de permisos de funciones

Tras cargar la Fase F, el asesor de seguridad de Supabase mostro avisos heredados de la Fase C: las funciones se podian llamar sin sesion, `player_family_id` devolvia la familia de cualquier jugador si se conocia su identificador, y dos funciones de trigger no fijaban `search_path`.

Con autorizacion expresa se aplico el 2026-10-28 `202610280002_harden_function_grants.sql`:

- Sin sesion no se puede ejecutar ninguna funcion de `public`.
- Con sesion se conservan, de forma explicita, las funciones de las politicas RLS y las RPC de las Fases D y F.
- `player_family_id` solo responde si quien pregunta tiene acceso a esa familia.
- `search_path` fijo en las dos funciones de trigger.

Comprobado despues, en una transaccion deshecha al final:

| Comprobacion | Resultado |
|---|---|
| Sin sesion: funciones y lectura de familias | Bloqueado |
| Familia: familias, jugadores, fichas medicas, contactos | 1, 2, 2, 2 (solo los suyos) |
| Familia: familia de un jugador propio y de uno ajeno | La suya y `null` |
| Pruebas de Fase D | Correctas |
| Pruebas de Fase F con recorrido completo de firma | Correctas |
| Administracion: familias, jugadores, firmas; revisar solicitud | 2, 3, 2; correcto |
| Restos tras las pruebas | Ninguno |

Avisos que se mantienen:

- Las RPC `SECURITY DEFINER` son llamables con sesion. Es el diseno: cada una deriva la identidad de `auth.uid()` y valida permisos.
- Proteccion de contrasenas filtradas desactivada en Auth. La app entra por enlace al correo, sin contrasena.

Los avisos de rendimiento (indices en claves foraneas, politicas permisivas multiples) no son relevantes con el volumen de pruebas.

## Prueba desde la app (2026-10-29)

Con `config.local.js` apuntando al proyecto nuevo, el tutor de prueba entro por enlace al correo y firmo desde la app en modo test.

| Documento | Resultado |
|---|---|
| Contrato de actividad | Firmado y bloqueado. PDF de 1,2 MB y PNG de la firma en sus buckets. Seis aceptaciones, incluidos Anexo 1 y PAR-Q. Huellas SHA-256 guardadas. |
| Autorizacion de imagen | Firmada y bloqueada con decision "Autorizo". PNG de la firma en su bucket. |
| Auditoria | Una entrada por firma, con documento y version. |
| Inscripcion ficticia | Sin cambios (`pending`). |

Leccion aprendida: el navegador conservaba `config.local.js` en cache y seguia usando el proyecto anterior. Se cambio el sufijo a `?v=f1`. Si se vuelve a cambiar de proyecto, conviene probar en una ventana de incognito.

## Pendiente

- Comprobar la vista de administracion con el usuario de Training Kids.
- Verificar en servidor que la huella del PDF coincide con el archivo (requiere edge function).
