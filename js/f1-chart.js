import {
  getSeasonRaces,
  getDriverStandings,
  getSeasonResults,
  getSeasonSprints,
  getSeasonQualifying,
} from "./f1-api.js";

// Dynamisch geladen: fällt das CDN aus, bleibt der Rest der Seite funktionsfähig
const D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
const MARGIN = { top: 12, right: 4, bottom: 28, left: 32 };
const SEGMENT_GAP = 2;
// Maximum eines Wochenendes: Rennsieg (25) + Sprintsieg (8); seit 2025 kein Punkt mehr für die schnellste Runde
const MAX_WEEKEND_POINTS = 33;

// Einheitliche Kürzel mit drei Buchstaben für die Achse, nach Strecke statt Land (Spanien und USA mehrfach)
const RACE_CODES = {
  albert_park: "AUS",
  shanghai: "CHN",
  suzuka: "JPN",
  bahrain: "BHR",
  jeddah: "KSA",
  miami: "MIA",
  imola: "EMI",
  villeneuve: "CAN",
  monaco: "MON",
  catalunya: "BAR",
  red_bull_ring: "AUT",
  silverstone: "GBR",
  spa: "BEL",
  hungaroring: "HUN",
  zandvoort: "NED",
  monza: "ITA",
  madring: "ESP",
  baku: "AZE",
  sepang: "MAL",
  marina_bay: "SIN",
  americas: "USA",
  rodriguez: "MEX",
  interlagos: "BRA",
  vegas: "LVG",
  losail: "QAT",
  yas_marina: "ABU",
};
const raceCode = (race) =>
  RACE_CODES[race.Circuit.circuitId] ?? race.Circuit.Location.locality.slice(0, 3).toUpperCase();

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const formatAverage = (value) =>
  value === undefined
    ? "–"
    : `P${value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

/** Platzierung als „P3“, sonst „Ausfall“ (positionText ist dann z. B. „R“ oder „D“). */
const formatPosition = (result) => (Number(result.positionText) ? `P${result.positionText}` : "Ausfall");

const entryOf = (entries = [], driverId) => entries.find((entry) => entry.Driver.driverId === driverId);

/** Der andere Fahrer im selben Team in dieser Runde – so zählt jeder, der das zweite Cockpit gefahren ist. */
function teammateEntry(entries = [], driverId) {
  const own = entryOf(entries, driverId);
  return (
    own &&
    entries.find(
      (entry) =>
        entry.Constructor.constructorId === own.Constructor.constructorId && entry.Driver.driverId !== driverId,
    )
  );
}

/** Eine Zeile pro bereits gestarteter Runde mit Punkten und Platzierungen. */
function toRows(season, driverId, races) {
  return races.map((race) => {
    const result = entryOf(season.race.get(race.round), driverId);
    const sprint = entryOf(season.sprint.get(race.round), driverId);
    return {
      round: race.round,
      code: raceCode(race),
      name: race.raceName,
      racePoints: Number(result?.points ?? 0),
      sprintPoints: Number(sprint?.points ?? 0),
      race: result ? formatPosition(result) : season.race.has(race.round) ? "nicht gestartet" : "noch offen",
      sprint: race.Sprint ? (sprint ? formatPosition(sprint) : "nicht gestartet") : null,
      qualifying: entryOf(season.qualifying.get(race.round), driverId)?.position,
    };
  });
}

/**
 * Teamkollege ist, mit wem der Fahrer die meisten Rennen im selben Team bestritten hat
 * (bei Fahrerwechsel oder langer Verletzung). Bei Gleichstand zählt der jüngere.
 */
export function findTeammate(raceResults, driverId) {
  const mates = [...raceResults.values()].map((entries) => teammateEntry(entries, driverId)).filter(Boolean);
  if (!mates.length) return null;
  const races = new Map();
  for (const mate of mates) races.set(mate.Driver.driverId, (races.get(mate.Driver.driverId) ?? 0) + 1);
  // Runden sind aufsteigend sortiert: >= behält bei Gleichstand das spätere Rennen
  const best = mates.reduce((leader, mate) =>
    races.get(mate.Driver.driverId) >= races.get(leader.Driver.driverId) ? mate : leader,
  );
  return {
    driverId: best.Driver.driverId,
    name: best.Driver.familyName,
    team: best.Constructor.name,
    races: races.get(best.Driver.driverId),
  };
}

/**
 * Durchschnittsplatz und gewonnene Duelle gegen den Teamkollegen – nur in Runden,
 * in denen beide im selben Team ein Ergebnis haben.
 */
export function compare(entriesByRound, driverId, teammateId) {
  const pairs = [...entriesByRound.values()]
    .map((entries) => [entryOf(entries, driverId), entryOf(entries, teammateId)])
    .filter(([own, mate]) => own && mate && own.Constructor.constructorId === mate.Constructor.constructorId)
    .map(([own, mate]) => [Number(own.position), Number(mate.position)]);
  const wins = pairs.filter(([own, mate]) => own < mate).length;
  // Ohne gemeinsame Rennen undefined, formatAverage zeigt dann „–“
  const mean = (side) => (pairs.length ? pairs.reduce((sum, pair) => sum + pair[side], 0) / pairs.length : undefined);
  return {
    driverAverage: mean(0),
    teammateAverage: mean(1),
    wins,
    losses: pairs.length - wins,
  };
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

  // Ist zu wenig Platz für alle Kürzel, nur jedes zweite beschriften
  const tickValues = x.step() < 30 ? x.domain().filter((_, index) => index % 2 === 0) : x.domain();
  const codes = new Map(rows.map((row) => [row.round, row.code]));
  svg
    .select(".driver-chart__axis--x")
    .attr("transform", `translate(0,${height - MARGIN.bottom})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(tickValues)
        .tickFormat((round) => codes.get(round))
        .tickSize(0)
        .tickPadding(10),
    );

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
    title.textContent = `${row.code} · ${row.name}`;
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
 * Driver Overview: Punkte des gewählten Fahrers pro Rennen (Rennen und Sprint),
 * darunter der Vergleich mit dem Teamkollegen in Qualifying und Rennen.
 */
export async function initF1Chart() {
  const root = document.querySelector("[data-f1-chart]");
  if (!root) return;

  const status = root.querySelector("[data-status]");
  const select = root.querySelector("[data-driver-select]");
  const canvas = root.querySelector("[data-canvas]");
  const tooltip = root.querySelector("[data-tooltip]");
  const summary = root.querySelector("[data-summary]");
  const headToHead = root.querySelector("[data-head-to-head]");

  let d3;
  let standings;
  let races;
  let season;
  try {
    let results;
    let sprints;
    let qualifying;
    [d3, standings, races, results, sprints, qualifying] = await Promise.all([
      import(D3_URL),
      getDriverStandings(),
      getSeasonRaces(),
      getSeasonResults(),
      getSeasonSprints(),
      getSeasonQualifying(),
    ]);
    // Je Runde alle Fahrer: daraus ergeben sich Punkte und die Teambesetzung pro Rennen
    const byRound = (list, key) => new Map(list.map((race) => [race.round, race[key]]));
    season = {
      race: byRound(results, "Results"),
      sprint: byRound(sprints, "SprintResults"),
      qualifying: byRound(qualifying, "QualifyingResults"),
    };
  } catch {
    status.textContent = "Das Diagramm konnte gerade nicht geladen werden.";
    return;
  }

  // Nur Runden mit Ergebnis – am Sprint-Samstag zählt schon der Sprint
  races = races.filter((race) => season.race.has(race.round) || season.sprint.has(race.round));
  if (!standings.length || !races.length) {
    status.textContent = "In dieser Saison wurden noch keine Punkte vergeben.";
    return;
  }

  select.replaceChildren(
    ...standings.map(({ Driver }) => {
      const option = document.createElement("option");
      option.value = Driver.driverId;
      option.textContent = `${Driver.givenName} ${Driver.familyName}`;
      return option;
    }),
  );
  select.disabled = false;

  let rows = [];

  /** Teamvergleich: links der gewählte Fahrer, rechts das zweite Cockpit des Teams. */
  const showHeadToHead = (driverId, driverName) => {
    const teammate = findTeammate(season.race, driverId);
    headToHead.hidden = !teammate;
    if (!teammate) return;

    const field = (name) => headToHead.querySelector(`[data-h2h="${name}"]`);
    field("driver").textContent = driverName;
    field("teammate").textContent = teammate.name;
    field("team").textContent = teammate.team;
    field("teammate-note").textContent = `${teammate.races} gemeinsame Rennen`;

    for (const key of ["qualifying", "race"]) {
      const result = compare(season[key], driverId, teammate.driverId);
      const duel = headToHead.querySelector(`[data-duel="${key}"]`);
      const part = (side) => duel.querySelector(`[data-duel-part="${side}"]`);
      duel.querySelector('[data-duel-average="driver"]').textContent = formatAverage(result.driverAverage);
      duel.querySelector('[data-duel-average="teammate"]').textContent = formatAverage(result.teammateAverage);
      duel.querySelector('[data-duel-count="driver"]').textContent = result.wins;
      duel.querySelector('[data-duel-count="teammate"]').textContent = result.losses;
      // Anteil am Balken entspricht den gewonnenen Duellen; ohne gemeinsame Rennen halb/halb
      const shared = result.wins + result.losses;
      part("driver").style.flexGrow = shared ? result.wins : 1;
      part("teammate").style.flexGrow = shared ? result.losses : 1;
      duel
        .querySelector("[data-duel-track]")
        .setAttribute(
          "aria-label",
          `${driverName} ${result.wins}, ${teammate.name} ${result.losses} gewonnene Duelle`,
        );
    }
  };

  const showDriver = () => {
    const driverId = select.value;
    rows = toRows(season, driverId, races);
    const driverName = standings.find((standing) => standing.Driver.driverId === driverId).Driver.familyName;
    showHeadToHead(driverId, driverName);

    const racePoints = d3.sum(rows, (row) => row.racePoints);
    const sprintPoints = d3.sum(rows, (row) => row.sprintPoints);
    summary.textContent = `${racePoints + sprintPoints} Punkte · ${racePoints} aus Rennen, ${sprintPoints} aus Sprints`;
    status.hidden = true;
    canvas.hidden = false;
    render(d3, canvas, tooltip, rows, true);
  };

  select.addEventListener("change", showDriver);

  // Legende als Schalter: hebt Renn- oder Sprintpunkte hervor, erneuter Klick hebt es auf
  const highlightButtons = root.querySelectorAll("[data-highlight]");
  for (const button of highlightButtons) {
    button.addEventListener("click", () => {
      const active = button.getAttribute("aria-pressed") !== "true";
      for (const other of highlightButtons) {
        other.setAttribute("aria-pressed", String(active && other === button));
      }
      if (active) root.dataset.highlighted = button.dataset.highlight;
      else delete root.dataset.highlighted;
    });
  }
  // Breite ändert sich (Drehen, Fenstergrösse): neu zeichnen ohne Animation
  new ResizeObserver(() => {
    if (rows.length && !canvas.hidden) render(d3, canvas, tooltip, rows, false);
  }).observe(canvas);

  showDriver();
}
