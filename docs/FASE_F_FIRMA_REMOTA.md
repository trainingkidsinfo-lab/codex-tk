# Fase F - Firma remota

## Estado

Codigo y migracion preparados. **La migracion no se ha aplicado** en el proyecto Supabase de pruebas. Hasta que se aplique, el modo test sigue cargando con normalidad y la firma remota aparece desactivada con un aviso.

No se han ejecutado migraciones, seed ni SQL remoto. La solicitud ficticia `77777777-7777-7777-7777-777777777771` no se ha tocado.

## Que cambia

### Base de datos (`supabase/migrations/202610280001_phase_f_remote_signature.sql`)

- Las familias ya no pueden insertar filas en `signature_records` directamente. Antes podian crear una firma marcada como firmada con cualquier contenido.
- Nueva RPC `family_sign_document`. Deriva la familia y el firmante de `auth.uid()` y comprueba:
  - que el usuario es miembro activo de la familia con permiso de firma;
  - que la inscripcion es de su familia y no esta retirada ni rechazada;
  - que la version pertenece a un documento activo del mismo servicio y admite firma;
  - nombre del firmante, datos completados y aceptaciones obligatorias (el contrato exige ademas contrato, Anexo 1 y Anexo 2 PAR-Q);
  - decision explicita `authorize` o `deny` en la autorizacion de imagen;
  - huellas SHA-256 con formato valido;
  - que los archivos declarados existen en los buckets privados, dentro de la carpeta de esa familia, inscripcion y version.
- Una sola firma valida por inscripcion y version. Repetir la misma firma devuelve el mismo identificador; otra firma distinta se rechaza.
- Nuevas columnas de evidencia: nombre escrito, ruta y huella de la imagen de la firma, y decision de imagen.
- Las familias pueden subir el PDF firmado a su carpeta de `tk-signed-documents`, pero no sobrescribirlo ni borrarlo.
- Huellas SHA-256 de los cuatro PDF originales en `document_versions`, solo si estaban vacias.
- Auditoria de cada firma con documento, version, inscripcion, decision de imagen y huella.
- La firma sigue siendo inmutable por el trigger de Fase C.

### Aplicacion

- `data/remote-documents.js`: modulo nuevo con la subida de archivos, el calculo de huellas sobre los bytes que se suben y la llamada a la RPC. Tambien contiene el mapeo de documentos remotos, antes dentro del adaptador.
- `data/supabase-adapter.js`: nuevas operaciones `signDocument` y `getSignedFileUrl`. Si la migracion F no esta aplicada, lee el esquema anterior y desactiva la firma en lugar de fallar.
- `app.js`: en modo test, confirmar la firma sube los archivos y registra la firma remota. El modo demo no cambia.
- `areas/documents.js`: justificante de prueba con huella SHA-256 y decision de imagen. La familia y administracion pueden abrir el PDF firmado y la imagen de la firma con un enlace temporal de dos minutos.
- Los identificadores de documentos remotos ya no cambian al firmarse, para que el documento abierto no se pierda.
- Sufijo de cache de modulos `?v=f1`.

## Limites conocidos

- La huella del PDF la calcula el navegador sobre los bytes que sube. La RPC comprueba que el archivo existe, pero no puede leer su contenido. Verificarla en servidor necesita una edge function.
- Si la RPC falla despues de subir los archivos, esos archivos quedan en el bucket sin firma asociada. No se pueden borrar desde el navegador.
- La firma no tiene validez juridica. Sigue pendiente elegir un proveedor de firma (Fase M).
- La autorizacion de imagen se firma por inscripcion, como hasta ahora. La decision D4 sigue abierta; con un solo servicio activo, inscripcion e hijo coinciden.

## Como aplicarla en el proyecto de pruebas

Requiere tu aprobacion expresa. Pasos:

1. En el SQL Editor del proyecto de pruebas, ejecutar una sola vez `supabase/migrations/202610280001_phase_f_remote_signature.sql`.
2. Ejecutar `supabase/tests/phase_f_rls.sql` sustituyendo los marcadores por usuarios y registros ficticios. Termina en `rollback` y no deja datos.
3. En la app en modo test, con la familia ficticia, firmar la autorizacion de imagen y despues el contrato.
4. Con el usuario administrador, comprobar el justificante, abrir el PDF firmado y revisar la auditoria.

## Pruebas

- `tests/remote-signature.test.mjs`: rutas, aceptaciones, tipos de archivo, subida sin sobrescritura, huellas calculadas, fallo de subida sin registro de firma, identificadores estables, escapado del justificante y comprobaciones estaticas de la migracion.

Verificacion realizada el 2026-10-28 sin Node instalado, en navegador con sustitutos de `node:test`, `node:assert` y `node:fs`: 38 de 38 correctas. El modo demo se ha recorrido firmando la autorizacion de imagen. El modo test no se ha podido probar contra Supabase.

Pendiente: ejecutar `npm test` con Node 20 o superior.
