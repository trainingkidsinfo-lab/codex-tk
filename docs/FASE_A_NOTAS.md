# Fase A - Notas de desarrollo

## Alcance construido

- Aplicacion nueva en `tk-platform-v1`.
- Prototipo navegable sin dependencias externas.
- Acceso familiar simulado por email y codigo temporal.
- Cuenta familiar con varios tutores e hijos.
- Datos medicos y contacto de emergencia compartidos.
- Selector de servicios:
  - Training Kids operativo en prototipo.
  - Football Academy visible como interes/prealta.
  - Gym Home previsto como futuro servicio.
- Inscripcion Training Kids con tarifas configurables simuladas.
- Centros, grupos, horarios y capacidad simulados.
- Disponibilidad familiar.
- Asignacion definitiva de grupo desde admin simulado.
- Area privada familiar.
- Panel administrativo unico con filtros por servicio.
- Auditoria basica local.
- Diseño visual base con identidad Training Kids.

## Simulado en Fase A

- Autenticacion: codigo fijo `123456`.
- Base de datos: `localStorage`.
- Stripe: estados de pago de prueba sin conexion.
- Documentos y firma: aun no implementados en esta fase.
- Supabase: no conectado.
- Emails/comunicaciones: solo registros simulados.

## Decisiones tecnicas

- Se ha creado una app nueva y aislada para no tocar el ZIP original.
- Se ha elegido una version estatica para Fase A porque permite validar flujo, contenido y navegacion sin credenciales ni dependencias.
- Los datos se organizan ya con mentalidad modular: familia compartida, hijos compartidos, inscripciones por servicio.
- La interfaz separa Training Kids, Football Academy y Gym Home para evitar mezcla comercial.
- El panel administrativo usa filtros por servicio desde el inicio.

## Siguiente control antes de Fase B

Antes de conectar Supabase, Stripe o firma real, conviene aprobar:

- Flujo de pantallas.
- Jerarquia visual.
- Tarjetas de servicios.
- Tratamiento de Football Academy como prealta visible.
- Estructura de admin y filtros.
- Campos familiares, medicos y de disponibilidad.

## Revision final de Fase A

Comprobado:

- Acceso familiar simulado mediante codigo.
- Error por codigo incorrecto y reintento.
- Pantalla principal familiar.
- Alta familiar paso a paso.
- Training Kids como servicio operativo de prototipo.
- Football Academy visible como interes/prealta.
- Gym Home visible solo como servicio futuro.
- Panel administrador unico.
- Filtros por servicio.
- Centros, grupos, horarios y capacidad.
- Estados de carga, vacio, error, exito y pendiente.
- Responsive en movil, tablet y escritorio sin desbordamiento horizontal.

Correcciones aplicadas:

- Se anadio estado real de carga durante la verificacion del codigo simulado.
- Se mejoro la seleccion visual de tarjetas de hijos y tarifas.
- Se anadieron tarjetas de estados para carga, vacio y error.
- Se corrigio una ambiguedad de navegacion: el paso "Familia" paso a mostrarse como "Datos familia" para no confundirse con la pestaña principal "Familia".
- Se reforzo el comportamiento responsive de botones, estados y grids.
