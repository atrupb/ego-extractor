"use strict";
/* ============ PE tab — count, print, and the rules in plain text ============ */

function renderPE(){
  const p = peS(), cap = peCap();
  el("peCur").textContent = p.cur;
  el("peCap").textContent = "/ " + cap;
  el("peBarFill").style.width = Math.min(100, 100*p.cur/cap) + "%";
  renderLoadout();
}

let printOpen = null;   // which active print has its spec unfolded
function renderLoadout(){
  const l = loadoutS(), box = el("loadoutPanel"), body = el("loadoutBody");
  if(!l.length){ box.style.display = "none"; return; }
  box.style.display = "block";
  const col = collection();
  body.innerHTML = l.map((e,i)=>{
    const it = col.find(x=>x.id===e.id);
    if(!it) return "";
    // headline shorthand: weapon to-hit + damage / suit AC, all derived,
    // colored by the damage type dealt or guarded
    const acN = it.type === "suit" ? suitAC(it) : null;
    const stat = it.type === "weapon" ? weaponStat(it) : acN !== null ? "AC "+acN : "";
    const dc = DTYPE_COLOR[itemDType(it)];
    return '<div class="printrow'+(printOpen === i ? ' open' : '')+'" data-open="'+i+'">'+
      riskBadge(it.grade)+
      '<div class="cimg">'+(it.img?'<img loading="lazy" src="'+esc(it.img)+'" alt="">':'<span class="noimg">—</span>')+'</div>'+
      '<span class="pn">'+esc(it.name)+
        '<span class="pclass" style="display:block;font-weight:400;color:var(--dim)">'+it.type.toUpperCase()+' · '+e.cost+' PE</span></span>'+
      (stat ? '<span class="pcost"'+(dc?' style="color:'+dc+'"':'')+'>'+esc(stat)+'</span>' : '')+
      '<button class="prx" data-rm="'+i+'">×</button>'+
    '</div>'+
    (printOpen === i ? '<div class="printspec">'+printSpecHTML(it)+'</div>' : '');
  }).join("");
}

function peStep(){
  const n = Math.floor(+el("peStep").value);
  return isFinite(n) && n >= 1 ? Math.min(999, n) : 1;
}

function initPE(){
  el("peStep").value = store.get("peStep") || 1;
  el("peStep").addEventListener("change", ()=>{
    el("peStep").value = peStep();          // normalize junk input
    store.set("peStep", peStep());
  });
  el("peMinus").onclick = ()=>{ addPE(-peStep()); renderPE(); };
  el("pePlus").onclick  = ()=>{ addPE(+peStep()); renderPE(); };
  el("printOpenBtn").onclick = openPrintModal;
  el("loadoutBody").addEventListener("click", e=>{
    const b = e.target.closest("[data-rm]");
    if(b){
      const l = loadoutS();
      l.splice(+b.dataset.rm, 1);
      if(printOpen !== null) printOpen = null;
      saveLoadout(l);
      refreshAll();        // a removed suit takes its AC bonus with it
      return;
    }
    // tapping the row itself unfolds the full spec, tapping again folds it away
    const row = e.target.closest("[data-open]");
    if(!row) return;
    printOpen = printOpen === +row.dataset.open ? null : +row.dataset.open;
    renderLoadout();
  });
}
