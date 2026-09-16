# Fase B - Modelo de datos modular

## Principio principal

Una familia y un hijo existen una sola vez. Cada servicio crea sus propias inscripciones, tarifas, documentos, grupos, calendarios, pagos y estados.

## Compartido

- `families`: unidad familiar.
- `family_members`: tutores y permisos familiares.
- `players`: hijos/jugadores.
- `medical_profiles`: datos medicos por hijo.
- `emergency_contacts`: contactos de emergencia.
- `services`: Training Kids, Football Academy y futuro Gym Home.
- `communications`: mensajes y registros.
- `audit_log`: acciones sensibles.

## Separado por servicio

- `service_locations`: centros disponibles por servicio.
- `service_seasons`: temporadas por servicio.
- `service_groups`: grupos, horarios y capacidad por servicio.
- `service_plans`: planes comerciales por servicio.
- `plan_prices`: tarifas por plan, centro, campana y visibilidad.
- `enrollments`: inscripcion de un hijo en un servicio.
- `availability_requests`: disponibilidad indicada por la familia para una inscripcion.
- `service_documents`: documentos aplicables a un servicio.
- `document_versions`: versiones de documentos.
- `signature_records`: evidencia de firma integrada.
- `payment_orders`: pagos previstos o realizados por inscripcion.
- `payment_events`: eventos economicos procedentes de Stripe prueba/futuro.

## Training Kids V1

Operativo primero:

- Alta de hijos.
- Centro.
- Disponibilidad.
- Tarifa Training Kids.
- Inscripcion.
- Estado.
- Asignacion administrativa de grupo.

Tarifas base:

- 1 dia/semana mensual: 60 EUR.
- 1 dia/semana trimestral: 150 EUR.
- 2 dias/semana mensual: 100 EUR.
- 2 dias/semana trimestral: 240 EUR.
- Matricula: 20 EUR.

Tarifas especiales:

- 2 dias/semana trimestral historica: 210 EUR, solo administracion.
- Ofertas adulto + niño solo para Gym Home Training Kids.

## Football Academy Fase B

Visible desde el inicio como informacion e interes/prealta.

Preparado para activar despues:

- Planes 4, 6 y 8 sesiones/mes.
- Temporada 9 meses.
- Tarifa general.
- Tarifa especial para Miramadrid y clientes actuales Training Kids.
- Grupos y horarios propios.
- Documentos y pagos propios.

## Gym Home futuro

No se desarrolla completo en V1.

Debe quedar previsto para:

- Reservas adultos.
- 8 plazas por sesion.
- Plazas fijas.
- Pagos de adultos.
- Packs familiares.

## Reglas de seguridad previstas

- La familia solo ve su familia y sus hijos.
- La familia no puede modificar pagos, estados economicos, grupos definitivos ni tarifas asignadas.
- Administracion modifica grupos, estados y tarifas segun permisos.
- Todo cambio sensible genera `audit_log`.
- Datos medicos requieren permisos mas restrictivos que datos basicos.

## Marca en Fase B

- La cabecera general usa Training Kids como marca principal.
- Football Academy conserva su logo especifico dentro de su seccion.
- El archivo recibido `training_kids_niños.png` queda copiado como recurso, pero contiene mucho margen y una franja de color; por eso la cabecera usa provisionalmente el isotipo `training_kids.png` junto al texto Training Kids para mantener una vista limpia.
