"use strict";
/* ============ PE tracker — the live-combat home screen ============ */
let critOn = false;

function diceVal(){ return +el("diceVal").textContent; }
function crVal(){ return +el("crVal").textContent; }
function adjVal(){ return +el("adjVal").textContent; }

function stepEl(id, d, lo, hi){
  const n = Math.min(hi, Math.max(lo, +el(id).textContent + d));
  el(id).textContent = n;
}

function renderPE(){
  const p = peS(), cap = peCap();
  el("peCur").textContent = p.cur;
  el("peCap").textContent = "/ " + cap;
  el("peBarFill").style.width = Math.min(100, 100*p.cur/cap) + "%";

  // CANNOT PRINT: below the cheapest unlocked printable record (no mercy floor — surfaced, not prevented)
  const cheap = cheapestPrint();
  const cannot = cheap === null || p.cur < cheap;
  el("cannotBox").style.display = cannot ? "block" : "none";
  el("cannotBox").textContent = cheap === null
    ? "▚ NO PRINTABLE RECORDS ▚"
    : "▚ CANNOT PRINT — CHEAPEST "+cheap+" PE ▚";
  el("cheapLine").textContent = cheap === null
    ? "no unlocked weapon/suit records in archive"
    : "cheapest print: "+cheap+" PE // Temperance discount −"+statMod("TEM");

  // combat state
  el("cStart").disabled = p.inCombat;
  el("cEnd").disabled = !p.inCombat;
  el("combatState").textContent = p.inCombat ? "// IN COMBAT" : "// out of combat";
  el("combatState").style.color = p.inCombat ? "var(--red)" : "var(--dim)";

  // hit button labels track the dice stepper + crit toggle
  const d = diceVal();
  el("hitGain").textContent = "+" + (1 + (critOn?2:1)*d);
  el("saveGain").textContent = "+" + d;
  el("critBtn").classList.toggle("onstate", critOn);

  renderLoadout();
  renderLog();
  el("printOpenBtn").disabled = cheap === null || p.cur < cheap;
}

function renderLoadout(){
  const l = loadoutS(), box = el("loadoutPanel"), body = el("loadoutBody");
  if(!l){ box.style.display = "none"; return; }
  box.style.display = "block";
  const col = collection();
  const bits = [];
  for(const [key,label] of [["w","WEAPON"],["s","SUIT"]]){
    if(!l[key]) continue;
    const it = col.find(x=>x.id===l[key]);
    if(it) bits.push('<div class="statrow"><span>'+label+'</span><b style="color:'+GHEX[it.grade]+'">'+esc(it.name)+' ('+it.grade+')</b></div>');
  }
  body.innerHTML = bits.join("") +
    '<div class="statrow"><span>PE spent</span><b>'+l.cost+'</b></div>'+
    '<div class="syncnote">// dissolves losslessly at encounter end. PE is only lost if the print is destroyed.</div>';
}

function renderLog(){
  const p = peS(), box = el("evlog");
  if(!p.log.length){ box.innerHTML = '<div class="d">// no events logged.</div>'; return; }
  box.innerHTML = p.log.slice(0,60).map(e=>{
    const cls = e.d > 0 ? "gain" : e.d < 0 ? "loss" : "d";
    const sign = e.d > 0 ? "+"+e.d : e.d;
    return '<div><span class="'+cls+'">'+sign+'</span> <span class="d">::</span> '+esc(e.label)+'</div>';
  }).join("");
  el("undoBtn").disabled = !p.log.length;
}

function initPE(){
  // steppers
  el("diceMinus").onclick = ()=>{ stepEl("diceVal",-1,1,30); renderPE(); };
  el("dicePlus").onclick  = ()=>{ stepEl("diceVal",+1,1,30); renderPE(); };
  el("crMinus").onclick = ()=>stepEl("crVal",-1,0,30);
  el("crPlus").onclick  = ()=>stepEl("crVal",+1,0,30);
  el("adjMinus").onclick = ()=>stepEl("adjVal",-1,1,99);
  el("adjPlus").onclick  = ()=>stepEl("adjVal",+1,1,99);
  el("critBtn").onclick = ()=>{ critOn = !critOn; renderPE(); };

  // gain triggers (§3)
  el("missMeBtn").onclick   = ()=>{ addPE("ENEMY MISSED ME / SAVE MADE", +5); renderPE(); };
  el("missAllyBtn").onclick = ()=>{ addPE("ENEMY MISSED ALLY / ALLY SAVED", +3); renderPE(); };
  el("hitBtn").onclick = ()=>{
    const d = diceVal();
    const gain = 1 + (critOn?2:1)*d;
    addPE((critOn?"CRIT LANDED":"ATTACK LANDED")+" ("+d+" dice)", gain);
    critOn = false;
    renderPE();
  };
  el("saveSpellBtn").onclick = ()=>{ addPE("SAVE-SPELL DAMAGE ("+diceVal()+" dice)", +diceVal()); renderPE(); };
  el("restBtn").onclick = ()=>{ addPE("LONG REST (a trickle)", +1); renderPE(); };

  // combat bookends: ± highest enemy CR present
  el("cStart").onclick = ()=>{
    const cr = crVal();
    const p = peS(); p.inCombat = true; savePe(p);
    addPE("COMBAT START (CR "+cr+")", +cr, "combat-start");
    renderPE();
  };
  el("cEnd").onclick = ()=>{
    const cr = crVal();
    const p = peS(); p.inCombat = false; savePe(p);
    const hadPrint = !!loadoutS();
    addPE("COMBAT END (CR "+cr+")"+(hadPrint?" — print dissolved":""), +cr, "combat-end");
    if(hadPrint) saveLoadout(null);
    renderPE();
  };

  // manual adjust (table corrections)
  el("adjGain").onclick  = ()=>{ addPE("MANUAL ADJUST", +adjVal()); renderPE(); };
  el("adjSpend").onclick = ()=>{ addPE("MANUAL SPEND", -adjVal()); renderPE(); };

  // undo — a fumbled +5 mid-combat can't require mental math to fix
  el("undoBtn").onclick = ()=>{ undoPE(); renderPE(); };

  el("dissolveBtn").onclick = ()=>{
    if(!confirm("Dissolve the active print? No PE refund — the cost is spent.")) return;
    saveLoadout(null); renderPE();
  };
  el("printOpenBtn").onclick = openPrintModal;
}
