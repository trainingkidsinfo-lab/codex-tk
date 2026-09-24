export function renderAuth({ state, testCode, appConfig }) {
  const isSupabaseTest = appConfig?.isSupabaseTest;
  const isLinkSent = isSupabaseTest && Boolean(state.pendingLinkEmail);
  const emailValue = escapeAttribute(state.authEmailDraft || state.pendingLinkEmail || state.family.email || "");
  const resendSeconds = Math.max(0, Math.ceil(((state.resendAvailableAt || 0) - Date.now()) / 1000));
  const requestDisabled = Boolean(state.authRequestInFlight);
  return `
    <main class="auth-layout">
      <section class="auth-card">
        <div class="auth-logo" aria-label="Training Kids">
          <img src="./assets/logo-training-kids-symbol.png" alt="" />
          <span><strong>Training</strong><span>Kids</span></span>
        </div>
        <p class="eyebrow">Vista privada de prueba · ${isSupabaseTest ? "Fase D test" : "Modo demo"}</p>
        <h1>Acceso</h1>
        <p class="muted">${isSupabaseTest ? "Te enviaremos un enlace seguro para iniciar sesión. En este dispositivo mantendremos tu sesión iniciada." : "Introduce tu correo y usa el código temporal de prueba."}</p>
        ${state.connectionError ? `<div class="document-warning" role="alert">${escapeHtml(state.connectionError)}</div>` : ""}
        ${state.authDiagnostics ? `<div class="validation-box" role="status"><strong>Diagnóstico seguro</strong><br>Etapa: ${escapeHtml(state.authDiagnostics.stage)} · Evento: ${escapeHtml(state.authDiagnostics.event)} · Sesión: ${state.authDiagnostics.hasSession ? "sí" : "no"} · Código: ${escapeHtml(state.authDiagnostics.code)}${state.authDiagnostics.projectMatches !== undefined ? `<br>Proyecto JWT: ${state.authDiagnostics.projectMatches ? "coincide" : "no coincide"} · Rol JWT: ${escapeHtml(state.authDiagnostics.jwtRole || "sin rol")} · Caducado: ${state.authDiagnostics.jwtExpired ? "sí" : "no"} · Algoritmo: ${escapeHtml(state.authDiagnostics.jwtAlgorithm || "desconocido")}` : ""}${state.authDiagnostics.postgrest ? `<br>PostgREST: HTTP ${escapeHtml(state.authDiagnostics.postgrest.status)} · ${escapeHtml(state.authDiagnostics.postgrest.authorization)} · ${escapeHtml(state.authDiagnostics.postgrest.message || "sin detalle")}` : ""}</div>` : ""}
        <div class="form-grid">
          <div class="field">
            <label for="email">Correo electrónico</label>
            <input id="email" type="email" value="${emailValue}" placeholder="tu@email.com" ${isLinkSent ? "readonly" : ""} />
          </div>
          ${!isSupabaseTest ? `
            <div class="field">
              <label for="code">Código temporal</label>
              <input id="code" inputmode="numeric" placeholder="123456" />
            </div>
          ` : ""}
          ${isSupabaseTest
            ? isLinkSent
              ? `<button class="button ghost" onclick="requestLoginLink(document.querySelector('#email').value.trim())" ${requestDisabled || resendSeconds > 0 ? "disabled" : ""}>${requestDisabled ? "Enviando..." : resendSeconds > 0 ? `Reenviar enlace (${resendSeconds} s)` : "Reenviar enlace"}</button>
                 <button class="button ghost" onclick="changeLoginEmail()" ${requestDisabled ? "disabled" : ""}>Cambiar correo</button>`
              : `<button class="button" onclick="requestLoginLink(document.querySelector('#email').value.trim())" ${requestDisabled ? "disabled" : ""}>${requestDisabled ? "Enviando..." : "Enviar enlace de acceso"}</button>`
            : `<button class="button" onclick="login()">Entrar</button>`}
          ${state.authError ? `<div class="document-warning" role="alert">${escapeHtml(state.authError)}</div>` : ""}
          ${state.authNotice ? `<div class="status-ok">${escapeHtml(state.authNotice)}</div>` : ""}
          ${isSupabaseTest && !isLinkSent ? `<p class="muted">Abre el enlace recibido en este mismo navegador.</p>` : ""}
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
          <p class="eyebrow">${isSupabaseTest ? "Fase D · Supabase test" : "Modo demo"}</p>
          <h2>${message}</h2>
          <p class="muted">${isSupabaseTest ? "Cargando datos ficticios privados desde Supabase." : "Datos ficticios y locales. No se conecta ningun servicio externo."}</p>
        </div>
      </section>
    </main>
  `;
}
