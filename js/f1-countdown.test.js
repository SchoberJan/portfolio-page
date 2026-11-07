// Ausführen mit: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByDay } from "./f1-countdown.js";

const session = (name, iso) => ({ name, start: new Date(iso) });

test("Sessions werden nach Kalendertag in Schweizer Zeit gruppiert", () => {
  const days = groupByDay([
    session("FP1", "2026-11-06T15:30:00Z"),
    session("FP2", "2026-11-06T19:00:00Z"),
    session("Qualifying", "2026-11-07T18:00:00Z"),
  ]);
  assert.deepEqual(
    days.map((day) => day.map(({ name }) => name)),
    [["FP1", "FP2"], ["Qualifying"]],
  );
});

test("Tagesgrenze gilt in Schweizer Zeit, nicht in UTC", () => {
  // 23:30 UTC ist in Zürich schon der nächste Tag (00:30), 22:30 UTC noch nicht
  const days = groupByDay([
    session("vor Mitternacht", "2026-11-20T22:30:00Z"),
    session("nach Mitternacht", "2026-11-20T23:30:00Z"),
  ]);
  assert.equal(days.length, 2);
});
