import { EXAMPLE, EMPTY, WEIGHT_UNITS, blankFood, f } from "./data.js";
import { S, setState, loadLocal, saveLocal, sanitize, store, weightKg } from "./state.js";
import { renderFoods, renderAnalysis, toast, openEditor, setOpenEditor, esc, gramsText, initTooltips } from "./render.js";
import { encodeRecipe, decodeRecipe, readHash, buildHash } from "./share.js";
import { search, searchBundled, bundledAt, bundledFdcId, nutrientsFor, setApiKey, DEMO_LIMIT, KEY_LIMIT, SIGNUP_URL } from "./fdc.js";
import { icon, mountIcons } from "./icons.js";
import { initEditable, fitAll } from "./editable.js";

const $ = id => document.getElementById(id);
mountIcons();
initTooltips();
initEditable();

/* ---------- API key: a popover behind the key icon in the search box ---------- */
const keyBox = $("apikey"), shareKey = $("sharekey"), keyBtn = $("keybtn"), keyPop = $("keypop");
function useKey(k){
  keyBox.value = k; setApiKey(k); store.set("lady.fdckey", k);
  keyBtn.classList.toggle("on", !!k); keyBtn.title = k ? "USDA API key (set)" : "USDA API key";
  shareKey.disabled = !k;
  if(!k) shareKey.checked = false;
}
keyBox.addEventListener("change", ()=> useKey(keyBox.value.trim()));
function toggleKeyPop(show = keyPop.hidden){
  keyPop.hidden = !show; keyBtn.setAttribute("aria-expanded", String(show));
  if(show){ closeResults(); keyBox.focus(); }
}
keyBtn.addEventListener("click", ()=> toggleKeyPop());
document.addEventListener("click", e=>{ if(!e.target.closest("#keypop, #keybtn, [data-act=key]")) toggleKeyPop(false); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !keyPop.hidden){ toggleKeyPop(false); keyBtn.focus(); } });
/* one-time hint after the first USDA search without a key */
function keyHintOnce(){
  if(store.get("lady.keyhint") || keyBox.value) return;
  store.set("lady.keyhint", true);
  alertsEl.innerHTML = `<div class="notice soft">${icon("key")}<div class="body"><p><strong>That search used USDA\u2019s shared demo key.</strong></p>
    <p>It allows about ${DEMO_LIMIT} requests an hour for everyone on your network. A free personal key allows ${KEY_LIMIT}; add one behind the ${icon("key",12)} icon in the search box.</p>
    <div class="row"><button data-act="key">${icon("key",14)}Add a key</button></div></div>
    <button class="quiet iconbtn" data-act="close" aria-label="Dismiss">${icon("x",14)}</button></div>`;
}
shareKey.checked = !!store.get("lady.sharekey");
shareKey.addEventListener("change", ()=> store.set("lady.sharekey", shareKey.checked));

/* ---------- URL <-> state ---------- */
let lastWritten = null;                 // encoded diet we last put in the address bar
let syncTimer = null;
function scheduleUrlSync(){
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async ()=>{
    const enc = await encodeRecipe(S);
    if(enc===lastWritten) return;
    lastWritten = enc;
    history.replaceState(null, "", buildHash(enc));
  }, 250);
}
async function loadFromHash(){
  const { recipe, key } = readHash();
  const qkey = new URLSearchParams(location.search).get("key");
  if(key || qkey) useKey(key || qkey);
  if(!recipe || recipe===lastWritten) return false;
  try{
    const next = sanitize(await decodeRecipe(recipe));
    if(!next) throw new Error("not a diet");
    setState(next); lastWritten = recipe;
    return true;
  }catch(err){
    console.error("Could not read diet from link:", err);
    toast("That link did not contain a readable diet");
    return false;
  }
}
window.addEventListener("hashchange", async ()=>{ if(await loadFromHash()){ renderAll(); toast("Loaded diet from link"); } });

/* ---------- render + persist ---------- */
function renderAll(){ renderFoods(); renderAnalysis(); persist(); }
function persist(){ saveLocal(); scheduleUrlSync(); }

/* ---------- title ---------- */
const titleEl = $("title");
titleEl.addEventListener("input", ()=>{
  const v = titleEl.value.trim();
  if(v===S.title) return;
  S.title = v || EXAMPLE.title; document.title = S.title; persist();
});
titleEl.addEventListener("blur", ()=>{ if(titleEl.value !== S.title){ titleEl.value = S.title; fitAll(); } });

/* ---------- menu: share + reset (arrow keys move, Tab works natively, Escape closes) ---------- */
const moreBtn = $("more"), menu = $("menupop");
const menuItems = ()=> [...menu.querySelectorAll("[role=menuitem]:not([hidden])")];
function toggleMenu(show = menu.hidden, focusFirst = false){
  menu.hidden = !show; moreBtn.setAttribute("aria-expanded", String(show));
  if(show){ // keep the popover on screen when the button sits near the right edge
    menu.classList.remove("flip");
    const r = menu.getBoundingClientRect();
    if(r.right > window.innerWidth - 8) menu.classList.add("flip");
    if(focusFirst) menuItems()[0]?.focus();
  }
}
moreBtn.addEventListener("click", ()=> toggleMenu(menu.hidden, true));
moreBtn.addEventListener("keydown", e=>{ if(e.key==="ArrowDown"){ e.preventDefault(); toggleMenu(true, true); } });
menu.addEventListener("click", e=>{ if(e.target.closest("[role=menuitem]")) toggleMenu(false); });
menu.addEventListener("keydown", e=>{
  const items = menuItems(), i = items.indexOf(document.activeElement);
  if(e.key==="ArrowDown"){ e.preventDefault(); items[(i+1) % items.length]?.focus(); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); items[(i-1+items.length) % items.length]?.focus(); }
  else if(e.key==="Home"){ e.preventDefault(); items[0]?.focus(); }
  else if(e.key==="End"){ e.preventDefault(); items.at(-1)?.focus(); }
  else if(e.key==="Escape"){ toggleMenu(false); moreBtn.focus(); }
});
menu.addEventListener("mousemove", e=>{ const it = e.target.closest("[role=menuitem]"); if(it && it!==document.activeElement) it.focus(); });
menu.addEventListener("focusout", e=>{ if(!menu.contains(e.relatedTarget) && e.relatedTarget!==moreBtn) toggleMenu(false); });
document.addEventListener("click", e=>{ if(!e.target.closest(".menu")) toggleMenu(false); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") toggleMenu(false); });

async function shareUrl(){
  const withKey = shareKey.checked && keyBox.value.trim();
  const url = new URL(location.href);
  url.search = "";
  url.hash = buildHash(await encodeRecipe(S), withKey ? keyBox.value.trim() : "");
  return url.toString();
}
async function copyLink(){
  const url = await shareUrl();
  const withKey = url.includes("&key=");
  try{ await navigator.clipboard.writeText(url); toast(withKey ? "Link copied, with your API key included" : "Link copied — anyone with it sees this diet"); }
  catch(e){ window.prompt("Copy this link:", url); }
}
$("copylink").addEventListener("click", copyLink);
$("about").addEventListener("click", ()=>{
  const f = $("disclaimer");
  f.scrollIntoView({ behavior:"smooth", block:"center" });
  f.classList.remove("flash"); void f.offsetWidth; f.classList.add("flash");
});
$("reset").addEventListener("click", ()=>{
  if(confirm("Replace this diet with the built-in example?")){
    setState(structuredClone(EXAMPLE)); setOpenEditor(null); renderAll(); toast("Example diet loaded");
  }
});
$("new").addEventListener("click", ()=>{
  if(!S.foods.length || confirm("Start a new, empty diet? The current one stays in the address bar until you leave this page.")){
    setState(structuredClone(EMPTY)); setOpenEditor(null); renderAll(); toast("Empty diet — add some foods");
  }
});

/* ---------- food table events ---------- */
const tbl = $("tbl-foods");
tbl.addEventListener("input", e=>{
  const tr = e.target.closest("tr[data-id]");
  if(!tr) return;
  const it = S.foods.find(x=>x.id===tr.dataset.id);
  if(!it) return;
  const fld = e.target.dataset.f;
  if(fld==="name") it.name = e.target.value;
  else if(fld==="src") it.src = e.target.value;
  else if(fld==="amount") it.amount = e.target.value;
  else if(fld==="unit") it.unit = e.target.value;
  else if(fld==="per") it.per = e.target.value;
  else if(fld==="n") it.per100[+e.target.dataset.j] = +e.target.value||0;
  else return;
  if(fld==="amount" || fld==="unit" || fld==="per"){
    const gd = tr.querySelector(".gday"), amt = tr.querySelector('input[data-f="amount"]');
    const bad = gramsText(it)==="?";
    gd.textContent = gramsText(it); gd.classList.toggle("bad", bad); amt.classList.toggle("bad", bad);
  }
  renderAnalysis();
  persist();
});
tbl.addEventListener("click", e=>{
  const btn = e.target.closest("button[data-f]"); if(!btn) return;
  const id = btn.closest("tr").dataset.id;
  if(btn.dataset.f==="del"){
    if(openEditor===id) setOpenEditor(null);
    S.foods = S.foods.filter(x=>x.id!==id); renderAll();
  } else if(btn.dataset.f==="edit"){
    setOpenEditor(openEditor===id ? null : id);
    renderFoods();
  }
});
function addFood(it, msg){
  S.foods.unshift(it); renderAll();
  const row = tbl.querySelector(`tr[data-id="${it.id}"]`);
  if(row){ row.classList.add("flash"); row.scrollIntoView({block:"nearest", behavior:"smooth"}); }
  toast(msg);
  return row;
}
$("addfood").addEventListener("click", ()=>{
  const it = blankFood(); setOpenEditor(it.id);
  const row = addFood(it, "Name it, set the amount, then type its nutrients per 100 g");
  const n = row?.querySelector('input[data-f="name"]'); if(n){ n.focus(); n.select(); }
});
document.getElementById("tbl-in").addEventListener("input", e=>{
  if(e.target.id==="g-weightUnit"){
    const kg = weightKg();
    S.weightUnit = e.target.value;
    S.weight = Math.round(kg / WEIGHT_UNITS[S.weightUnit] * 10) / 10;
    renderAll(); return;
  }
  if(e.target.dataset.g){ S[e.target.dataset.g] = +e.target.value||0; renderAll(); }
});
$("allcols").addEventListener("click", e=>{
  const on = $("tbl-an").classList.toggle("allcols");
  e.currentTarget.setAttribute("aria-pressed", String(on));
});

/* ---------- problems: one dismissable card under the search box ---------- */
const alertsEl = $("alerts");
function problemHtml(err){
  const link = txt => `<a href="${SIGNUP_URL}" target="_blank" rel="noopener">${txt} ${icon("external",12)}</a>`;
  const kind = err.kind || "http";
  const detail = {
    "demo-limit": `The public key allows about ${DEMO_LIMIT} requests an hour, shared by everyone on your network. Built-in ingredients and custom foods still work. A free personal key allows ${KEY_LIMIT} an hour.`,
    "key-limit":  `It allows ${KEY_LIMIT} requests an hour and resets on its own. Built-in ingredients and custom foods still work meanwhile.`,
    "bad-key":    "Check it for typos, or request a new one.",
    "offline":    "", "http": "Try again in a moment.", "data": "",
  }[kind] ?? "";
  const actions = kind==="demo-limit" ? `<button data-act="key">${icon("key",14)}Use a personal key</button>${link("get one free")}`
    : kind==="bad-key" ? `<button data-act="key">${icon("key",14)}Fix the key</button>${link("get a new one")}`
    : kind==="key-limit" ? link("manage keys") : "";
  return `<div class="notice ${["offline","http"].includes(kind)?"bad":""}">${icon("alert")}<div class="body"><p><strong>${esc(err.message)}</strong></p>
    ${detail?`<p>${detail}</p>`:""}${actions?`<div class="row">${actions}</div>`:""}</div>
    <button class="quiet iconbtn" data-act="close" aria-label="Dismiss">${icon("x",14)}</button></div>`;
}
function problem(err){
  console.warn("USDA problem:", err);
  alertsEl.innerHTML = problemHtml(err);
}
alertsEl.addEventListener("click", e=>{
  const act = e.target.closest("button[data-act]")?.dataset.act;
  if(act==="close") alertsEl.innerHTML = "";
  if(act==="key"){ alertsEl.innerHTML = ""; toggleKeyPop(true); keyBox.select(); }
});

/* ---------- ingredient search: a floating listbox with keyboard navigation ---------- */
const resultsBox = $("results"), qBox = $("q");
const opt = (attrs, label, meta) => `<div class="opt" role="option" ${attrs}><span>${label}</span><span class="dt">${meta}</span>${icon("plus",14)}</div>`;
const localOpts = (q, exclude=new Set()) => searchBundled(q).filter(b=> !exclude.has(bundledFdcId(b)))
  .map(b=> opt(`data-local="${b.i}"`, esc(b.name), `built-in · ${esc(b.src)}`)).join("");
const usdaOpt = q => `<div class="opt usda" role="option" data-usda="1"><span>Search USDA for “${esc(q)}”</span><span class="dt">FoodData Central</span>${icon("search",14)}</div>`;
let usdaHits = new Map();   // fdcId -> search hit (with per100) for the list on screen
let active = -1;
const options = ()=> [...resultsBox.querySelectorAll(".opt")];
function setActive(i){
  const os = options(); if(!os.length){ active=-1; return; }
  active = (i + os.length) % os.length;
  os.forEach((o,k)=> o.classList.toggle("active", k===active));
  os[active].scrollIntoView({ block:"nearest" });
}
function open(html){ resultsBox.innerHTML = html; resultsBox.hidden = false; qBox.setAttribute("aria-expanded","true"); setActive(0); if(!keyPop.hidden) toggleKeyPop(false); }
function close(){ resultsBox.hidden = true; qBox.setAttribute("aria-expanded","false"); active = -1; }
function closeResults(){ close(); }
function showLocal(){
  const q = qBox.value.trim();
  if(!q){ close(); return; }
  const exact = searchBundled(q).some(b=> b.name.toLowerCase()===q.toLowerCase());
  const local = localOpts(q);
  // searching USDA is the default action unless the text names a built-in food exactly
  open(exact ? local + usdaOpt(q) : usdaOpt(q) + local);
}
async function doSearch(){
  const q=qBox.value.trim(); if(!q) return;
  open(localOpts(q) + `<div class="msg">searching USDA FoodData Central…</div>`);
  try{
    const foods = await search(q);
    usdaHits = new Map(foods.map(x=>[String(x.fdcId), x]));
    const usda = foods.map(x=> opt(`data-fdc="${esc(x.fdcId)}"`, `${esc(x.description)}${x.brandOwner?` — ${esc(x.brandOwner)}`:""}`, esc(x.dataType))).join("");
    const local = localOpts(q, new Set(foods.map(x=>x.fdcId)));
    open((usda ? `<div class="msg">USDA FoodData Central</div>${usda}` : `<div class="msg">No USDA results. Try simpler words (“sardine canned water”).</div>`)
       + (local ? `<div class="msg">built-in</div>${local}` : ""));
    keyHintOnce();
  }catch(err){ close(); problem(err); }
}
async function choose(el){
  if(!el) return;
  if(el.dataset.usda){ doSearch(); return; }
  if(el.dataset.local!=null){
    const b = bundledAt(+el.dataset.local);
    addFood(f(b.name,"100","g","day",b.src,b.per100.slice()), "Added at 100 g a day — adjust the amount");
    close(); qBox.value=""; return;
  }
  const id = el.dataset.fdc; if(!id) return;
  const hit = usdaHits.get(id);
  el.classList.add("busy");
  try{
    let per100 = hit?.per100, dataType = hit?.dataType || "";
    if(!per100){ const rec = await nutrientsFor(id); per100 = rec.per100; dataType = rec.dataType || dataType; }
    if(!per100.some(v=>v>0)){
      const err = new Error(`“${hit?.description||id}” lists no usable nutrients in USDA’s data — try another entry for the same food, or add it as a custom food.`);
      err.kind = "data"; throw err;
    }
    addFood(f(hit?.description || `USDA ${id}`,"100","g","day",`USDA FDC ${id}${dataType?` (${dataType})`:""}`,per100),
      "Added at 100 g a day — adjust the amount");
    close(); qBox.value="";
  }catch(err){ el.classList.remove("busy"); close(); problem(err); }
}
qBox.addEventListener("input", showLocal);
qBox.addEventListener("focus", showLocal);
qBox.addEventListener("keydown", e=>{
  if(e.key==="ArrowDown"){ e.preventDefault(); resultsBox.hidden ? showLocal() : setActive(active+1); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); setActive(active-1); }
  else if(e.key==="Escape"){ close(); }
  else if(e.key==="Enter"){ e.preventDefault(); const os = options(); if(!resultsBox.hidden && os[active]) choose(os[active]); else doSearch(); }
});
$("go").addEventListener("click", doSearch);
resultsBox.addEventListener("mousemove", e=>{ const o = e.target.closest(".opt"); if(o){ const i = options().indexOf(o); if(i!==active) setActive(i); } });
resultsBox.addEventListener("mousedown", e=> e.preventDefault()); // keep focus in the search box
resultsBox.addEventListener("click", e=> choose(e.target.closest(".opt")));
document.addEventListener("click", e=>{ if(!e.target.closest(".searchbar")) close(); });

/* ---------- installable: register the service worker (production build only) ---------- */
if("serviceWorker" in navigator && import.meta.env.PROD){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("/sw.js").catch(e=> console.warn("service worker:", e)));
}

/* ---------- boot ---------- */
(async ()=>{
  useKey(store.get("lady.fdckey") || "");
  setState(loadLocal());
  const fromLink = await loadFromHash();
  renderAll();
  fitAll();
  if(fromLink) toast("Loaded diet from link — edits stay in this browser");
})();
