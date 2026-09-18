import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.localStorage ??= { getItem(){ return null; }, setItem(){}, key(){ return null; }, length: 0 };
import { NUTS } from "../src/data.js";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≈ ${b}`);
const { mapNutrients, bundledFdcId } = await import("../src/fdc.js");

test("maps all three FoodData Central nutrient shapes", () => {
  const full     = { foodNutrients: [{ nutrient: { id: 1008, number: "208" }, amount: 150 }, { nutrient: { id: 1003, number: "203" }, amount: 20 }] };
  const abridged = { foodNutrients: [{ number: "208", name: "Energy", amount: 150 }, { number: "203", name: "Protein", amount: 20 }] };
  const hit      = { foodNutrients: [{ nutrientId: 1008, nutrientNumber: "208", value: 150 }, { nutrientId: 1003, nutrientNumber: "203", value: 20 }] };
  for (const food of [full, abridged, hit]) {
    const m = mapNutrients(food);
    assert.equal(m[0], 150); assert.equal(m[1], 20); assert.equal(m.length, 24);
  }
});

test("bundled entries expose the USDA id they came from", () => {
  assert.equal(bundledFdcId({ src: "USDA 171077 (SR Legacy)" }), 171077);
  assert.equal(bundledFdcId({ src: "40% elemental calcium" }), null);
});

test("converts USDA units into the AAFCO table's units", () => {
  const hit = (...pairs) => ({ foodNutrients: pairs.map(([id, num, value]) => ({ nutrientId: id, nutrientNumber: num, value })) });
  const j = name => NUTS.findIndex(n => n[0] === name);
  // vitamin A: USDA's IU field first; else USDA's IU definition from retinol and carotenes; else RAE µg × 3.33
  assert.equal(mapNutrients(hit([1104, "318", 500], [1106, "320", 999], [1105, "319", 999]))[j("Vitamin A")], 500);
  assert.equal(mapNutrients(hit([1105, "319", 69], [1106, "320", 69]))[j("Vitamin A")], 230);          // cottage cheese: retinol only
  near(mapNutrients(hit([1105, "319", 0], [1107, "321", 11509], [1108, "322", 7], [1106, "320", 961]))[j("Vitamin A")], 19187.5); // sweet potato: USDA lists 19218
  assert.equal(mapNutrients(hit([1120, "334", 120]))[j("Vitamin A")], 100);
  assert.equal(mapNutrients(hit([1106, "320", 100]))[j("Vitamin A")], 333);
  // vitamin D: IU preferred; µg × 40 otherwise
  assert.equal(mapNutrients(hit([1110, "324", 80], [1114, "328", 5]))[j("Vitamin D")], 80);
  assert.equal(mapNutrients(hit([1114, "328", 2.5]))[j("Vitamin D")], 100);
  // vitamin E: mg α-tocopherol × 1.49 IU
  assert.equal(+mapNutrients(hit([1109, "323", 10]))[j("Vitamin E")].toFixed(2), 14.9);
  // EPA + DHA are summed; one missing counts as 0, both missing is unknown
  assert.equal(mapNutrients(hit([1278, "629", 1.5], [1272, "621", 2.25]))[j("EPA+DHA")], 3.75);
  assert.equal(mapNutrients(hit([1272, "621", 2.25]))[j("EPA+DHA")], 2.25);
  assert.equal(mapNutrients(hit([1003, "203", 1]))[j("EPA+DHA")], null);
  // energy falls back to the Atwater-derived fields; fat to NLEA total fat; folate to food folate
  assert.equal(mapNutrients(hit([2047, "957", 123]))[0], 123);
  assert.equal(mapNutrients(hit([1085, "298", 9]))[j("Fat")], 9);
  assert.equal(mapNutrients(hit([1187, "431", 40]))[j("Folate")], 40);
  // masses pass straight through in the units the table expects (mg, µg)
  const m = mapNutrients(hit([1087, "301", 56], [1103, "317", 30.7], [1178, "418", 0.89], [1180, "421", 293.8]));
  assert.equal(m[j("Calcium")], 56); assert.equal(m[j("Selenium")], 30.7); assert.equal(m[j("Vitamin B12")], 0.89); assert.equal(m[j("Choline")], 293.8);
  // a nutrient the record does not carry is null (unknown), never 0 or NaN; a reported 0 stays 0
  assert.ok(mapNutrients({ foodNutrients: [{ nutrientId: 1003, value: null }] }).every(v => v === null));
  assert.ok(mapNutrients({}).every(v => v === null));
  const z = mapNutrients(hit([1100, "314", 0], [1003, "203", 20]));
  assert.equal(z[j("Iodine")], 0); assert.equal(z[j("Protein")], 20); assert.equal(z[j("Calcium")], null);
});
