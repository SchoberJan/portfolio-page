const TOUCHED_CLASS = "car-explorer--touched";
const ARMED_CLASS = "car-explorer--armed";
const DRAWING_CLASS = "car-explorer--drawing";
const DRAW_CLASS = "car-explorer__draw";
const DETAIL_CLASS = "car-explorer--detail";
const DRAWN_LINES =
  ":is(path, rect, circle, ellipse):not(.car-explorer__zone, .car-explorer__axis, .car-explorer__dash)";
// Breite der Zeichnung im viewBox des SVG
const DRAWING_WIDTH = 1000;
// Markierungen bleiben mit ihrer Tippfläche von 44px ganz im Ausschnitt
const EDGE_PX = 28;
const HINT_OPEN = "Wähle einen Punkt am Auto, um mehr über mich zu erfahren.";
const HINT_CLOSE = "Ein erneuter Klick auf den Punkt zeigt wieder das ganze Auto.";

/**
 * Kamera für die Einzelheit: setzt den Ausschnitt eines Bauteils (in Einheiten der Zeichnung)
 * so gross wie möglich und zentriert in die Fläche der Einzelheit (in px).
 */
export function fitDetail([x, y, width, height], unit, areaWidth, areaHeight) {
  const zoom = Math.min(areaWidth / (width * unit), areaHeight / (height * unit));
  return {
    zoom,
    x: areaWidth / 2 - (x + width / 2) * unit * zoom,
    y: areaHeight / 2 - (y + height / 2) * unit * zoom,
  };
}

/** Massstab wie auf einer technischen Zeichnung, z. B. „M 2,3 : 1“ oder „M 1 : 1,8“. */
export function formatScale(zoom) {
  const number = (value) =>
    value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return zoom >= 1 ? `M ${number(zoom)} : 1` : `M 1 : ${number(1 / zoom)}`;
}

/**
 * Macht das F1-Auto bei „Über mich“ klickbar. Ohne Auswahl steht das ganze Auto gross da.
 * Ein Bauteil zeigt es als Einzelheit wie auf einem Bauplan, sein Text erscheint daneben;
 * ein erneuter Klick oder Escape führt zurück zum ganzen Auto.
 */
export function initCarExplorer() {
  const root = document.querySelector("[data-car-explorer]");
  if (!root) return;

  const stage = root.querySelector("[data-car-stage]");
  const detail = root.querySelector(".car-explorer__detail");
  const scale = root.querySelector("[data-car-scale]");
  const hint = root.querySelector("[data-car-hint]");
  const controls = [...root.querySelectorAll("[data-part]")];
  const hotspots = [...stage.querySelectorAll("button[data-part]")];
  const panels = [...root.querySelectorAll("[data-panel]")];
  let current = null;

  /** Fährt die Kamera auf das gewählte Bauteil; die Markierungen bleiben auf ihren Hinweislinien. */
  const layout = () => {
    const hotspot = hotspots.find((button) => button.dataset.part === current);
    const unit = stage.clientWidth / DRAWING_WIDTH;
    const camera = hotspot
      ? fitDetail(hotspot.dataset.focus.split(" ").map(Number), unit, detail.clientWidth, stage.clientHeight)
      : { zoom: 1, x: 0, y: 0 };
    // Die Kamera sitzt im SVG und rechnet darum in Einheiten der Zeichnung statt in px
    stage.style.setProperty("--car-x", `${camera.x / unit}px`);
    stage.style.setProperty("--car-y", `${camera.y / unit}px`);
    stage.style.setProperty("--car-zoom", camera.zoom);

    for (const button of hotspots) {
      // offsetLeft/-Top ist die Lage ohne Kamera, die Verschiebung kommt über „translate“ dazu
      const x = camera.x + button.offsetLeft * camera.zoom;
      const y = Math.max(EDGE_PX, camera.y + button.offsetTop * camera.zoom);
      button.style.setProperty("--dx", `${x - button.offsetLeft}px`);
      button.style.setProperty("--dy", `${y - button.offsetTop}px`);
      // Ausserhalb der Einzelheit abgeschnitten: dann auch nicht per Tastatur erreichbar
      button.inert = Boolean(hotspot) && (x < EDGE_PX || x > detail.clientWidth - EDGE_PX);
    }
    if (hotspot) {
      const name = panels.find((panel) => panel.dataset.panel === current).querySelector(".car-explorer__label");
      scale.textContent = `Einzelheit ${name.textContent.trim()} · ${formatScale(camera.zoom)}`;
    }
  };

  const select = (part) => {
    current = part;
    root.classList.toggle(DETAIL_CLASS, Boolean(part));
    for (const control of controls) {
      const active = control.dataset.part === part;
      control.toggleAttribute("data-active", active);
      if (control.hasAttribute("aria-pressed")) {
        control.setAttribute("aria-pressed", String(active));
      }
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== part;
    hint.textContent = part ? HINT_CLOSE : HINT_OPEN;
    layout();
  };

  root.addEventListener("click", (event) => {
    const control = event.target.closest("[data-part]");
    if (!control) return;
    root.classList.add(TOUCHED_CLASS);
    // Erneuter Klick auf das gewählte Bauteil hebt die Auswahl auf
    select(control.dataset.part === current ? null : control.dataset.part);
    // Auf kleinen Bildschirmen steht der Text unter dem Auto und läge sonst ausserhalb des Bildes
    if (current) root.querySelector(".car-explorer__panels").scrollIntoView({ block: "nearest" });
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !current) return;
    const hotspot = hotspots.find((button) => button.dataset.part === current);
    select(null);
    hotspot.focus();
  });

  // Breite ändert sich (Drehen, Fenstergrösse): Kamera und Markierungen neu ausrichten
  new ResizeObserver(layout).observe(stage);

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
