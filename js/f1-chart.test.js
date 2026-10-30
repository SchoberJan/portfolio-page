// Ausführen mit: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { findTeammate, compare } from "./f1-chart.js";

const entry = (driverId, constructorId, position) => ({
  Driver: { driverId, familyName: driverId },
  Constructor: { constructorId, name: constructorId },
  position: String(position),
});
// Runden als Map wie in season.race: Runde → Ergebnisse aller Fahrer
const rounds = (...lists) => new Map(lists.map((list, index) => [String(index + 1), list]));

test("Teamkollege ist, wer die meisten gemeinsamen Rennen hat", () => {
  const races = rounds(
    [entry("ver", "red_bull", 1), entry("law", "red_bull", 9)],
    [entry("ver", "red_bull", 2), entry("had", "red_bull", 5), entry("law", "rb", 8)],
    [entry("ver", "red_bull", 4), entry("had", "red_bull", 3), entry("law", "rb", 7)],
  );
  assert.deepEqual(findTeammate(races, "ver"), { driverId: "had", name: "had", team: "red_bull", races: 2 });
});

test("Bei Gleichstand zählt der spätere Teamkollege", () => {
  const races = rounds(
    [entry("ver", "red_bull", 1), entry("law", "red_bull", 9)],
    [entry("ver", "red_bull", 2), entry("had", "red_bull", 5)],
  );
  assert.equal(findTeammate(races, "ver").driverId, "had");
});

test("Ohne Teamkollegen gibt es kein Duell", () => {
  assert.equal(findTeammate(rounds([entry("ver", "red_bull", 1)]), "ver"), null);
});

test("Duell zählt nur Rennen, in denen beide im selben Team fuhren", () => {
  const races = rounds(
    [entry("ver", "red_bull", 1), entry("had", "rb", 9)],
    [entry("ver", "red_bull", 2), entry("had", "red_bull", 5)],
    [entry("ver", "red_bull", 4), entry("had", "red_bull", 3)],
  );
  assert.deepEqual(compare(races, "ver", "had"), {
    driverAverage: 3,
    teammateAverage: 4,
    wins: 1,
    losses: 1,
  });
});

test("Ohne gemeinsame Rennen gibt es keinen Durchschnitt", () => {
  const result = compare(rounds([entry("ver", "red_bull", 1)]), "ver", "had");
  assert.equal(result.driverAverage, undefined);
  assert.equal(result.wins + result.losses, 0);
});
