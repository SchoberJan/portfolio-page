const INITIAL_PART = "power";
const TOUCHED_CLASS = "car-explorer--touched";
const ARMED_CLASS = "car-explorer--armed";
const DRAWING_CLASS = "car-explorer--drawing";

/**
 * Macht das F1-Auto bei „Über mich“ klickbar: Bauteil oder Nummer
 * wählen ein Bauteil, sein Text erscheint daneben.
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
    // Auf kleinen Bildschirmen läge der Text sonst unter dem sichtbaren Bereich
    root.querySelector(".car-explorer__panels").scrollIntoView({ block: "nearest" });
  });

  show(INITIAL_PART);

  // Das Auto zeichnet sich erst auf, wenn es grösstenteils im Bild ist, sonst bliebe die Animation ungesehen.
  // Erst JS blendet die Linien aus: Ohne JS oder bei reduzierter Bewegung bleiben sie sichtbar.
  root.classList.add(ARMED_CLASS);
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      root.classList.add(DRAWING_CLASS);
      observer.disconnect();
    },
    { threshold: 0.6 },
  );
  observer.observe(root.querySelector("[data-car-stage]"));
}
