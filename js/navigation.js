const DESKTOP_QUERY = "(min-width: 768px)";

/**
 * Steuert das Hamburger-Menü auf kleinen Bildschirmen:
 * öffnen/schliessen per Button, Schliessen bei Link-Klick, Escape oder Wechsel auf Desktop.
 */
export function initNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (!toggle || !nav) return;

  const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Menü schliessen" : "Menü öffnen");
    nav.classList.toggle("site-nav--open", open);
  };

  toggle.addEventListener("click", () => setOpen(!isOpen()));

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  window.matchMedia(DESKTOP_QUERY).addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}
