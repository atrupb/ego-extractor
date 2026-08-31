"use strict";
/* ============ session-end archive growth: extraction (free, random) & synthesis (paid, chosen) ============ */
let offer = [], picked = -1;

/* candidate pool — owned records are always filtered out (no silent duplicate fallback) */
function pool(R, type, grade, excludeKeys){
  const owned = new Set(collection().map(c=>c.type+"::"+c.name));
  let p = R.filter(i=>i.type===type && (type==="gift" || i.grade===grade));
  if(excludeKeys) p = p.filter(i=>!excludeKeys.has(i.type+"::"+i.name));
  if(!el("optDup").checked) p = p.filter(i=>!owned.has(i.type+"::"+i.name));
  return p;
}
/* is there anything left to draw at this class for these categories? */
function gradeStock(R, kinds, grade){
  return kinds.some(t => pool(R, t, grade).length > 0);
}

function giftPoolBySlot(R, slotLabel, excludeKeys){
  const owned = new Set(collection().map(c=>c.type+"::"+c.name));
  const cell = SLOTS.find(s => s.label === slotLabel) || {label: slotLabel};
  let p = R.filter(i=>i.type==="gift" && giftFitsSlot(i.slot, cell));
  if(excludeKeys) p = p.filter(i=>!excludeKeys.has(i.type+"::"+i.name));
  if(!el("optDup").checked) p = p.filter(i=>!owned.has(i.type+"::"+i.name));
  return p;
}

function chamberMsg(t){ el("chamberMsg").textContent = t; }
/* blackout, then fade into the chamber */
async function chamberEnter(){
  const f = el("chamberFade");
  f.style.transition = "none";
  f.style.opacity = "1";
  show("E");
  await sleep(80);                      // let the black frame paint
  f.style.transition = "";
  f.style.opacity = "0";
  await sleep(reduced ? 0 : 1500);
}

const snapSnd = new Audio("snap.mp3");
const doorSnd = new Audio("assets/DoorClick.wav");
const chamberMusic = new Audio("assets/extraction-theme.mp3");
chamberMusic.loop = true;
function playDoor(){ try{ doorSnd.currentTime = 0; doorSnd.play().catch(()=>{}); }catch(e){} }
let musTimer = null;
function musicFade(target, ms){
  clearInterval(musTimer);
  if(target > 0) chamberMusic.play().catch(()=>{});
  const start = chamberMusic.volume, delta = target - start, t0 = Date.now();
  musTimer = setInterval(()=>{
    const k = Math.min(1, (Date.now() - t0) / ms);
    chamberMusic.volume = Math.max(0, Math.min(1, start + delta * k));
    if(k >= 1){
      clearInterval(musTimer);
      if(target === 0){ chamberMusic.pause(); chamberMusic.currentTime = 0; }
    }
  }, 60);
}
async function rollDie(sides, forced){
  const face = el("dieface"+sides), num = el("dienum"+sides);
  el("diebox").style.display = "flex";
  el("unit"+sides).style.display = "flex";
  el("dieresult"+sides).textContent = " ";
  el("dierange"+sides).textContent = "1~"+sides;
  const result = forced !== undefined ? forced : rnd(sides);
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
  el("cards").innerHTML = "";
  document.querySelector(".chamberwrap").classList.remove("rumble");
  chamberMsg("");
  el("recoverBtn").style.display = "none";
  el("diebox").style.display = "none";
  el("unit4").style.display = "none";
  el("unit20").style.display = "none";
  el("dieresult4").textContent = " ";
  el("dieresult20").textContent = " ";
  el("dieresult20").style.color = "";
}
/* ---------- EXTRACTION: d4 category, d20 risk class, hand of 3, recover one ---------- */
async function beginExtraction(){
  playDoor();
  resetExtractionScreen();
  await chamberEnter();

  const R = roster();
  const d4 = await rollDie(4);
  const cat = CATS[d4];
  el("dieresult4").textContent = cat;
  await sleep(reduced?0:700);

  let grade = null;
  if(d4 !== 1){
    // a fully-owned class can no longer be rolled — the d20 lands only on classes with stock
    const kinds = d4===2 ? ["weapon"] : d4===3 ? ["suit"] : ["weapon","suit"];
    const valid = CLASSES.filter(g => gradeStock(R, kinds, g));
    if(!valid.length){ finishHand(); return; }   // nothing anywhere: empty-hand message
    let d20 = rnd(20);
    while(!valid.includes(D20MAP(d20))) d20 = rnd(20);
    await rollDie(20, d20);
    grade = D20MAP(d20);
    el("dieresult20").textContent = grade;
    el("dieresult20").style.color = GHEX[grade];
    await sleep(reduced?0:800);
  }

  // never crosses classes — a thin class just deals what it has left
  if(d4===1){ offer = sample(pool(R,"gift"),3); }
  else if(d4===2){ offer = sample(pool(R,"weapon",grade),3); }
  else if(d4===3){ offer = sample(pool(R,"suit",grade),3); }
  else{ offer = sample(pool(R,"weapon",grade).concat(pool(R,"suit",grade)),3); }
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
  const stock = t.type === "gift" ? giftPoolBySlot(roster(), t.slot) : pool(roster(), t.type, t.grade);
  if(!stock.length) return;   // stale UI guard
  if(!confirm("Synthesize — "+t.label+" — for "+t.cost+" PE?")) return;
  playDoor();
  addPE(-t.cost);
  resetExtractionScreen();
  await chamberEnter();
  // a thin class or slot just deals what it has left — never borrows from elsewhere
  const R = roster();
  offer = t.type === "gift"
    ? sample(giftPoolBySlot(R, t.slot), 3)
    : sample(pool(R, t.type, t.grade), 3);
  finishHand();
  renderPE();
}

function finishHand(){
  if(!offer.length){
    chamberMsg("// no records of this class in the archive index");
    return;
  }
  chamberMsg(offer.length < 3 ? "the class runs thin — "+offer.length+" remain · choose" : "choose one to recover");
  musicFade(0.8, reduced ? 0 : 2500);   // the rolls are done — the theme swells in
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
    c.style.animationDelay = reduced ? "0s" : (0.15 + i*0.22)+"s";
    c.innerHTML =
      riskBadge(it.grade)+
      '<div class="cin">'+
        '<div class="cface cfront" style="--g:'+GCOLOR[g]+'">'+
          '<div class="cimg">'+(it.img?'<img loading="lazy" src="'+it.img+'" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'noimg\',textContent:\'NO FEED\'}))">':'<span class="noimg">NO FEED</span>')+'</div>'+
          '<div class="cmeta"><div class="cname">'+esc(it.name)+'</div>'+
          '<div class="ctag">'+esc(typeTag(it))+'</div>'+
          (it.src?'<div class="csrc">ex. '+esc(it.src)+'</div>':'')+
          '<div class="cflav" data-f="'+i+'"></div></div>'+
        '</div>'+
        '<div class="cface cback">'+
          '<span class="cbdot"></span>'+
          '<span class="cblabel">.EGO SEALED</span>'+
        '</div>'+
      '</div>';
    // no auto-reveal — the operator opens each unit by hand
    c.addEventListener("click",()=>{
      if(!c.classList.contains("flip")){ c.classList.add("flip"); return; }
      document.querySelectorAll(".card").forEach(x=>x.classList.remove("sel"));
      c.classList.add("sel"); picked = i;
      el("recoverBtn").style.display = "block";
    });
    wrap.appendChild(c);
    getFlavor(it).then(f=>{
      const slot = wrap.querySelector('.cflav[data-f="'+i+'"]');
      if(slot && f) slot.textContent = "“"+f+"”";
    });
  });
}

/* recovery is permanent — the record enters the archive; printing it later costs PE every time.
   DoorClick, black, music dies, and you wake up in the archive. */
async function recoverRecord(){
  if(picked<0) return;
  const it = offer[picked];
  el("recoverBtn").disabled = true;
  el("recoverBtn").style.display = "none";
  playDoor();
  // rumble; the clamps release the rejects; the winch takes the chosen one up
  document.querySelector(".chamberwrap").classList.add("rumble");
  document.querySelectorAll("#cards .card").forEach((x,i)=>{
    x.style.animationDelay = "";
    x.classList.add(i===picked ? "claimed" : "reject");
  });
  musicFade(0, 1900);
  await sleep(reduced ? 0 : 1350);
  const f = el("chamberFade");
  f.style.opacity = "1";
  await sleep(reduced ? 0 : 1500);
  const c = collection();
  c.unshift({...it, id:Date.now(), date:todayISO(), note:"", reqs:{}});
  saveCol(c);
  switchTab("A");
  refreshAll();
  el("recoverBtn").disabled = false;
  await sleep(reduced ? 0 : 300);
  f.style.opacity = "0";
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

  // synthesis selects + cost line; fully-owned classes can't be synthesized either
  const type = el("synType").value;
  const isGift = type === "gift";
  el("synClassField").style.display = isGift ? "none" : "block";
  el("synSlotField").style.display  = isGift ? "block" : "none";
  // a fully-owned class can't be synthesized; a thin one just deals fewer choices
  let stockOK = true;
  if(!isGift){
    const sel = el("synClass");
    [...sel.options].forEach(o => { o.disabled = pool(r, type, o.value).length === 0; });
    if(sel.selectedOptions[0] && sel.selectedOptions[0].disabled){
      const first = [...sel.options].find(o => !o.disabled);
      if(first) sel.value = first.value;
    }
    stockOK = pool(r, type, sel.value).length > 0;
  }else{
    stockOK = giftPoolBySlot(r, el("synSlot").value).length > 0;
  }
  const t = synthTarget();
  el("synCost").innerHTML = 'COST: <b class="'+(p.cur>=t.cost?'':'bad')+'">'+t.cost+' PE</b> (have '+p.cur+')'+
    (stockOK ? '' : ' <b class="bad">— none left</b>');
  el("synBtn").disabled = p.cur < t.cost || !stockOK;
}
