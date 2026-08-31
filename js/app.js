"use strict";
/* ============ navigation + boot ============ */
const TABS = ["P","S","A","G","T"];   // PE / Sheet / Archive / Gifts / Terminal (+E extraction, no tab)

function show(s){ [...TABS,"E"].forEach(x=>el("scr"+x).classList.toggle("on",x===s)); }
function switchTab(t){
  TABS.forEach(x=>el("tab"+x).classList.toggle("on",x===t));
  show(t);
  refreshAll();
}
function refreshAll(){
  renderPE();
  renderSheet();
  renderArchive();
  renderGifts();
  renderTerminal();
}

/* one-time migration from the extraction-only app: "printed" items are really
   recovered records — give them the fields the sheet economy needs */
function migrate(){
  const c = collection();
  let dirty = false;
  for(const it of c){
    if(!("reqs" in it)){ it.reqs = {}; dirty = true; }
    if(!("note" in it)){ it.note = ""; dirty = true; }
  }
  if(dirty) saveCol(c);
}

function init(){
  migrate();
  TABS.forEach(t=>el("tab"+t).onclick = ()=>switchTab(t));

  initPE();
  initPrint();
  initSheet();
  initGifts();
  initArchive();

  // terminal wiring
  el("beginBtn").onclick = beginExtraction;
  el("synBtn").onclick = beginSynthesis;
  el("synType").onchange = renderTerminal;
  el("synClass").onchange = renderTerminal;
  el("synSlot").onchange = renderTerminal;
  el("origBtn").onclick = openOriginal;
  el("syncBtn").onclick = sync;

  // extraction screen
  el("recoverBtn").onclick = recoverRecord;
  el("abortBtn").onclick = ()=>{ if(picked>=0 || confirm("Abort extraction? The roll is lost.")) switchTab("T"); };

  // original E.G.O. modal
  el("cType").onchange = onCTypeChange;
  el("cSave").onclick = saveOriginal;
  el("cCancel").onclick = ()=>el("cmodal").classList.remove("on");
  el("cmodal").addEventListener("click",e=>{ if(e.target===el("cmodal")) el("cmodal").classList.remove("on"); });

  refreshAll();

  /* offline app shell */
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
}
init();
