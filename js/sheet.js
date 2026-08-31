"use strict";
/* ============ character sheet — merged stats, grades, derived numbers, session work ============ */

const PROF_DOT = ["○","●","◉"];   // none / proficient / expertise
const fmtMod = m => (m>=0?"+":"") + m;

function renderSheet(){
  const c = charS();
  renderStatCards(c);
  renderSaves(c);
  renderSkills(c);

  // derived block
  el("lvlVal").textContent = c.level;
  el("profVal").textContent = "+" + prof();
  el("hitDieSel").value = String(c.hitDie);
  el("hpMax").textContent = maxHP();
  const cur = c.hpCur === null ? maxHP() : Math.min(c.hpCur, maxHP());
  el("hpCurVal").textContent = cur;
  el("acVal").textContent = acVal();
  el("acMiscVal").textContent = (c.acMisc>=0?"+":"") + c.acMisc;
  const init = statMod("JUS");
  el("initVal").textContent = (init>=0?"+":"") + init;
  el("alephGate").textContent = prof() >= 4 ? "OPEN (prof +"+prof()+")" : "SEALED — needs prof +4 (lv 9+)";
  el("alephGate").style.color = prof() >= 4 ? "var(--zayin)" : "var(--red)";

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

  // feats
  el("featList").innerHTML = c.feats.length
    ? c.feats.map((f,i)=>'<div class="featrow"><span>'+esc(f)+'</span><span class="x" data-feat="'+i+'">×</span></div>').join("")
    : '<div class="syncnote" style="margin-top:0">// no feats recorded.</div>';

  // overflow-conversion log
  el("ovflList").innerHTML = c.overflow.length
    ? c.overflow.map(o=>'<div class="statrow"><span>'+o.date+' // '+STAT_NAME[o.stat]+' capped</span><b class="t">+2 PE cap</b></div>').join("")
    : '<div class="syncnote" style="margin-top:0">// no capped-stat conversions yet.</div>';
  el("capTotal").textContent = peCap();
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
    const mod = statMod(ABIL2MERGED[s.abil]) + lv * prof();
    return '<div class="profrow" data-skill="'+s.id+'">'+
      '<span class="pdot'+(lv?' on':'')+(lv===2?' ex':'')+'">'+PROF_DOT[lv]+'</span>'+
      '<span class="pname">'+s.name+'</span>'+
      '<span class="psrc">'+s.abil+'</span>'+
      '<span class="pmod">'+fmtMod(mod)+'</span></div>';
  }).join("");
  const pp = 10 + statMod("PRU") + (c.skills.perception|0) * prof();
  el("passPerc").textContent = pp;
}

function renderStatCards(c){
  const cap = statCapNow();
  el("statgrid").innerHTML = STATS.map(s=>{
    const st = c.stats[s.k];
    const cur = st.base + (st.tmp|0);
    const rank = gradeRank(cur);
    const mod = Math.floor((cur-10)/2);
    // progress toward next grade band
    let prog = 100;
    if(rank < 6){
      const lo = GRADE_FLOOR[rank], hi = GRADE_FLOOR[rank+1];
      prog = Math.max(0, Math.min(100, 100*(cur-lo)/(hi-lo)));
    }
    const capped = st.base >= cap;
    return '<div class="statcard">'+
      '<div class="sname">'+s.name+'</div><div class="ssub">'+esc(s.sub)+'</div>'+
      '<div class="srow">'+
        '<div class="score">'+cur+(st.tmp?'<small> ('+st.base+(st.tmp>0?'+':'')+st.tmp+')</small>':'')+'</div>'+
        '<div class="gradebadge'+(rank===6?' ex':'')+'">'+GRADE_NAMES[rank]+'</div>'+
      '</div>'+
      '<div class="modline">MOD <b>'+(mod>=0?'+':'')+mod+'</b></div>'+
      '<div class="prog"><i style="width:'+prog+'%"></i></div>'+
      '<div class="capnote">'+(rank===6 ? '<span class="warn">EX — external effect</span>'
        : 'next: '+GRADE_NAMES[rank+1]+' at '+GRADE_FLOOR[rank+1])+
        (capped?' <span class="warn">// CAP '+cap+'</span>':' // cap '+cap)+'</div>'+
      '<div class="microbtns">'+
        '<button class="microbtn" data-k="'+s.k+'" data-act="b-">−</button>'+
        '<button class="microbtn" data-k="'+s.k+'" data-act="b+">+</button>'+
        '<button class="microbtn accent" data-k="'+s.k+'" data-act="t-">T−</button>'+
        '<button class="microbtn accent" data-k="'+s.k+'" data-act="t+">T+</button>'+
      '</div>'+
      '<button class="workbtn" data-k="'+s.k+'" data-act="work">'+
        (capped ? 'WORK → +2 PE CAP' : 'WORK +1')+
        '<small>'+esc(s.work)+'</small></button>'+
    '</div>';
  }).join("");
}

function initSheet(){
  // stat card buttons (base is real growth — capped; temp models external effects and can reach EX)
  el("statgrid").addEventListener("click", e=>{
    const b = e.target.closest("button");
    if(!b) return;
    const c = charS(), k = b.dataset.k, st = c.stats[k];
    switch(b.dataset.act){
      case "b+": st.base = Math.min(statCapNow(), st.base+1); break;
      case "b-": st.base = Math.max(3, st.base-1); break;
      case "t+": st.tmp = Math.min(15, (st.tmp|0)+1); break;
      case "t-": st.tmp = Math.max(-15, (st.tmp|0)-1); break;
      case "work":
        if(st.base < statCapNow()) st.base++;
        else c.overflow.push({date:todayISO(), stat:k});  // capped: converts to +2 permanent PE cap
        break;
    }
    saveChar(c);
    refreshAll();
  });

  // saves toggle proficiency; skills cycle none → prof → expertise
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
  el("hitDieSel").onchange = ()=>{ const c=charS(); c.hitDie=+el("hitDieSel").value; saveChar(c); refreshAll(); };
  el("acMinus").onclick = ()=>{ const c=charS(); c.acMisc=(c.acMisc|0)-1; saveChar(c); renderSheet(); };
  el("acPlus").onclick  = ()=>{ const c=charS(); c.acMisc=(c.acMisc|0)+1; saveChar(c); renderSheet(); };

  // HP is derived (never hand-entered); current HP is just table damage tracking
  const hpAdj = d => ()=>{
    const c = charS();
    const cur = c.hpCur === null ? maxHP() : c.hpCur;
    c.hpCur = Math.max(0, Math.min(maxHP(), cur + d));
    saveChar(c); renderSheet();
  };
  el("hpM5").onclick = hpAdj(-5); el("hpM1").onclick = hpAdj(-1);
  el("hpP1").onclick = hpAdj(+1); el("hpP5").onclick = hpAdj(+5);
  el("hpFull").onclick = ()=>{ const c=charS(); c.hpCur=null; saveChar(c); renderSheet(); };

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
}
