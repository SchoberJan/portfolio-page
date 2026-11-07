import { getCurrentYear } from "./f1-api.js";

export const SEASON_CHANGE = "f1:season-change";

/**
 * Auswahl zwischen laufender und letzter Saison für Kalender und Diagramm.
 * Die letzte Saison ergibt sich aus dem Jahr von „current“: Wechselt die API
 * zur neuen Saison, rückt die abgeschlossene von selbst nach.
 */
export async function initSeasonSwitch() {
  const root = document.querySelector("[data-season-switch]");
  if (!root) return;

  let year;
  try {
    year = await getCurrentYear();
  } catch {
    // Ohne Jahr bleibt die Auswahl verborgen, Kalender und Diagramm melden den Fehler selbst
    return;
  }

  const buttons = [...root.querySelectorAll("[data-season]")];
  const [current, last] = buttons;
  current.textContent = year;
  last.textContent = year - 1;
  last.dataset.season = year - 1;

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-season]");
    if (!button || button.getAttribute("aria-pressed") === "true") return;
    for (const other of buttons) {
      other.setAttribute("aria-pressed", String(other === button));
    }
    document.dispatchEvent(
      new CustomEvent(SEASON_CHANGE, { detail: button.dataset.season }),
    );
  });
  root.hidden = false;
}
