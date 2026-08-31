"use strict";
/* ============ gift loadout — LC slot grid; equip/swap out of combat ============ */
let gSlotOpen = null;

function renderGifts(){
  const eq = giftEq(), col = collection();
  el("slotgrid").innerHTML = SLOTS.map(s=>{
    if(s.id === "eye"){
      // permanently occupied — can never hold another gift
      return '<div class="slotcell lockedslot"><div class="slabel">'+s.label+' // SEALED</div>'+
        '<div class="sitem">「Your Eyes」</div></div>';
    }
    const it = eq[s.id] ? col.find(x=>x.id===eq[s.id]) : null;
    const bon = it && (it.bonus||[]).length
      ? '<div class="sbonus">'+esc((it.bonus||[]).map(b=>(b.n>0?"+":"")+b.n+" "+(BONUS_LABEL[b.t]||b.t)).join(", "))+'</div>' : '';
    return '<div class="slotcell'+(it?'':' emptyslot')+'" data-slot="'+s.id+'">'+
      '<div class="slabel">'+s.label+'</div>'+
      '<div class="sitem">'+(it?esc(it.name):'— empty —')+'</div>'+bon+'</div>';
  }).join("");
}

function openGiftChooser(slotId){
  gSlotOpen = slotId;
  const cell = SLOTS.find(s=>s.id===slotId);
  const eq = giftEq(), col = collection();
  el("gTitle").textContent = cell.label.toUpperCase() + " SLOT";
  const fits = col.filter(i=>i.type==="gift" && giftFitsSlot(i.slot||typeTag(i), cell));
  const rows = fits.map(it=>{
    const u = unlockState(it);
    const where = Object.entries(eq).find(([sl,id])=>id===it.id && sl!==slotId);
    const dis = !u.ok;
    return '<div class="pickrow'+(eq[slotId]===it.id?' sel':'')+(dis?' disabled':'')+'" data-gid="'+it.id+'">'+
      '<span style="flex:1;min-width:0">'+esc(it.name)+'</span>'+
      (dis ? '<span class="pclass" style="color:var(--red)">'+esc(u.reasons.join(" · "))+'</span>'
           : where ? '<span class="pclass" style="color:var(--dim)">on '+esc((SLOTS.find(s=>s.id===where[0])||{}).label||where[0])+'</span>' : '')+
    '</div>';
  });
  el("gList").innerHTML =
    '<div class="pickrow'+(!eq[slotId]?' sel':'')+'" data-gid="none"><span>— UNEQUIP —</span></div>'+
    (rows.length ? rows.join("") :
      '<div class="syncnote">// no recovered gifts fit this slot. gifts come from extraction or synthesis.</div>');
  el("gmodal").classList.add("on");
}

function initGifts(){
  el("slotgrid").addEventListener("click", e=>{
    const cell = e.target.closest(".slotcell[data-slot]");
    if(cell) openGiftChooser(cell.dataset.slot);
  });
  el("gmodal").addEventListener("click", e=>{
    if(e.target === el("gmodal")){ el("gmodal").classList.remove("on"); return; }
    const row = e.target.closest(".pickrow");
    if(!row || row.classList.contains("disabled")) return;
    const eq = giftEq();
    if(row.dataset.gid === "none"){ delete eq[gSlotOpen]; }
    else{
      const id = +row.dataset.gid;
      for(const k of Object.keys(eq)) if(eq[k]===id) delete eq[k]; // one body, one copy
      eq[gSlotOpen] = id;
    }
    saveGiftEq(eq);
    el("gmodal").classList.remove("on");
    refreshAll();   // equipping a gift can move AC, initiative, stats, skills
  });
  el("gClose").onclick = ()=>el("gmodal").classList.remove("on");
}
