import { getNextRace } from "./f1-api.js";
import { getCircuitOutline } from "./circuit-map.js";

const TIME_ZONE = "Europe/Berlin";
const SESSIONS = [
  ["FirstPractice", "FP1"],
  ["SecondPractice", "FP2"],
  ["ThirdPractice", "FP3"],
  ["SprintQualifying", "Sprint-Qualifying"],
  ["Sprint", "Sprint"],
  ["Qualifying", "Qualifying"],
];

const toDate = ({ date, time = "00:00:00Z" }) => new Date(`${date}T${time}`);
const format = (date, options) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, ...options }).format(date);
const formatMonth = (date) => format(date, { month: "short" }).replace(".", "").toUpperCase();
const pad = (value) => String(value).padStart(2, "0");

/** Alle Sessions des Rennwochenendes inkl. Rennen, nach Startzeit sortiert. */
function getSessions(race) {
  const sessions = SESSIONS.filter(([key]) => race[key]).map(([key, name]) => ({
    name,
    start: toDate(race[key]),
  }));
  sessions.push({ name: "Rennen", start: toDate(race) });
  return sessions.sort((a, b) => a.start - b.start);
}

/** Tage und Monat(e) des Wochenendes in Berliner Zeit, z. B. „30–1“ und „OKT–NOV“. */
function formatWeekend(first, last) {
  const days = `${format(first, { day: "numeric" })}–${format(last, { day: "numeric" })}`;
  const firstMonth = formatMonth(first);
  const lastMonth = formatMonth(last);
  return { days, months: firstMonth === lastMonth ? firstMonth : `${firstMonth}–${lastMonth}` };
}

/**
 * Zeigt das nächste Rennwochenende mit Countdown bis zur nächsten Session
 * und dem Streckenverlauf als Icon.
 */
export async function initF1Countdown() {
  const root = document.querySelector("[data-f1-countdown]");
  if (!root) return;

  const status = root.querySelector("[data-status]");
  const field = (name) => root.querySelector(`[data-${name}]`);

  let race;
  try {
    race = await getNextRace();
  } catch {
    status.textContent = "Das nächste Rennen konnte gerade nicht geladen werden.";
    return;
  }
  if (!race) {
    status.textContent = "Die Saison ist beendet – das nächste Rennen folgt im neuen Jahr.";
    return;
  }

  const sessions = getSessions(race);
  const { days, months } = formatWeekend(sessions[0].start, sessions.at(-1).start);
  field("days").textContent = days;
  field("months").textContent = months;
  field("race").textContent = `${race.raceName} · ${race.Circuit.circuitName}`;

  const tick = () => {
    const now = Date.now();
    const next = sessions.find((session) => session.start > now);
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
    field("start").textContent = `${format(next.start, {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })} Uhr (Berliner Zeit)`;
  };

  const timer = setInterval(tick, 1000);
  tick();
  status.hidden = true;
  field("body").hidden = false;

  // Die Streckenform ist Dekoration: fehlt sie, bleibt der Countdown trotzdem nutzbar
  try {
    const outline = await getCircuitOutline(Number(race.Circuit.Location.lat), Number(race.Circuit.Location.long));
    if (!outline) return;
    const track = field("track");
    track.innerHTML = `<svg viewBox="${outline.viewBox}" aria-hidden="true" focusable="false"><path d="${outline.d}" /></svg>`;
    track.hidden = false;
  } catch {
    // ohne Streckenform weiter
  }
}
