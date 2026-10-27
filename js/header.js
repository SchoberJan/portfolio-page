const SCROLL_THRESHOLD = 8;

/**
 * Zeigt eine Trennlinie unter dem Header, sobald die Seite gescrollt wurde.
 */
export function initHeader() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const update = () => {
    header.classList.toggle("site-header--scrolled", window.scrollY > SCROLL_THRESHOLD);
  };

  window.addEventListener("scroll", update, { passive: true });
  update();
}
