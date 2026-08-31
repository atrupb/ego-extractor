"use strict";
/* ============ print flow — pick a weapon and/or suit, pay PE, they join the active list ============ */
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
        '<div class="pimg">'+(it.img?'<img loading="lazy" src="'+it.img+'" alt="">':'<span class="noimg">—</span>')+'</div>'+
        '<span style="flex:1;min-width:0">'+esc(it.name)+
          '<span class="pclass" style="color:'+GHEX[it.grade]+';display:block;font-weight:400">'+it.grade+'</span></span>'+
        '<span class="pcost">'+printCost(it.grade)+' PE</span>'+
      '</div>').join("");
  }
  const total = printTotal();
  const both = pSel.w && pSel.s;
  el("pTotal").innerHTML = 'TOTAL'+(both?' (FULL SET)':'')+
    ': <b class="'+(total<=p.cur?'':'bad')+'">'+total+' PE</b> (have '+p.cur+')';
  el("pConfirm").disabled = (!pSel.w && !pSel.s) || total > p.cur;
}

function initPrint(){
  // tap a row to select it; tap again to deselect (one weapon + one suit per print action)
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
    const col = collection(), l = loadoutS();
    for(const key of ["w","s"]){
      const it = pSel[key] && col.find(x=>x.id===pSel[key]);
      if(it) l.push({id:it.id, cost:printCost(it.grade), date:todayISO()});
    }
    saveLoadout(l);
    el("pmodal").classList.remove("on");
    renderPE();
  };
  el("pCancel").onclick = ()=>el("pmodal").classList.remove("on");
}
