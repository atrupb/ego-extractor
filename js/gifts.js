"use strict";
/* ============ gift loadout — Waylon silhouette, slots point at the body ============ */
let gSlotOpen = null;
let gAdjust = false, gSel = null;   // dot-adjustment mode

/* default anchors, aimed at waylon-body.png (placed at 115,4 130×260).
   The player can override any dot from the ADJUST DOTS mode; overrides live in storage. */
const SLOT_POS = {
  hat:   {side:"L", y:10,  ax:178, ay:16},
  eye:   {side:"L", y:118, ax:161, ay:86},
  mouth2:{side:"L", y:226, ax:174, ay:104},
  cheek: {side:"R", y:10,  ax:198, ay:98},
  brooch:{side:"R", y:118, ax:176, ay:140},
  hand2: {side:"R", y:226, ax:222, ay:234}
};
function anchorOf(id){
  const o = (store.get("slotPos")||{})[id];
  const d = SLOT_POS[id];
  return o ? {side:d.side, y:d.y, ax:o.ax, ay:o.ay} : d;
}

/* 「Your Eyes」 is drawn, not photographed — flat wayfarers in the same line
   language as the circuit traces, so they sit on the silhouette instead of on it.
   Art box is 48x18; everything scales off the width asked for. */
function eyeArt(ax, ay, w){
  const h = w * 18 / 48, s = w / 48;
  const lens = "M2 3 H21 L19.6 12.4 C19.1 15.4 16.6 16.8 13 16.8 C8.2 16.8 4.6 14.8 3.6 10.8 Z";
  const pen = ' fill="#0d0d0c" stroke="#f2c14e" stroke-width="1.4" stroke-linejoin="round"';
  return '<g transform="translate('+(ax - w/2)+' '+(ay - h/2)+') scale('+s+')" filter="url(#gshadow)">'+
    '<path d="'+lens+'"'+pen+'/>'+
    '<g transform="translate(46 0) scale(-1 1)"><path d="'+lens+'"'+pen+'/></g>'+
    '<path d="M21 4.2 Q24 2.4 27 4.2" fill="none" stroke="#f2c14e" stroke-width="1.4" stroke-linecap="round"/>'+
    '<path d="M2 3.4 L-1.5 1.6 M46 3.4 L49.5 1.6" fill="none" stroke="#f2c14e" stroke-width="1.4" stroke-linecap="round"/>'+
  '</g>';
}

function renderGifts(){
  const eq = giftEq(), col = collection();
  let svg = '<svg viewBox="0 0 360 270" preserveAspectRatio="none">'+
    '<defs>'+
      '<filter id="gshadow" x="-40%" y="-40%" width="180%" height="180%">'+
        '<feDropShadow dx="0" dy="1" stdDeviation=".9" flood-color="#000" flood-opacity=".9"/>'+
      '</filter>'+
    '</defs>'+
    '<image href="assets/waylon-body.png" x="115" y="4" width="130" height="260"/>';
  const chips = [], art = [];   // art paints last so no trace line crosses a gift
  for(const s of SLOTS){
    const pos = anchorOf(s.id); if(!pos) continue;
    const sealed = s.id === "eye";
    const it = !sealed && eq[s.id] ? col.find(x=>x.id===eq[s.id]) : null;
    const lit = sealed || !!it;
    const colr = gAdjust && gSel === s.id ? "#e02929" : lit ? "#f2c14e" : "#55534a";
    const left = pos.side === "L";
    const ex = left ? 103 : 257;
    const cy = pos.y + 14;
    const lane = left ? pos.ax - 8 : pos.ax + 8;   // right-angle circuit-trace routing
    const src = sealed ? null : (it && it.img) || null;
    const worn = sealed || !!src;
    svg += '<path d="M'+ex+' '+cy+' H'+lane+' V'+pos.ay+' H'+pos.ax+'" fill="none" stroke="'+colr+'" stroke-width="1.2" opacity=".7"/>';
    // worn art replaces the dot; while adjusting, the dot comes back on top of it
    if(!worn || gAdjust)
      svg += '<circle cx="'+pos.ax+'" cy="'+pos.ay+'" r="'+(gAdjust && gSel===s.id ? 5 : 3.4)+'" fill="'+colr+'"/>';
    if(sealed) art.push(eyeArt(pos.ax, pos.ay, 32));
    else if(src){
      const sz = 20;   // worn art reads as jewellery, not as a billboard
      art.push('<image class="gart" href="'+esc(src)+'" preserveAspectRatio="xMidYMid meet"'+
        ' x="'+(pos.ax - sz/2)+'" y="'+(pos.ay - sz/2)+'" width="'+sz+'" height="'+sz+'"'+
        ' filter="url(#gshadow)"/>');
    }
    const style = (left ? 'left:1%;' : 'right:1%;')+'top:'+(pos.y/270*100).toFixed(2)+'%';
    const bonus = it && (it.bonus||[]).length
      ? (it.bonus||[]).map(b=>(b.n>0?"+":"")+b.n+" "+(BONUS_LABEL[b.t]||b.t)).join(", ") : "";
    chips.push('<div class="slotchip'+(sealed?' lockedslot':(it?' filled':' emptyslot'))+
      (gAdjust && gSel===s.id?' adjsel':'')+'" data-slot="'+s.id+'" style="'+style+'"'+
      (bonus?' title="'+esc(bonus)+'"':'')+'>'+
      '<div class="slabel">'+s.label+'</div>'+
      '<div class="sitem">'+(sealed?'「Your Eyes」':it?esc(it.name):'—')+'</div></div>');
  }
  svg += art.join("") + '</svg>';
  const debug = !!store.get("debug");
  if(!debug) gAdjust = false;
  el("slotgrid").innerHTML =
    '<div class="bodywrap">'+svg+chips.join("")+'</div>'+
    (debug ? '<div class="growrow">'+
      '<button class="smallbtn'+(gAdjust?' danger':' accent')+'" data-act="adjust">'+(gAdjust?'Done':'Adjust dots')+'</button>'+
      (gAdjust?'<button class="smallbtn" data-act="resetdots">Reset dots</button>':'')+
    '</div>'+
    (gAdjust?'<div class="syncnote">// tap a slot chip, then tap the body where its dot belongs.</div>':'') : '');
}

function openGiftChooser(slotId){
  gSlotOpen = slotId;
  const cell = SLOTS.find(s=>s.id===slotId);
  const eq = giftEq(), col = collection();
  el("gTitle").textContent = cell.label.toUpperCase() + " SLOT";
  const fits = col.filter(i=>i.type==="gift" && giftFitsSlot(i.slot||typeTag(i), cell));
  const rows = fits.map(it=>{
    const where = Object.entries(eq).find(([sl,id])=>id===it.id && sl!==slotId);
    return '<div class="pickrow'+(eq[slotId]===it.id?' sel':'')+'" data-gid="'+it.id+'">'+
      '<span style="flex:1;min-width:0">'+esc(it.name)+'</span>'+
      (where ? '<span class="pclass" style="color:var(--dim)">on '+esc((SLOTS.find(s=>s.id===where[0])||{}).label||where[0])+'</span>' : '')+
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
    const btn = e.target.closest("[data-act]");
    if(btn){
      if(btn.dataset.act === "adjust"){ gAdjust = !gAdjust; gSel = null; renderGifts(); }
      if(btn.dataset.act === "resetdots" && confirm("Reset every dot to its default position?")){
        store.set("slotPos", {}); renderGifts();
      }
      return;
    }
    const chip = e.target.closest("[data-slot]");
    if(chip){
      if(gAdjust){ gSel = chip.dataset.slot; renderGifts(); return; }
      if(chip.dataset.slot === "eye") return;   // sealed
      openGiftChooser(chip.dataset.slot);
      return;
    }
    // adjust mode: a tap on the diagram moves the selected slot's dot there
    if(gAdjust && gSel){
      const wrap = e.target.closest(".bodywrap");
      if(!wrap) return;
      const r = wrap.getBoundingClientRect();
      const o = store.get("slotPos") || {};
      o[gSel] = {
        ax: Math.round((e.clientX - r.left) / r.width * 360),
        ay: Math.round((e.clientY - r.top) / r.height * 270)
      };
      store.set("slotPos", o);
      renderGifts();
    }
  });
  el("gmodal").addEventListener("click", e=>{
    if(e.target === el("gmodal")){ el("gmodal").classList.remove("on"); return; }
    const row = e.target.closest(".pickrow");
    if(!row) return;
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
