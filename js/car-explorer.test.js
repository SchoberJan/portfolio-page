import assert from "node:assert/strict";
import { test } from "node:test";
import { fitDetail, formatScale } from "./car-explorer.js";

test("Ausschnitt füllt die Einzelheit und steht in ihrer Mitte", () => {
  // Ausschnitt 200 × 100 Einheiten, 1 Einheit = 1px, Einzelheit 800 × 300px: die Höhe begrenzt auf 3-fach
  const camera = fitDetail([100, 50, 200, 100], 1, 800, 300);
  assert.equal(camera.zoom, 3);
  // Mitte des Ausschnitts (200 | 100) landet in der Mitte der Einzelheit (400 | 150)
  assert.equal(camera.x + 200 * camera.zoom, 400);
  assert.equal(camera.y + 100 * camera.zoom, 150);
});

test("Ein grosser Ausschnitt verkleinert das Auto", () => {
  const camera = fitDetail([0, 0, 1000, 400], 0.5, 290, 200);
  assert.equal(camera.zoom, 0.58);
});

test("Massstab wird wie auf einer Zeichnung geschrieben", () => {
  assert.equal(formatScale(2.27), "M 2,3 : 1");
  assert.equal(formatScale(1), "M 1,0 : 1");
  assert.equal(formatScale(0.55), "M 1 : 1,8");
});
