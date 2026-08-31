"use strict";
/* ============ tiny helpers shared by every module ============ */
const el = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => 1 + Math.floor(Math.random() * n);
const todayISO = () => new Date().toISOString().slice(0, 10);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* tiny markdown for player-written notes: **bold**, *italic*, `code`,
   # heading lines, - or * bullet lists. Escapes first — input is the player's text. */
function mdLite(src){
  const inline = s => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = [];
  let list = null;
  for(const line of String(src).split("\n")){
    const m = line.match(/^\s*[-*]\s+(.*)/);
    if(m){ (list = list || []).push("<li>"+inline(m[1])+"</li>"); continue; }
    if(list){ out.push("<ul>"+list.join("")+"</ul>"); list = null; }
    const h = line.match(/^#+\s+(.*)/);
    if(h){ out.push('<div class="mdh">'+inline(h[1])+"</div>"); continue; }
    if(line.trim() === ""){ out.push('<div class="mdgap"></div>'); continue; }
    out.push("<div>"+inline(line)+"</div>");
  }
  if(list) out.push("<ul>"+list.join("")+"</ul>");
  return out.join("");
}

function sample(pool, n){
  const p = [...pool];
  for(let i = p.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p.slice(0, n);
}

/* ============ safe storage (memory fallback for sandboxed previews) ============ */
const mem = {};
const store = {
  get(k){ try{ const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : (k in mem ? mem[k] : null); }catch(e){ return k in mem ? mem[k] : null; } },
  set(k, v){
    mem[k] = v;
    try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){}
    // cloud.js watches writes so synced keys auto-upload; guard: it loads later
    if(typeof cloudTouch === "function") try{ cloudTouch(k); }catch(e){}
  }
};
