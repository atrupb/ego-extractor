"use strict";
/* ============ cross-device sync — one private GitHub gist is the cloud slot ============
   v2: per-key merge, the way a real database writes fields instead of files.
   Every synced key carries its own timestamp; a device only updates the keys it
   actually has newer versions of, so a stale device can no longer erase work it
   never knew about. Whole-state conflicts (and their popups) no longer exist —
   the worst case is the same key edited on two devices, where the newer edit wins.
   The gist keeps every revision, so History can restore any earlier snapshot. */

const CLOUD_KEYS = ["col","char","pe","loadout","gifts","slotPos","roster","syncAt","peStep"];
const GIST_FILE    = "ego-state-v2.json";
const GIST_FILE_V1 = "ego-state.json";   // read-only legacy: old app versions wrote here,
                                         // and new ones ignore their pushes entirely
const GIST_DESC = "ego-terminal-sync";

let cloudSilent = false;    // applying remote data — don't re-mark it dirty
let cloudReady  = false;    // the boot pull has settled — pushes may flow
let cloudBusy   = false;
let pushTimer   = null, lastPullTs = 0, cloudMsg = "", histList = null;

const ghToken = () => store.get("ghToken") || "";
const cloudOn = () => !!(ghToken() && store.get("gistId"));

/* util.js calls this after every store.set */
let writeSeq = 0;   // counts local edits so a push knows if typing continued mid-flight
function cloudTouch(k){
  if(cloudSilent || !CLOUD_KEYS.includes(k) || !cloudOn()) return;
  // writes before the boot pull settles are one-time migrations normalizing local
  // data, not player edits — they must not claim to be news
  if(!cloudReady) return;
  writeSeq++;
  const ka = store.get("cloudKeyAt") || {};
  ka[k] = new Date().toISOString();
  store.set("cloudKeyAt", ka);            // not a CLOUD_KEY — no recursion
  store.set("cloudDirty", true);
  renderCloud();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(cloudPush, 2500);
}

async function gh(path, opts){
  // no-store: the API sends max-age=60, and a cached GET makes the freshly
  // written gist look older than it is
  const res = await fetch("https://api.github.com" + path, Object.assign({}, opts, {
    cache: "no-store",
    headers: Object.assign({
      "Authorization": "Bearer " + ghToken(),
      "Accept": "application/vnd.github+json"
    }, (opts || {}).headers || {})
  }));
  if(!res.ok) throw new Error("github " + res.status);
  return res.json();
}

async function readGist(g){
  const f = g.files && (g.files[GIST_FILE] || g.files[GIST_FILE_V1]);
  if(!f) return null;
  try{
    const text = f.truncated ? await (await fetch(f.raw_url, {cache:"no-store"})).text() : f.content;
    return JSON.parse(text);
  }catch(e){ return null; }
}

function payloadNow(){
  const data = {};
  for(const k of CLOUD_KEYS){ const v = store.get(k); if(v !== null) data[k] = v; }
  return {v:2, at:new Date().toISOString(), keyAt: store.get("cloudKeyAt") || {}, data};
}

/* the age of one key in a payload. v1 payloads stamped nothing individually,
   so every key inherits the file stamp; in v2 an unstamped key is of unknown
   age and must never beat a stamped local one. */
function keyStamp(p, k){
  if((p.v|0) >= 2) return (p.keyAt && p.keyAt[k]) || "";
  return p.at || "";
}

/* fold a remote payload into local state, newest stamp per key.
   Returns true if local still holds something the remote lacks — i.e. push. */
function mergeRemote(p){
  const keyAt = store.get("cloudKeyAt") || {};
  let tookRemote = false, haveNewer = false;
  cloudSilent = true;
  try{
    for(const k of CLOUD_KEYS){
      if(k in p.data){
        const rAt = keyStamp(p, k), lAt = keyAt[k] || "";
        if(rAt > lAt){ store.set(k, p.data[k]); keyAt[k] = rAt; tookRemote = true; }
        else if(lAt > rAt) haveNewer = true;
      }else if(store.get(k) !== null) haveNewer = true;
    }
  }finally{ cloudSilent = false; }
  store.set("cloudKeyAt", keyAt);
  store.set("cloudAt", p.at);
  if(tookRemote) refreshAll();
  return haveNewer;
}

function fmtAt(iso){ try{ return new Date(iso).toLocaleString(); }catch(e){ return iso; } }
function cloudStatus(t){ cloudMsg = t; const s = el("cloudStat"); if(s) s.textContent = t; }

async function cloudPush(){
  clearTimeout(pushTimer);
  if(!cloudOn()) return;
  if(cloudBusy){ pushTimer = setTimeout(cloudPush, 3000); return; }
  cloudBusy = true; cloudStatus("uploading…");
  try{
    // adopt anything newer from the cloud first, then write the merged whole —
    // this push can only ever add news, never roll another device's keys back
    const remote = await readGist(await gh("/gists/" + store.get("gistId")));
    if(remote && (remote.v|0) >= 2) mergeRemote(remote);
    lastPullTs = Date.now();   // a push merges the cloud first — it counts as a check
    const seqAtSend = writeSeq;
    const p = payloadNow();
    await gh("/gists/" + store.get("gistId"), {method:"PATCH",
      body: JSON.stringify({files: {[GIST_FILE]: {content: JSON.stringify(p)}}})});
    store.set("cloudAt", p.at);
    // typing that happened while this upload was in flight is NOT in it —
    // stay dirty and follow up, or that typing would sit unsynced
    if(writeSeq === seqAtSend) store.set("cloudDirty", false);
    else{ clearTimeout(pushTimer); pushTimer = setTimeout(cloudPush, 1500); }
    cloudStatus("");
  }catch(e){
    cloudStatus("// offline — changes queued on this device");
  }
  cloudBusy = false;
  renderCloud();
}

async function cloudPull(){
  if(!cloudOn() || cloudBusy) return;
  cloudBusy = true; lastPullTs = Date.now(); cloudStatus("checking cloud…");
  let remote = null, failed = false;
  try{ remote = await readGist(await gh("/gists/" + store.get("gistId"))); }
  catch(e){ failed = true; }
  cloudBusy = false;
  cloudReady = true;
  if(failed){ cloudStatus("// offline — using this device's data"); renderCloud(); return; }
  let pushNeeded = !!store.get("cloudDirty");
  // a legacy v1 payload here means no device has written v2 yet — it only
  // matters at connect; established devices don't let it overwrite anything
  if(remote && (remote.v|0) >= 2) pushNeeded = mergeRemote(remote) || pushNeeded;
  else if(!remote) pushNeeded = true;   // v2 slot missing — seed it
  if(pushNeeded) return cloudPush();
  cloudStatus(""); renderCloud();
}

async function cloudConnect(){
  const tok = (el("ghTok").value || "").trim();
  if(!tok){ cloudStatus("// paste a token first"); return; }
  store.set("ghToken", tok);
  cloudBusy = true; cloudStatus("connecting…");
  try{
    let gist = null;
    for(let page = 1; page <= 3 && !gist; page++){
      const list = await gh("/gists?per_page=100&page=" + page);
      gist = list.find(g => g.description === GIST_DESC || (g.files && (g.files[GIST_FILE] || g.files[GIST_FILE_V1])));
      if(list.length < 100) break;
    }
    if(gist){
      // the cloud already exists — this device adopts it, then contributes its own news
      const remote = await readGist(await gh("/gists/" + gist.id));
      if(remote && !confirm("Cloud archive found (updated " + fmtAt(remote.at) + ").\n\nAdopt it onto this device?")){
        store.set("ghToken", null);
        cloudBusy = false; cloudStatus("// connection cancelled"); renderCloud(); return;
      }
      store.set("gistId", gist.id);
      store.set("cloudKeyAt", {});   // no claims — the cloud's stamps win everywhere
      cloudBusy = false; cloudReady = true;
      if(remote){ mergeRemote(remote); }
      store.set("cloudDirty", true); // upload the merged whole (covers local-only keys)
      await cloudPush();
    }else{
      // no cloud yet — this device's data becomes the seed, every key stamped now
      const p = payloadNow();
      const ka = {};
      for(const k of Object.keys(p.data)) ka[k] = p.at;
      p.keyAt = ka;
      const made = await gh("/gists", {method:"POST", body: JSON.stringify({
        description: GIST_DESC, public: false,
        files: {[GIST_FILE]: {content: JSON.stringify(p)}}
      })});
      store.set("gistId", made.id);
      store.set("cloudKeyAt", ka);
      store.set("cloudAt", p.at);
      store.set("cloudDirty", false);
      cloudBusy = false; cloudReady = true;
      cloudStatus("");
    }
  }catch(e){
    store.set("ghToken", null);
    cloudBusy = false;
    cloudStatus("// token rejected or offline — not connected");
  }
  renderCloud();
}

function cloudDisconnect(){
  if(!confirm("Disconnect this device from cloud sync? Data on this device stays as it is.")) return;
  store.set("ghToken", null); store.set("gistId", null);
  store.set("cloudAt", null); store.set("cloudDirty", false);
  store.set("cloudKeyAt", null);
  histList = null;
  cloudStatus(""); renderCloud();
}

/* ---- history: the gist keeps every revision — any snapshot can be restored ---- */
async function cloudHist(){
  cloudStatus("loading history…");
  try{
    const g = await gh("/gists/" + store.get("gistId"));
    histList = (g.history || []).slice(0, 15);
    cloudStatus("");
  }catch(e){ histList = null; cloudStatus("// offline"); }
  renderCloud();
}
async function cloudRestore(ver){
  cloudStatus("fetching snapshot…");
  try{
    const g = await gh("/gists/" + store.get("gistId") + "/" + ver);
    const p = await readGist(g);
    if(!p){ cloudStatus("// snapshot unreadable"); renderCloud(); return; }
    if(!confirm("Restore the snapshot from " + fmtAt(p.at) + "?\n\nIt becomes the newest version everywhere — current data is overwritten.")){
      cloudStatus(""); renderCloud(); return;
    }
    const now = new Date().toISOString();
    const keyAt = store.get("cloudKeyAt") || {};
    cloudSilent = true;
    try{
      for(const k of CLOUD_KEYS) if(k in p.data){ store.set(k, p.data[k]); keyAt[k] = now; }
    }finally{ cloudSilent = false; }
    store.set("cloudKeyAt", keyAt);
    store.set("cloudDirty", true);
    histList = null;
    refreshAll();
    renderCloud();
    cloudPush();
  }catch(e){ cloudStatus("// offline"); renderCloud(); }
}

function renderCloud(){
  const box = el("cloudBody"); if(!box) return;
  if(!cloudOn()){
    box.innerHTML =
      '<div class="syncnote" style="margin-top:0">Mirrors the archive, sheet, PE, prints and gifts across devices through a private GitHub gist. Create a <b>classic</b> token with only the <b>gist</b> scope and paste it on each device. The first device seeds the cloud with its data; later devices adopt the cloud copy.</div>'+
      '<div class="syncnote">github.com/settings/tokens/new?scopes=gist</div>'+
      '<div class="field"><label>GitHub token</label><input type="password" id="ghTok" placeholder="ghp_…" autocomplete="off"></div>'+
      '<button class="smallbtn accent" id="cloudConnBtn" style="margin-top:10px">Connect</button>'+
      '<div class="syncnote" id="cloudStat">'+esc(cloudMsg)+'</div>';
    el("cloudConnBtn").onclick = cloudConnect;
  }else if(histList){
    box.innerHTML =
      '<div class="picklabel" style="margin-top:0">Cloud history — tap a snapshot to restore it</div>'+
      histList.map(h=>'<div class="pickrow" data-hver="'+esc(h.version)+'"><span>'+fmtAt(h.committed_at)+'</span></div>').join("")+
      '<div class="row" style="margin-top:10px"><button class="smallbtn" id="cloudHistBack">Back</button></div>'+
      '<div class="syncnote" id="cloudStat">'+esc(cloudMsg)+'</div>';
    box.querySelectorAll("[data-hver]").forEach(r => r.onclick = ()=>cloudRestore(r.dataset.hver));
    el("cloudHistBack").onclick = ()=>{ histList = null; renderCloud(); };
  }else{
    const dirty = !!store.get("cloudDirty");
    box.innerHTML =
      '<div class="statrow"><span>Cloud slot</span><b>'+esc(String(store.get("gistId")).slice(0,10))+'…</b></div>'+
      '<div class="statrow"><span>Last sync</span><b class="'+(dirty?'':'t')+'">'+(store.get("cloudAt") ? esc(fmtAt(store.get("cloudAt"))) : "never")+'</b></div>'+
      (dirty ? '<div class="syncnote">// unsynced changes on this device</div>' : '')+
      '<div class="row" style="margin-top:10px">'+
        '<button class="smallbtn accent" id="cloudSyncBtn">Sync now</button>'+
        '<button class="smallbtn" id="cloudHistBtn">History</button>'+
        '<button class="smallbtn" id="cloudOffBtn">Disconnect</button>'+
      '</div>'+
      '<div class="syncnote" id="cloudStat">'+esc(cloudMsg)+'</div>';
    el("cloudSyncBtn").onclick = cloudPull;
    el("cloudHistBtn").onclick = cloudHist;
    el("cloudOffBtn").onclick = cloudDisconnect;
  }
}

function initCloud(){
  // first run of the per-key engine on an already-connected device: local data
  // was in sync through cloudAt, so every present key inherits that stamp —
  // without this, an old whole-file payload would outrank everything local
  if(cloudOn() && !store.get("cloudKeyAt")){
    const base = store.get("cloudAt") || new Date().toISOString();
    const ka = {};
    for(const k of CLOUD_KEYS) if(store.get(k) !== null) ka[k] = base;
    store.set("cloudKeyAt", ka);
  }
  renderCloud();
  if(cloudOn()) cloudPull();
  else cloudReady = true;
  // sync on every way a device can wake up, and steadily while it sits open —
  // resuming a phone app fires visibilitychange, not focus, which is why a
  // resumed phone used to sit on stale data until relaunched
  window.addEventListener("focus", ()=>cloudWake(5000));
  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden){ if(cloudOn() && store.get("cloudDirty")) cloudPush(); }
    else cloudWake(3000);
  });
  setInterval(()=>{ if(!document.hidden) cloudWake(40000); }, 45000);
}

/* one sync heartbeat: dirty devices push (which merges first), clean ones pull.
   minGap keeps wake-up storms from hammering the API. */
function cloudWake(minGap){
  if(!cloudOn() || cloudBusy || !cloudReady) return;
  if(Date.now() - lastPullTs < minGap) return;
  if(store.get("cloudDirty")){ cloudPush(); return; }
  // don't steal focus from an open editor — its keystrokes sync on push anyway
  const ae = document.activeElement;
  if(ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT")) return;
  cloudPull();
}
