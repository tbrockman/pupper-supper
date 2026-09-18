/**
 * Pure diet maths: no DOM, no storage. render.js draws what this returns and
 * test/analysis.test.js checks it.
 *
 * AAFCO expresses its profile per 1,000 kcal of metabolisable energy, on the
 * assumption that the food is fed in the amount that meets the dog's energy
 * need. So the daily requirement of a nutrient for *this* dog is
 *     AAFCO value per 1,000 kcal × (energy need in kcal / 1,000)
 * and that, not the nutrient density of whatever was entered, is what each
 * day's intake is judged against. Density alone would call 100 g of beef a
 * complete diet: its 21 g of protein is 156 g per 1,000 kcal, well over 45,
 * while the dog is short of both calories and protein.
 */
import { NUTS, iKcal, iCa, iP } from "./data.js";
import { S, totals, totalGrams, weightKg, missing } from "./state.js";

/** Resting energy requirement, kcal/day, for a body weight in kg. */
export const rerFor = kg => kg > 0 ? 70 * Math.pow(kg, 0.75) : 0;
/** Maintenance energy requirement: RER × activity multiplier. */
export const merFor = (kg, activity) => rerFor(kg) * (activity > 0 ? activity : 0);

/** Calories eaten within ±10 % of the need count as on target. */
export const ENERGY_TOLERANCE = 0.10;
/** Under 120 % of a minimum is flagged as marginal. */
export const MARGINAL = 1.2;

/**
 * Status of one nutrient.
 *   day      amount eaten per day
 *   mer      the dog's energy need, kcal/day
 *   mn / mx  AAFCO minimum / maximum per 1,000 kcal (null when there is none)
 * Returns { dayMin, dayMax, pct, status } where status is one of
 * "unknown" (no energy need to scale by), "high", "low", "marginal", "ok".
 */
export function judge(day, mer, mn, mx){
  if(!(mer > 0)) return { dayMin: null, dayMax: null, pct: NaN, status: "unknown" };
  const scale = mer / 1000;
  const dayMin = mn != null ? mn * scale : null;
  const dayMax = mx != null ? mx * scale : null;
  const pct = dayMin ? day / dayMin : NaN;
  let status = "ok";
  if(dayMax != null && day > dayMax) status = "high";
  else if(dayMin != null && pct < 1) status = "low";
  else if(dayMin != null && pct < MARGINAL) status = "marginal";
  return { dayMin, dayMax, pct, status };
}

/** Calcium : phosphorus by weight. NaN with neither, Infinity with calcium but no phosphorus. */
export function caToP(ca, p){
  if(p > 0) return ca / p;
  return ca > 0 ? Infinity : NaN;
}

/**
 * Everything the analysis panel shows, for the current diet (or a given one).
 *   kcal, grams   energy and mass eaten per day
 *   rer, mer      the dog's resting / maintenance need, kcal/day
 *   ePct          kcal / mer (NaN when mer is 0)
 *   energy        "ok" | "low" | "high" | "unknown"
 *   caP           calcium : phosphorus ratio, see caToP
 *   rows          one per NUTS entry: { j, name, unit, min, max, day, per1000, dayMin, dayMax, pct, status, missing }
 *                 per1000 is the density of the diet as entered; min/max are AAFCO's per 1,000 kcal;
 *                 missing lists the foods fed whose value for this nutrient is unknown (day is then a lower bound).
 */
export function analyze(state = S){
  const t = totals(state), kcal = t[iKcal], miss = missing(state);
  const rer = rerFor(weightKg(state)), mer = merFor(weightKg(state), state.activity);
  const ePct = mer > 0 ? kcal / mer : NaN;
  const energy = !(mer > 0) ? "unknown" : ePct < 1 - ENERGY_TOLERANCE ? "low" : ePct > 1 + ENERGY_TOLERANCE ? "high" : "ok";
  const rows = NUTS.map(([name, unit, mn, mx], j) => {
    const day = t[j];
    const per1000 = kcal > 0 ? day / kcal * 1000 : NaN;
    const v = j === iKcal ? { dayMin: null, dayMax: null, pct: NaN, status: "energy" } : judge(day, mer, mn, mx);
    return { j, name, unit, min: mn, max: mx, day, per1000, ...v, missing: miss[j] };
  });
  return { kcal, grams: totalGrams(state), rer, mer, ePct, energy, caP: caToP(t[iCa], t[iP]), rows };
}
