import { EXAMPLE, NUTS, UNITS, PERIODS, WEIGHT_UNITS, DEFAULT_TITLE, newId } from "./data.js";
import { evalExpr } from "./expr.js";

/* ---------- localStorage wrapper ---------- */
export const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
};

/* ---------- current recipe (live binding: importers see reassignment) ---------- */
export let S = null;
export function setState(next){ S = next; }
export function loadLocal(){ return sanitize(store.get("lady.state")) || structuredClone(EXAMPLE); }
export function saveLocal(){ store.set("lady.state", S); }

const num = (v,d)=> Number.isFinite(+v) && v!=="" && v!==null ? +v : d;
const str = (v,d="")=> typeof v==="string" ? v.slice(0,300) : d;

/**
 * v1 recipes (before the per-day expression column) had batch/day/week modes
 * with qty × gPerUnit and a batch fraction. Rewrite each into amount/unit/per.
 */
function migrateV1(raw){
  const cups = num(raw.cupsPerDay, 2), batch = num(raw.batchCups, 10) || 10;
  const foods = raw.foods.filter(x=>x && typeof x==="object").map(x=>{
    const qty = num(x.qty, 0), g = num(x.gPerUnit, 1), unit = str(x.unit, "g") || "g";
    const base = g===1 ? `${qty}` : `${qty}*${g}`;
    const amount = x.mode==="batch" ? `${base}*${cups}/${batch}` : base;
    const per = x.mode==="week" ? "week" : "day";
    const note = unit==="g" ? (x.mode==="batch" ? `${qty} g per batch` : "") : `${qty} ${unit} × ${g} g${x.mode==="batch" ? " per batch" : ""}`;
    return { ...x, amount, unit:"g", per, src: [str(x.src), note].filter(Boolean).join(" · ") };
  });
  return { title: raw.title, weight: raw.weight, activity: raw.activity, foods };
}

/**
 * Coerce an untrusted recipe object (from localStorage or a shared link) into a
 * well-formed one. Returns null if it is not recognisably a recipe.
 * v2 recipes (amount expression, `kind`, no unit/per) need no rewriting: unit
 * and per default to g / day and `kind` is simply dropped.
 */
export function sanitize(raw){
  if(!raw || typeof raw!=="object" || !Array.isArray(raw.foods)) return null;
  if("batchCups" in raw || raw.foods.some(x=>x && "mode" in x)) raw = migrateV1(raw);
  return {
    title:    str(raw.title, DEFAULT_TITLE).trim() || DEFAULT_TITLE,
    weight:   num(raw.weight, EXAMPLE.weight),
    weightUnit: raw.weightUnit in WEIGHT_UNITS ? raw.weightUnit : "kg",
    activity: num(raw.activity, EXAMPLE.activity),
    foods: raw.foods.filter(x=>x && typeof x==="object").map(x=>({
      id:     str(x.id) || newId(),
      name:   str(x.name, "Unnamed"),
      amount: typeof x.amount==="number" ? String(x.amount) : str(x.amount, "0").slice(0,60),
      unit:   x.unit in UNITS ? x.unit : "g",
      per:    x.per in PERIODS ? x.per : "day",
      src:    str(x.src),
      per100: NUTS.map((_,j)=> num(Array.isArray(x.per100)? x.per100[j] : 0, 0)),
    })),
  };
}

/* ---------- ration maths ---------- */
/** the dog's weight in kilograms, whatever unit it was entered in */
export const weightKg = () => S.weight * WEIGHT_UNITS[S.weightUnit];
/** grams per day for an item; NaN when its expression does not parse */
export const gramsPerDay = it => evalExpr(it.amount) * UNITS[it.unit] / PERIODS[it.per];
const g0 = it => { const g = gramsPerDay(it); return Number.isFinite(g) && g>0 ? g : 0; };

export function totals(){
  const t = NUTS.map(()=>0);
  for(const it of S.foods){
    const g = g0(it);
    it.per100.forEach((v,j)=> t[j]+= g*(v||0)/100);
  }
  return t;
}
export const totalGrams = () => S.foods.reduce((a,x)=>a+g0(x),0);
