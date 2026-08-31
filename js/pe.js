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
    '<div class="statrow"><span>PE spent</span><b>'+l.cost+'</b></div>';
}

function initPE(){
  el("peMinus").onclick = ()=>{ addPE(-1); renderPE(); };
  el("pePlus").onclick  = ()=>{ addPE(+1); renderPE(); };
  el("removePrintBtn").onclick = ()=>{ saveLoadout(null); renderPE(); };
  el("printOpenBtn").onclick = openPrintModal;
}
