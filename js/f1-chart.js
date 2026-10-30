import {
  getSeasonRaces,
  getDriverStandings,
  getDriverResults,
  getDriverSprintResults,
  getDriverQualifying,
} from "./f1-api.js";

// Dynamisch geladen: fällt das CDN aus, bleibt der Rest der Seite funktionsfähig
const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const MARGIN = { top: 12, right: 4, bottom: 28, left: 32 };
const SEGMENT_GAP = 2;
// Maximum eines Wochenendes: Rennsieg (25) + Sprintsieg (8); seit 2025 kein Punkt mehr für die schnellste Runde
const MAX_WEEKEND_POINTS = 33;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Platzierung als „P3“, sonst „Ausfall“ (positionText ist dann z. B. „R“ oder „D“). */
const formatPosition = (result) => (Number(result.positionText) ? `P${result.positionText}` : "Ausfall");

/**
 * Führt Rennen, Sprints und Qualifying eines Fahrers zu einer Zeile pro
 * bereits gestarteter Runde zusammen.
 */
async function loadDriverSeason(driverId, races) {
  const [results, sprints, qualifying] = await Promise.all([
    getDriverResults(driverId),
    getDriverSprintResults(driverId),
    getDriverQualifying(driverId),
  ]);
  const byRound = (list, key) => new Map(list.map((race) => [race.round, race[key][0]]));
  const raceResults = byRound(results, "Results");
  const sprintResults = byRound(sprints, "SprintResults");
  const qualifyingResults = byRound(qualifying, "QualifyingResults");

  return races.map((race) => {
    const result = raceResults.get(race.round);
    const sprint = sprintResults.get(race.round);
    return {
      round: race.round,
      name: race.raceName,
      racePoints: Number(result?.points ?? 0),
      sprintPoints: Number(sprint?.points ?? 0),
      race: result ? formatPosition(result) : "nicht gestartet",
      sprint: race.Sprint ? (sprint ? formatPosition(sprint) : "nicht gestartet") : null,
      qualifying: qualifyingResults.get(race.round)?.position,
    };
  });
}

/** Zeilen für Tooltip und Screenreader. */
function describe(row) {
  const lines = [`Rennen: ${row.race} · ${row.racePoints} Pkt.`];
  if (row.sprint) lines.push(`Sprint: ${row.sprint} · ${row.sprintPoints} Pkt.`);
  lines.push(`Qualifying: ${row.qualifying ? `P${row.qualifying}` : "–"}`);
  return lines;
}

/** Gestapeltes Balkendiagramm: Rennpunkte unten, Sprintpunkte oben drauf. */
function render(d3, canvas, tooltip, rows, animate) {
  const width = canvas.clientWidth;
  const height = Math.round(Math.min(320, Math.max(220, width * 0.45)));
  const total = (row) => row.racePoints + row.sprintPoints;
  // Ein offener Tooltip würde sonst noch die Werte des vorherigen Fahrers zeigen
  tooltip.hidden = true;

  const x = d3
    .scaleBand()
    .domain(rows.map((row) => row.round))
    .range([MARGIN.left, width - MARGIN.right])
    .padding(0.25);
  // Feste Skala bis zum Wochenend-Maximum, damit Balken aller Fahrer vergleichbar sind
  const maxPoints = Math.max(MAX_WEEKEND_POINTS, d3.max(rows, total));
  const y = d3.scaleLinear().domain([0, maxPoints]).range([height - MARGIN.bottom, MARGIN.top]);
  // Hilfslinien alle 5 Punkte; zu nahe am Maximum fallen sie weg, sonst überlappen die Zahlen
  const yTicks = [...d3.range(0, maxPoints - 5, 5), maxPoints];
  // Abgerundete Enden nur oben; nie grösser als der Balken selbst
  const radius = (barHeight) => Math.min(4, x.bandwidth() / 2, barHeight / 2);

  const svg = d3
    .select(canvas)
    .selectAll("svg")
    .data([null])
    .join((enter) => {
      const root = enter.append("svg").attr("role", "group").attr("aria-label", "Punkte pro Rennen");
      root.append("g").attr("class", "driver-chart__grid");
      root.append("g").attr("class", "driver-chart__axis driver-chart__axis--x");
      root.append("g").attr("class", "driver-chart__rounds");
      return root;
    })
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  svg
    .select(".driver-chart__grid")
    .attr("transform", `translate(${MARGIN.left},0)`)
    .call(d3.axisLeft(y).tickValues(yTicks).tickSize(-(width - MARGIN.left - MARGIN.right)).tickPadding(8))
    .call((grid) => grid.select(".domain").remove())
    .call((grid) => grid.selectAll(".tick").classed("driver-chart__tick--max", (value) => value === maxPoints));

  // Auf schmalen Screens nur jede zweite Runde beschriften
  const tickValues = width < 560 ? x.domain().filter((_, index) => index % 2 === 0) : x.domain();
  svg
    .select(".driver-chart__axis--x")
    .attr("transform", `translate(0,${height - MARGIN.bottom})`)
    .call(d3.axisBottom(x).tickValues(tickValues).tickSize(0).tickPadding(10));

  // Ohne Animation direkt setzen: auch 0-ms-Transitions warten sonst auf den nächsten Frame
  const animated = (selection) =>
    animate && !prefersReducedMotion()
      ? selection.transition().duration(500).ease(d3.easeCubicOut)
      : selection.interrupt();

  // Pfade statt rect, damit nur die oberen Ecken abgerundet sind. Gleicher Aufbau
  // auch bei Höhe 0, damit D3 zwischen den Pfaden animieren kann.
  const barPath = (left, top, bottom, rounded) => {
    const barWidth = x.bandwidth();
    const r = rounded ? radius(bottom - top) : 0;
    return `M${left},${bottom}V${top + r}q0,${-r} ${r},${-r}H${left + barWidth - r}q${r},0 ${r},${r}V${bottom}Z`;
  };
  const flatBar = (row) => barPath(x(row.round), y(0), y(0), false);

  const rounds = svg
    .select(".driver-chart__rounds")
    .selectAll(".driver-chart__round")
    .data(rows, (row) => row.round)
    .join((enter) => {
      const round = enter
        .append("g")
        .attr("class", "driver-chart__round")
        .attr("tabindex", 0)
        .attr("role", "img");
      round.append("rect").attr("class", "driver-chart__hit");
      round.append("path").attr("class", "driver-chart__bar driver-chart__bar--race").attr("d", flatBar);
      round.append("path").attr("class", "driver-chart__bar driver-chart__bar--sprint").attr("d", flatBar);
      return round;
    })
    .attr("aria-label", (row) => `Runde ${row.round}, ${row.name}: ${describe(row).join(", ")}`);

  rounds
    .select(".driver-chart__hit")
    .attr("x", (row) => x(row.round) - (x.step() - x.bandwidth()) / 2)
    .attr("y", MARGIN.top)
    .attr("width", x.step())
    .attr("height", height - MARGIN.top - MARGIN.bottom);

  const raceTop = (row) => y(row.racePoints);
  const sprintBottom = (row) => (row.racePoints ? raceTop(row) - SEGMENT_GAP : y(0));

  animated(rounds.select(".driver-chart__bar--race")).attr("d", (row) =>
    barPath(x(row.round), raceTop(row), y(0), !row.sprintPoints),
  );
  animated(rounds.select(".driver-chart__bar--sprint")).attr("d", (row) =>
    barPath(x(row.round), Math.min(y(total(row)), sprintBottom(row)), sprintBottom(row), true),
  );

  const showTooltip = (event, row) => {
    tooltip.replaceChildren();
    const title = document.createElement("p");
    title.className = "driver-chart__tooltip-title";
    title.textContent = `R${row.round} · ${row.name}`;
    tooltip.append(title);
    for (const line of describe(row)) {
      const text = document.createElement("p");
      text.textContent = line;
      tooltip.append(text);
    }
    tooltip.hidden = false;

    // Über dem Balken zentriert, aber nie aus dem Diagramm hinaus
    const center = canvas.offsetLeft + x(row.round) + x.bandwidth() / 2;
    const half = tooltip.offsetWidth / 2;
    const left = Math.max(half, Math.min(center, canvas.offsetLeft + canvas.clientWidth - half));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${canvas.offsetTop + y(total(row))}px`;
  };
  const hideTooltip = () => {
    tooltip.hidden = true;
  };

  // Touch: pointerleave kommt direkt nach dem Tippen, dort schliesst erst blur den Tooltip
  rounds
    .on("pointerenter focus", showTooltip)
    .on("pointerleave", (event) => event.pointerType === "mouse" && hideTooltip())
    .on("blur", hideTooltip);
}

/**
 * Diagramm mit Fahrerauswahl: Punkte des gewählten Fahrers pro Rennen,
 * aufgeteilt in Rennen und Sprint, im Tooltip ergänzt um das Qualifying.
 */
export async function initF1Chart() {
  const root = document.querySelector("[data-f1-chart]");
  if (!root) return;

  const status = root.querySelector("[data-status]");
  const select = root.querySelector("[data-driver-select]");
  const canvas = root.querySelector("[data-canvas]");
  const tooltip = root.querySelector("[data-tooltip]");
  const summary = root.querySelector("[data-summary]");

  let d3;
  let standings;
  let races;
  try {
    [d3, standings, races] = await Promise.all([import(D3_URL), getDriverStandings(), getSeasonRaces()]);
  } catch {
    status.textContent = "Das Diagramm konnte gerade nicht geladen werden.";
    return;
  }

  // Nur Runden, deren Rennen schon gestartet ist
  const now = Date.now();
  races = races.filter((race) => new Date(`${race.date}T${race.time ?? "00:00:00Z"}`) <= now);
  if (!standings.length || !races.length) {
    status.textContent = "In dieser Saison wurden noch keine Punkte vergeben.";
    return;
  }

  select.replaceChildren(
    ...standings.map(({ position, points, Driver }) => {
      const option = document.createElement("option");
      option.value = Driver.driverId;
      option.textContent = `${position}. ${Driver.givenName} ${Driver.familyName} (${points} Pkt.)`;
      return option;
    }),
  );
  select.disabled = false;

  let rows = [];
  let loadId = 0;

  const showDriver = async () => {
    const id = ++loadId;
    canvas.setAttribute("aria-busy", "true");
    try {
      const nextRows = await loadDriverSeason(select.value, races);
      if (id !== loadId) return;
      rows = nextRows;
    } catch {
      if (id !== loadId) return;
      status.textContent = "Die Daten dieses Fahrers konnten gerade nicht geladen werden.";
      status.hidden = false;
      canvas.hidden = true;
      return;
    } finally {
      if (id === loadId) canvas.removeAttribute("aria-busy");
    }

    const racePoints = d3.sum(rows, (row) => row.racePoints);
    const sprintPoints = d3.sum(rows, (row) => row.sprintPoints);
    summary.textContent = `${racePoints + sprintPoints} Punkte · ${racePoints} aus Rennen, ${sprintPoints} aus Sprints`;
    status.hidden = true;
    canvas.hidden = false;
    render(d3, canvas, tooltip, rows, true);
  };

  select.addEventListener("change", showDriver);
  // Breite ändert sich (Drehen, Fenstergrösse): neu zeichnen ohne Animation
  new ResizeObserver(() => {
    if (rows.length && !canvas.hidden) render(d3, canvas, tooltip, rows, false);
  }).observe(canvas);

  await showDriver();
}
