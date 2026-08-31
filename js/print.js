"use strict";
/* ============ print flow — at initiative: pick weapon and/or suit, pay PE, one encounter ============ */
let pSel = {w:null, s:null};

function printTotal(){
  const col = collection();
  let t = 0;
  for(const key of ["w","s"]){
    if(!pSel[key]) continue;
    const it = col.find(x=>x.id===pSel[key]);
    if(it) t += printCost(it.grade);
  }
  return t;
}

function openPrintModal(){
  pSel = {w:null, s:null};
  renderPrintModal();
  el("pmodal").classList.add("on");
}

function renderPrintModal(){
  const col = collection(), p = peS();
  for(const [key,type,boxId] of [["w","weapon","pWeapons"],["s","suit","pSuits"]]){
    const items = col.filter(i=>i.type===type && unlockState(i).ok);
    const box = el(boxId);
    if(!items.length){
      box.innerHTML = '<div class="syncnote" style="margin-top:0">// no unlocked '+type+' records.</div>';
      continue;
    }
    box.innerHTML = items.map(it=>
      '<div class="pickrow'+(pSel[key]===it.id?' sel':'')+'" data-slot="'+key+'" data-id="'+it.id+'">'+
        '<span class="pclass" style="color:'+GHEX[it.grade]+'">'+it.grade.slice(0,1)+'</span>'+
        '<span style="flex:1;min-width:0">'+esc(it.name)+'</span>'+
        '<span class="pcost">'+printCost(it.grade)+' PE</span>'+
      '</div>').join("");
  }
  const total = printTotal();
  const both = pSel.w && pSel.s;
  el("pTotal").innerHTML = 'TOTAL'+(both?' (FULL SET — DOUBLE)':'')+
    ': <b class="'+(total<=p.cur?'':'bad')+'">'+total+' PE</b> (have '+p.cur+')';
  el("pConfirm").disabled = (!pSel.w && !pSel.s) || total > p.cur;
}

function initPrint(){
  // tap a row to select it; tap again to deselect (one weapon + one suit max)
  el("pmodal").addEventListener("click", e=>{
    const row = e.target.closest(".pickrow");
    if(!row) { if(e.target===el("pmodal")) el("pmodal").classList.remove("on"); return; }
    const key = row.dataset.slot, id = +row.dataset.id;
    pSel[key] = pSel[key] === id ? null : id;
    renderPrintModal();
  });
  el("pConfirm").onclick = ()=>{
    const total = printTotal();
    if((!pSel.w && !pSel.s) || total > peS().cur) return;
    addPE(-total);
    saveLoadout({w:pSel.w, s:pSel.s, cost:total, date:todayISO()});   // a new print replaces the old one
    el("pmodal").classList.remove("on");
    renderPE();
  };
  el("pCancel").onclick = ()=>el("pmodal").classList.remove("on");
}
