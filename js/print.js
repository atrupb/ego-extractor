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
      '<div class="arow'+(pPick===it.id?' sel':'')+'" data-pick="'+it.id+'" style="--g:'+GCOLOR[it.grade]+'">'+
        '<div class="cimg">'+(it.img?'<img loading="lazy" src="'+esc(it.img)+'" alt="">':'<span class="noimg">NO FEED</span>')+'</div>'+
        '<div class="cmeta"><div class="cname">'+esc(it.name)+'</div>'+
        '<div class="ctag"><b style="color:'+GHEX[it.grade]+'">'+it.grade+'</b> // '+printCost(it.grade)+' PE</div>'+
        '<div class="cflav" data-pf="'+it.id+'">'+(it.note?esc(it.note):'')+'</div></div>'+
      '</div>').join("");
    // no mechanics written yet? fall back to the record's wiki flavor
    for(const it of items){
      if(it.note) continue;
      getFlavor(it).then(f=>{
        const slot = box.querySelector('.cflav[data-pf="'+it.id+'"]');
        if(slot && f && !slot.textContent) slot.textContent = "“"+f+"”";
      });
    }
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
    renderPE();
  };
  el("pCancel").onclick = ()=>el("pmodal").classList.remove("on");
}
