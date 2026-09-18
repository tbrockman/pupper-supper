import { NUTS, UNITS, PERIODS, iKcal, iCa, iP } from "./data.js";
import { S, gramsPerDay, totals, totalGrams, weightKg } from "./state.js";
import { icon } from "./icons.js";
import { editable, fitAll } from "./editable.js";

/** Escape text for innerHTML. Names/sources can arrive from a shared link. */
export const esc = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const fmt = v => v>=100? v.toFixed(0) : v>=10? v.toFixed(1) : v.toFixed(2);
export const gramsText = it => { const g = gramsPerDay(it); return Number.isFinite(g) ? `${g.toFixed(g<10?1:0)} g` : "?"; };
const opts = (obj, sel) => Object.keys(obj).map(k=>`<option value="${k}" ${k===sel?"selected":""}>${k}</option>`).join("");
export const info = tip => `<span class="info" tabindex="0" role="note" data-tip="${esc(tip)}">${icon("info",14)}</span>`;

/* ---------- food table ---------- */
export let openEditor = null; // food id whose nutrient panel is open
export function setOpenEditor(id){ openEditor = id; }

function foodRow(it){
  const g = gramsPerDay(it), bad = !Number.isFinite(g), open = openEditor===it.id;
  return `<tr data-id="${esc(it.id)}" class="${open?"open":""}">
    <td class="foodname">
      ${editable({ value:it.name, cls:"name", attrs:`data-f="name" aria-label="Food name"`, label:"Rename" })}
    </td>
    <td class="num amount"><input type="text" inputmode="decimal" class="${bad?"bad":""}" value="${esc(it.amount)}" data-f="amount" aria-label="${esc(it.name)} amount" spellcheck="false"></td>
    <td><select data-f="unit" aria-label="unit">${opts(UNITS, it.unit)}</select></td>
    <td><select data-f="per" aria-label="per">${opts(PERIODS, it.per)}</select></td>
    <td class="num gday ${bad?"bad":""}">${gramsText(it)}</td>
    <td class="actions"><button class="quiet iconbtn ${open?"on":""}" data-f="edit" title="${open?"Close":"Edit"} nutritional information" aria-pressed="${open}" aria-expanded="${open}">${icon("sliders")}</button><button class="quiet iconbtn" data-f="del" title="Remove" aria-label="Remove ${esc(it.name)}">${icon("trash")}</button></td></tr>`;
}
function editorRow(it){
  return `<tr class="editor" data-id="${esc(it.id)}"><td colspan="6">
    <label class="notefield">Note or source<input type="text" value="${esc(it.src)}" data-f="src" placeholder="where these numbers came from, batch size, brand\u2026" spellcheck="false" autocomplete="off"></label>
    <div class="nutgrid">${NUTS.map((n,j)=>
      `<label>${n[0]} ${n[1]} /100 g<input type="number" step="any" value="${+(+it.per100[j]).toFixed(3)}" data-f="n" data-j="${j}"></label>`).join("")}
    </div></td></tr>`;
}
export function renderFoods(){
  const head = `<thead><tr><th>Food</th><th class="num">amount</th><th>unit</th><th>per</th><th class="num">g / day</th><th></th></tr></thead>`;
  const tbl = document.getElementById("tbl-foods");
  tbl.innerHTML = head + "<tbody>" +
    (S.foods.map(it=> foodRow(it) + (openEditor===it.id ? editorRow(it) : "")).join("") ||
     `<tr><td class="src" colspan="6">nothing yet — search above or add a custom food</td></tr>`) + "</tbody>";
  fitAll(tbl);
  document.querySelectorAll("input[data-g]").forEach(i=>{ if(+i.value !== S[i.dataset.g]) i.value = S[i.dataset.g]; });
  const wu = document.getElementById("g-weightUnit"); if(wu.value !== S.weightUnit) wu.value = S.weightUnit;
  const t = document.getElementById("title");
  if(t.value !== S.title){ t.value = S.title; t.dispatchEvent(new Event("input", { bubbles:true })); } // input event re-fits the box
  document.title = S.title;
}

/* ---------- analysis ---------- */
function strip(p1000, mn, mx){
  // log scale from min/10 to max (or min*40 when no max); markers at min (and max edge)
  const lo = mn/10, hi = mx || mn*40;
  const pos = v => Math.max(0, Math.min(100, 100*Math.log(Math.max(v,lo)/lo)/Math.log(hi/lo)));
  const bandL = pos(mn), bandR = mx?100:pos(mn*40);
  return `<div class="strip">
    <div class="band" style="left:${bandL}%; width:${bandR-bandL}%"></div>
    <div class="minm" style="left:${bandL}%"></div>
    <div class="dot" style="left:${pos(p1000)}%"></div></div>`;
}
/** Linear strip: shaded band between bandL..bandR, marker at bandL, dot at v; scale lo..hi. */
function linStrip(v, lo, hi, bandL, bandR){
  const pos = x => Math.max(0, Math.min(100, 100*(x-lo)/(hi-lo)));
  return `<div class="strip">
    <div class="band" style="left:${pos(bandL)}%; width:${pos(bandR)-pos(bandL)}%"></div>
    <div class="minm" style="left:${pos(bandL)}%"></div>
    <div class="dot" style="left:${pos(v)}%"></div></div>`;
}
export function renderAnalysis(){
  const t = totals(), kcal = t[iKcal];
  const rer = 70*Math.pow(weightKg(),0.75), mer = rer*S.activity;
  const caP = t[iP] ? t[iCa]/t[iP] : 0;
  const ePct = mer ? kcal/mer : 0;
  const vrow = (cls, name, tip, value, unit, target, strip, status, sub="") =>
    `<tr class="${cls}"><td>${name}${tip?" "+info(tip):""}${sub?`<span class="src" style="display:block">${sub}</span>`:""}</td>
     <td class="num"><span class="val">${value}</span></td><td class="unit">${unit}</td><td class="num c-target">${target}</td>
     <td class="c-range">${strip}</td><td class="status">${status}</td></tr>`;
  // input rows: what the dog's numbers produce
  document.getElementById("w-status").textContent = `RER \u2248 ${rer.toFixed(0)} kcal`;
  document.getElementById("a-status").textContent =
    `need \u2248 ${mer.toFixed(0)} kcal \u00b7 ` + (S.activity<1.2 ? "below typical" : S.activity<=1.4 ? "inactive adult" : S.activity<=1.8 ? "active adult" : "working or growing");
  // computed rows
  document.getElementById("vitals-out").innerHTML =
    vrow(ePct>1.1||ePct<0.9?"low":"okrow", "Calories per day",
        `Energy in the diet versus the estimated need: RER \u00d7 activity, where RER = 70 \u00d7 kg^0.75 = ${rer.toFixed(0)} kcal here. Within \u00b110% counts as on target. Adjust to the dog\u2019s body condition over time.`,
        kcal.toFixed(0), "kcal", `\u2248 ${mer.toFixed(0)}`, linStrip(kcal, 0, mer*2, mer*0.9, mer*1.1),
        `${(100*ePct).toFixed(0)}% of need${ePct>1.1?" \u00b7 overfeeding":ePct<0.9?" \u00b7 underfeeding":""}`,
        `in ${totalGrams().toFixed(0)} g of food`)
  + vrow(caP<1||caP>2?"low":"okrow", "Ca : P ratio",
        "Calcium to phosphorus by weight. Meat is phosphorus-rich, so home-cooked diets usually need a calcium source to land between 1:1 and 2:1.",
        caP.toFixed(2), "", "1.0\u20132.0", linStrip(caP, 0, 3, 1, 2),
        caP<1?"below 1.0 \u00b7 add calcium":caP>2?"above 2.0 \u00b7 too much calcium":"within range");

  const rows = NUTS.map(([name,unit,mn,mx],j)=>{
    if(j===iKcal) return "";
    const day=t[j], p=kcal? day/kcal*1000:0;
    const isEPA = name==="EPA+DHA";
    const pct = mn? p/mn : 1;
    let cls="okrow", st="OK";
    if(mx && p>mx){cls="high"; st="over max";}
    else if(pct<1){cls="low"; st=isEPA?"below 0.3 target":"LOW · "+(100*pct).toFixed(0)+"%";}
    else if(pct<1.2){cls="marg"; st="marginal · "+(100*pct).toFixed(0)+"%";}
    else st=(100*pct).toFixed(0)+"% of min";
    return `<tr class="${cls}"><td>${name}<span class="src" style="display:block">${unit}${isEPA?" \u00b7 no AAFCO min; 0.3 g/1000 kcal target":""}</span></td>
      <td class="num c-day">${fmt(day)}</td><td class="num">${fmt(p)}</td><td class="num c-min">${mn??""}</td>
      <td class="c-range">${strip(p,mn||0.001,mx)}</td><td class="status">${st}</td></tr>`;
  }).join("");
  document.querySelector("#tbl-an tbody").innerHTML = rows;
}

export function toast(msg){ const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1800); }

/* ---------- floating tooltip for .info markers: never leaves the viewport ---------- */
export function initTooltips(){
  const tip = document.getElementById("tip");
  let current = null;
  function show(el){
    current = el; shownAt = performance.now();
    tip.textContent = el.dataset.tip; tip.hidden = false;
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
  // hover only for a real mouse: a touch tap emits emulated hover events right before its click
  document.addEventListener("pointerover", e=>{ if(e.pointerType!=="mouse") return; const el = target(e); if(el && el!==current) show(el); });
  document.addEventListener("pointerout", e=>{ if(e.pointerType!=="mouse") return; const el = target(e); if(el && !el.contains(e.relatedTarget)) hide(); });
  document.addEventListener("focusin", e=>{ const el = target(e); if(el) show(el); });
  document.addEventListener("focusout", e=>{ if(target(e)) hide(); });
  document.addEventListener("click", e=>{
    const el = target(e);
    if(!el){ if(current) hide(); return; }                       // a tap anywhere else dismisses
    if(el===current && !tip.hidden && performance.now() - shownAt > 400) hide(); // second tap closes
    else show(el);                                               // (a click right after hover/focus opened it is not a toggle)
  });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") hide(); });
  window.addEventListener("scroll", ()=>{ if(current) show(current); }, { passive:true });
}
