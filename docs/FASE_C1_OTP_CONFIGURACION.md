# Mejora futura - Plantilla OTP de Supabase

Esta configuracion no debe aplicarse todavia. Mientras Supabase mantenga bloqueada la edicion de la plantilla sin SMTP, la aplicacion utiliza temporalmente el magic link predeterminado.

Antes de produccion se configurara un dominio, SMTP corporativo y esta plantilla basada en `{{ .Token }}`. No deben solicitarse ni guardarse credenciales SMTP durante la fase actual.

## Donde configurarla

Cuando exista SMTP corporativo:

1. Abrir `Supabase -> Authentication -> Email Templates`.
2. Entrar en `Magic Link / OTP`.
3. Sustituir el asunto y el cuerpo por los contenidos siguientes.
4. Guardar los cambios.

La plantilla debe mostrar `{{ .Token }}`. No debe contener `{{ .ConfirmationURL }}` porque el acceso de la aplicacion se realiza introduciendo el codigo en la misma pantalla.

## Asunto recomendado

```text
Tu codigo de acceso a Training Kids
```

## HTML

```html
<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f4f8f8;font-family:Arial,sans-serif;color:#0b2851;">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #dce8e8;border-radius:8px;padding:32px;">
        <div style="font-size:24px;font-weight:700;margin-bottom:24px;">
          <span style="color:#36b7b4;">TRAINING</span>
          <span style="color:#f4b62a;">KIDS</span>
        </div>
        <h1 style="font-size:24px;margin:0 0 12px;">Tu codigo de acceso</h1>
        <p style="font-size:16px;line-height:1.5;margin:0 0 24px;">
          Introduce este codigo temporal en la pantalla de acceso de Training Kids:
        </p>
        <div style="background:#eef8f7;border:1px solid #36b7b4;border-radius:8px;padding:18px;text-align:center;font-size:32px;font-weight:700;letter-spacing:4px;">
          {{ .Token }}
        </div>
        <p style="font-size:14px;line-height:1.5;color:#52647a;margin:24px 0 0;">
          Si no has solicitado este codigo, puedes ignorar este correo.
        </p>
      </div>
    </div>
  </body>
</html>
```

## Texto alternativo

```text
Training Kids

Tu codigo temporal de acceso es: {{ .Token }}

Introducelo en la pantalla de acceso de Training Kids.
Si no has solicitado este codigo, puedes ignorar este correo.
```

No incluir en la plantilla la publishable key, `service_role`, secret keys, contrasenas, tokens privados ni credenciales SMTP. El SMTP corporativo queda pendiente para produccion.
