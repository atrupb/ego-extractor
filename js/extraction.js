"use strict";
/* ============ session-end archive growth: extraction (free, random) & synthesis (paid, chosen) ============ */
let offer = [], picked = -1;

/* candidate pool — owned records are filtered out before drawing (duplicates ruled a non-issue) */
function pool(R, type, grade, excludeKeys){
  const owned = new Set(collection().map(c=>c.type+"::"+c.name));
  const dup = el("optDup").checked;
  let p = R.filter(i=>i.type===type && (type==="gift" || i.grade===grade));
  if(excludeKeys) p = p.filter(i=>!excludeKeys.has(i.type+"::"+i.name));
  if(!dup){
    const fresh = p.filter(i=>!owned.has(i.type+"::"+i.name));
    if(fresh.length>=1) p = fresh;
  }
  return p;
}
function giftPoolBySlot(R, slotLabel, excludeKeys){
  const owned = new Set(collection().map(c=>c.type+"::"+c.name));
  const dup = el("optDup").checked;
  let p = R.filter(i=>i.type==="gift" && giftFitsSlot(i.slot, {label:slotLabel}));
  if(excludeKeys) p = p.filter(i=>!excludeKeys.has(i.type+"::"+i.name));
  if(!dup){
    const fresh = p.filter(i=>!owned.has(i.type+"::"+i.name));
    if(fresh.length>=1) p = fresh;
  }
  return p;
}

function logLine(html){ const d = document.createElement("div"); d.innerHTML = html; el("log").appendChild(d); }

const snapSnd = new Audio("snap.mp3");
async function rollDie(sides){
  const face = el("dieface"+sides), num = el("dienum"+sides);
  el("diebox").style.display = "flex";
  el("unit"+sides).style.display = "flex";
  el("dieresult"+sides).textContent = " ";
  el("dierange"+sides).textContent = "1~"+sides;
  const result = rnd(sides);
  face.classList.remove("landed");
  if(!reduced){
    face.classList.add("rolling");
    // one new number per reel pass (90ms), so each value streaks through once
    for(let i=0;i<10;i++){ num.textContent = rnd(sides); await sleep(90); }
    face.classList.remove("rolling");
  }
  face.classList.add("landed");
  num.textContent = result;
  try{ snapSnd.currentTime = 0; snapSnd.play().catch(()=>{}); }catch(e){}
  return result;
}

function resetExtractionScreen(){
  offer = []; picked = -1;
  el("log").innerHTML = ""; el("cards").innerHTML = "";
  el("recoverBtn").style.display = "none";
  el("gradebar").style.display = "none";
  el("gradebar").querySelectorAll("span").forEach(s=>{ s.className=""; s.style.background=""; });
  el("diebox").style.display = "none";
  el("unit4").style.display = "none";
  el("unit20").style.display = "none";
}
function markArchiveUsed(){
  const c = charS(); c.archiveUsed = true; saveChar(c);
}

/* ---------- EXTRACTION: d4 category, d20 risk class, hand of 3, recover one ---------- */
async function beginExtraction(){
  resetExtractionScreen();
  markArchiveUsed();
  show("E");
  logLine('<span class="d">// session terminated. drawing accumulated PE…</span>');
  await sleep(reduced?0:500);

  const d4 = await rollDie(4);
  const cat = CATS[d4];
  el("dieresult4").textContent = cat;
  logLine('D4 → <span class="t">'+d4+'</span> :: category <span class="a">'+cat+'</span>');
  await sleep(reduced?0:700);

  let grade = null;
  if(d4 !== 1){
    const d20 = await rollDie(20);
    grade = D20MAP(d20);
    el("dieresult20").textContent = grade;
    el("gradebar").style.display = "flex";
    const hit = el("gradebar").querySelector('[data-g="'+grade+'"]');
    hit.classList.add("hit"); hit.style.background = GHEX[grade];
    logLine('D20 → <span class="t">'+d20+'</span> :: risk class <span style="color:'+GHEX[grade]+'">'+grade+'</span>');
    if(grade==="ALEPH" && !reduced){ document.body.classList.add("alert"); setTimeout(()=>document.body.classList.remove("alert"),3200); }
    await sleep(reduced?0:700);
  }else{
    logLine('<span class="d">// gifts carry no risk classification.</span>');
  }

  const R = roster();
  if(d4===1){ offer = sample(pool(R,"gift"),3); }
  else if(d4===2){ offer = sample(pool(R,"weapon",grade),3); }
  else if(d4===3){ offer = sample(pool(R,"suit",grade),3); }
  else{
    const taken = new Set();
    for(let i=0;i<3;i++){
      const t = Math.random()<0.5 ? "weapon" : "suit";
      let p = pool(R,t,grade,taken);
      if(!p.length) p = pool(R, t==="weapon"?"suit":"weapon", grade, taken);
      if(p.length){ const pick = sample(p,1)[0]; taken.add(pick.type+"::"+pick.name); offer.push(pick); }
    }
  }
  finishHand();
}

/* ---------- SYNTHESIS: pay PE, choose category + class (or gift slot), still a hand of 3 ---------- */
function synthTarget(){
  const t = el("synType").value;
  if(t === "gift") return {type:"gift", slot: el("synSlot").value, cost: SYNTH_COST.GIFT,
    label:"GIFT // "+el("synSlot").value.toUpperCase()};
  const g = el("synClass").value;
  return {type:t, grade:g, cost: SYNTH_COST[g], label: g+" "+t.toUpperCase()};
}
async function beginSynthesis(){
  const t = synthTarget();
  if(peS().cur < t.cost) return;
  if(!confirm("Synthesize — "+t.label+" — for "+t.cost+" PE?")) return;
  addPE("SYNTHESIS: "+t.label, -t.cost, "synth");
  resetExtractionScreen();
  markArchiveUsed();
  show("E");
  logLine('<span class="d">// synthesis protocol. '+t.cost+' PE committed.</span>');
  logLine('target :: <span class="a">'+esc(t.label)+'</span>');
  if(t.grade){
    el("gradebar").style.display = "flex";
    const hit = el("gradebar").querySelector('[data-g="'+t.grade+'"]');
    hit.classList.add("hit"); hit.style.background = GHEX[t.grade];
  }
  await sleep(reduced?0:500);
  const R = roster();
  offer = t.type==="gift" ? sample(giftPoolBySlot(R, t.slot),3) : sample(pool(R, t.type, t.grade),3);
  finishHand();
  renderPE();
}

function finishHand(){
  if(!offer.length){
    logLine('<span class="d">// no records of this class in the archive index. run record recovery.</span>');
    return;
  }
  logLine('<span class="d">// '+offer.length+' record'+(offer.length>1?'s':'')+' rendered. choose one to recover.</span>');
  renderCards();
}

/* gifts show their equip slot (Hat, Eye, Brooch…) instead of repeating "GIFT";
   older entries without a stored slot borrow it from the current roster */
function typeTag(it){
  if(it.type!=="gift") return it.type.toUpperCase();
  const slot = it.slot || (roster().find(r=>r.type==="gift" && r.name===it.name)||{}).slot;
  return (slot || "gift").toUpperCase();
}

function renderCards(){
  const wrap = el("cards");
  offer.forEach((it,i)=>{
    const g = it.type==="gift" ? "GIFT" : it.grade;
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML =
      '<div class="cin">'+
        '<div class="cface cfront" style="--g:'+GCOLOR[g]+'">'+
          '<div class="cimg">'+(it.img?'<img loading="lazy" src="'+it.img+'" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'noimg\',textContent:\'NO FEED\'}))">':'<span class="noimg">NO FEED</span>')+'</div>'+
          '<div class="cmeta"><div class="cname">'+esc(it.name)+'</div>'+
          '<div class="ctag"><b>'+g+'</b> // '+esc(typeTag(it))+'</div>'+
          (it.src?'<div class="csrc">ex. '+esc(it.src)+'</div>':'')+
          '<div class="cflav" data-f="'+i+'"></div></div>'+
        '</div>'+
        '<div class="cface cback"><span>.EGO</span></div>'+
      '</div>';
    c.addEventListener("click",()=>{
      if(!c.classList.contains("flip")){ c.classList.add("flip"); return; }
      document.querySelectorAll(".card").forEach(x=>x.classList.remove("sel"));
      c.classList.add("sel"); picked = i;
      el("recoverBtn").style.display = "block";
    });
    wrap.appendChild(c);
    setTimeout(()=>c.classList.add("flip"), reduced?0:400+i*350);
    getFlavor(it).then(f=>{
      const slot = wrap.querySelector('.cflav[data-f="'+i+'"]');
      if(slot && f) slot.textContent = "“"+f+"”";
    });
  });
}

/* recovery is permanent — the record enters the archive; printing it later costs PE every time */
function recoverRecord(){
  if(picked<0) return;
  const it = offer[picked];
  const c = collection();
  c.unshift({...it, id:Date.now(), date:todayISO(), note:"", reqs:{}});
  saveCol(c);
  switchTab("A");
  refreshAll();
}

/* ---------- fully original E.G.O. — 200 PE, once per campaign ---------- */
function openOriginal(){
  if(charS().originalUsed || peS().cur < SYNTH_COST.ORIGINAL) return;
  el("cName").value = ""; el("cType").value = "weapon"; el("cGrade").value = "ZAYIN";
  el("cSlot").value = "Hat"; el("cImg").value = ""; el("cMech").value = "";
  ["FOR","JUS","PRU","TEM"].forEach(k=>el("cReq"+k).value = "0");
  onCTypeChange();
  el("cmodal").classList.add("on");
}
function onCTypeChange(){
  const isGift = el("cType").value === "gift";
  el("cGradeField").style.display = isGift ? "none" : "block";
  el("cSlotField").style.display  = isGift ? "block" : "none";
}
function saveOriginal(){
  const name = el("cName").value.trim();
  if(!name) return;
  const type = el("cType").value;
  const it = {
    name, type,
    grade: type==="gift" ? null : el("cGrade").value,
    slot:  type==="gift" ? el("cSlot").value : null,
    img: el("cImg").value.trim() || null, link:"", src:"Original E.G.O. — synthesized by W. Ryder",
    id: Date.now(), date: todayISO(), note: el("cMech").value,
    reqs: Object.fromEntries(["FOR","JUS","PRU","TEM"].map(k=>[k, +el("cReq"+k).value])),
    original: true
  };
  addPE("ORIGINAL E.G.O.: "+name, -SYNTH_COST.ORIGINAL, "synth");
  const c = charS(); c.originalUsed = true; saveChar(c);
  const col = collection(); col.unshift(it); saveCol(col);
  el("cmodal").classList.remove("on");
  switchTab("A");
  refreshAll();
}

/* ---------- terminal screen render ---------- */
function renderTerminal(){
  const r = roster(), c = charS(), p = peS();
  el("stOwned").textContent = collection().length;
  el("stW").textContent = r.filter(i=>i.type==="weapon").length;
  el("stS").textContent = r.filter(i=>i.type==="suit").length;
  el("stG").textContent = r.filter(i=>i.type==="gift").length;
  el("stSync").textContent = store.get("syncAt")||"never";
  el("syncwarn").style.display = r.some(i=>i.type==="suit") ? "none" : "block";

  // one archive action per session end — informational only, never a lock
  el("usedNote").style.display = c.archiveUsed ? "block" : "none";

  // synthesis selects + cost line
  const isGift = el("synType").value === "gift";
  el("synClassField").style.display = isGift ? "none" : "block";
  el("synSlotField").style.display  = isGift ? "block" : "none";
  const t = synthTarget();
  el("synCost").innerHTML = 'COST: <b class="'+(p.cur>=t.cost?'':'bad')+'">'+t.cost+' PE</b> (have '+p.cur+')';
  el("synBtn").disabled = p.cur < t.cost;

  // original E.G.O.
  el("origBtn").disabled = c.originalUsed || p.cur < SYNTH_COST.ORIGINAL;
  el("origNote").textContent = c.originalUsed
    ? "// already forged. once per campaign."
    : "// 200 PE. player-designed with the DM. once per campaign.";
}
