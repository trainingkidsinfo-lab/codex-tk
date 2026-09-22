export function renderAuth({ state, testCode, appConfig }) {
  const isSupabaseTest = appConfig?.isSupabaseTest;
  const emailValue = escapeAttribute(state.pendingOtpEmail || state.family.email || "");
  return `
    <main class="auth-layout">
      <section class="auth-card">
        <div class="auth-logo" aria-label="Training Kids">
          <img src="./assets/logo-training-kids-symbol.png" alt="" />
          <span><strong>Training</strong><span>Kids</span></span>
        </div>
        <p class="eyebrow">Vista privada de prueba · ${isSupabaseTest ? "Fase C test" : "Modo demo"}</p>
        <h1>Acceso familiar</h1>
        <p class="muted">${isSupabaseTest ? "Introduce tu email autorizado. Recibiras un enlace seguro y, segun la configuracion del email, tambien un codigo temporal." : "Introduce tu correo y usa el codigo temporal de prueba. En produccion lo enviara el proveedor de autenticacion."}</p>
        ${state.connectionError ? `<div class="document-warning">${state.connectionError}</div>` : ""}
        <div class="form-grid">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" value="${emailValue}" placeholder="tu@email.com" />
          </div>
          <div class="field">
            <label for="code">${isSupabaseTest ? "Codigo temporal (opcional si usas el enlace)" : "Codigo temporal"}</label>
            <input id="code" inputmode="numeric" maxlength="8" placeholder="${isSupabaseTest ? "Codigo recibido" : "123456"}" />
          </div>
          <button class="button" onclick="login()">${isSupabaseTest ? (state.pendingOtpEmail ? "Verificar codigo" : "Solicitar codigo") : "Entrar"}</button>
          ${isSupabaseTest && state.pendingOtpEmail ? `<button class="button ghost" onclick="requestLoginCode(document.querySelector('#email').value.trim())">Solicitar codigo nuevo</button>` : ""}
          ${state.authError ? `<div class="document-warning" role="alert">${state.authError}</div>` : ""}
          ${state.authNotice ? `<div class="status-ok">${state.authNotice}</div>` : ""}
          ${isSupabaseTest ? `<p class="muted">Abre el enlace del email en este mismo navegador o introduce el codigo recibido. La sesion se conserva al recargar.</p>` : `<p class="muted">Codigo simulado para modo demo: <strong>${testCode}</strong></p>`}
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
