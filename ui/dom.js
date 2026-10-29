// Acceso tipado a campos de formulario. Devuelve null si el campo no esta en pantalla.

/** @param {string} selector */
export const inputAt = (selector) => /** @type {HTMLInputElement | null} */ (document.querySelector(selector));

/** @param {string} selector */
export const inputsAt = (selector) => /** @type {HTMLInputElement[]} */ ([...document.querySelectorAll(selector)]);
