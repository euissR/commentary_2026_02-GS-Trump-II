// layout.js
export function getEditorialRect(container) {
  const el =
    container.closest(".field--name-body") || // Drupal prod
    container.closest("[class^='container-']") || // embedded viz wrappers
    container.parentElement || // local dev fallback
    container;

  return el.getBoundingClientRect();
}
