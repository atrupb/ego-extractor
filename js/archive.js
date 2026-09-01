"use strict";
/* ============ archive — every recovered record, lock states, shattered records ============ */
let fCat = "all", fClass = "all", fShatter = false;

/* the record's computed headline value, for tag lines: weapon to-hit + damage / suit AC —
   worn in the color of the damage type it deals or guards */
function statTag(it){
  const c = DTYPE_COLOR[itemDType(it)] || "var(--teal)";
  if(it.type === "weapon" && weaponStat(it)) return ' // <b style="color:'+c+'">'+esc(weaponStat(it))+'</b>';
  if(it.type === "suit"){
    const n = suitAC(it);
    if(n !== null) return ' // <b style="color:'+c+'">AC '+n+'</b>';
  }
  return '';
}

function reqTagHTML(it){
  if(it.type === "gift") return '';
  const reqs = effReqs(it);
  const bits = [];
  for(const s of STATS){
    const need = reqs[s.k] | 0;
    if(!need) continue;
    const ok = gradeRank(statCur(s.k)) >= need;
    bits.push('<span class="'+(ok?'ok':'no')+'">'+s.k+' '+GRADE_NAMES[need]+'</span>');
  }
  if(it.grade === "ALEPH")
    bits.push('<span class="'+(prof()>=4?'ok':'no')+'">PROF+4</span>');
  else if(it.grade === "WAW" || it.grade === "HE")
    bits.push('<span class="'+(prof()>=3?'ok':'no')+'">PROF+3</span>');
  return bits.length ? '<div class="reqtags">'+bits.join(' · ')+'</div>' : '';
}

function renderArchive(){
  // the rules explainer at the bottom rides the terminal's debug option
  el("calcPanel").style.display = store.get("debug") ? "" : "none";
  // chips reflect filter state
  document.querySelectorAll("#fCatRow .chip").forEach(ch=>ch.classList.toggle("on", ch.dataset.v===fCat));
  document.querySelectorAll("#fClassRow .chip").forEach(ch=>ch.classList.toggle("on", ch.dataset.v===fClass));
  el("fShatter").classList.toggle("on", fShatter);

  const list = el("alist"); list.innerHTML = "";
  const col = collection();
  const match = it => (fCat==="all" || it.type===fCat) &&
                      (fClass==="all" || it.grade===fClass);

  const rec = col.filter(match);
  rec.forEach(it=>{
    const g = it.type==="gift"?"GIFT":it.grade;
    const u = unlockState(it);
    const r = document.createElement("div");
    r.className = "arow" + (u.ok ? "" : " locked");
    r.style.setProperty("--g", GCOLOR[g]);
    r.innerHTML = riskBadge(it.grade)+(u.ok?'':'<span class="lockicon">▚ LOCKED</span>')+
      '<div class="cimg">'+(it.img?'<img loading="lazy" src="'+it.img+'" alt="">':'<span class="noimg">—</span>')+'</div>'+
      '<div class="cmeta"><div class="cname">'+esc(it.name)+'</div>'+
      '<div class="ctag">'+esc(typeTag(it))+statTag(it)+(it.src?' // from '+esc(it.src):'')+'</div>'+
      reqTagHTML(it)+
      (it.note?'<div class="csrc">'+esc(it.note.slice(0,70))+(it.note.length>70?'…':'')+'</div>':'')+'</div>';
    r.addEventListener("click",()=>openDetail(it.id));
    list.appendChild(r);
  });

  // shattered records: exist in the index, not yet recovered — trophies waiting
  if(fShatter){
    const owned = new Set(col.map(c=>c.type+"::"+c.name));
    roster().filter(it=>match(it) && !owned.has(it.type+"::"+it.name)).forEach(it=>{
      const g = it.type==="gift"?"GIFT":it.grade;
      const r = document.createElement("div");
      r.className = "arow shattered";
      r.style.setProperty("--g", GCOLOR[g]);
      r.innerHTML = riskBadge(it.grade)+
        '<div class="cimg">'+(it.img?'<img loading="lazy" src="'+it.img+'" alt="">':'<span class="noimg">—</span>')+'</div>'+
        '<div class="cmeta"><div class="cname">'+esc(it.name)+'</div>'+
        '<div class="ctag">'+esc(typeTag(it))+' // ▚ SHATTERED</div></div>';
      if(it.link) r.addEventListener("click",()=>window.open(it.link,"_blank"));
      list.appendChild(r);
    });
  }

  if(!list.children.length){
    list.innerHTML = '<div class="empty">// nothing here.<br>run the session-end protocol on the terminal to recover your first record.</div>';
  }
}

/* ---------- detail modal: flavor, requirements (numeral grades), mechanics ---------- */
let detailId = null;
function openDetail(id){
  const it = collection().find(x=>x.id===id); if(!it) return;
  detailId = id;
  const g = it.type==="gift"?"GIFT":it.grade;
  el("mImg").innerHTML = riskBadge(it.grade) + (it.img?'<img src="'+it.img+'" alt="">':'<span class="noimg">NO FEED</span>');
  el("mName").textContent = it.name;
  el("mTag").innerHTML = esc(typeTag(it))+statTag(it)+(it.src?' // from '+esc(it.src):'');
  el("mFlav").innerHTML = '<span class="d">// retrieving record…</span>';
  getFlavor(it).then(f=>{
    el("mFlav").innerHTML = f ? '“'+esc(f)+'”' : '<span class="d">// no description recovered — open the full record.</span>';
  });
  const reqs = effReqs(it);
  for(const s of STATS) el("mReq"+s.k).value = String(reqs[s.k]|0);
  el("mReqWrap").style.display = it.type === "gift" ? "none" : "flex";
  // the record's headline value: weapons carry damage, suits carry AC;
  // gifts instead carry small structured bonuses
  el("mBonusWrap").style.display = it.type === "gift" ? "block" : "none";
  if(it.type === "gift") el("mBonusList").innerHTML = (it.bonus||[]).map(bonusRowHTML).join("");
  el("mStatField").style.display = it.type === "weapon" ? "block" : "none";
  el("mStat").value = it.dmg || "";
  // the stat override is derivation machinery — it hides behind the debug option
  el("mCalcWrap").style.display = it.type !== "gift" && store.get("debug") ? "block" : "none";
  el("mAtkLabel").textContent = it.type === "weapon"
    ? "Attack stat — blank = auto from damage type"
    : "Guard stat — blank = auto from best resistance; pick on ties";
  const pickedStat = it.type === "weapon" ? it.atk : it.acStat;
  el("mAtk").value = STAT_NAME[pickedStat] ? pickedStat : "";
  el("mRangeField").style.display = it.type === "weapon" ? "block" : "none";
  el("mRange").value = it.range === "melee" || it.range === "ranged" ? it.range : "";
  renderTypeRow(it);
  el("mNote").value = it.note||"";
  el("mWiki").onclick = ()=>{ if(it.link) window.open(it.link,"_blank"); };
  el("modal").classList.add("on");
}

/* the record's identity strip: main damage / defense type with its icon,
   the governing stat, and — for weapons — attack speed with the Rapid marker */
function renderTypeRow(it){
  const box = el("mTypeRow");
  if(it.type === "gift"){ box.style.display = "none"; return; }
  box.style.display = "flex";
  const s = egoStats(it);
  const dt = itemDType(it);
  let h = '<div class="typecell"><span class="tclabel">'+
    (it.type === "weapon" ? "MAIN DAMAGE TYPE" : "MAIN DEFENSE TYPE")+'</span><div class="tcval">';
  h += dt
    ? '<img src="'+DTYPE_ICON(dt)+'" alt=""><span class="ct-'+dt.toLowerCase()+'">'+dt.toUpperCase()+'</span>'
    : '<span class="tcsub">—</span>';
  h += '</div>';
  if(it.type === "weapon"){
    h += '<span class="tclabel tcgap">SPEED</span><div class="tcval">'+
      (s && s.speed ? esc(s.speed) : '<span class="tcsub">—</span>')+
      (isRapid(it) ? '<span class="rapidtag">RAPID</span>' : '')+'</div>';
    const rg = weaponRange(it);
    h += '<span class="tclabel tcgap">RANGE</span><div class="tcval">'+
      (rg ? RANGE_LABEL[rg] : '<span class="tcsub">—</span>')+'</div>';
  }
  h += '</div>';
  box.innerHTML = h;
}

/* every edit lands immediately — there is no save button */
function persistDetail(){
  const c = collection(); const it = c.find(x=>x.id===detailId);
  if(!it) return;
  it.note = el("mNote").value;
  if(it.type !== "gift") it.reqs = readModalReqs();
  if(it.type === "weapon"){ it.dmg = el("mStat").value.trim(); it.atk = el("mAtk").value; it.range = el("mRange").value; }
  if(it.type === "suit")   it.acStat = el("mAtk").value;   // "" = auto from resistances
  if(it.type === "gift")   it.bonus = readModalBonuses();
  saveCol(c);
  el("mTag").innerHTML = esc(typeTag(it))+statTag(it)+(it.src?' // from '+esc(it.src):'');
  renderTypeRow(it);
}
function closeDetail(){
  el("modal").classList.remove("on");
  refreshAll();   // fold the edits into every view once, on the way out
}
function bonusRowHTML(b){
  const opts = BONUS_TARGETS.map(t=>'<option value="'+t.v+'"'+(b && b.t===t.v?' selected':'')+'>'+esc(t.label)+'</option>').join("");
  return '<div class="bonusrow"><select class="bt">'+opts+'</select>'+
    '<input type="number" class="bn" value="'+(b ? (+b.n||0) : 1)+'" inputmode="numeric">'+
    '<button class="bx">×</button></div>';
}
function readModalBonuses(){
  return [...el("mBonusList").querySelectorAll(".bonusrow")]
    .map(r=>({t:r.querySelector(".bt").value, n:+r.querySelector(".bn").value||0}))
    .filter(b=>b.n);
}

function readModalReqs(){
  return Object.fromEntries(STATS.map(s=>[s.k, +el("mReq"+s.k).value]));
}

function initArchive(){
  el("fCatRow").addEventListener("click", e=>{
    const ch = e.target.closest(".chip"); if(!ch) return;
    fCat = ch.dataset.v; renderArchive();
  });
  el("fClassRow").addEventListener("click", e=>{
    const ch = e.target.closest(".chip"); if(!ch) return;
    if(ch.id==="fShatter"){ fShatter = !fShatter; }
    else fClass = ch.dataset.v;
    renderArchive();
  });

  // autosave wiring — any edit persists on the spot
  el("mNote").addEventListener("input", persistDetail);
  el("mStat").addEventListener("input", persistDetail);
  el("mAtk").addEventListener("change", persistDetail);
  el("mRange").addEventListener("change", persistDetail);
  for(const s of STATS) el("mReq"+s.k).addEventListener("change", persistDetail);
  el("mBonusList").addEventListener("change", persistDetail);
  el("mBonusAdd").onclick = ()=>{
    el("mBonusList").insertAdjacentHTML("beforeend", bonusRowHTML(null));
    persistDetail();
  };
  el("mBonusList").addEventListener("click", e=>{
    const x = e.target.closest(".bx");
    if(x){ x.closest(".bonusrow").remove(); persistDetail(); }
  });

  el("mDel").onclick = ()=>{
    if(!confirm("Shatter this record? It leaves the archive — recover it again through extraction or synthesis.")) return;
    saveCol(collection().filter(x=>x.id!==detailId));
    // clean any gift equip or loadout pointing at it
    const eq = giftEq();
    for(const k of Object.keys(eq)) if(eq[k]===detailId) delete eq[k];
    saveGiftEq(eq);
    saveLoadout(loadoutS().filter(e=>e.id!==detailId));
    el("modal").classList.remove("on");
    refreshAll();
  };
  el("mClose").onclick = closeDetail;
  el("modal").addEventListener("click",e=>{ if(e.target===el("modal")) closeDetail(); });
}
