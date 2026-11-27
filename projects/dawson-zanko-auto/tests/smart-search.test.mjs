import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const S = createRequire(import.meta.url)("../assets/js/smart-search.js");
const opts = { brands: ["Peugeot", "Mercedes-Benz", "Renault"], models: ["3008", "Clio V"], currentYear: 2026 };

test("phrase complète", () => {
  const c = S.parse("SUV diesel automatique moins de 20 000 €", opts);
  assert.deepEqual([c.body, c.fuel, c.transmission, c.priceMax], ["suv", "diesel", "automatique", 20000]);
  assert.equal(c.text, "");
});
test("marque, modèle, km, année", () => {
  const c = S.parse("peugeot 3008 < 50000 km après 2019", opts);
  assert.equal(c.brand, "Peugeot"); assert.equal(c.model, "3008");
  assert.equal(c.kmMax, 50000); assert.equal(c.yearMin, 2019);
});
test("k et max", () => {
  assert.equal(S.parse("citadine essence 12k max", opts).priceMax, 12000);
  assert.equal(S.parse("budget 15000", opts).priceMax, 15000);
  assert.equal(S.parse("80k km max", opts).kmMax, 80000);
});
test("fourchette de prix", () => {
  const c = S.parse("entre 10 et 15k", opts);
  assert.equal(c.priceMin, 10000); assert.equal(c.priceMax, 15000);
});
test("accents, alias et récente", () => {
  const c = S.parse("Mercedes électrique récente", opts);
  assert.equal(c.brand, "Mercedes-Benz"); assert.equal(c.fuel, "electrique"); assert.equal(c.yearMin, 2022);
});
test("matches", () => {
  const v = { brand: "Peugeot", model: "3008", fuel: "diesel", transmission: "automatique", body: "suv", price: 19000, mileage: 40000, year: 2021 };
  assert.ok(S.matches(v, S.parse("suv diesel auto moins de 20k", opts)));
  assert.ok(!S.matches(v, S.parse("essence", opts)));
  assert.ok(!S.matches(v, S.parse("moins de 15 000 €", opts)));
});
