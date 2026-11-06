import { getDriverStandings, getSeasonRaces } from "./f1-api.js";
import { isFinished, toDate } from "./f1-countdown.js";

const UPDATE_INTERVAL_MS = 60 * 1000;
const NO_DATA = "Gerade keine Daten";

const pad = (value) => String(value).padStart(2, "0");

/** Restzeit in Tagen, Stunden und Minuten, z. B. „3 T 04 Std 12 Min“. */
export function formatRemaining(milliseconds) {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60000);
  const days = Math.floor(minutes / 1440);
  return `${days} T ${pad(Math.floor(minutes / 60) % 24)} Std ${pad(minutes % 60)} Min`;
}

async function showNextRace(raceField, countdownField) {
  let races;
  try {
    races = await getSeasonRaces();
  } catch {
    raceField.textContent = NO_DATA;
    return;
  }

  const next = races.find((race) => !isFinished(race));
  if (!next) {
    raceField.textContent = "Saison beendet";
    return;
  }
  raceField.textContent = next.raceName;

  const update = () => {
    const remaining = toDate(next) - Date.now();
    countdownField.textContent = remaining > 0 ? formatRemaining(remaining) : "Rennen läuft";
  };
  update();
  setInterval(update, UPDATE_INTERVAL_MS);
}

async function showLeader(leaderField) {
  let standings;
  try {
    standings = await getDriverStandings();
  } catch {
    leaderField.textContent = NO_DATA;
    return;
  }

  const [leader] = standings;
  leaderField.textContent = leader
    ? `${leader.Driver.familyName}, ${leader.points} Punkte`
    : "Noch keine Wertung";
}

/**
 * Füllt den Live-Streifen der Landing mit Daten aus der F1-API.
 * Beide Anfragen sind unabhängig: fällt eine aus, bleibt die andere sichtbar.
 */
export function initF1Telemetry() {
  const root = document.querySelector("[data-f1-telemetry]");
  if (!root) return;

  const field = (name) => root.querySelector(`[data-${name}]`);
  showNextRace(field("race"), field("countdown"));
  showLeader(field("leader"));
}
