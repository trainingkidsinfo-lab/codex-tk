export function renderAuth({ state, testCode }) {
  return `
    <main class="auth-layout">
      <section class="auth-card">
        <div class="auth-logo" aria-label="Training Kids">
          <img src="./assets/logo-training-kids-symbol.png" alt="" />
          <span><strong>Training</strong><span>Kids</span></span>
        </div>
        <p class="eyebrow">Vista privada de prueba · Fase B</p>
        <h1>Acceso familiar</h1>
        <p class="muted">Introduce tu correo y usa el codigo temporal de prueba. En produccion lo enviara el proveedor de autenticacion.</p>
        <div class="form-grid">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" value="${state.family.email}" placeholder="tu@email.com" />
          </div>
          <div class="field">
            <label for="code">Codigo temporal</label>
            <input id="code" inputmode="numeric" maxlength="6" placeholder="123456" />
          </div>
          <button class="button" onclick="login()">Entrar</button>
          <p class="muted">Codigo simulado para Fase B: <strong>${testCode}</strong></p>
        </div>
      </section>
      <div id="toast" class="toast" role="status"></div>
    </main>
  `;
}

export function renderLoading(message = "Preparando vista privada") {
  return `
    <main class="loading-screen">
      <section class="loading-box">
        <div class="state-card loading">
          <p class="eyebrow">Fase B</p>
          <h2>${message}</h2>
          <p class="muted">Datos ficticios y locales. No se conecta ningun servicio externo.</p>
        </div>
      </section>
    </main>
  `;
}
