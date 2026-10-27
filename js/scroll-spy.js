const ACTIVE_CLASS = "site-nav__link--active";

/**
 * Markiert den Navigationslink des Abschnitts, der gerade die Bildschirmmitte kreuzt.
 */
export function initScrollSpy() {
  const links = [...document.querySelectorAll(".site-nav__link[href^='#']")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (sections.length === 0) return;

  const setActive = (id) => {
    for (const link of links) {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle(ACTIVE_CLASS, active);
      if (active) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    },
    { rootMargin: "-50% 0px -50% 0px" },
  );

  for (const section of sections) observer.observe(section);
}
