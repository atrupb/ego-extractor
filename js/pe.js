"use strict";
/* ============ PE tab — count, print, and the rules in plain text ============ */

function renderPE(){
  const p = peS(), cap = peCap();
  el("peCur").textContent = p.cur;
  el("peCap").textContent = "/ " + cap;
  el("peBarFill").style.width = Math.min(100, 100*p.cur/cap) + "%";
  renderLoadout();
}

function renderLoadout(){
  const l = loadoutS(), box = el("loadoutPanel"), body = el("loadoutBody");
  if(!l.length){ box.style.display = "none"; return; }
  box.style.display = "block";
  const col = collection();
  body.innerHTML = l.map((e,i)=>{
    const it = col.find(x=>x.id===e.id);
    if(!it) return "";
    return '<div class="printrow">'+
      '<div class="pimg">'+(it.img?'<img loading="lazy" src="'+it.img+'" alt="">':'<span class="noimg">—</span>')+'</div>'+
      '<span class="pn">'+esc(it.name)+
        '<span class="pclass" style="color:'+GHEX[it.grade]+';display:block;font-weight:400">'+it.grade+' '+it.type.toUpperCase()+'</span></span>'+
      '<span class="pcost">'+e.cost+' PE</span>'+
      '<button class="prx" data-rm="'+i+'">×</button>'+
    '</div>';
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
    if(!b) return;
    const l = loadoutS();
    l.splice(+b.dataset.rm, 1);
    saveLoadout(l);
    renderPE();
  });
}
