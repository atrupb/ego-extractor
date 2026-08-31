"use strict";
/* ============ tiny helpers shared by every module ============ */
const el = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => 1 + Math.floor(Math.random() * n);
const todayISO = () => new Date().toISOString().slice(0, 10);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

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
