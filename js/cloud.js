"use strict";
/* ============ cross-device sync — one private GitHub gist is the cloud slot ============
   The first device to connect seeds the gist from its local storage; every other
   device that connects with the same token adopts the cloud copy. After that,
   every change pushes automatically (debounced) and every launch/focus pulls. */

const CLOUD_KEYS = ["col","char","pe","loadout","gifts","slotPos","roster","syncAt","peStep","lockHash"];
const GIST_FILE = "ego-state.json";
const GIST_DESC = "ego-terminal-sync";

let cloudSilent = false;    // applying remote data — don't re-mark it dirty
let cloudReady  = false;    // the boot pull has settled — pushes may flow
let cloudBusy   = false;
let pushTimer   = null, lastPullTs = 0, cloudMsg = "";

const ghToken = () => store.get("ghToken") || "";
const cloudOn = () => !!(ghToken() && store.get("gistId"));

/* util.js calls this after every store.set */
function cloudTouch(k){
  if(cloudSilent || !CLOUD_KEYS.includes(k) || !cloudOn()) return;
  store.set("cloudDirty", true);          // not a CLOUD_KEY — no recursion
  renderCloud();
  clearTimeout(pushTimer);
  if(cloudReady) pushTimer = setTimeout(cloudPush, 2500);
}

async function gh(path, opts){
  const res = await fetch("https://api.github.com" + path, Object.assign({}, opts, {
    headers: Object.assign({
      "Authorization": "Bearer " + ghToken(),
      "Accept": "application/vnd.github+json"
    }, (opts || {}).headers || {})
  }));
  if(!res.ok) throw new Error("github " + res.status);
  return res.json();
}

async function readGist(g){
  const f = g.files && g.files[GIST_FILE];
  if(!f) return null;
  try{
    const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    return JSON.parse(text);
  }catch(e){ return null; }
}

function payloadNow(){
  const data = {};
  for(const k of CLOUD_KEYS){ const v = store.get(k); if(v !== null) data[k] = v; }
  return {v:1, at:new Date().toISOString(), data};
}

function applyRemote(remote){
  cloudSilent = true;
  try{ for(const k of CLOUD_KEYS) if(k in remote.data) store.set(k, remote.data[k]); }
  finally{ cloudSilent = false; }
  store.set("cloudAt", remote.at);
  store.set("cloudDirty", false);
  refreshAll();
}

function fmtAt(iso){ try{ return new Date(iso).toLocaleString(); }catch(e){ return iso; } }
function cloudStatus(t){ cloudMsg = t; const s = el("cloudStat"); if(s) s.textContent = t; }

/* both sides changed since they last agreed — the operator picks a survivor */
function resolveConflict(remote){
  const loadCloud = confirm("Another device updated the cloud (" + fmtAt(remote.at) + "), and this device also has unsynced changes.\n\nOK — load the cloud version (this device's unsynced changes are lost)\nCancel — keep this device's version and overwrite the cloud");
  if(loadCloud){ applyRemote(remote); cloudStatus(""); renderCloud(); }
  else{ store.set("cloudAt", remote.at); cloudPush(); }
}

async function cloudPush(){
  clearTimeout(pushTimer);
  if(!cloudOn()) return;
  if(cloudBusy){ pushTimer = setTimeout(cloudPush, 3000); return; }
  cloudBusy = true; cloudStatus("uploading…");
  try{
    // refuse to clobber a version this device hasn't seen
    const remote = await readGist(await gh("/gists/" + store.get("gistId")));
    const seen = store.get("cloudAt");
    if(remote && seen && remote.at !== seen){
      cloudBusy = false; cloudStatus("");
      resolveConflict(remote);
      return;
    }
    const p = payloadNow();
    await gh("/gists/" + store.get("gistId"), {method:"PATCH",
      body: JSON.stringify({files: {[GIST_FILE]: {content: JSON.stringify(p)}}})});
    store.set("cloudAt", p.at);
    store.set("cloudDirty", false);
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
  const seen = store.get("cloudAt"), dirty = !!store.get("cloudDirty");
  if(!remote || remote.at === seen){
    if(dirty) return cloudPush();
    cloudStatus(""); renderCloud(); return;
  }
  if(dirty) return resolveConflict(remote);
  applyRemote(remote);
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
      gist = list.find(g => g.description === GIST_DESC || (g.files && g.files[GIST_FILE]));
      if(list.length < 100) break;
    }
    if(gist){
      // the cloud already exists — this device adopts it
      const remote = await readGist(await gh("/gists/" + gist.id));
      if(remote && !confirm("Cloud archive found (updated " + fmtAt(remote.at) + ").\n\nLoad it onto this device? Data currently on this device is replaced.")){
        store.set("ghToken", null);
        cloudBusy = false; cloudStatus("// connection cancelled"); renderCloud(); return;
      }
      store.set("gistId", gist.id);
      cloudBusy = false; cloudReady = true;
      if(remote){ applyRemote(remote); cloudStatus(""); }
      else{ store.set("cloudDirty", true); await cloudPush(); }
    }else{
      // no cloud yet — this device's data becomes the seed
      const p = payloadNow();
      const made = await gh("/gists", {method:"POST", body: JSON.stringify({
        description: GIST_DESC, public: false,
        files: {[GIST_FILE]: {content: JSON.stringify(p)}}
      })});
      store.set("gistId", made.id);
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
  cloudStatus(""); renderCloud();
}

function renderCloud(){
  const box = el("cloudBody"); if(!box) return;
  if(!cloudOn()){
    box.innerHTML =
      '<div class="syncnote" style="margin-top:0">Mirrors the archive, sheet, PE, prints, gifts and passcode across devices through a private GitHub gist. Create a <b>classic</b> token with only the <b>gist</b> scope and paste it on each device. The first device seeds the cloud with its data; later devices adopt the cloud copy.</div>'+
      '<div class="syncnote">github.com/settings/tokens/new?scopes=gist</div>'+
      '<div class="field"><label>GitHub token</label><input type="password" id="ghTok" placeholder="ghp_…" autocomplete="off"></div>'+
      '<button class="smallbtn accent" id="cloudConnBtn" style="margin-top:10px">Connect</button>'+
      '<div class="syncnote" id="cloudStat">'+esc(cloudMsg)+'</div>';
    el("cloudConnBtn").onclick = cloudConnect;
  }else{
    const dirty = !!store.get("cloudDirty");
    box.innerHTML =
      '<div class="statrow"><span>Cloud slot</span><b>'+esc(String(store.get("gistId")).slice(0,10))+'…</b></div>'+
      '<div class="statrow"><span>Last sync</span><b class="'+(dirty?'':'t')+'">'+(store.get("cloudAt") ? esc(fmtAt(store.get("cloudAt"))) : "never")+'</b></div>'+
      (dirty ? '<div class="syncnote">// unsynced changes on this device</div>' : '')+
      '<div class="row" style="margin-top:10px">'+
        '<button class="smallbtn accent" id="cloudSyncBtn">Sync now</button>'+
        '<button class="smallbtn" id="cloudOffBtn">Disconnect</button>'+
      '</div>'+
      '<div class="syncnote" id="cloudStat">'+esc(cloudMsg)+'</div>';
    el("cloudSyncBtn").onclick = cloudPull;
    el("cloudOffBtn").onclick = cloudDisconnect;
  }
}

function initCloud(){
  renderCloud();
  if(cloudOn()) cloudPull();
  else cloudReady = true;
  window.addEventListener("focus", ()=>{
    if(cloudOn() && Date.now() - lastPullTs > 60000) cloudPull();
  });
  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden && cloudOn() && store.get("cloudDirty")) cloudPush();
  });
}
