# Fase C - Supabase de pruebas

Estado: conexion y vinculacion remota completadas. El SQL devolvio `Fase C vinculada y RLS verificada`.

## Modos

- Demo: `http://localhost:4174/`. Usa datos ficticios en `localStorage` y codigo `123456`.
- Test: `http://localhost:4174/?mode=test`. Usa Supabase Auth y datos remotos. No vuelve al modo demo si falla la conexion.

`config.local.js` contiene exclusivamente Project URL y publishable key. El archivo esta ignorado por Git. Nunca debe usarse una `service_role`, secret key o contrasena de base de datos en el navegador.

## Vinculacion completada

Se ejecuto correctamente una sola vez:

```text
supabase/migrations/202609180001_link_test_users_and_verify_rls.sql
```

El archivo no debe volver a ejecutarse ni modificarse. Corrigio la representacion del rol admin, vinculo los dos usuarios Auth, creo una segunda familia ficticia minima y comprobo aislamiento RLS y buckets privados.

## Acceso test

- Familia: `alexsotokurko23@gmail.com`, rol `family`, vinculada a la familia seed.
- Administracion: `trainingkids.info@gmail.com`, rol `admin`, sin familia asociada.

En la pantalla de acceso se solicita un codigo OTP por email y se introduce en la misma pantalla. La app conserva la sesion al recargar y limpia parametros antiguos de autenticacion de la URL. El boton `X` cierra la sesion real de Supabase.

Si Supabase limita temporalmente los envios, la pantalla conserva el email introducido y muestra el error en español sin revelar si la cuenta existe. La comprobacion visual del usuario administrador queda pendiente hasta que termine ese limite.

## Datos conectados

- Sesion, perfil y roles.
- Familia, tutores, hijos y datos medicos/emergencia.
- Inscripciones y estados.
- Centros, grupos, capacidad y tarifas.
- Catalogo documental, firmas registradas, pagos y auditoria existentes.

Las pantallas de alta, firma y pago siguen siendo un prototipo: en modo test pueden representar cambios temporalmente en memoria, pero todavia no persisten esas operaciones remotas ni realizan firma juridica, Stripe o emails de produccion.

## Pendientes de produccion

- Configurar dominios y redirect URLs definitivos de Auth.
- Sustituir el CDN del cliente Supabase por dependencias versionadas durante el empaquetado.
- Implementar escrituras remotas controladas para alta, documentos, auditoria y pagos.
- Pruebas automatizadas con usuarios aislados y entorno desechable.
- Firma juridica, Stripe, SMTP transaccional y despliegue privado.
