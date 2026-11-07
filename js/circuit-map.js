// Streckenverläufe aller F1-Strecken (bacinger/f1-circuits, MIT), fest auf einen Commit gepinnt
const CIRCUITS_URL =
  "https://cdn.jsdelivr.net/gh/bacinger/f1-circuits@8094e957b8d6aa8b9f4510c93968556cccd30e02/f1-circuits.geojson";
// Rund 10 km: weiter weg liegt keine Strecke zu den Koordinaten aus der F1-API
const MAX_DISTANCE_DEG = 0.1;
// Halbe Länge der Start-Ziel-Linie, gemessen an der längsten Seite der Strecke (= 100)
const START_LINE_HALF = 6;

// Die Datei wird nur einmal geladen und für jede weitere Strecke wiederverwendet
let featuresPromise;

function loadFeatures() {
  featuresPromise ??= fetch(CIRCUITS_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Streckendaten nicht erreichbar (Status ${response.status})`);
      return (await response.json()).features;
    })
    .catch((error) => {
      featuresPromise = undefined;
      throw error;
    });
  return featuresPromise;
}

/**
 * Sucht die Strecke, die am nächsten bei den Koordinaten aus der F1-API liegt,
 * und gibt ihren Verlauf als SVG-Pfad zurück – oder null, wenn keine passt.
 */
export async function getCircuitOutline(lat, lng) {
  const features = await loadFeatures();

  const distance = (feature) => {
    const [x, y] = feature.geometry.coordinates[0];
    return Math.hypot(x - lng, y - lat);
  };
  const nearest = features.reduce((best, feature) => (distance(feature) < distance(best) ? feature : best));

  return distance(nearest) <= MAX_DISTANCE_DEG ? toSvgPath(nearest.geometry.coordinates) : null;
}

const round = (value) => value.toFixed(1);
const point = ([x, y]) => `${round(x)} ${round(y)}`;

/** Richtung von a nach b als Vektor der Länge 1. */
function direction(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
}

/**
 * Glättet den geschlossenen Streckenzug zu Bézierkurven. Die Griffe richten sich nach
 * dem eigenen Teilstück: lange Geraden neben kurzen Kurven schiessen so nicht über.
 */
function smoothPath(points) {
  const at = (index) => points[(index + points.length) % points.length];
  const curves = points.map((current, index) => {
    const next = at(index + 1);
    const handle = Math.hypot(next[0] - current[0], next[1] - current[1]) / 3;
    const out = direction(at(index - 1), next);
    const into = direction(current, at(index + 2));
    const first = [current[0] + out[0] * handle, current[1] + out[1] * handle];
    const second = [next[0] - into[0] * handle, next[1] - into[1] * handle];
    return `C${point(first)} ${point(second)} ${point(next)}`;
  });
  return `M${point(points[0])}${curves.join("")}Z`;
}

/** Rechnet Längen-/Breitengrade in einen SVG-Pfad um (längste Seite = 100). */
export function toSvgPath(coordinates) {
  // Längengrade werden zum Pol hin schmaler; ohne Korrektur wäre die Strecke verzerrt
  const shrink = Math.cos((coordinates[0][1] * Math.PI) / 180);
  const projected = coordinates.map(([lng, lat]) => [lng * shrink, -lat]);

  const xs = projected.map(([x]) => x);
  const ys = projected.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const scale = 100 / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const width = (Math.max(...xs) - minX) * scale;
  const height = (Math.max(...ys) - minY) * scale;

  // Alle Verläufe im Datensatz sind geschlossen: Der letzte Punkt wiederholt den ersten
  const points = projected.slice(0, -1).map(([x, y]) => [(x - minX) * scale, (y - minY) * scale]);

  // Der Datensatz beginnt auf der Start-Ziel-Geraden; die Linie steht quer zur Fahrtrichtung
  const [start] = points;
  const [dx, dy] = direction(start, points[1]);
  const startLine = `M${point([start[0] - dy * START_LINE_HALF, start[1] + dx * START_LINE_HALF])}L${point([
    start[0] + dy * START_LINE_HALF,
    start[1] - dx * START_LINE_HALF,
  ])}`;

  return { d: smoothPath(points), startLine, viewBox: `0 0 ${round(width)} ${round(height)}` };
}
