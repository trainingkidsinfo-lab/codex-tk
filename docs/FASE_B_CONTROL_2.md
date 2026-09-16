# Fase B - Control 2

## Objetivo

Separar el prototipo navegable en una estructura modular sin cambiar el funcionamiento visible para familias ni administracion.

## Resultado

- Datos ficticios movidos a `data/mock-data.js`.
- Persistencia local movida a `data/local-adapter.js`.
- Pantallas separadas por area: acceso, familia, administracion, Training Kids, Football Academy, Gym Home futuro y diseño.
- Componentes y helpers comunes movidos a `ui/shared.js`.
- `app.js` queda como coordinador de estado, acciones y renderizado.

## Regla tecnica

Las pantallas no deben depender directamente de `localStorage`. Solo trabajan con el estado recibido y con acciones globales simuladas. Cuando se apruebe Supabase, el primer cambio natural sera sustituir el adaptador local por uno remoto.

## Servicios

- Training Kids: operativo en el prototipo.
- Football Academy: visible como informacion y prealta.
- Gym Home: visible solo como futuro servicio.

## Simulado

- Acceso por codigo temporal.
- Datos familiares.
- Inscripciones.
- Asignacion de grupo.
- Pago de prueba.
- Auditoria basica.

## Pendiente de fases posteriores

- Supabase real.
- Stripe real.
- Firma real.
- Emails o comunicaciones reales.
- Publicacion.
