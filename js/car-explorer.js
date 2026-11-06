const INITIAL_PART = "power";
const TOUCHED_CLASS = "car-explorer--touched";
const DRAWING_CLASS = "car-explorer--drawing";

/**
 * Macht das F1-Auto bei „Über mich“ klickbar: Bauteil, Nummer oder Foto
 * wählen ein Bauteil, sein Text und sein Foto werden hervorgehoben.
 */
export function initCarExplorer() {
  const root = document.querySelector("[data-car-explorer]");
  if (!root) return;

  const controls = [...root.querySelectorAll("[data-part]")];
  const panels = [...root.querySelectorAll("[data-panel]")];

  const show = (part) => {
    for (const control of controls) {
      const active = control.dataset.part === part;
      control.toggleAttribute("data-active", active);
      if (control.hasAttribute("aria-pressed")) {
        control.setAttribute("aria-pressed", String(active));
      }
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== part;
  };

  root.addEventListener("click", (event) => {
    const control = event.target.closest("[data-part]");
    if (!control) return;
    root.classList.add(TOUCHED_CLASS);
    show(control.dataset.part);
  });

  show(INITIAL_PART);

  // Das Auto zeichnet sich erst auf, wenn es ins Bild kommt, sonst bliebe die Animation ungesehen
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    root.classList.add(DRAWING_CLASS);
    observer.disconnect();
  });
  observer.observe(root.querySelector("[data-car-stage]"));
}
