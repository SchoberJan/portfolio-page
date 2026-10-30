const BASE_URL = "https://api.jolpi.ca/ergast/f1";
const CACHE_PREFIX = "f1:";
// Daten ändern sich nur an Rennwochenenden; schont das Limit der API (500 Anfragen/h)
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Holt Daten von der Jolpica-F1-API (Nachfolger der Ergast-API).
 * Antworten werden im localStorage zwischengespeichert. Schlägt die Anfrage fehl,
 * dient ein abgelaufener Cache-Eintrag als Notlösung.
 */
async function request(path) {
  const key = CACHE_PREFIX + path;
  const cached = readCache(key);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.data;

  try {
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

/** Nächstes Rennen der laufenden Saison inkl. Strecke, oder null nach Saisonende. */
export async function getNextRace() {
  const data = await request("current/next.json");
  return data.RaceTable.Races[0] ?? null;
}

/** Aktueller WM-Stand aller Fahrer. */
export async function getDriverStandings() {
  const data = await request("current/driverStandings.json?limit=100");
  return data.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
}

/** Ergebnisse eines Fahrers in allen bisherigen Rennen der laufenden Saison. */
export async function getDriverResults(driverId) {
  const data = await request(`current/drivers/${encodeURIComponent(driverId)}/results.json?limit=100`);
  return data.RaceTable.Races;
}
