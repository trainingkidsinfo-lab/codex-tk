# Fase K1 - Capa de datos en TypeScript (etapa 2)

## Alcance

Sin cambios en pantallas ni en Supabase. La conexion con Supabase pasa a TypeScript estricto con los tipos del esquema real, para que un nombre de tabla, columna, funcion o argumento mal escrito falle al comprobar y no al usar la app.

## Que cambia

- `data/database.types.ts`: tipos generados desde el proyecto de pruebas (`yqvymjryecmfsoilkxgj`). Solo se leyo el esquema; no se escribio nada.
- Pasan a `.ts` y modo estricto: `app-config`, `errors`, `remote-interest`, `remote-payments`, `remote-documents` y `supabase-adapter`.
- `data/supabase-client.ts`: cliente tipado (`SupabaseClient<Database>`) y `callRpc`. Los tipos generados no reflejan que en Postgres todos los argumentos admiten `null` (sin grupo, sin nota, hijo nuevo...). `callRpc` lo permite y sigue comprobando nombres de funcion y de argumentos. Las llamadas envian exactamente lo mismo que antes.
- Las filas que se leen tienen tipo propio, sacado del esquema (`FamilyRow`, `EnrollmentRow`, `PaymentRow`...). Las columnas que pueden faltar antes de una migracion (firma F, pagos G) son opcionales.
- Los errores se leen con `asErrorLike` en lugar de suponer su forma.
- El estado de la app sigue sin tipar (`AppState`). Se tipara al ordenar `app.js` en la etapa 3.
- Node 22 ejecuta los `.ts` directamente en las pruebas, porque solo se usan tipos que se pueden borrar (`erasableSyntaxOnly`). Vite hace lo mismo en el navegador. No hay paso de compilacion nuevo.
- TypeScript pasa de 7.0.2 a 6.0.3. La 7 todavia no ofrece la API que necesita el revisor de codigo para leer TypeScript (`typescript-eslint`).

## Comprobaciones

- `npm run typecheck` ejecuta dos pasadas:
  - toda la app en modo no estricto, como en la etapa 1;
  - `data/` en modo estricto (`tsconfig.strict.json`).
- Se verifico que la comprobacion detecta errores de verdad. Se introdujeron a proposito tres erratas en el adaptador: una columna (`mail` en `families`), un argumento (`p_enrolment_id`) y una funcion (`family_register_interes`). Las tres fallaron al comprobar. Despues se restauro el archivo.
- ESLint revisa tambien los `.ts` con `typescript-eslint` y exige `import type` para los tipos.

## Regenerar los tipos

Tras aplicar una migracion en el proyecto de pruebas hay que regenerar `data/database.types.ts` y despues ejecutar `npm run check`. Se puede hacer con la herramienta de Supabase de Claude (`generate_typescript_types`) o con la CLI de Supabase:

```bash
npx supabase gen types typescript --project-id yqvymjryecmfsoilkxgj > data/database.types.ts
```

## Verificacion (2026-10-29)

- `npm run check`: revisor limpio, las dos pasadas de tipos sin errores, 66 de 66 pruebas y compilacion correcta.
- Con Vite: el modo test arranca y conecta con el proyecto de pruebas; en el modo demo se recorrieron Familia, Pagos, Documentos y Admin sin errores en consola.
- Pendiente: entrar con una sesion real de administracion y de familia, ya con `npm run dev` en `127.0.0.1:4181`, y comprobar que se cargan los datos.
