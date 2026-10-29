# Fase G - Pagos de prueba sin Stripe real

## Decision de negocio aplicada

D6, decidida el 2026-10-29: la matricula de 20 EUR se cobra **una sola vez por familia, para siempre**. No se repite por un segundo hijo ni en temporadas siguientes.

## Que hace

- Al **aprobar** una solicitud de Training Kids, el servidor prepara el pago inicial: tarifa de `plan_prices` mas la matricula si corresponde. El navegador nunca decide importes.
- La matricula se incluye solo si la familia no tiene otro pago con matricula pendiente o pagado. Un indice unico lo garantiza en la base de datos aunque haya dos aprobaciones a la vez.
- Una inscripcion tiene como maximo un pago inicial pendiente o pagado. Aprobar dos veces no duplica el pago.
- **Administracion** registra el resultado: pagado, fallido o cancelado, siempre con confirmacion en pagina. Pagado genera un recibo de prueba `TK-PRUEBA-000001` y es definitivo.
- Un pago cancelado permite **preparar uno nuevo** con la tarifa vigente.
- **Rechazar** una solicitud cancela su pago pendiente.
- Cada cambio queda en `payment_events` y en la auditoria.
- La **familia** ve sus pagos, el desglose y los recibos, pero no puede crearlos ni cambiarlos.
- Football Academy y Gym Home no generan pagos.

## Que no hace

- No hay Stripe, tarjeta ni cobro real (Fase L).
- No fija fecha de vencimiento: es una decision de negocio pendiente.
- No genera las cuotas siguientes a la primera.
- Si se cancela el pago que llevaba la matricula, los pagos pendientes de otros hijos no se recalculan; el siguiente pago que se prepare la incluira.
- Si una familia reenvia una solicitud ya aprobada con otra tarifa, el pago pendiente conserva el importe anterior. Hay que cancelarlo y preparar uno nuevo.
- El modo demo mantiene su simulacion local.

## Archivos

- `supabase/migrations/202610290001_phase_g_payments.sql`: columnas de desglose y recibo, indices unicos, funciones `prepare_initial_payment_order` (interna), `admin_prepare_payment_order`, `admin_record_payment` y nueva version de `admin_review_enrollment`.
- `supabase/tests/phase_g_rls.sql`: recorrido completo con rollback.
- `data/remote-payments.js`: traduccion de los pagos remotos a la app.
- `data/supabase-adapter.js`: `recordPayment` y `preparePayment`; lectura compatible si la migracion G no esta aplicada.
- `areas/payments.js` y `app.js`: acciones de administracion con confirmacion en pagina.
- `tests/payments-remote.test.mjs`.

## Verificacion

- Pruebas automaticas en navegador (sin Node): 52 de 52 correctas.
- Modo demo revisado: la simulacion de pagos sigue igual.
- Migracion y pruebas SQL: pendientes de aplicar en el proyecto de pruebas, con aprobacion expresa.
