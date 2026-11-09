import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRemaining } from "./f1-telemetry.js";

const MINUTE = 60 * 1000;

test("Restzeit wird in Tage, Stunden und Minuten aufgeteilt", () => {
  assert.equal(formatRemaining((3 * 1440 + 4 * 60 + 12) * MINUTE), "03 Tage 04 Std 12 Min");
});

test("Angefangene Minuten werden abgerundet", () => {
  assert.equal(formatRemaining(MINUTE + 59 * 1000), "00 Tage 00 Std 01 Min");
});

test("Vergangene Zeitpunkte ergeben keine negative Restzeit", () => {
  assert.equal(formatRemaining(-5 * MINUTE), "00 Tage 00 Std 00 Min");
});
