import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml, jsArg } from "../ui/escape.js";

test("escapeHtml neutraliza los cinco caracteres especiales", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("escapeHtml devuelve cadena vacia para null y undefined", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(0), "0");
});

test("jsArg produce un literal JS seguro dentro de un atributo", () => {
  const value = `x');alert(1);//"`;
  const attr = jsArg(value);
  assert.equal(attr.includes("'"), false);
  assert.equal(attr.includes('"'), false);
  const decoded = attr.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
  assert.equal(JSON.parse(decoded), value);
});
