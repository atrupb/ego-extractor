"use strict";
/* ============ persistent state + derived numbers ============ */

/* --- roster (all records that exist) & archive (records Waylon has recovered) --- */
function roster(){ return store.get("roster") || SEED; }
function collection(){ return store.get("col") || []; }
function saveCol(c){ store.set("col", c); }

/* --- character --- */
function defaultChar(){
  return {
    level:1,
    stats:{FOR:{base:10,tmp:0}, JUS:{base:10,tmp:0}, PRU:{base:10,tmp:0}, TEM:{base:10,tmp:0}},
    feats:[], asi:{},            // asi: {4:"feat"|"cap", 8:..., 12, 16, 19}
    saveProf:{CON:true, INT:true}, // artificer chassis defaults; tap to change
    skills:{},                   // {perception:0|1|2} — none / proficient / expertise
    capAdj:0,                    // player-managed permanent PE cap adjustment
    initMisc:0, hpCur:null, hpTemp:0,
    hdLeft:null,                 // hit dice remaining; null = full (= level)
    originalUsed:false           // fully original E.G.O. — once per campaign
  };
}
function charS(){
  const c = store.get("char");
  if(!c) return defaultChar();
  // old saves logged cap overflow as a list — fold it into the plain adjustment
  if(Array.isArray(c.overflow)){ c.capAdj = (c.capAdj|0) + 2*c.overflow.length; delete c.overflow; }
  // migrate quietly if fields were added since the save was written
  const m = Object.assign(defaultChar(), c, {stats:Object.assign(defaultChar().stats, c.stats||{})});
  // the temp-modifier UI is gone — fold any stored temp values into base so − / + work on the real number
  let folded = false;
  for(const k of Object.keys(m.stats)){
    const st = m.stats[k];
    if(st.tmp){ st.base += st.tmp|0; st.tmp = 0; folded = true; }
  }
  if(folded) store.set("char", m);
  return m;
}
function saveChar(c){ store.set("char", c); }

/* --- PE pool --- */
function peS(){
  let p = store.get("pe");
  if(!p){
    // starting reserve: 10 + 5 × starting level
    p = {cur:10 + 5*charS().level};
    store.set("pe", p);
  }
  return p;
}
function savePe(p){ store.set("pe", p); }

/* --- active prints (a list — sets are common) & gift equips --- */
function loadoutS(){
  const l = store.get("loadout");
  if(!l) return [];
  if(Array.isArray(l)) return l;
  // migrate the old single-print {w,s,cost} shape
  const col = collection(), out = [];
  for(const key of ["w","s"]){
    const it = l[key] && col.find(x=>x.id===l[key]);
    if(it) out.push({id:it.id, cost:printCost(it.grade), date:l.date||todayISO()});
  }
  store.set("loadout", out);
  return out;
}
function saveLoadout(l){ store.set("loadout", l); }
function giftEq(){ return store.get("gifts") || {}; }   // {slotId: colItemId}
function saveGiftEq(g){ store.set("gifts", g); }

/* ============ derived character numbers ============ */
function statCur(k){ const s = charS().stats[k]; return s.base + (s.tmp|0); }
function statMod(k){ return Math.floor((statCur(k) - 10) / 2); }
function prof(){ return 2 + Math.floor((charS().level - 1) / 4); }
/* HP is derived live — retroactive: hit die + Fortitude mod × level, avg per level after 1st.
   Hit die is d8, per the Artificer rules. */
const HIT_DIE = 8;
function maxHP(){
  const c = charS(), m = statMod("FOR");
  return Math.max(1, HIT_DIE + m + (c.level - 1) * (HIT_DIE/2 + 1 + m));
}
function hdLeft(){
  const c = charS();
  return c.hdLeft === null ? c.level : Math.min(c.hdLeft, c.level);
}
/* AC = 10 + Justice, plus the AC bonus of any actively printed suit */
function printedAcBonus(){
  const col = collection();
  return loadoutS().reduce((a,e)=>{
    const it = col.find(x=>x.id===e.id);
    const n = it && it.type === "suit" ? parseInt(it.ac, 10) : 0;
    return a + (isFinite(n) ? n : 0);
  }, 0);
}
function acVal(){ return 10 + statMod("JUS") + printedAcBonus(); }

/* PE cap: 100 base + player-managed adjustment + 10 per ASI-level cap choice */
function peCap(){
  const c = charS();
  const asiCaps = Object.values(c.asi).filter(v => v === "cap").length;
  return 100 + (c.capAdj|0) + 10*asiCaps;
}

/* print cost for one item of a risk class (Temperance INT-mod discount, floored at 0) */
function printCost(grade){ return Math.max(0, PRINT_BASE[grade] - statMod("TEM")); }

/* ============ equip gate: numeral grades (primary) + proficiency floors (secondary).
   Gifts have neither — you just put them on. ============ */
function unlockState(it){
  if(it.type === "gift") return {ok:true, reasons:[]};
  const reasons = [];
  const reqs = it.reqs || {};
  for(const s of STATS){
    const need = reqs[s.k] | 0;
    if(need > 0 && gradeRank(statCur(s.k)) < need)
      reasons.push(s.name + " " + GRADE_NAMES[need]);
  }
  if(it.grade === "ALEPH" && prof() < 4) reasons.push("PROF +4 (LV 9+)");
  if((it.grade === "WAW" || it.grade === "HE") && prof() < 3) reasons.push("PROF +3 (LV 5+)");
  return {ok: !reasons.length, reasons};
}

/* cheapest printable cost among unlocked recovered weapons/suits; null = nothing printable */
function cheapestPrint(){
  const costs = collection()
    .filter(i => (i.type === "weapon" || i.type === "suit") && unlockState(i).ok)
    .map(i => printCost(i.grade));
  return costs.length ? Math.min(...costs) : null;
}

/* ============ PE mutation — clamped to [0, cap] ============ */
function addPE(delta){
  const p = peS(), cap = peCap();
  p.cur = Math.min(cap, Math.max(0, p.cur + delta));
  savePe(p);
  return p.cur;
}
