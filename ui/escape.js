// Escapado unico para plantillas HTML construidas con template strings.
// Todo dato que proceda de familias, administracion o Supabase debe pasar por aqui
// antes de insertarse en innerHTML.

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// Argumento seguro para manejadores inline: onclick="accion(${jsArg(id)})".
// Produce un literal JS entre comillas dobles y lo escapa para el atributo HTML.
export function jsArg(value) {
  return escapeHtml(JSON.stringify(value === null || value === undefined ? "" : String(value)));
}
