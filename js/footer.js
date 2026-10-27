/**
 * Setzt das aktuelle Jahr im Copyright-Hinweis.
 */
export function initFooter() {
  const year = String(new Date().getFullYear());
  for (const element of document.querySelectorAll("[data-current-year]")) {
    element.textContent = year;
  }
}
