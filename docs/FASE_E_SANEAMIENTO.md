# Fase E - Saneamiento del frontend

## Alcance

Fase sin cambios en Supabase. No se han ejecutado ni modificado migraciones, seed ni SQL remoto. La solicitud ficticia `77777777-7777-7777-7777-777777777771` no se ha tocado.

## Cambios

### Seguridad

- Nuevo helper unico `ui/escape.js` con `escapeHtml` y `jsArg`.
- Todas las plantillas de `areas/` y `ui/shared.js` escapan los datos procedentes de familias, administracion o Supabase antes de insertarlos con `innerHTML`.
- Los identificadores usados en manejadores `onclick` se pasan con `jsArg`, que genera un literal JS seguro dentro del atributo.
- Las observaciones de revision, que escribe administracion y lee la familia, se muestran como texto.
- Las URLs `data:` de firmas y PDFs solo se aceptan si tienen el tipo esperado.
- `supabase-js` se carga con version exacta `2.103.0` en lugar de `@2`.

### Experiencia administrativa

- Las decisiones `approve`, `request_changes` y `reject` se confirman con el mismo cuadro en pagina que activar y dar de baja. Se elimina `window.confirm`.
- Mientras hay una confirmacion abierta, los botones de decision quedan desactivados.
- El selector de grupo conserva la eleccion pendiente en modo test y muestra el nombre del grupo en lugar del identificador.
- El contador de hijos del panel suma todas las familias cargadas.

### Familia y documentos

- La pestaña Diseño solo aparece en modo demo o para administracion.
- El boton de salir tiene etiqueta accesible.
- Etiquetas `label for` en los formularios de familia, salud, centro, disponibilidad y firma.
- Foco visible para teclado en todos los controles.
- Los pasos del flujo documental son una lista ordenada con el paso actual marcado.
- "Ver documento" de la Normativa abre el PDF en lugar de descargar el `.docx`.
- Los pagos remotos se muestran en modo lectura, sin botones de simulacion.

### Limpieza

- Retiradas del codigo las plantillas SEPA, ficha medica, contacto de emergencia, proteccion de datos del contrato anual y prealta documental de Football Academy.
- Retiradas las fuentes legales del contrato anual y del mandato SEPA. Los archivos originales siguen en `original-documents/`.
- Retirado `footballPlans`, que no se usaba y contenia importes no aprobados.
- Retirado el flujo de aceptacion de documentos informativos, que no tenia acceso desde la interfaz.
- Eliminados `supabase-schema-draft.sql` y el PDF generado en `output/pdf/`.
- Todos los modulos internos usan el mismo sufijo de cache `?v=e1`, para evitar instancias duplicadas.

## Pruebas

`package.json` declara `"type": "module"` y el script `npm test`, que ejecuta `node --test tests/*.test.mjs`.

Pruebas nuevas:

- `tests/escape-html.test.mjs`
- `tests/templates-escaping.test.mjs`
- `tests/active-documents.test.mjs`

Verificacion realizada el 2026-10-28 sin Node instalado: las 7 suites se ejecutaron en navegador con sustitutos de `node:test`, `node:assert` y `node:fs`. Resultado: 27 de 27 correctas. Las 6 pruebas de escapado fallan contra `main`, lo que confirma que detectan el problema.

Pendiente: ejecutar `npm test` con Node 20 o superior en un equipo que lo tenga instalado.

## Pendiente de decision

- D8: los correos personales siguen en `docs/FASE_C_SUPABASE_TEST.md` y en la migracion aplicada `202609180001`. La migracion no se modifica.
- Lint: no se ha añadido ESLint porque requiere instalar dependencias con npm.
