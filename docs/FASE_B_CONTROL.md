# Fase B - Control 1

## Realizado

- Inicio de Fase B sin recrear la aplicacion.
- Cambio de marca general a Training Kids.
- Conservado logo Football Academy para su seccion propia.
- Gym Home sigue visible solo como servicio futuro.
- Creado borrador de modelo de datos modular.
- Creado borrador de esquema Supabase sin ejecutar.
- Creado `README.md` de la app nueva.
- Actualizada la vista privada para mostrar Fase B.

## Importante sobre el logo

El archivo `training_kids_niños.png` se copio como `assets/logo-training-kids.png`, pero visualmente contiene mucho margen y una franja turquesa/amarilla. Para que la cabecera no quede rota, se usa provisionalmente `training_kids.png` como isotipo junto al texto Training Kids.

Football Academy mantiene `assets/logo-training-kids-football.png` y se mostrara solo dentro de su seccion.

## Sigue simulado

- Autenticacion por codigo.
- Persistencia local.
- Stripe.
- Firma.
- Supabase.
- Emails.

## No realizado

- No se ha modificado el ZIP original.
- No se han conectado credenciales.
- No se ha publicado en produccion.
- No se han introducido clausulas legales nuevas.

## Proximo bloque recomendado

Convertir el prototipo en una estructura modular de aplicacion:

- Separar datos ficticios en un modulo.
- Separar renderizado de familia, admin y servicios.
- Crear adaptador local de datos con la misma forma que tendra Supabase.
- Mantener la app funcionando con datos locales hasta aprobar conexion real.
