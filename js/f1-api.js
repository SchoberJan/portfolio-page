const BASE_URL = "https://api.jolpi.ca/ergast/f1";
const CACHE_PREFIX = "f1:";
// Daten ändern sich nur an Rennwochenenden; schont das Limit der API (500 Anfragen/h)
const CACHE_TTL_MS = 60 * 60 * 1000;
// Die API lehnt mehr als 4 Anfragen pro Sekunde ab (Status 429)
const BURST_LIMIT = 4;
const BURST_WINDOW_MS = 1000;
const recentStarts = [];

/** Wartet, bis im letzten Zeitfenster weniger als BURST_LIMIT Anfragen gestartet wurden. */
async function waitForSlot() {
  for (;;) {
    const now = Date.now();
    while (recentStarts.length && now - recentStarts[0] >= BURST_WINDOW_MS) recentStarts.shift();
    if (recentStarts.length < BURST_LIMIT) {
      recentStarts.push(now);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, BURST_WINDOW_MS - (now - recentStarts[0])));
  }
}

// Laufende Anfragen: fragen zwei Module gleichzeitig dasselbe ab, geht nur eine Anfrage raus
const pending = new Map();

/**
 * Holt Daten von der Jolpica-F1-API (Nachfolger der Ergast-API).
 * Antworten werden im localStorage zwischengespeichert. Schlägt die Anfrage fehl,
 * dient ein abgelaufener Cache-Eintrag als Notlösung.
 */
function request(path) {
  const cached = readCache(CACHE_PREFIX + path);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return Promise.resolve(cached.data);

  if (!pending.has(path)) {
    pending.set(path, fetchAndCache(path, cached).finally(() => pending.delete(path)));
  }
  return pending.get(path);
}

async function fetchAndCache(path, cached) {
  const key = CACHE_PREFIX + path;
  try {
    await waitForSlot();
    const response = await fetch(`${BASE_URL}/${path}`);
    if (!response.ok) throw new Error(`F1-API antwortet mit Status ${response.status}`);
    const { MRData } = await response.json();
    writeCache(key, MRData);
    return MRData;
  } catch (error) {
    if (cached) return cached.data;
    throw error;
  }
}

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ time: Date.now(), data }));
  } catch {
    // Speicher voll oder gesperrt (z. B. privater Modus): dann ohne Cache weiter
  }
}

/** Alle Rennen der laufenden Saison inkl. Sessions und Strecke. */
export async function getSeasonRaces() {
  const data = await request("current.json?limit=100");
  return data.RaceTable.Races;
}

/** Die ersten drei eines Rennens der laufenden Saison – leer, solange kein Ergebnis vorliegt. */
export async function getPodium(round) {
  const data = await request(`current/${encodeURIComponent(round)}/results.json?limit=3`);
  return data.RaceTable.Races[0]?.Results ?? [];
}

/** Aktueller WM-Stand aller Fahrer. */
export async function getDriverStandings() {
  const data = await request("current/driverStandings.json?limit=100");
  return data.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
}

// Die API liefert höchstens 100 Einträge pro Seite
const PAGE_SIZE = 100;

/**
 * Lädt alle Seiten eines Saison-Endpunkts und führt sie zu einer Liste von Rennen
 * zusammen. Ein Rennen kann über zwei Seiten verteilt sein; seine Einträge
 * (resultKey, z. B. „Results“) werden dann aneinandergehängt.
 */
async function requestAllRaces(endpoint, resultKey) {
  const page = (offset) => request(`${endpoint}?limit=${PAGE_SIZE}&offset=${offset}`);
  const first = await page(0);
  const offsets = [];
  for (let offset = PAGE_SIZE; offset < Number(first.total); offset += PAGE_SIZE) offsets.push(offset);
  const pages = [first, ...(await Promise.all(offsets.map(page)))];

  const races = new Map();
  for (const race of pages.flatMap((data) => data.RaceTable.Races)) {
    const existing = races.get(race.round);
    if (existing) existing[resultKey].push(...race[resultKey]);
    else races.set(race.round, { ...race, [resultKey]: [...race[resultKey]] });
  }
  return [...races.values()];
}

/** Rennergebnisse aller Fahrer der laufenden Saison (Races[].Results). */
export const getSeasonResults = () => requestAllRaces("current/results.json", "Results");

/** Sprintergebnisse aller Fahrer der laufenden Saison (Races[].SprintResults). */
export const getSeasonSprints = () => requestAllRaces("current/sprint.json", "SprintResults");

/** Qualifying-Ergebnisse aller Fahrer der laufenden Saison (Races[].QualifyingResults). */
export const getSeasonQualifying = () => requestAllRaces("current/qualifying.json", "QualifyingResults");
