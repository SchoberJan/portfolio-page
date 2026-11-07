const TOUCHED_CLASS = "car-explorer--touched";
const ARMED_CLASS = "car-explorer--armed";
const DRAWING_CLASS = "car-explorer--drawing";
const DRAW_CLASS = "car-explorer__draw";
const DRAWN_LINES =
  ":is(path, rect, circle, ellipse):not(.car-explorer__zone, .car-explorer__axis, .car-explorer__dash)";

/**
 * Macht das F1-Auto bei „Über mich“ klickbar: Bauteil oder Markierung
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

  const stage = root.querySelector("[data-car-stage]");

  // Die Regeln der Animation erreichen den Inhalt von <use> nicht, darum wird die Spiegelhälfte zu echten Elementen.
  for (const mirror of stage.querySelectorAll("use")) {
    const half = stage.querySelector(mirror.getAttribute("href")).cloneNode(true);
    half.removeAttribute("id");
    half.setAttribute("transform", mirror.getAttribute("transform"));
    mirror.replaceWith(half);
  }

  // Gestrichelte Linien behalten ihr Muster und werden per CSS aufgedeckt, alle anderen zeichnen sich über die Strichlänge.
  for (const line of stage.querySelectorAll(DRAWN_LINES)) {
    line.classList.add(DRAW_CLASS);
    line.setAttribute("pathLength", "1");
  }

  // Das Auto zeichnet sich erst auf, wenn es grösstenteils im Bild ist, sonst bliebe die Animation ungesehen.
  // Erst JS blendet die Linien aus: Ohne JS oder bei reduzierter Bewegung bleiben sie sichtbar.
  root.classList.add(ARMED_CLASS);
  stage.addEventListener(
    "animationend",
    () => root.classList.remove(ARMED_CLASS, DRAWING_CLASS),
    { once: true },
  );
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      root.classList.add(DRAWING_CLASS);
      observer.disconnect();
    },
    { threshold: 0.6 },
  );
  observer.observe(stage);
}
