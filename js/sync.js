"use strict";
/* ============ record recovery (wiki sync) + flavor text ============ */
/* Each item row's name link targets an anchor: #E.G.O_Weapon / #E.G.O_Suit / #E.G.O_Gift.
   That classifies rows regardless of table header layout. */
function rowType(a){
  const h = a.getAttribute("href")||"";
  if(/#E\.G\.O[._ ]?Weapon/i.test(h)) return "weapon";
  if(/#E\.G\.O[._ ]?Suit/i.test(h))   return "suit";
  if(/#E\.G\.O[._ ]?Gift/i.test(h))   return "gift";
  return null;
}
async function sync(){
  const btn = el("syncBtn"), msg = el("syncMsg");
  btn.disabled = true; msg.textContent = "Reading the archive…";
  try{
    const r = await fetch(API+"?action=parse&page=Equipment&prop=text&format=json&origin=*");
    const j = await r.json();
    const doc = new DOMParser().parseFromString(j.parse.text["*"],"text/html");
    const items = [];
    doc.querySelectorAll("table tr").forEach(tr=>{
      if(!tr.querySelector("td")) return;
      // find the classifying anchor + name
      let a = null, type = null;
      for(const cand of tr.querySelectorAll("a[href]")){
        const t = rowType(cand);
        if(t && cand.textContent.trim() && !cand.querySelector("img")){ a = cand; type = t; break; }
      }
      // fallback: table header says Slot -> gift rows (links may not be anchored)
      if(!a){
        const tb = tr.closest("table");
        const heads = tb ? [...tb.querySelectorAll("th")].map(x=>x.textContent.trim().toLowerCase()) : [];
        if(heads.some(h=>h.startsWith("slot"))){
          for(const cand of tr.querySelectorAll("a[href]")){
            if(cand.textContent.trim() && !cand.querySelector("img")){ a = cand; type = "gift"; break; }
          }
        }
      }
      if(!a) return;
      const name = a.textContent.trim();
      // grade via risk icon anywhere in the row
      let grade = null;
      const risk = tr.querySelector('img[src*="Risk_"]');
      if(risk){
        const m = (risk.getAttribute("src")||"").match(/Risk_(Zayin|Teth|He|Waw|Aleph)/i);
        if(m) grade = m[1].toUpperCase();
      }
      if(type!=="gift" && !grade) return;
      // item image: first img that isn't an icon
      let img = null;
      for(const im of tr.querySelectorAll("img")){
        const s = im.getAttribute("src")||"";
        if(/Risk_|Icon|EBox|Healing/i.test(s)) continue;
        img = s; break;
      }
      if(img){
        if(img.startsWith("/")) img = WIKI+img;
        img = img.replace(/\/(\d+)px-/,"/200px-").split("?")[0];
      }
      let link = a.getAttribute("href")||"";
      if(link.startsWith("/")) link = WIKI+link;
      // gifts: equip slot lives in the cell under the table's "Slot" header
      let slot = null;
      if(type==="gift"){
        const tb2 = tr.closest("table");
        const heads2 = tb2 ? [...tb2.querySelectorAll("th")].map(x=>x.textContent.trim().toLowerCase()) : [];
        const si = heads2.findIndex(h=>h.startsWith("slot"));
        const td = si>=0 ? tr.querySelectorAll("td")[si] : null;
        if(td) slot = td.textContent.trim() || null;
      }
      items.push({name,type,grade,img,link,src:a.getAttribute("title")||"",slot});
    });
    const seen = new Set(), clean = [];
    for(const it of items){ const k = it.type+"::"+it.name; if(!seen.has(k)){ seen.add(k); clean.push(it); } }
    if(clean.filter(i=>i.type==="weapon").length < 10) throw new Error("archive read came back thin");
    store.set("roster", clean);
    store.set("syncAt", todayISO());
    // combat stats ride the same recovery: every indexed weapon/suit (and any already-
    // recovered record the index no longer lists) gets its numbers read here, once
    await syncStats(clean.concat(collection()), msg);
    const nW=clean.filter(i=>i.type==="weapon").length, nS=clean.filter(i=>i.type==="suit").length, nG=clean.filter(i=>i.type==="gift").length;
    msg.textContent = "Recovery complete — "+nW+" weapons, "+nS+" suits, "+nG+" gifts indexed, combat records read. Works offline from here.";
    refreshAll();   // derived numbers may have just changed
  }catch(e){
    msg.textContent = "Recovery failed ("+e.message+"). Check connection; the seeded weapon records still work.";
  }
  btn.disabled = false;
  renderTerminal();
}

/* ============ flavor text: fetched on demand from each item's wiki page, cached ============ */
function flavKey(it){ return it.type+"::"+it.name; }

/* ============ combat stats: weapons — damage type + attack speed; suits — the four
   resistance multipliers. Read in bulk during recovery, never on demand ============ */
function tcase(s){ return s.toLowerCase().replace(/(^|\s)\w/g, c=>c.toUpperCase()); }
function egoStats(it){ return (store.get("egoStats") || {})[flavKey(it)] || null; }
function pageOf(it){
  try{ return decodeURIComponent((it.link||"").split("/wiki/")[1].split("#")[0]); }
  catch(e){ return null; }
}
/* "Requirements: [icon] Justice 3 …" — the four gauge stats only; Agent Level
   is plain text with no stat name, so the regex walks right past it */
function parseReqs(box){
  const NAME2K = {fortitude:"FOR", justice:"JUS", temperance:"TEM", prudence:"PRU"};
  const im = box.querySelector('img[src*="FortitudeIcon"],img[src*="JusticeIcon"],img[src*="TemperanceIcon"],img[src*="PrudenceIcon"]');
  if(!im || !im.parentElement) return null;
  const reqs = {};
  const re = /\b(Fortitude|Justice|Temperance|Prudence)\s*(\d)/gi;
  let m;
  while((m = re.exec(im.parentElement.textContent)))
    reqs[NAME2K[m[1].toLowerCase()]] = Math.min(6, +m[2]);
  return Object.keys(reqs).length ? reqs : null;
}
function parseStats(doc, type){
  const sec = type === "weapon" ? "Weapon" : "Suit";
  const anchor = doc.getElementById("E.G.O_"+sec) || doc.getElementById("E.G.O "+sec);
  const box = anchor && anchor.closest('[id^="abno-box-ego"]');
  if(!box) return null;
  const reqs = parseReqs(box);
  if(type === "weapon"){
    // "Damage: [icon] RED 12-18" + "Speed: 3 (Slow)"
    const icon = box.querySelector('img[src*="DamageTypeIcon"]');
    const dm = icon && (icon.getAttribute("src")||"").match(/(Red|White|Black|Pale)DamageTypeIcon/i);
    const sm = box.textContent.match(/Speed:[\s\S]{0,24}?\(\s*(Very Fast|Fast|Normal|Slow|Very Slow)\s*\)/i);
    return dm || sm || reqs ? {dtype: dm ? tcase(dm[1]) : null, speed: sm ? tcase(sm[1]) : null, reqs} : null;
  }
  // "Resistances: [icon] 0.7 (Endured) …" one line per damage type
  const guards = {};
  box.querySelectorAll('img[src*="DamageTypeIcon"]').forEach(im=>{
    const m = (im.getAttribute("src")||"").match(/(Red|White|Black|Pale)DamageTypeIcon/i);
    const v = im.parentElement && im.parentElement.textContent.match(/(\d+(?:\.\d+)?)/);
    if(m && v) guards[tcase(m[1])] = parseFloat(v[1]);
  });
  return Object.keys(guards).length || reqs ? {guards, reqs} : null;
}
/* one fetch per abnormality page (a page carries both the weapon and the suit);
   already-cached pages are skipped, so re-runs only pick up what's missing */
async function syncStats(items, msg){
  const cache = store.get("egoStats") || {};
  const byPage = new Map();
  for(const it of items){
    if(it.type === "gift" || cache[flavKey(it)]) continue;
    const page = pageOf(it); if(!page) continue;
    if(!byPage.has(page)) byPage.set(page, []);
    byPage.get(page).push(it);
  }
  const todo = [...byPage.keys()], total = todo.length;
  if(!total) return 0;
  let done = 0, got = 0;
  await Promise.all(Array.from({length:4}, async ()=>{
    while(todo.length){
      const page = todo.shift();
      try{
        const r = await fetch(API+"?action=parse&page="+encodeURIComponent(page)+"&prop=text&format=json&origin=*");
        const j = await r.json();
        const doc = new DOMParser().parseFromString(j.parse.text["*"],"text/html");
        for(const it of byPage.get(page)){
          const out = parseStats(doc, it.type);
          if(out){ cache[flavKey(it)] = out; got++; }
        }
      }catch(e){ /* offline or layout change: this page stays missing, retried next recovery */ }
      done++;
      if(msg) msg.textContent = "Reading combat records… "+done+"/"+total;
    }
  }));
  store.set("egoStats", cache);
  return got;
}
function flavCache(){ return store.get("flav") || {}; }
const flavPending = {};
async function getFlavor(it){
  const key = flavKey(it);
  const cache = flavCache();
  if(cache[key]) return cache[key]; // empty = never found; retry, don't trust old failures
  if(flavPending[key]) return flavPending[key];
  flavPending[key] = (async ()=>{
    let text = "";
    try{
      const page = decodeURIComponent((it.link||"").split("/wiki/")[1].split("#")[0]);
      const r = await fetch(API+"?action=parse&page="+encodeURIComponent(page)+"&prop=text&format=json&origin=*");
      const j = await r.json();
      const doc = new DOMParser().parseFromString(j.parse.text["*"],"text/html");
      const sec = it.type==="weapon"?"Weapon":it.type==="suit"?"Suit":"Gift";
      const anchor = doc.getElementById("E.G.O_"+sec) || doc.getElementById("E.G.O "+sec);
      /* the heading sits alone inside a header div; the lore lives elsewhere in the
         same abno-box-ego-* container (suit's is misnamed "sett", gifts have no lore
         div at all — their Effect line is the closest thing to a description) */
      const box = anchor && anchor.closest('[id^="abno-box-ego"]');
      if(it.type==="gift"){
        const sp = (box||doc).querySelector('[id$="gift-special"]');
        if(sp){
          sp.querySelectorAll("br").forEach(b=>b.replaceWith(" "));
          text = sp.textContent.replace(/\s+/g," ").replace(/^\s*Effect\s*/i,"").trim();
        }
      }else if(box){
        let lore = box.querySelector('div[id$="-lore"]');
        if(!lore){
          for(const t of box.querySelectorAll("table")){
            if(/^Details\b/i.test(t.textContent.replace(/\s+/g," ").trim())){ lore = t; break; }
          }
        }
        if(lore){
          lore.querySelectorAll("br").forEach(b=>b.replaceWith(" "));
          text = lore.textContent.replace(/\s+/g," ").replace(/^\s*Details\s*/i,"").trim();
        }
      }
    }catch(e){ /* offline or layout change: leave empty */ }
    if(text){ const c = flavCache(); c[key] = text; store.set("flav", c); }
    delete flavPending[key];
    return text;
  })();
  return flavPending[key];
}
