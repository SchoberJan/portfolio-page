// Ausführen mit: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { toSvgPath } from "./circuit-map.js";

// Geschlossenes Quadrat am Äquator: dort verzerrt die Projektion nicht
const square = [
  [0, 0],
  [1, 0],
  [1, -1],
  [0, -1],
  [0, 0],
];

test("Strecke ist auf die längste Seite 100 skaliert und geschlossen", () => {
  const { d, viewBox } = toSvgPath(square);
  assert.equal(viewBox, "0 0 100.0 100.0");
  assert.ok(d.startsWith("M0.0 0.0C"));
  assert.ok(d.endsWith("0.0 0.0Z"));
  // Vier Teilstücke: Der wiederholte letzte Punkt erzeugt keine fünfte Kurve
  assert.equal(d.match(/C/g).length, 4);
});

test("Griffe schiessen neben einer langen Geraden nicht über die Strecke hinaus", () => {
  const { d } = toSvgPath([
    [0, 0],
    [1, 0],
    [1.01, -0.01],
    [1, -0.02],
    [0, -0.02],
    [0, 0],
  ]);
  const xs = [...d.matchAll(/(-?\d+\.\d) (-?\d+\.\d)/g)].map((match) => Number(match[1]));
  assert.ok(Math.max(...xs) <= 101);
  assert.ok(Math.min(...xs) >= -1);
});

test("Start-Ziel-Linie steht quer zur Fahrtrichtung", () => {
  // Erstes Teilstück waagrecht, also muss die Linie senkrecht sein: gleiches x
  const { startLine } = toSvgPath(square);
  const [[, x1, y1], [, x2, y2]] = [...startLine.matchAll(/(-?\d+\.\d) (-?\d+\.\d)/g)];
  assert.equal(x1, x2);
  assert.notEqual(y1, y2);
});
