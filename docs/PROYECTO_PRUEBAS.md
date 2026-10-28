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

## Avisos del asesor de seguridad de Supabase

Ya existian en el proyecto anterior porque vienen de la Fase C. No son nuevos de la Fase F.

- Las funciones `SECURITY DEFINER` se pueden llamar sin sesion. Todas comprueban la identidad y rechazan llamadas sin permiso, salvo `player_family_id`, que devuelve la familia de un jugador si se conoce su identificador interno.
- `touch_updated_at` y `prevent_signed_signature_update` no fijan `search_path`.

Propuesta pendiente de aprobacion: una migracion pequena que retire `EXECUTE` a `anon` en todas las funciones de `public` y fije `search_path` en esas dos.

Los avisos de rendimiento (indices en claves foraneas, politicas permisivas multiples) no son relevantes con el volumen de pruebas.

## Pendiente

- Cambiar `config.local.js` a la URL y la clave publica del proyecto nuevo.
- Probar la app en modo test con los dos usuarios, incluida la firma desde el navegador.
