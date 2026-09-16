export function renderDesign() {
  return `
    <section class="panel pad">
      <p class="eyebrow">Sistema visual Fase B</p>
      <h1>Deportivo, claro y familiar</h1>
      <p class="muted">Tokens visuales base: turquesa #00B8B8, amarillo #F8B000, azul marino, blanco y gris muy claro. Componentes con radio contenido, contraste alto y botones grandes.</p>
      <div class="grid four">
        <div class="stat" style="background:#00b8b8;color:white"><strong style="color:white">TK</strong><span>Turquesa</span></div>
        <div class="stat" style="background:#f8b000;color:#06254a"><strong>TK</strong><span>Amarillo</span></div>
        <div class="stat" style="background:#06254a;color:white"><strong style="color:white">TK</strong><span>Azul marino</span></div>
        <div class="stat"><strong>TK</strong><span>Blanco/gris</span></div>
      </div>
    </section>
    <section class="section-title"><h2>Estados simulados</h2></section>
    <div class="state-strip">
      <article class="state-card loading"><span class="badge turquoise">Carga</span><h3>Verificando codigo</h3><p class="muted">Estado usado en el acceso simulado.</p></article>
      <article class="state-card"><span class="badge">Vacio</span><h3>Sin registros</h3><p class="muted">Se muestra en filtros sin inscripciones o grupos.</p></article>
      <article class="state-card error"><span class="badge red">Error</span><h3>Codigo incorrecto</h3><p class="muted">Mensaje con reintento mediante aviso inferior.</p></article>
      <article class="state-card"><span class="badge green">Exito</span><h3>Guardado progresivo</h3><p class="muted">LocalStorage en Fase B.</p></article>
      <article class="state-card"><span class="badge yellow">Pendiente</span><h3>Football Academy</h3><p class="muted">Interes y prealta visibles.</p></article>
      <article class="state-card error"><span class="badge red">Atencion</span><h3>Capacidad completa</h3><p class="muted">Avisos de grupo lleno.</p></article>
    </div>
  `;
}
