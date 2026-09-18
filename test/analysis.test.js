import { test } from "node:test";
import assert from "node:assert/strict";
import { NUTS, UNITS, PERIODS, EXAMPLE, iKcal, iCa, iP } from "../src/data.js";
import { sanitize, setState, totals, totalGrams, gramsPerDay, weightKg, missing, unknownOf } from "../src/state.js";
import { analyze, judge, caToP, rerFor, merFor } from "../src/analysis.js";
import { BUNDLED } from "../src/bundled.js";

const near = (a, b, rel = 1e-6, msg) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), msg ?? `${a} ≈ ${b}`);
const idx = name => NUTS.findIndex(n => n[0] === name);
const bundled = name => BUNDLED.find(b => b.name === name);
const food = (name, amount, unit, per, per100) => ({ name, amount: String(amount), unit, per, per100 });
/** a diet for one dog; per100 arrays may be short (missing columns are 0) */
const diet = (foods, weight = 23, activity = 2.4, weightUnit = "kg") => sanitize({ weight, activity, weightUnit, foods });
/** a synthetic complete food: `mult` × every AAFCO minimum per 1,000 kcal, packed into `kcal` kcal per 100 g */
const completeFood = (kcal, mult = 1.5) => NUTS.map(([, , mn], j) => j === iKcal ? kcal : (mn ?? 0) * mult * kcal / 1000);

/* ---------- energy need ---------- */
test("resting and maintenance energy follow 70 × kg^0.75 × activity", () => {
  near(rerFor(23), 735.18, 1e-4);      // 70 × 23^0.75
  near(merFor(23, 2.4), 1764.43, 1e-4);
  near(merFor(10, 1), 393.6, 1e-3);
  assert.equal(rerFor(0), 0);
  assert.equal(rerFor(-5), 0);
  assert.equal(merFor(20, -1), 0);
  assert.equal(merFor(20, NaN), 0);
});

test("the dog's weight in lb feeds the same maths as in kg", () => {
  const kg = analyze(diet([], 23, 1.6, "kg")), lb = analyze(diet([], 23 / 0.453592, 1.6, "lb"));
  near(kg.mer, lb.mer, 1e-9);
  near(weightKg(diet([], 50, 1, "lb")), 22.6796, 1e-4);
});

/* ---------- grams per day ---------- */
test("every unit × period combination converts to grams per day", () => {
  for (const [u, gPerUnit] of Object.entries(UNITS))
    for (const [p, days] of Object.entries(PERIODS)) {
      const d = diet([food("x", 3, u, p, [100])]);
      near(gramsPerDay(d.foods[0]), 3 * gPerUnit / days, 1e-9, `3 ${u}/${p}`);
    }
  // spot values a person can check by hand
  near(gramsPerDay(food("x", 1, "lb", "week", [])), 64.7989, 1e-5);
  near(gramsPerDay(food("x", 8, "oz", "day", [])), 226.796, 1e-5);
  near(gramsPerDay(food("x", 1, "kg", "month", [])), 32.8542, 1e-5);
});

test("the same mass expressed in different units gives identical totals", () => {
  const per100 = bundled("Egg, whole, raw").per100;
  const same = [
    food("g", 1000, "g", "day", per100),
    food("kg", 1, "kg", "day", per100),
    food("oz", 1000 / 28.3495, "oz", "day", per100),
    food("lb", 1000 / 453.592, "lb", "day", per100),
    food("week", 7, "kg", "week", per100),
    food("month", 30.4375, "kg", "month", per100),
    food("expr", "2*500", "g", "day", per100),
    food("batch", "10000*2/20", "g", "day", per100),
  ];
  const ref = totals(diet([same[0]]));
  for (const f of same.slice(1)) {
    const t = totals(diet([f]));
    t.forEach((v, j) => near(v, ref[j], 1e-9, `${f.name} ${NUTS[j][0]}`));
  }
});

test("totals are linear: doubling an amount doubles every nutrient, and foods add up", () => {
  const egg = bundled("Egg, whole, raw").per100, rice = bundled("Rice, white, cooked").per100;
  const one = totals(diet([food("egg", 50, "g", "day", egg)]));
  const two = totals(diet([food("egg", 100, "g", "day", egg)]));
  one.forEach((v, j) => near(two[j], 2 * v, 1e-9));
  const both = totals(diet([food("egg", 50, "g", "day", egg), food("rice", 200, "g", "day", rice)]));
  const riceOnly = totals(diet([food("rice", 200, "g", "day", rice)]));
  both.forEach((v, j) => near(v, one[j] + riceOnly[j], 1e-9));
  // per-100 g values scale by grams/100 exactly
  near(one[idx("Protein")], 12.56 * 0.5); near(one[idx("Calcium")], 28); near(one[iKcal], 71.5);
});

test("unparseable, zero and negative amounts contribute nothing; negative nutrients are clamped", () => {
  const d = diet([
    food("ok", 100, "g", "day", [200, 10]),
    food("bad", "100/", "g", "day", [200, 10]),
    food("zero", 0, "g", "day", [200, 10]),
    food("neg", -100, "g", "day", [200, 10]),
    food("negnut", 100, "g", "day", [-50, -5]),
  ]);
  assert.deepEqual(totals(d).slice(0, 2), [200, 10]);
  assert.equal(totalGrams(d), 200);           // the clamped row still weighs something
  assert.deepEqual(d.foods[4].per100.slice(0, 2), [0, 0], "sanitize clamps negative nutrients");
  assert.equal(diet([], -10).weight, 0);
  assert.equal(diet([], 10, -2).activity, 0);
});

/* ---------- judging a nutrient ---------- */
test("judge scales the AAFCO per-1,000 kcal profile by the dog's energy need", () => {
  const mer = 2000; // so a per-1,000 kcal minimum doubles
  assert.deepEqual(judge(90, mer, 45, null), { dayMin: 90, dayMax: null, pct: 1, status: "marginal" });
  assert.equal(judge(89.9, mer, 45, null).status, "low");
  assert.equal(judge(108, mer, 45, null).status, "ok");        // 120 %
  assert.equal(judge(107, mer, 45, null).status, "marginal");
  assert.deepEqual(judge(3000, mer, 1250, 6250), { dayMin: 2500, dayMax: 12500, pct: 1.2, status: "ok" });
  assert.equal(judge(12500.1, mer, 1250, 6250).status, "high");
  assert.equal(judge(0, mer, 1250, 6250).status, "low");
  assert.equal(judge(5, mer, null, null).status, "ok");        // no minimum: nothing to fail
  assert.equal(judge(5, 0, 45, null).status, "unknown");
  assert.equal(judge(5, NaN, 45, null).status, "unknown");
});

test("calcium : phosphorus handles zeros", () => {
  assert.equal(caToP(1200, 1000), 1.2);
  assert.equal(caToP(0, 0), NaN);
  assert.equal(caToP(0, 500), 0);
  assert.equal(caToP(500, 0), Infinity);
});

/* ---------- the scenario that prompted this: 100 g of beef a day ---------- */
test("100 g of beef a day is short of protein for a 23 kg dog, whatever its nutrient density", () => {
  const beef = bundled("Beef, ground, 95% lean, raw").per100;
  const a = analyze(diet([food("beef", 100, "g", "day", beef)], 23, 2.4));
  const p = a.rows[idx("Protein")];
  near(p.day, 21.41);
  near(p.per1000, 21.41 / 137 * 1000, 1e-9);     // 156 g/1,000 kcal: dense in protein…
  assert.ok(p.per1000 > p.min);
  near(p.dayMin, 45 * a.mer / 1000, 1e-9);        // …but the dog needs ~79 g a day
  assert.ok(p.dayMin > 79 && p.dayMin < 80);
  assert.equal(p.status, "low");
  near(p.pct, 21.41 / p.dayMin, 1e-9);
  assert.equal(a.energy, "low");
  near(a.ePct, 137 / a.mer, 1e-9);
  // every nutrient with a minimum is short when the dog gets 8 % of its calories
  for (const r of a.rows) if (r.min != null) assert.equal(r.status, "low", r.name);
});

/* ---------- a complete food at, under and over the energy need ---------- */
test("a complete food fed to the energy need passes everything; the same food under- or over-fed does not", () => {
  const per100 = completeFood(400, 1.5), mer = merFor(23, 2.4);
  const gramsFor = frac => (mer * frac / 400) * 100;
  const at = analyze(diet([food("complete", gramsFor(1), "g", "day", per100)]));
  assert.equal(at.energy, "ok"); near(at.ePct, 1);
  for (const r of at.rows) if (r.j !== iKcal) {
    if (r.min != null) { near(r.pct, 1.5, 1e-9, r.name); near(r.per1000 / r.min, 1.5, 1e-9, r.name); }
    assert.equal(r.status, "ok", r.name);
  }
  // half the food: density is unchanged but the dog gets 75 % of every minimum
  const half = analyze(diet([food("complete", gramsFor(0.5), "g", "day", per100)]));
  assert.equal(half.energy, "low");
  for (const r of half.rows) if (r.min != null) { near(r.pct, 0.75, 1e-9, r.name); assert.equal(r.status, "low", r.name); near(r.per1000 / r.min, 1.5, 1e-9); }
  // 80 % of the food: still under-fed on calories, nutrients at exactly 120 % → marginal boundary
  const most = analyze(diet([food("complete", gramsFor(0.8), "g", "day", per100)]));
  assert.equal(most.energy, "low");
  for (const r of most.rows) if (r.min != null) near(r.pct, 1.2, 1e-9, r.name);
  // twice the food: calories flagged high, nutrients plentiful, but a maximum can now be crossed
  const twice = analyze(diet([food("complete", gramsFor(2), "g", "day", per100)]));
  assert.equal(twice.energy, "high");
  assert.equal(twice.rows[idx("Protein")].status, "ok");
  near(twice.rows[idx("Protein")].pct, 3, 1e-9);
});

test("a maximum is judged on the daily amount, so a supplement can push a nutrient over even in a small diet", () => {
  const mer = merFor(23, 2.4);
  const vitD = idx("Vitamin D"), supp = NUTS.map(() => 0); supp[vitD] = 1e6; // IU per 100 g
  const gramsOver = (750 * mer / 1000) / 1e6 * 100 * 1.01;
  const a = analyze(diet([food("D", gramsOver, "g", "day", supp)]));
  assert.equal(a.rows[vitD].status, "high");
  assert.equal(analyze(diet([food("D", gramsOver * 0.9, "g", "day", supp)])).rows[vitD].status, "ok");
  // a maximum wins over a low minimum elsewhere only for its own row
  assert.equal(a.rows[idx("Protein")].status, "low");
});

test("only calcium in the bowl: ratio is infinite and calcium is judged against its daily need", () => {
  const cc = bundled("Calcium carbonate powder").per100;
  const a = analyze(diet([food("CaCO3", 5, "g", "day", cc)]));
  assert.equal(a.caP, Infinity);
  assert.equal(a.kcal, 0);
  assert.ok(Number.isNaN(a.rows[iCa].per1000), "no density without calories");
  near(a.rows[iCa].day, 2000);
  assert.equal(a.rows[iCa].status, "low");          // needs ~2,200 mg
  assert.equal(analyze(diet([food("CaCO3", 6, "g", "day", cc)])).rows[iCa].status, "marginal");   // 2,400 mg ≈ 109 %
  assert.equal(analyze(diet([food("CaCO3", 7, "g", "day", cc)])).rows[iCa].status, "ok");
  const e = analyze(diet([]));
  assert.ok(Number.isNaN(e.caP)); assert.equal(e.energy, "low"); assert.equal(e.grams, 0);
});

test("without a weight nothing can be judged", () => {
  const a = analyze(diet([food("beef", 100, "g", "day", bundled("Beef, ground, 95% lean, raw").per100)], 0));
  assert.equal(a.mer, 0); assert.ok(Number.isNaN(a.ePct)); assert.equal(a.energy, "unknown");
  for (const r of a.rows) if (r.j !== iKcal) { assert.equal(r.status, "unknown"); assert.equal(r.dayMin, null); }
  near(a.rows[idx("Protein")].per1000, 156.277, 1e-4);   // density is still reported
});

test("the built-in example diet meets the profile for the dog it was written for", () => {
  setState(structuredClone(EXAMPLE));
  const a = analyze();
  assert.equal(a.energy, "ok");
  assert.ok(a.caP >= 1 && a.caP <= 2);
  for (const r of a.rows) if (r.j !== iKcal) assert.equal(r.status, "ok", `${r.name}: ${r.status} ${(100 * r.pct).toFixed(0)}%`);
});

test("the AAFCO table is the 2016 adult-maintenance profile per 1,000 kcal", () => {
  const byName = Object.fromEntries(NUTS.map(([n, u, mn, mx]) => [n, { u, mn, mx }]));
  assert.deepEqual(byName["Protein"], { u: "g", mn: 45, mx: null });
  assert.deepEqual(byName["Calcium"], { u: "mg", mn: 1250, mx: 6250 });
  assert.deepEqual(byName["Vitamin D"], { u: "IU", mn: 125, mx: 750 });
  assert.deepEqual(byName["Iodine"], { u: "µg", mn: 250, mx: 2750 });
  assert.deepEqual(byName["Vitamin B12"], { u: "µg", mn: 7, mx: null });
  assert.equal(NUTS.length, 24);
  assert.equal(NUTS[iKcal][0], "Energy"); assert.equal(NUTS[iCa][0], "Calcium"); assert.equal(NUTS[iP][0], "Phosphorus");
});

/* ---------- unknown values ---------- */
test("a nutrient the source did not report is null, counts as 0, and is listed as missing", () => {
  const beef = bundled("Beef, ground, 95% lean, raw").per100;
  const iodine = idx("Iodine");
  assert.equal(beef[iodine], null, "USDA SR Legacy never reports iodine");
  const d = diet([food("beef", 100, "g", "day", beef), food("kelp", 1, "g", "day", bundled("Kelp powder").per100), food("none", 0, "g", "day", beef)]);
  const a = analyze(d);
  near(a.rows[iodine].day, 1500);                               // kelp only; beef's unknown adds nothing
  assert.deepEqual(a.rows[iodine].missing, [{ name: "beef", grams: 100 }]);   // a food fed at 0 g is not listed
  assert.deepEqual(a.rows[idx("Protein")].missing, []);
  assert.equal(a.rows[iodine].status, "ok"); near(a.rows[iodine].pct, 1500 / a.rows[iodine].dayMin, 1e-9);
  assert.deepEqual(missing(diet([])), NUTS.map(() => []));
});

test("sanitize keeps null for unknown values and treats blank or garbage the same way", () => {
  const s = sanitize({ foods: [{ name: "x", amount: "1", per100: [1, null, undefined, "", "abc", -3, "4"] }] });
  assert.deepEqual(s.foods[0].per100.slice(0, 7), [1, null, null, null, null, 0, 4]);
  assert.ok(s.foods[0].per100.slice(7).every(v => v === null), "missing columns are unknown, not zero");
  assert.deepEqual(unknownOf(s.foods[0]), [1, 2, 3, 4, ...Array.from({ length: 17 }, (_, i) => i + 7)]);
  assert.deepEqual(unknownOf({ per100: NUTS.map(() => 0) }), []);
});
