"use strict";
/* ============ print flow — pick a category, pick one record, print it; repeat for the set ============ */
let pCat = "weapon", pPick = null;

function openPrintModal(){
  pCat = "weapon"; pPick = null;
  renderPrintModal();
  el("pmodal").classList.add("on");
}

function renderPrintModal(){
  const p = peS(), cap = peCap();
  // the modal carries its own copy of the Enkephalin meter
  el("pmFill").style.width = Math.min(100, 100*p.cur/cap) + "%";
  el("pmCur").textContent = p.cur;
  el("pmCap").textContent = "/ " + cap;
  document.querySelectorAll("#pCatRow .chip").forEach(ch=>ch.classList.toggle("on", ch.dataset.v===pCat));

  const items = collection().filter(i=>i.type===pCat && unlockState(i).ok);
  const box = el("pList");
  if(!items.length){
    box.innerHTML = '<div class="empty">// no unlocked '+pCat+' records in the archive.</div>';
  }else{
    box.innerHTML = items.map(it=>
      '<div class="pickrow'+(pPick===it.id?' sel':'')+'" data-pick="'+it.id+'">'+
        riskBadge(it.grade)+
        '<div class="cimg">'+(it.img?'<img loading="lazy" src="'+esc(it.img)+'" alt="">':'<span class="noimg">—</span>')+'</div>'+
        '<span style="flex:1;min-width:0">'+esc(it.name)+'</span>'+
        '<span class="pcost">'+printCost(it.grade)+' PE</span>'+
      '</div>').join("");
  }

  const it = pPick && collection().find(x=>x.id===pPick);
  // full spec for the selected record only — the list rows stay slim
  el("pSpec").style.display = it ? "block" : "none";
  if(it) el("pSpec").innerHTML = printSpecHTML(it);
  const cost = it ? printCost(it.grade) : 0;
  el("pTotal").innerHTML = it
    ? esc(it.name)+': <b class="'+(cost<=p.cur?'':'bad')+'">'+cost+' PE</b> (have '+p.cur+')'
    : '<span style="color:var(--dim)">select a record</span><b>'+p.cur+' PE held</b>';
  el("pConfirm").disabled = !it || cost > p.cur;
}

/* the spec card: identity, resolved numbers in the type's color, and the
   record's written mechanics note */
function printSpecHTML(it){
  const dt = itemDType(it), dc = dt && DTYPE_COLOR[dt];
  const s = egoStats(it);
  let h = '<div class="pshead">';
  h += dt
    ? '<img src="'+DTYPE_ICON(dt)+'" alt=""><span style="color:'+dc+'">'+dt.toUpperCase()+'</span>'
    : '<span class="psdim">type unknown</span>';
  if(it.type === "weapon"){
    if(s && s.speed) h += '<span class="psdim">'+esc(s.speed)+'</span>';
    const rg = weaponRange(it);
    if(rg) h += '<span class="psdim">'+RANGE_LABEL[rg]+'</span>';
    if(isRapid(it)) h += '<span class="rapidtag">RAPID</span>';
  }
  h += '</div>';
  const num = it.type === "weapon" ? weaponStat(it) : (suitAC(it) !== null ? "AC "+suitAC(it) : "");
  if(num) h += '<div class="psnum"'+(dc ? ' style="color:'+dc+'"' : '')+'>'+esc(num)+'</div>';
  if(it.note) h += '<div class="psnote">'+esc(it.note)+'</div>';
  return h;
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
