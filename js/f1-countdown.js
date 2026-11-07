import { getSeasonRaces, getPodium } from "./f1-api.js";
import { getCircuitOutline } from "./circuit-map.js";
import { SEASON_CHANGE } from "./f1-season.js";

const TIME_ZONE = "Europe/Zurich";
const SESSIONS = [
  ["FirstPractice", "FP1"],
  ["SecondPractice", "FP2"],
  ["ThirdPractice", "FP3"],
  ["SprintQualifying", "Sprint-Qualifying"],
  ["Sprint", "Sprint"],
  ["Qualifying", "Qualifying"],
];
// Ein Rennen dauert höchstens rund zwei Stunden, mit Unterbrechungen etwas länger
const RACE_DURATION_MS = 3 * 60 * 60 * 1000;

export const toDate = ({ date, time = "00:00:00Z" }) => new Date(`${date}T${time}`);
const format = (date, options) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, ...options }).format(date);
const formatMonth = (date) => format(date, { month: "short" }).replace(".", "").toUpperCase();
const formatWeekday = (date) => format(date, { weekday: "short" }).replace(".", "").toUpperCase();
const formatShortDate = (date) => `${format(date, { day: "2-digit" })} ${formatMonth(date)}`;
const formatTime = (date) => format(date, { hour: "2-digit", minute: "2-digit" });
const formatLongDate = (date, options = {}) =>
  format(date, { weekday: "long", day: "numeric", month: "long", ...options });
const pad = (value) => String(value).padStart(2, "0");
export const isFinished = (race) => toDate(race).getTime() + RACE_DURATION_MS < Date.now();

function createElement(tag, className, text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

/** Alle Sessions des Rennwochenendes inkl. Rennen, nach Startzeit sortiert. */
function getSessions(race) {
  const sessions = SESSIONS.filter(([key]) => race[key]).map(([key, name]) => ({
    name,
    start: toDate(race[key]),
  }));
  sessions.push({ name: "Rennen", start: toDate(race) });
  return sessions.sort((a, b) => a.start - b.start);
}

/** Sessions je Kalendertag in Schweizer Zeit; die Reihenfolge bleibt erhalten. */
export function groupByDay(sessions) {
  const days = new Map();
  for (const session of sessions) {
    const day = format(session.start, { dateStyle: "short" });
    days.set(day, [...(days.get(day) ?? []), session]);
  }
  return [...days.values()];
}

function createSessionItem(session) {
  const item = createElement("li", "sessions__item");
  item.append(
    createElement("span", "sessions__name", session.name),
    createElement("span", "sessions__time", formatTime(session.start)),
  );
  return item;
}

/** Eine Spalte im Zeitplan: Wochentag und Datum, darunter die Sessions dieses Tages. */
function createSessionDay(sessions, items) {
  const { start } = sessions[0];
  const label = createElement("p", "sessions__day-label");
  label.append(
    createElement("span", "sessions__weekday", formatWeekday(start)),
    createElement("span", "sessions__date", formatShortDate(start)),
  );
  const list = createElement("ol", "sessions__list");
  list.append(...sessions.map((session) => items.get(session)));
  const day = createElement("li", "sessions__day");
  day.append(label, list);
  return day;
}

/** Tage und Monat(e) des Wochenendes in Schweizer Zeit, z. B. „30–1“ und „OKT–NOV“. */
function formatWeekend(first, last) {
  const days = `${format(first, { day: "numeric" })}–${format(last, { day: "numeric" })}`;
  const firstMonth = formatMonth(first);
  const lastMonth = formatMonth(last);
  return { days, months: firstMonth === lastMonth ? firstMonth : `${firstMonth}–${lastMonth}` };
}

function createRaceButton(race, index) {
  const button = createElement("button", "race-list__button");
  button.type = "button";
  button.dataset.index = index;
  button.classList.toggle("race-list__button--done", isFinished(race));
  button.append(
    createElement("span", "race-list__round", `R${race.round}`),
    createElement("span", "race-list__name", race.raceName),
    createElement("span", "race-list__date", formatShortDate(toDate(race))),
  );
  const item = document.createElement("li");
  item.append(button);
  return item;
}

function createPodiumItem(result) {
  const item = createElement("li", "podium__item");
  const driver = createElement("span", "podium__driver");
  driver.append(
    createElement("span", "podium__name", `${result.Driver.givenName} ${result.Driver.familyName}`),
    createElement("span", "podium__team", result.Constructor.name),
  );
  // Sieger: Gesamtzeit; dahinter: Abstand („+13.078“) oder Status bei Überrundung
  item.append(
    createElement("span", "podium__position", result.position),
    driver,
    createElement("span", "podium__gap", result.Time?.time ?? result.status),
  );
  return item;
}

/**
 * Zeigt den Rennkalender der Saison: links die Rennliste, in der Mitte die
 * Streckenform und rechts den Countdown bzw. bei gefahrenen Rennen die Top 3.
 */
export function initF1Countdown() {
  const root = document.querySelector("[data-f1-countdown]");
  if (!root) return;

  const status = root.querySelector("[data-status]");
  const field = (name) => root.querySelector(`[data-${name}]`);
  const list = field("race-list");
  const toggle = field("race-toggle");

  let season;
  let races = [];
  let items = [];
  let selected = 0;
  let expanded = false;
  let timer;
  let showId = 0;
  let loadId = 0;

  /** Zugeklappt sind nur das gewählte Rennen und seine Nachbarn sichtbar. */
  const updateList = () => {
    const start = Math.max(0, Math.min(selected - 1, races.length - 3));
    items.forEach((item, index) => {
      item.hidden = !expanded && (index < start || index > start + 2);
      const button = item.firstChild;
      if (index === selected) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  };

  const setExpanded = (value) => {
    expanded = value;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Weniger anzeigen" : "Alle Rennen anzeigen";
    list.classList.toggle("race-list__items--expanded", expanded);
    updateList();
    if (expanded) list.scrollTop = items[selected].offsetTop - list.clientHeight / 2;
  };

  const startCountdown = (sessions) => {
    const items = new Map(sessions.map((session) => [session, createSessionItem(session)]));
    field("sessions").replaceChildren(...groupByDay(sessions).map((day) => createSessionDay(day, items)));

    const tick = () => {
      const now = Date.now();
      const next = sessions.find((session) => session.start > now);
      for (const [session, item] of items) {
        item.classList.toggle("sessions__item--done", session.start <= now);
        item.classList.toggle("sessions__item--next", session === next);
      }
      if (!next) {
        field("label").textContent = "Das Rennen läuft";
        field("start").textContent = "";
        clearInterval(timer);
        return;
      }

      const minutes = Math.floor((next.start - now) / 60000);
      field("unit-days").textContent = pad(Math.floor(minutes / 1440));
      field("unit-hours").textContent = pad(Math.floor(minutes / 60) % 24);
      field("unit-minutes").textContent = pad(minutes % 60);
      field("label").textContent = `${next.name} startet in`;
      field("start").textContent = `${formatLongDate(next.start)}, ${formatTime(next.start)} Uhr`;
    };
    timer = setInterval(tick, 1000);
    tick();
  };

  const showPodium = async (race, id) => {
    const resultStatus = field("result-status");
    const podium = field("podium");
    field("label").textContent = `Gefahren am ${formatLongDate(toDate(race), { year: "numeric" })}`;
    resultStatus.textContent = "Ergebnis wird geladen …";
    resultStatus.hidden = false;
    podium.replaceChildren();

    let results;
    try {
      results = await getPodium(race.round, season);
    } catch {
      if (id === showId) resultStatus.textContent = "Das Ergebnis konnte gerade nicht geladen werden.";
      return;
    }
    if (id !== showId) return;
    if (!results.length) {
      resultStatus.textContent = "Das Ergebnis folgt in Kürze.";
      return;
    }
    resultStatus.hidden = true;
    podium.replaceChildren(...results.map(createPodiumItem));
  };

  // Die Streckenform ist Dekoration: fehlt sie, bleibt der Rest trotzdem nutzbar
  const showTrack = async (race, id) => {
    const track = field("track");
    let outline = null;
    try {
      outline = await getCircuitOutline(Number(race.Circuit.Location.lat), Number(race.Circuit.Location.long));
    } catch {
      // ohne Streckenform weiter
    }
    if (id !== showId) return;
    track.hidden = !outline;
    if (outline) {
      track.innerHTML = `
        <svg viewBox="${outline.viewBox}" aria-hidden="true" focusable="false">
          <path class="countdown__track-casing" d="${outline.d}" />
          <path class="countdown__track-line" d="${outline.d}" />
          <path class="countdown__track-start" d="${outline.startLine}" />
        </svg>
        <p class="countdown__track-legend">Start und Ziel</p>`;
    }
  };

  const showRace = () => {
    // Schnelles Umschalten: verspätete Antworten eines früher gewählten Rennens verwerfen
    const id = ++showId;
    const race = races[selected];
    clearInterval(timer);
    updateList();

    const sessions = getSessions(race);
    const { days, months } = formatWeekend(sessions[0].start, sessions.at(-1).start);
    field("days").textContent = days;
    field("months").textContent = months;
    field("race").textContent = `${race.raceName} · ${race.Circuit.circuitName}`;

    const finished = isFinished(race);
    field("upcoming").hidden = finished;
    field("result").hidden = !finished;
    if (finished) showPodium(race, id);
    else startCountdown(sessions);
    showTrack(race, id);
  };

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-index]");
    if (!button) return;
    selected = Number(button.dataset.index);
    setExpanded(false);
    showRace();
  });
  toggle.addEventListener("click", () => setExpanded(!expanded));

  const showMessage = (message) => {
    clearInterval(timer);
    status.textContent = message;
    status.hidden = false;
    field("body").hidden = true;
  };

  /** Der bisherige Kalender bleibt stehen, bis die neue Saison da ist. */
  const load = async (requested) => {
    const id = ++loadId;
    let loaded;
    try {
      loaded = await getSeasonRaces(requested);
    } catch {
      if (id === loadId) showMessage("Der Rennkalender konnte gerade nicht geladen werden.");
      return;
    }
    if (id !== loadId) return;
    if (!loaded.length) {
      showMessage("Für diese Saison sind noch keine Rennen geplant.");
      return;
    }

    season = requested;
    races = loaded;
    items = races.map(createRaceButton);
    list.replaceChildren(...items);
    // Standardmässig das nächste Rennen, nach Saisonende das letzte
    const nextIndex = races.findIndex((race) => !isFinished(race));
    selected = nextIndex === -1 ? races.length - 1 : nextIndex;
    setExpanded(false);
    showRace();
    status.hidden = true;
    field("body").hidden = false;
  };

  document.addEventListener(SEASON_CHANGE, ({ detail }) => load(detail));
  load();
}
