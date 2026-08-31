"use strict";
/* ============ persistent state + derived numbers ============ */

/* --- roster (all records that exist) & archive (records Waylon has recovered) --- */
function roster(){ return store.get("roster") || SEED; }
function collection(){ return store.get("col") || []; }
function saveCol(c){ store.set("col", c); }

/* --- character --- */
function defaultChar(){
  return {
    level:1, hitDie:8,
    stats:{FOR:{base:10,tmp:0}, JUS:{base:10,tmp:0}, PRU:{base:10,tmp:0}, TEM:{base:10,tmp:0}},
    feats:[], asi:{},            // asi: {4:"feat"|"cap", 8:..., 12, 16, 19}
    saveProf:{},                 // {STR:true,...} — proficient saving throws
    skills:{},                   // {perception:0|1|2} — none / proficient / expertise
    overflow:[],                 // [{date, stat}] — each is +2 permanent PE cap
    acMisc:0, hpCur:null,
    originalUsed:false           // fully original E.G.O. — once per campaign
  };
}
function charS(){
  const c = store.get("char");
  if(!c) return defaultChar();
  // migrate quietly if fields were added since the save was written
  return Object.assign(defaultChar(), c, {stats:Object.assign(defaultChar().stats, c.stats||{})});
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

/* --- active print loadout & gift equips --- */
function loadoutS(){ return store.get("loadout") || null; }
function saveLoadout(l){ store.set("loadout", l); }
function giftEq(){ return store.get("gifts") || {}; }   // {slotId: colItemId}
function saveGiftEq(g){ store.set("gifts", g); }

/* ============ derived character numbers ============ */
function statCur(k){ const s = charS().stats[k]; return s.base + (s.tmp|0); }
function statMod(k){ return Math.floor((statCur(k) - 10) / 2); }
function statCapNow(){ return charS().level >= 9 ? 20 : 16; }   // EX never via growth
function prof(){ return 2 + Math.floor((charS().level - 1) / 4); }
/* HP is derived live — retroactive: hit die + Fortitude mod × level, avg per level after 1st */
function maxHP(){
  const c = charS(), m = statMod("FOR");
  return Math.max(1, c.hitDie + m + (c.level - 1) * (c.hitDie/2 + 1 + m));
}
function acVal(){ return 10 + statMod("JUS") + (charS().acMisc|0); }

/* PE cap: 100 base, +2 per capped-stat overflow, +10 per ASI-level cap choice */
function peCap(){
  const c = charS();
  const asiCaps = Object.values(c.asi).filter(v => v === "cap").length;
  return 100 + 2*c.overflow.length + 10*asiCaps;
}

/* print cost for one item of a risk class (Temperance INT-mod discount, floored at 0) */
function printCost(grade){ return Math.max(0, PRINT_BASE[grade] - statMod("TEM")); }

/* ============ equip gate: numeral grades (primary) + Aleph prof floor (secondary) ============ */
function unlockState(it){
  const reasons = [];
  const reqs = it.reqs || {};
  for(const s of STATS){
    const need = reqs[s.k] | 0;
    if(need > 0 && gradeRank(statCur(s.k)) < need)
      reasons.push(s.name + " " + GRADE_NAMES[need]);
  }
  if(it.grade === "ALEPH" && prof() < 4) reasons.push("PROF +4 (LV 9+)");
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
