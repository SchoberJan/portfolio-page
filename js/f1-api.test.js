import assert from "node:assert/strict";
import { test } from "node:test";
import { getCurrentYear, getSeasonRaces } from "./f1-api.js";

const answer = (MRData) => ({ ok: true, json: async () => ({ MRData }) });
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("nach einer Ablehnung wird pausiert und erneut versucht", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("Failed to fetch");
    return answer({ RaceTable: { season: "2027", Races: [] } });
  });

  const year = getCurrentYear();
  await flush();
  assert.equal(calls, 1);
  t.mock.timers.tick(11 * 1000);
  await flush();
  assert.equal(calls, 1, "während der Pause geht keine Anfrage raus");
  t.mock.timers.tick(1000);

  assert.equal(await year, 2027);
  assert.equal(calls, 2);
});

test("eine Saison wird über ihr Jahr abgefragt", async (t) => {
  const races = [{ round: "1" }];
  const fetched = t.mock.method(globalThis, "fetch", async () =>
    answer({ RaceTable: { Races: races } }),
  );

  assert.deepEqual(await getSeasonRaces("2025"), races);
  assert.match(fetched.mock.calls[0].arguments[0], /\/f1\/2025\.json\?limit=100$/);
});
