"use strict";
/* ============ passcode gate — a door lock on the terminal, not a vault ============
   The hash lives in synced storage, so one passcode covers every device.
   Unlock lasts for the app session; relaunching the app asks again. */

let lockMode = "unlock";   // unlock | setup | verify (verify → setup = change passcode)

async function pwHash(pw){
  try{
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ego::" + pw));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }catch(e){
    // non-secure context fallback (dev previews) — djb2, clearly marked
    let h = 5381; const s = "ego::" + pw;
    for(let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return "x" + h.toString(16);
  }
}

function lockShow(mode){
  lockMode = mode;
  el("lockPw").value = ""; el("lockPw2").value = "";
  el("lockPw2").style.display = mode === "setup" ? "" : "none";
  el("lockBtn").textContent = mode === "setup" ? "Set passcode" : mode === "verify" ? "Confirm" : "Unlock";
  // nothing to cancel back to on first-run setup or a locked terminal
  el("lockCancel").style.display = mode !== "unlock" && store.get("lockHash") ? "" : "none";
  const m = el("lockMsg");
  m.classList.remove("bad");
  m.textContent = mode === "setup" ? "// set an operator passcode for this terminal"
    : mode === "verify" ? "// enter the current passcode" : "// enter passcode";
  el("lockscreen").classList.add("on");
  el("lockPw").focus();
}
function lockHide(){ el("lockscreen").classList.remove("on"); }
function lockFail(t){
  const m = el("lockMsg");
  m.classList.add("bad"); m.textContent = t;
  el("lockPw").value = ""; el("lockPw").focus();
}

async function lockSubmit(){
  const pw = el("lockPw").value;
  if(!pw) return;
  if(lockMode === "setup"){
    if(pw !== el("lockPw2").value) return lockFail("// passcodes do not match");
    store.set("lockHash", await pwHash(pw));
    try{ sessionStorage.setItem("egoUnlocked", "1"); }catch(e){}
    lockHide(); return;
  }
  if((await pwHash(pw)) !== store.get("lockHash")) return lockFail("// access denied");
  if(lockMode === "verify"){ lockShow("setup"); return; }
  try{ sessionStorage.setItem("egoUnlocked", "1"); }catch(e){}
  lockHide();
}

function lockNow(){
  try{ sessionStorage.removeItem("egoUnlocked"); }catch(e){}
  lockShow("unlock");
}

function initLock(){
  el("lockBtn").onclick = lockSubmit;
  el("lockCancel").onclick = lockHide;
  const enter = e => { if(e.key === "Enter") lockSubmit(); };
  el("lockPw").addEventListener("keydown", enter);
  el("lockPw2").addEventListener("keydown", enter);
  el("lockNowBtn").onclick = lockNow;
  el("chpassBtn").onclick = () => lockShow("verify");
  let unlocked = false;
  try{ unlocked = sessionStorage.getItem("egoUnlocked") === "1"; }catch(e){}
  if(!store.get("lockHash")) lockShow("setup");
  else if(!unlocked) lockShow("unlock");
}
