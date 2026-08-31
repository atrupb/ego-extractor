"use strict";
/* ============ character sheet — merged stats, saves, skills, derived numbers ============ */
const PROF_DOT = ["○","●","◉"];   // none / proficient / expertise
const fmtMod = m => (m>=0?"+":"") + m;

function renderSheet(){
  const c = charS();

  // core numbers
  el("lvlVal").textContent = c.level;
  el("profVal").textContent = "+" + prof();
  el("acVal").textContent = acVal();
  el("initVal").textContent = fmtMod(statMod("JUS") + (c.initMisc|0) + bonusFor("INIT"));
  el("initMiscVal").textContent = fmtMod(c.initMisc|0);
  el("hpMax").textContent = maxHP();
  el("hpCurVal").textContent = c.hpCur === null ? maxHP() : Math.min(c.hpCur, maxHP());
  el("hpTempVal").textContent = c.hpTemp | 0;
  el("hdVal").textContent = hdLeft() + " / " + c.level;

  renderStatCards(c);
  renderSaves(c);
  renderSkills(c);

  // feats
  el("featList").innerHTML = c.feats.length
    ? c.feats.map((f,i)=>'<div class="featrow"><span>'+esc(f)+'</span><span class="x" data-feat="'+i+'">×</span></div>').join("")
    : '<div class="syncnote" style="margin-top:0">// nothing recorded.</div>';

  // ASI-level choices: one feat OR +10 permanent PE cap (no ASIs, ever)
  const lvls = [4,8,12,16,19].filter(l=>l<=c.level);
  el("asiBody").innerHTML = !lvls.length
    ? '<div class="syncnote" style="margin-top:0">// first choice unlocks at level 4.</div>'
    : lvls.map(l=>
      '<div class="statrow"><span>LEVEL '+l+'</span>'+
      '<select data-asi="'+l+'" style="width:170px">'+
        '<option value=""'+(!c.asi[l]?' selected':'')+'>— undecided —</option>'+
        '<option value="feat"'+(c.asi[l]==="feat"?' selected':'')+'>Feat</option>'+
        '<option value="cap"'+(c.asi[l]==="cap"?' selected':'')+'>+10 PE cap</option>'+
      '</select></div>').join("");

  // PE cap
  el("capTotal").textContent = peCap();
  el("capAdjVal").textContent = ((c.capAdj>=0?"+":"") + (c.capAdj|0));
}

function renderStatCards(c){
  el("statgrid").innerHTML = STATS.map(s=>{
    const cur = statCur(s.k);
    const rank = gradeRank(cur);
    // progress toward the next grade band
    let prog = 100;
    if(rank < 6){
      const lo = GRADE_FLOOR[rank], hi = GRADE_FLOOR[rank+1];
      prog = Math.max(0, Math.min(100, 100*(cur-lo)/(hi-lo)));
    }
    return '<div class="statcard">'+
      '<div class="sname">'+s.name+'</div><div class="ssub">'+s.sub+'</div>'+
      '<div class="srow">'+
        '<div class="score">'+cur+'</div>'+
        '<div class="gradebadge'+(rank===6?' ex':'')+'">'+GRADE_NAMES[rank]+'</div>'+
      '</div>'+
      '<div class="modline">MOD <b>'+fmtMod(statMod(s.k))+'</b></div>'+
      '<div class="prog"><i style="width:'+prog+'%"></i></div>'+
      '<div class="capnote">'+(rank===6 ? 'EX' : 'next: '+GRADE_NAMES[rank+1]+' at '+GRADE_FLOOR[rank+1])+'</div>'+
      '<div class="microbtns">'+
        '<button class="microbtn" data-k="'+s.k+'" data-act="b-">−</button>'+
        '<button class="microbtn" data-k="'+s.k+'" data-act="b+">+</button>'+
      '</div>'+
    '</div>';
  }).join("");
}

/* saving throws — standard 5e rolls; the merged stat IS the ability (STR & CON both read Fortitude) */
function renderSaves(c){
  el("saveList").innerHTML = SAVES.map(a=>{
    const on = !!c.saveProf[a];
    const mod = statMod(ABIL2MERGED[a]) + (on ? prof() : 0);
    return '<div class="profrow" data-save="'+a+'">'+
      '<span class="pdot'+(on?' on':'')+'">'+PROF_DOT[on?1:0]+'</span>'+
      '<span class="pname">'+a+'</span>'+
      '<span class="psrc">'+STAT_NAME[ABIL2MERGED[a]]+'</span>'+
      '<span class="pmod">'+fmtMod(mod)+'</span></div>';
  }).join("");
}

/* skills — tap the dot to cycle none → proficient → expertise */
function renderSkills(c){
  el("skillList").innerHTML = SKILLS.map(s=>{
    const lv = c.skills[s.id] | 0;
    const mod = statMod(ABIL2MERGED[s.abil]) + lv * prof() + bonusFor(s.id);
    return '<div class="profrow" data-skill="'+s.id+'">'+
      '<span class="pdot'+(lv?' on':'')+(lv===2?' ex':'')+'">'+PROF_DOT[lv]+'</span>'+
      '<span class="pname">'+s.name+'</span>'+
      '<span class="psrc">'+s.abil+'</span>'+
      '<span class="pmod">'+fmtMod(mod)+'</span></div>';
  }).join("");
  const pp = 10 + statMod("PRU") + (c.skills.perception|0) * prof() + bonusFor("perception");
  el("passPerc").textContent = pp;
}

function initSheet(){
  el("statgrid").addEventListener("click", e=>{
    const b = e.target.closest("button");
    if(!b) return;
    const c = charS(), st = c.stats[b.dataset.k];
    if(b.dataset.act === "b+") st.base = Math.min(30, st.base+1);
    if(b.dataset.act === "b-") st.base = Math.max(3, st.base-1);
    saveChar(c);
    refreshAll();
  });

  el("saveList").addEventListener("click", e=>{
    const row = e.target.closest(".profrow[data-save]");
    if(!row) return;
    const c = charS(), a = row.dataset.save;
    c.saveProf[a] = !c.saveProf[a];
    saveChar(c); renderSheet();
  });
  el("skillList").addEventListener("click", e=>{
    const row = e.target.closest(".profrow[data-skill]");
    if(!row) return;
    const c = charS(), id = row.dataset.skill;
    c.skills[id] = ((c.skills[id]|0) + 1) % 3;
    saveChar(c); renderSheet();
  });

  el("lvlMinus").onclick = ()=>{ const c=charS(); c.level=Math.max(1,c.level-1); saveChar(c); refreshAll(); };
  el("lvlPlus").onclick  = ()=>{ const c=charS(); c.level=Math.min(20,c.level+1); saveChar(c); refreshAll(); };
  el("initMinus").onclick = ()=>{ const c=charS(); c.initMisc=(c.initMisc|0)-1; saveChar(c); renderSheet(); };
  el("initPlus").onclick  = ()=>{ const c=charS(); c.initMisc=(c.initMisc|0)+1; saveChar(c); renderSheet(); };

  // HP is derived (never hand-entered); current HP is just table damage tracking.
  // type the amount, then − / +
  const amt = id => { const n = Math.floor(+el(id).value); return isFinite(n) && n >= 1 ? n : 1; };
  const hpAdj = sign => ()=>{
    const c = charS();
    const cur = c.hpCur === null ? maxHP() : c.hpCur;
    c.hpCur = Math.max(0, Math.min(maxHP(), cur + sign*amt("hpAmt")));
    saveChar(c); renderSheet();
  };
  el("hpM").onclick = hpAdj(-1); el("hpP").onclick = hpAdj(+1);
  el("hpFull").onclick = ()=>{ const c=charS(); c.hpCur=null; saveChar(c); renderSheet(); };

  // temp HP — sits on top of current HP, no maximum
  const htAdj = sign => ()=>{
    const c = charS();
    c.hpTemp = Math.max(0, (c.hpTemp|0) + sign*amt("htAmt"));
    saveChar(c); renderSheet();
  };
  el("htM").onclick = htAdj(-1); el("htP").onclick = htAdj(+1);
  el("htZero").onclick = ()=>{ const c=charS(); c.hpTemp=0; saveChar(c); renderSheet(); };

  // hit dice remaining — pool size scales with level
  el("hdMinus").onclick = ()=>{ const c=charS(); c.hdLeft=Math.max(0, hdLeft()-1); saveChar(c); renderSheet(); };
  el("hdPlus").onclick  = ()=>{ const c=charS(); c.hdLeft=Math.min(c.level, hdLeft()+1); saveChar(c); renderSheet(); };

  el("asiBody").addEventListener("change", e=>{
    const sel = e.target.closest("select[data-asi]");
    if(!sel) return;
    const c = charS();
    if(sel.value) c.asi[sel.dataset.asi] = sel.value; else delete c.asi[sel.dataset.asi];
    saveChar(c); refreshAll();
  });

  el("featAdd").onclick = ()=>{
    const v = el("featInput").value.trim();
    if(!v) return;
    const c = charS(); c.feats.push(v); saveChar(c);
    el("featInput").value = ""; renderSheet();
  };
  el("featList").addEventListener("click", e=>{
    const x = e.target.closest(".x");
    if(!x) return;
    const c = charS(); c.feats.splice(+x.dataset.feat,1); saveChar(c); renderSheet();
  });

  // permanent PE cap — player-counted, ±2 per tap
  el("capMinus").onclick = ()=>{ const c=charS(); c.capAdj=(c.capAdj|0)-2; saveChar(c); refreshAll(); };
  el("capPlus").onclick  = ()=>{ const c=charS(); c.capAdj=(c.capAdj|0)+2; saveChar(c); refreshAll(); };
}
