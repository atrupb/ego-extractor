"use strict";
/* ============ print flow — pick a category, pick one record, print it; repeat for the set ============ */
let pCat = "weapon", pPick = null;

function openPrintModal(){
  pCat = "weapon"; pPick = null;
  renderPrintModal();
  el("pmodal").classList.add("on");
}

function renderPrintModal(){
  const p = peS();
  document.querySelectorAll("#pCatRow .chip").forEach(ch=>ch.classList.toggle("on", ch.dataset.v===pCat));

  const items = collection().filter(i=>i.type===pCat && unlockState(i).ok);
  const box = el("pList");
  if(!items.length){
    box.innerHTML = '<div class="empty">// no unlocked '+pCat+' records in the archive.</div>';
  }else{
    box.innerHTML = items.map(it=>
      '<div class="pickrow'+(pPick===it.id?' sel':'')+'" data-pick="'+it.id+'">'+
        '<div class="cimg">'+(it.img?'<img loading="lazy" src="'+esc(it.img)+'" alt="">':'<span class="noimg">—</span>')+'</div>'+
        '<span style="flex:1;min-width:0">'+esc(it.name)+
          '<span class="pclass" style="color:'+GHEX[it.grade]+';display:block;font-weight:400">'+it.grade+'</span></span>'+
        '<span class="pcost">'+printCost(it.grade)+' PE</span>'+
      '</div>').join("");
  }

  const it = pPick && collection().find(x=>x.id===pPick);
  const cost = it ? printCost(it.grade) : 0;
  el("pTotal").innerHTML = it
    ? esc(it.name)+': <b class="'+(cost<=p.cur?'':'bad')+'">'+cost+' PE</b> (have '+p.cur+')'
    : '<span style="color:var(--dim)">select a record</span><b>'+p.cur+' PE held</b>';
  el("pConfirm").disabled = !it || cost > p.cur;
}

function initPrint(){
  el("pCatRow").addEventListener("click", e=>{
    const ch = e.target.closest(".chip");
    if(!ch) return;
    pCat = ch.dataset.v; pPick = null;
    renderPrintModal();
  });
  el("pList").addEventListener("click", e=>{
    const row = e.target.closest("[data-pick]");
    if(!row) return;
    const id = +row.dataset.pick;
    pPick = pPick === id ? null : id;
    renderPrintModal();
  });
  el("pmodal").addEventListener("click", e=>{ if(e.target===el("pmodal")) el("pmodal").classList.remove("on"); });
  el("pConfirm").onclick = ()=>{
    const it = pPick && collection().find(x=>x.id===pPick);
    if(!it) return;
    const cost = printCost(it.grade);
    if(cost > peS().cur) return;
    addPE(-cost);
    const l = loadoutS();
    l.push({id:it.id, cost, date:todayISO()});
    saveLoadout(l);
    el("pmodal").classList.remove("on");
    refreshAll();          // a printed suit's AC bonus lands on the sheet
  };
  el("pCancel").onclick = ()=>el("pmodal").classList.remove("on");
}
