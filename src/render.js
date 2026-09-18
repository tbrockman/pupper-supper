import { NUTS, UNITS, PERIODS, iKcal } from "./data.js";
import { S, gramsPerDay, unknownOf } from "./state.js";
import { analyze, ENERGY_TOLERANCE } from "./analysis.js";
import { icon } from "./icons.js";
import { editable, fitAll } from "./editable.js";

/** Escape text for innerHTML. Names/sources can arrive from a shared link. */
export const esc = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const fmt = v => !Number.isFinite(v) ? "\u2013" : v>=100? v.toFixed(0) : v>=10? v.toFixed(1) : v.toFixed(2);
export const gramsText = it => { const g = gramsPerDay(it); return Number.isFinite(g) ? `${g.toFixed(g<10?1:0)} g` : "?"; };
const opts = (obj, sel) => Object.keys(obj).map(k=>`<option value="${k}" ${k===sel?"selected":""}>${k}</option>`).join("");
export const info = tip => `<span class="info" tabindex="0" role="note" data-tip="${esc(tip)}">${icon("info",14)}</span>`;
/** Amber marker for a value that rests on missing data; `attrs` can add e.g. a data-jump target. */
export const warn = (tip, size=13, attrs="") => `<span class="info warn" tabindex="0" role="note" data-tip="${esc(tip)}"${attrs}>${icon("alert",size)}</span>`;
/** "A", "A and B", "A, B, and C" */
const list = names => names.length<=1 ? names.join("") : names.length===2 ? names.join(" and ") : names.slice(0,-1).join(", ") + ", and " + names.at(-1);

/* ---------- food table ---------- */
/** ids of the foods whose nutrient panel is open (any number at once) */
export const openEditors = new Set();

/** The count of unknown nutrients shown on the row's editor button (empty when everything is known). */
export const badgeHtml = it => { const n = unknownOf(it).length; return n ? `<span class="badge">${n}</span>` : ""; };
function foodRow(it){
  const g = gramsPerDay(it), bad = !Number.isFinite(g), open = openEditors.has(it.id);
  return `<tr data-id="${esc(it.id)}" class="${open?"open":""}">
    <td class="foodname">
      ${editable({ value:it.name, cls:"name", attrs:`data-f="name" aria-label="Food name"`, label:"Rename" })}
    </td>
    <td class="num amount"><input type="text" inputmode="decimal" class="${bad?"bad":""}" value="${esc(it.amount)}" data-f="amount" aria-label="${esc(it.name)} amount" spellcheck="false"></td>
    <td><select data-f="unit" aria-label="unit">${opts(UNITS, it.unit)}</select></td>
    <td><select data-f="per" aria-label="per">${opts(PERIODS, it.per)}</select></td>
    <td class="num gday ${bad?"bad":""}">${gramsText(it)}</td>
    <td class="actions"><button class="quiet iconbtn ${open?"on":""}" data-f="edit" title="${open?"Close":"Edit"} nutritional information" aria-pressed="${open}" aria-expanded="${open}">${icon("sliders")}${badgeHtml(it)}</button><button class="quiet iconbtn" data-f="del" title="Remove" aria-label="Remove ${esc(it.name)}">${icon("trash")}</button></td></tr>`;
}
function editorRow(it){
  return `<tr class="editor" data-id="${esc(it.id)}"><td colspan="6">
    <label class="notefield">Note or source<input type="text" value="${esc(it.src)}" data-f="src" placeholder="where these numbers came from, batch size, brand\u2026" spellcheck="false" autocomplete="off"></label>
    <div class="nutgrid">${NUTS.map((n,j)=>{ const v = it.per100[j];
      return `<label class="${v==null?"unknown":""}"><span class="lt">${n[0]} ${n[1]} /100 g ${warn("Not reported; counts as 0. Type a value if you know it, or 0 if there is none.", 11)}</span><input type="number" step="any" min="0" value="${v==null?"":+(+v).toFixed(3)}" placeholder="${v==null?"not reported":""}" data-f="n" data-j="${j}" aria-label="${esc(n[0])} per 100 g${v==null?", not reported":""}"></label>`; }).join("")}
    </div></td></tr>`;
}
export function renderFoods(){
  const head = `<thead><tr><th>Food</th><th class="num">Amount</th><th>Unit</th><th>Per</th><th class="num">g / day</th><th></th></tr></thead>`;
  const tbl = document.getElementById("tbl-foods");
  tbl.innerHTML = head + "<tbody>" +
    (S.foods.map(it=> foodRow(it) + (openEditors.has(it.id) ? editorRow(it) : "")).join("") ||
     `<tr><td class="src" colspan="6">nothing yet — search above or add a custom food</td></tr>`) + "</tbody>";
  fitAll(tbl);
  document.querySelectorAll("input[data-g]").forEach(i=>{ if(+i.value !== S[i.dataset.g]) i.value = S[i.dataset.g]; });
  const wu = document.getElementById("g-weightUnit"); if(wu.value !== S.weightUnit) wu.value = S.weightUnit;
  const t = document.getElementById("title");
  if(t.value !== S.title){ t.value = S.title; t.dispatchEvent(new Event("input", { bubbles:true })); } // input event re-fits the box
  document.title = S.title;
}

/* ---------- analysis ---------- */
/** A tick number under a strip at pos % (centred on its marker by placeLabels()). */
const tick = (text, pos) => text ? `<span class="tk" style="--x:${pos}%">${esc(text)}</span>` : "";
/** value label above the dot, the strip, and the tick numbers beneath: one block, as tall as a name with its unit line */
const range = (inner, ticks, pos, label) =>
  `<div class="range"><div class="vlabel"><span class="vl" style="--x:${pos}%">${esc(label)}</span></div><div class="strip">${inner}</div><div class="ticks">${ticks}</div></div>`;
/**
 * Centre every label on its point: the value label on the dot, each tick on
 * its marker. A label shifts only as far as it must to stay within the strip,
 * and two ticks that would overlap are nudged apart.
 */
export function placeLabels(){
  const slack = 4, dotR = 4.5;
  document.querySelectorAll(".range").forEach(r=>{
    const w = r.offsetWidth;
    const at = el => parseFloat(el.style.getPropertyValue("--x")) / 100 * w;
    const clampTo = (el, x) => { const half = el.offsetWidth/2; return Math.max(half - slack, Math.min(w - half + slack, x)); };
    const vl = r.querySelector(".vl");
    if(vl) vl.style.left = clampTo(vl, Math.max(dotR, Math.min(w - dotR, at(vl)))) + "px";   // where the dot really is
    const tks = [...r.querySelectorAll(".tk")];
    const xs = tks.map(t => clampTo(t, at(t)));
    if(tks.length===2){                                       // keep min and max apart by a small gap
      const gap = 6, need = tks[0].offsetWidth/2 + tks[1].offsetWidth/2 + gap - (xs[1] - xs[0]);
      if(need > 0){ xs[0] -= need/2; xs[1] += need/2; }
    }
    tks.forEach((t,i)=> t.style.left = xs[i] + "px");
  });
}
/**
 * A range strip. The strip *is* the acceptable range: it runs from the minimum
 * to the maximum (or, with no maximum, on past the value) and only stretches
 * beyond an end when the value falls outside it, leaving the dot a little
 * inside the edge, but never so far that the range itself shrinks below half
 * the strip. Log scale, so a value twice over reads the same as one twice
 * under. Ticks beneath give the minimum and maximum in the row's unit.
 */
function strip(v, mn, mx, label, fmtTick=fmt){
  if(!(mn>0)) return range("", "", 0, label);
  v = Number.isFinite(v) ? v : v>0 ? (mx ?? mn)*3 : 0;         // an infinite ratio sits well past the end
  const below = v < mn, above = mx!=null && v > mx;
  let lo = below ? (v>0 ? v/1.15 : 0) : mn;
  let hi = above ? v*1.15 : (mx ?? Math.max(v, mn)*1.3);
  // the acceptable range keeps at least half the strip; a value further out than that sits at the edge
  lo = Math.max(lo, mn*mn/(mx ?? hi));
  if(above) hi = Math.min(hi, mx*mx/mn);
  const pos = x => Math.max(0, Math.min(100, 100*Math.log(Math.max(x,lo)/lo)/Math.log(hi/lo)));
  const bandL = pos(mn), bandR = mx!=null ? pos(mx) : 100, dot = pos(v);
  return range(`<div class="band" style="left:${bandL}%; width:${bandR-bandL}%"></div>
    <div class="minm" style="left:${bandL}%"></div>${mx!=null?`<div class="minm" style="left:${bandR}%"></div>`:""}
    <div class="dot" style="--x:${dot}%"></div>`,
    tick(fmtTick(mn), bandL) + (mx!=null ? tick(fmtTick(mx), bandR) : ""), dot, label);
}
const pctText = p => Number.isFinite(p) ? (100*p).toFixed(0)+"%" : "?";
export function renderAnalysis(){
  const a = analyze(), { kcal, rer, mer, ePct, caP } = a;
  const tol = (100*ENERGY_TOLERANCE).toFixed(0);
  const vrow = (cls, name, tip, strip, status, sub="") =>
    `<tr class="${cls}"><td>${name}${tip?" "+info(tip):""}${sub?`<span class="src" style="display:block">${sub}</span>`:""}</td>
     <td class="c-range">${strip}</td><td class="status">${status}</td></tr>`;
  // input rows: what the dog's numbers produce
  document.getElementById("w-status").textContent = mer>0 ? `RER \u2248 ${rer.toFixed(0)} kcal` : "enter a weight above 0";
  document.getElementById("a-status").textContent = mer>0 ?
    `need \u2248 ${mer.toFixed(0)} kcal \u00b7 ` + (S.activity<1.2 ? "below typical" : S.activity<=1.4 ? "inactive adult" : S.activity<=1.8 ? "active adult" : "working or growing")
    : "";
  // computed rows
  const caText = Number.isFinite(caP) ? caP.toFixed(2) : caP===Infinity ? "\u221e" : "\u2013";
  const caStatus = Number.isNaN(caP) ? "no calcium or phosphorus yet" : caP<1 ? "below 1.0 \u00b7 add calcium" : caP>2 ? "above 2.0 \u00b7 too much calcium" : "within range";
  document.getElementById("vitals-out").innerHTML =
    vrow(a.energy==="ok"?"okrow":"low", "Calories per day",
        `Energy in the diet versus the estimated need: RER \u00d7 activity, where RER = 70 \u00d7 kg^0.75 = ${rer.toFixed(0)} kcal here. Within \u00b1${tol}% counts as on target. Adjust to the dog\u2019s body condition over time.`,
        strip(kcal, mer*(1-ENERGY_TOLERANCE), mer*(1+ENERGY_TOLERANCE), `${kcal.toFixed(0)} kcal`, v=>v.toFixed(0)),
        a.energy==="unknown" ? "enter the dog\u2019s weight" : `${pctText(ePct)} of need${a.energy==="high"?" \u00b7 overfeeding":a.energy==="low"?" \u00b7 underfeeding":""}`,
        `in ${a.grams.toFixed(0)} g of food`)
  + vrow(caStatus==="within range"?"okrow":"low", "Ca : P ratio",
        "Calcium to phosphorus by weight. Meat is phosphorus-rich, so home-cooked diets usually need a calcium source to land between 1:1 and 2:1.",
        strip(Number.isNaN(caP)?0:caP, 1, 2, caText, v=>v.toFixed(1)), caStatus);

  const rows = a.rows.map(r=>{
    if(r.j===iKcal) return "";
    const isEPA = r.name==="EPA+DHA", u = r.unit;
    const cls = { high:"high", low:"low", marginal:"marg", ok:"okrow", unknown:"" }[r.status];
    const ge = r.missing.length ? "\u2265 " : "";   // a lower bound when some food's value is unknown
    const st = r.status==="unknown" ? "enter the dog\u2019s weight"
      : r.status==="high" ? "over max"
      : r.status==="low" ? (isEPA ? "below target \u00b7 " : "LOW \u00b7 ") + ge + pctText(r.pct)
      : r.status==="marginal" ? "marginal \u00b7 " + ge + pctText(r.pct)
      : r.dayMin ? ge + pctText(r.pct) + " of need" : "no minimum";
    const miss = r.missing.length ? " " + warn(`${r.name} is not reported for: ${list(r.missing.map(m=>m.name))}.`, 13, ` data-jump="${r.j}"`) : "";
    // with no energy need to scale by, fall back to judging density against the per-1,000 kcal profile
    const bar = r.status==="unknown" ? strip(r.per1000, r.min, r.max, `${fmt(r.per1000)} /1,000 kcal`) : strip(r.day, r.dayMin, r.dayMax, fmt(r.day));
    return `<tr class="${cls}"><td><span class="nm">${r.name}${miss}</span><span class="src" style="display:block">${u}</span></td>
      <td class="c-range">${bar}</td><td class="status">${st}</td></tr>`;
  }).join("");
  document.querySelector("#tbl-an tbody").innerHTML = rows;
  syncColumns();
}
/**
 * Line the three tables up: the first column of the inputs, quick checks and
 * nutrient tables is as wide as the widest entry in any of them, so the value
 * column of the inputs starts where the range columns do. The range column has
 * a fixed width (CSS) and the status column takes whatever is left, so those
 * match across tables by construction. The first column is shrunk to its
 * content for a moment to measure it, then every table gets the largest width.
 */
export function syncColumns(){
  const th = (id, col) => document.getElementById(id)?.tHead?.rows[0]?.cells[col];
  const sync = ths => {
    ths = ths.filter(Boolean);
    ths.forEach(t => { t.style.width = ""; t.classList.add("fit"); });
    const w = Math.ceil(Math.max(...ths.map(t => t.getBoundingClientRect().width)));
    ths.forEach(t => { t.classList.remove("fit"); t.style.width = w + "px"; });
  };
  sync([th("tbl-in", 0), th("tbl-vitals", 0), th("tbl-an", 0)]);
  placeLabels();
}

export function toast(msg){ const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1800); }

/* ---------- floating tooltip for .info markers: never leaves the viewport ---------- */
export function initTooltips(){
  const tip = document.getElementById("tip");
  let current = null;
  function show(el){
    current = el; shownAt = performance.now();
    const act = "jump" in el.dataset;                           // a tip that does something when clicked
    tip.innerHTML = esc(el.dataset.tip) + (act ? icon("arrow",12) : ""); tip.hidden = false;
    tip.classList.toggle("act", act);
    const r = el.getBoundingClientRect(), pad = 8, vw = window.innerWidth, vh = window.innerHeight;
    tip.style.maxWidth = Math.min(280, vw - 2*pad) + "px";
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = r.left + r.width/2 - w/2;
    left = Math.max(pad, Math.min(left, vw - w - pad));
    let top = r.top - h - 8;
    if(top < pad) top = Math.min(r.bottom + 8, vh - h - pad);
    tip.style.left = left + "px"; tip.style.top = top + "px";
  }
  function hide(){ current = null; tip.hidden = true; }
  let shownAt = 0;
  const target = e => e.target.closest?.(".info[data-tip]");
  const inTip = el => !!el && tip.contains(el);
  // hover only for a real mouse: a touch tap emits emulated hover events right before its click
  document.addEventListener("pointerover", e=>{ if(e.pointerType!=="mouse") return; const el = target(e); if(el && el!==current) show(el); });
  document.addEventListener("pointerout", e=>{ if(e.pointerType!=="mouse") return; const el = target(e); if(el && !el.contains(e.relatedTarget) && !inTip(e.relatedTarget)) hide(); });
  // an actionable tip stays while the pointer is on it; leaving it (not back to its marker) closes it
  tip.addEventListener("pointerout", e=>{ if(e.pointerType==="mouse" && current && !inTip(e.relatedTarget) && !current.contains(e.relatedTarget)) hide(); });
  document.addEventListener("focusin", e=>{ const el = target(e); if(el) show(el); });
  document.addEventListener("focusout", e=>{ if(target(e)) hide(); });
  document.addEventListener("click", e=>{
    if(inTip(e.target)){                                         // a tap on an actionable tip fires its action
      const j = current?.dataset.jump; hide();
      if(j!=null) document.dispatchEvent(new CustomEvent("jump-to-missing", { detail:{ j:+j } }));
      return;
    }
    const el = target(e);
    if(!el){ if(current) hide(); return; }                       // a tap anywhere else dismisses
    if(el===current && !tip.hidden && performance.now() - shownAt > 400) hide(); // second tap closes
    else show(el);                                               // (a click right after hover/focus opened it is not a toggle)
  });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") hide(); });
  window.addEventListener("scroll", ()=>{ if(current) show(current); }, { passive:true });
}
