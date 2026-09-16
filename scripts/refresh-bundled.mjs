/**
 * Regenerate src/bundled.js from USDA FoodData Central.
 *
 *   FDC_KEY=your-key node scripts/refresh-bundled.mjs            # all foods
 *   FDC_KEY=DEMO_KEY LIMIT=3 node scripts/refresh-bundled.mjs   # first 3 (DEMO_KEY allows 10 req/h)
 *
 * One search per food plus one batched detail request per 20 foods.
 * Entries marked `manual` are copied through untouched.
 */
import { writeFileSync, existsSync } from "node:fs";
import { LIST } from "./bundled-list.js";
import { mapNutrients } from "../src/fdc.js";
import { formatBundled } from "./bundled-format.mjs";

const KEY = process.env.FDC_KEY;
if(!KEY){ console.error("Set FDC_KEY (get one at https://fdc.nal.usda.gov/api-key-signup)"); process.exit(1); }
const LIMIT = +process.env.LIMIT || Infinity;
const API = "https://api.nal.usda.gov/fdc/v1";
const OUT = new URL("../src/bundled.js", import.meta.url);

async function get(path, init){
  const r = await fetch(`${API}${path}${path.includes("?")?"&":"?"}api_key=${KEY}`, init);
  if(!r.ok) throw new Error(`${path.split("?")[0]} -> ${r.status} ${r.statusText}`);
  return r.json();
}

// keep previously fetched entries so a partial run does not lose data
const previous = {};
if(existsSync(OUT)){
  const { BUNDLED } = await import(OUT);
  for(const e of BUNDLED) previous[e.name] = e;
}

/* FDC's search parser rejects punctuation such as / % ( ) and quotes with a 400,
   so the query is the description with those stripped; results are still matched
   against the exact description. */
const searchable = q => q.replace(/[^\w\s,.-]/g, " ").replace(/\s+/g, " ").trim();

const todo = LIST.filter(x=>!x.manual).slice(0, LIMIT);
const found = [];
for(const item of todo){
  let j;
  try{ j = await get(`/foods/search?query=${encodeURIComponent(searchable(item.q))}&dataType=${encodeURIComponent("SR Legacy,Foundation")}&pageSize=25`); }
  catch(e){ console.warn(`search failed for ${item.name}: ${e.message}`); continue; }
  const hit = (j.foods||[]).find(x=>x.description.toLowerCase()===item.q.toLowerCase()) || (j.foods||[])[0];
  if(!hit){ console.warn(`no result for ${item.name}`); continue; }
  found.push({ ...item, fdcId: hit.fdcId, description: hit.description, dataType: hit.dataType });
  console.log(`${item.name.padEnd(36)} -> ${hit.fdcId} ${hit.description}`);
}
for(let i=0;i<found.length;i+=20){
  const chunk = found.slice(i,i+20);
  const foods = await get(`/foods`, { method:"POST", headers:{"content-type":"application/json"},
    body: JSON.stringify({ fdcIds: chunk.map(x=>x.fdcId), format:"full" }) });
  for(const food of foods){
    const it = chunk.find(x=>x.fdcId===food.fdcId);
    if(it) it.per100 = mapNutrients(food);
  }
}

const out = LIST.map(item=>{
  if(item.manual) return { name:item.name, src:item.src, per100:item.per100 };
  const fresh = found.find(x=>x.name===item.name && x.per100);
  if(fresh) return { name:item.name, src:`USDA ${fresh.fdcId} (${fresh.dataType})`, per100: fresh.per100.map(v=>+(+v).toFixed(3)) };
  if(previous[item.name]) return previous[item.name];
  console.warn(`no data for ${item.name}; leaving it out`);
  return null;
}).filter(Boolean);

writeFileSync(OUT, formatBundled(out, "scripts/refresh-bundled.mjs"));
console.log(`wrote ${out.length} foods to src/bundled.js`);
