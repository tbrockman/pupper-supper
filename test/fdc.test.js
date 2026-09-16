import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.localStorage ??= { getItem(){ return null; }, setItem(){}, key(){ return null; }, length: 0 };
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
