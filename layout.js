// layout.js
export function getLayoutConfig(container) {
  const host =
    container.closest(".field--name-body") ||
    container.closest("[class^='container-']") ||
    container.parentElement ||
    container;

  const rect = host.getBoundingClientRect();

  const widthMode = container.dataset.width || "full";
  const widthFactor = widthMode === "half" ? 0.5 : 1;

  return {
    width: rect.width * widthFactor,
    height: rect.height,
  };
}

// 🔒 backwards compatibility
export function getEditorialRect(container) {
  const { width, height } = getLayoutConfig(container);
  return { width, height };
}
