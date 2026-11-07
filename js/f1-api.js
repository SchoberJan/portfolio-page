const BASE_URL = "https://api.jolpi.ca/ergast/f1";
const CACHE_PREFIX = "f1:";
// Daten ändern sich nur an Rennwochenenden; schont das Limit der API (500 Anfragen/h)
const CACHE_TTL_MS = 60 * 60 * 1000;
// Eine abgeschlossene Saison ändert sich nicht mehr, nur „current“ muss frisch bleiben
const ARCHIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CURRENT_SEASON = "current";
// Die API lehnt mehr als 4 Anfragen pro Sekunde ab (Status 429). Das Fenster ist länger als
// eine Sekunde, weil Anfragen durch Netzschwankungen dichter beim Server ankommen können.
const BURST_LIMIT = 4;
const BURST_WINDOW_MS = 1200;
// Nach einer Ablehnung sperrt die API rund 10 Sekunden (Retry-After). Der Browser kann den
// Header nicht lesen, weil der 429-Antwort die CORS-Freigabe fehlt, darum ein fester Wert.
const RETRY_PAUSE_MS = 12 * 1000;
const RETRIES = 2;
const recentStarts = [];
let pausedUntil = 0;

/** Wartet eine laufende Sperre ab und bis im letzten Zeitfenster weniger als BURST_LIMIT Anfragen gestartet wurden. */
async function waitForSlot() {
  for (;;) {
    const now = Date.now();
    if (now < pausedUntil) {
      await new Promise((resolve) => setTimeout(resolve, pausedUntil - now));
      continue;
    }
    while (recentStarts.length && now - recentStarts[0] >= BURST_WINDOW_MS)
      recentStarts.shift();
    if (recentStarts.length < BURST_LIMIT) {
      recentStarts.push(now);
      return;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, BURST_WINDOW_MS - (now - recentStarts[0])),
    );
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
  const ttl = path.startsWith(CURRENT_SEASON) ? CACHE_TTL_MS : ARCHIVE_TTL_MS;
  if (cached && Date.now() - cached.time < ttl)
    return Promise.resolve(cached.data);

  if (!pending.has(path)) {
    pending.set(
      path,
      fetchAndCache(path, cached).finally(() => pending.delete(path)),
    );
  }
  return pending.get(path);
}

async function fetchOnce(path) {
  await waitForSlot();
  const response = await fetch(`${BASE_URL}/${path}`);
  if (!response.ok)
    throw new Error(`F1-API antwortet mit Status ${response.status}`);
  const { MRData } = await response.json();
  return MRData;
}

/** Eine abgelehnte Seite soll nicht das ganze Diagramm kippen: alle Anfragen pausieren, dann erneut versuchen. */
async function fetchWithRetry(path) {
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await fetchOnce(path);
    } catch {
      pausedUntil = Date.now() + RETRY_PAUSE_MS;
    }
  }
  return fetchOnce(path);
}

async function fetchAndCache(path, cached) {
  const key = CACHE_PREFIX + path;
  try {
    const data = await fetchWithRetry(path);
    writeCache(key, data);
    return data;
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

/** Das Jahr, das die API gerade als laufende Saison führt. */
export async function getCurrentYear() {
  const data = await request(`${CURRENT_SEASON}.json?limit=100`);
  return Number(data.RaceTable.season);
}

/** Alle Rennen einer Saison („current“ oder Jahr) inkl. Sessions und Strecke. */
export async function getSeasonRaces(season = CURRENT_SEASON) {
  const data = await request(`${season}.json?limit=100`);
  return data.RaceTable.Races;
}

/** Die ersten drei eines Rennens – leer, solange kein Ergebnis vorliegt. */
export async function getPodium(round, season = CURRENT_SEASON) {
  const data = await request(
    `${season}/${encodeURIComponent(round)}/results.json?limit=3`,
  );
  return data.RaceTable.Races[0]?.Results ?? [];
}

/** WM-Stand aller Fahrer einer Saison. */
export async function getDriverStandings(season = CURRENT_SEASON) {
  const data = await request(`${season}/driverStandings.json?limit=100`);
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
  const page = (offset) =>
    request(`${endpoint}?limit=${PAGE_SIZE}&offset=${offset}`);
  const first = await page(0);
  const offsets = [];
  for (
    let offset = PAGE_SIZE;
    offset < Number(first.total);
    offset += PAGE_SIZE
  )
    offsets.push(offset);
  const pages = [first, ...(await Promise.all(offsets.map(page)))];

  const races = new Map();
  for (const race of pages.flatMap((data) => data.RaceTable.Races)) {
    const existing = races.get(race.round);
    if (existing) existing[resultKey].push(...race[resultKey]);
    else races.set(race.round, { ...race, [resultKey]: [...race[resultKey]] });
  }
  return [...races.values()];
}

/** Rennergebnisse aller Fahrer einer Saison (Races[].Results). */
export const getSeasonResults = (season = CURRENT_SEASON) =>
  requestAllRaces(`${season}/results.json`, "Results");

/** Sprintergebnisse aller Fahrer einer Saison (Races[].SprintResults). */
export const getSeasonSprints = (season = CURRENT_SEASON) =>
  requestAllRaces(`${season}/sprint.json`, "SprintResults");

/** Qualifying-Ergebnisse aller Fahrer einer Saison (Races[].QualifyingResults). */
export const getSeasonQualifying = (season = CURRENT_SEASON) =>
  requestAllRaces(`${season}/qualifying.json`, "QualifyingResults");
