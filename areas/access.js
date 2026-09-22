export function renderAuth({ state, testCode, appConfig }) {
  const isSupabaseTest = appConfig?.isSupabaseTest;
  const isOtpStep = isSupabaseTest && Boolean(state.pendingOtpEmail);
  const emailValue = escapeAttribute(state.authEmailDraft || state.pendingOtpEmail || state.family.email || "");
  const resendSeconds = Math.max(0, Math.ceil(((state.resendAvailableAt || 0) - Date.now()) / 1000));
  const requestDisabled = Boolean(state.authRequestInFlight);
  const verifyDisabled = Boolean(state.authVerifyInFlight);
  return `
    <main class="auth-layout">
      <section class="auth-card">
        <div class="auth-logo" aria-label="Training Kids">
          <img src="./assets/logo-training-kids-symbol.png" alt="" />
          <span><strong>Training</strong><span>Kids</span></span>
        </div>
        <p class="eyebrow">Vista privada de prueba · ${isSupabaseTest ? "Fase C test" : "Modo demo"}</p>
        <h1>Acceso</h1>
        <p class="muted">${isSupabaseTest ? "Te enviaremos un código temporal. En este dispositivo mantendremos tu sesión iniciada." : "Introduce tu correo y usa el código temporal de prueba."}</p>
        ${state.connectionError ? `<div class="document-warning" role="alert">${escapeHtml(state.connectionError)}</div>` : ""}
        <div class="form-grid">
          <div class="field">
            <label for="email">Correo electrónico</label>
            <input id="email" type="email" value="${emailValue}" placeholder="tu@email.com" ${isOtpStep ? "readonly" : ""} />
          </div>
          ${isOtpStep || !isSupabaseTest ? `
            <div class="field">
              <label for="code">${isSupabaseTest ? "Código de acceso" : "Código temporal"}</label>
              <input id="code" inputmode="numeric" autocomplete="one-time-code" placeholder="${isSupabaseTest ? "Introduce el código recibido" : "123456"}" />
            </div>
          ` : ""}
          ${isSupabaseTest
            ? isOtpStep
              ? `<button class="button" onclick="login()" ${verifyDisabled ? "disabled" : ""}>${verifyDisabled ? "Comprobando..." : "Acceder"}</button>
                 <button class="button ghost" onclick="requestLoginCode(document.querySelector('#email').value.trim())" ${requestDisabled || resendSeconds > 0 ? "disabled" : ""}>${requestDisabled ? "Enviando..." : resendSeconds > 0 ? `Reenviar código (${resendSeconds} s)` : "Reenviar código"}</button>
                 <button class="button ghost" onclick="changeLoginEmail()" ${requestDisabled || verifyDisabled ? "disabled" : ""}>Cambiar correo</button>`
              : `<button class="button" onclick="requestLoginCode(document.querySelector('#email').value.trim())" ${requestDisabled ? "disabled" : ""}>${requestDisabled ? "Enviando..." : "Enviar código"}</button>`
            : `<button class="button" onclick="login()">Entrar</button>`}
          ${state.authError ? `<div class="document-warning" role="alert">${escapeHtml(state.authError)}</div>` : ""}
          ${state.authNotice ? `<div class="status-ok">${escapeHtml(state.authNotice)}</div>` : ""}
          ${!isSupabaseTest ? `<p class="muted">Codigo simulado para modo demo: <strong>${testCode}</strong></p>` : ""}
        </div>
      </section>
      <div id="toast" class="toast" role="status"></div>
    </main>
  `;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return escapeAttribute(value).replaceAll("'", "&#39;");
}

export function renderLoading(message = "Preparando vista privada", isSupabaseTest = false) {
  return `
    <main class="loading-screen">
      <section class="loading-box">
        <div class="state-card loading">
          <p class="eyebrow">${isSupabaseTest ? "Fase C · Supabase test" : "Modo demo"}</p>
          <h2>${message}</h2>
          <p class="muted">${isSupabaseTest ? "Cargando datos ficticios privados desde Supabase." : "Datos ficticios y locales. No se conecta ningun servicio externo."}</p>
        </div>
      </section>
    </main>
  `;
}
