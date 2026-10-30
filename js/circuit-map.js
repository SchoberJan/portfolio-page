// Streckenverläufe aller F1-Strecken (bacinger/f1-circuits, MIT), fest auf einen Commit gepinnt
const CIRCUITS_URL =
  "https://cdn.jsdelivr.net/gh/bacinger/f1-circuits@8094e957b8d6aa8b9f4510c93968556cccd30e02/f1-circuits.geojson";
// Rund 10 km: weiter weg liegt keine Strecke zu den Koordinaten aus der F1-API
const MAX_DISTANCE_DEG = 0.1;

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

/** Rechnet Längen-/Breitengrade in einen SVG-Pfad um (längste Seite = 100). */
function toSvgPath(coordinates) {
  // Längengrade werden zum Pol hin schmaler; ohne Korrektur wäre die Strecke verzerrt
  const shrink = Math.cos((coordinates[0][1] * Math.PI) / 180);
  const points = coordinates.map(([lng, lat]) => [lng * shrink, -lat]);

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const scale = 100 / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);

  const d = points
    .map(([x, y], i) => `${i ? "L" : "M"}${((x - minX) * scale).toFixed(1)} ${((y - minY) * scale).toFixed(1)}`)
    .join("");
  const width = (Math.max(...xs) - minX) * scale;
  const height = (Math.max(...ys) - minY) * scale;

  return { d: `${d}Z`, viewBox: `0 0 ${width.toFixed(1)} ${height.toFixed(1)}` };
}
