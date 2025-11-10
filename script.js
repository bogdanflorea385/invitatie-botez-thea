// =========================
// CONFIG BACKEND (Render)
// =========================
const BACKEND = "https://invitatie-botez-thea.onrender.com"; // foloseste fix acest URL

// =========================
// UTILS DOM
// =========================
const $ = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);
const getVal = (...ids) => {
  for (const id of ids) {
    const el = byId(id);
    if (el && typeof el.value !== "undefined") return el.value;
  }
  return "";
};

// =========================
// AUDIO DIN DOM (optional)
// =========================
const voce    = byId("voceThea");
const melodie = byId("bgPiano");
try { if (melodie) melodie.volume = 0.3; } catch (_) {}

// =========================
// ELEMENTE & STRATURI
// =========================
const intro      = byId("intro");
const pagina2    = byId("pagina2");
const tapToStart = byId("tapToStart");
const storyText  = $(".story-text");
const h1         = $(".story-overlay h1");
const starsLayer = byId("starsLayer");

// Strat scantei (lazy create)
let sparkLayer = byId("sparkLayer");
if (!sparkLayer) {
  sparkLayer = document.createElement("div");
  sparkLayer.id = "sparkLayer";
  Object.assign(sparkLayer.style, {
    position: "fixed", inset: "0", pointerEvents: "none", zIndex: "9999"
  });
  document.body.appendChild(sparkLayer);
}

// =========================
/* TEXT NARATIV (cues) */
// =========================
const lines = storyText ? Array.from(storyText.querySelectorAll(".story-line")) : [];
const cues = [
  { time: 13.0, index: 0 },
  { time: 13.0, index: 1 },
  { time: 30.0, index: 2 },
  { time: 44.0, index: 3 },
  { time: 59.0, index: 4 },
  { time: 64.0, index: 5 },
];

const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
let lastShownIndex = -1;
let autoScrollOnce = false;
let started = false;

// =========================
// INIT & PLAYBACK CONTROL
// =========================
function setFirstLineActive() {
  if (!lines.length) return;
  lines.forEach((el) => el.classList.remove("active", "leaving"));
  lines[0].classList.add("active");
  lastShownIndex = 0;
}

function ensureFromZero(audioEl) {
  if (!audioEl) return;
  try {
    audioEl.pause();
    audioEl.currentTime = 0;
    if (audioEl.readyState < 2) audioEl.load();
    audioEl.playbackRate = 1;
  } catch (_) {}
}

function waitCanPlay(audioEl) {
  return new Promise((resolve) => {
    if (!audioEl) return resolve();
    if (audioEl.readyState >= 2) return resolve();
    audioEl.addEventListener("canplay", resolve, { once: true });
  });
}

function resetIntroState() {
  ensureFromZero(voce);
  ensureFromZero(melodie);

  if (intro)  { intro.style.display = "";  intro.classList.remove("fade-out"); }
  if (pagina2){ pagina2.style.display = "none"; pagina2.classList.remove("fade-in"); }
  document.body.classList.add("lock-scroll");

  if (tapToStart) {
    tapToStart.style.display = "flex";
    tapToStart.textContent = "Apasa pentru a porni povestea 🌙";
  }
  setFirstLineActive();
  if (h1) { h1.style.opacity = 1; h1.style.transition = "opacity 800ms ease"; }
  started = false;
}

async function startPlayback() {
  ensureFromZero(voce);
  ensureFromZero(melodie);

  await waitCanPlay(voce);
  try {
    await voce?.play();
    melodie?.play?.();
    if (tapToStart) tapToStart.style.display = "none";
    started = true;
  } catch {
    if (tapToStart) tapToStart.style.display = "flex";
  }
}

function startByGesture() {
  if (started) return;
  startPlayback();
}

document.addEventListener("DOMContentLoaded", () => {
  resetIntroState();
  if (!isTouch) startPlayback();
  else if (tapToStart) tapToStart.style.display = "flex";
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !started && !isTouch) startPlayback();
});
window.addEventListener("pageshow", (e) => { if (e.persisted) resetIntroState(); });

// Single-run handlers
function keyStartOnce(e) {
  if (tapToStart && tapToStart.style.display === "none") return;
  if (e.code === "Enter" || e.code === "Space") {
    e.preventDefault();
    userStartOnce();
  }
}
function attachStartListeners() {
  if (!tapToStart) return;
  tapToStart.addEventListener("pointerdown", userStartOnce, { once: false });
  tapToStart.addEventListener("click", userStartOnce, { once: false });
  document.addEventListener("keydown", keyStartOnce);
}
function userStartOnce() {
  if (started) return;
  started = true;

  tapToStart?.removeEventListener("pointerdown", userStartOnce);
  tapToStart?.removeEventListener("click", userStartOnce);
  document.removeEventListener("keydown", keyStartOnce);

  try { voce?.pause(); melodie?.pause(); } catch(_) {}
  try { if (voce) voce.currentTime = 0; if (melodie) melodie.currentTime = 0; } catch(_){}
  if (voce && voce.readyState < 2) try { voce.load(); } catch(_){}
  if (melodie && melodie.readyState < 2) try { melodie.load(); } catch(_){}

  const p1 = voce?.play?.();
  const p2 = melodie?.play?.();

  Promise.allSettled([p1, p2]).then(res => {
    const ok = res.some(r => r && r.status === "fulfilled");
    if (ok) tapToStart && (tapToStart.style.display = "none");
    else {
      started = false;
      tapToStart && (tapToStart.style.display = "flex");
      attachStartListeners();
    }
  });
}
if (tapToStart) attachStartListeners();

// =========================
// SINCRONIZARE TEXT + TITLU
// =========================
function setActiveLine(newIndex) {
  if (!lines.length) return;
  if (newIndex === lastShownIndex) return;

  const current = lines[lastShownIndex];
  const next    = lines[newIndex];
  if (!next) return;

  lines.forEach((l, i) => { if (i !== newIndex) l.classList.remove("active", "leaving"); });
  if (current) {
    current.classList.remove("active");
    current.classList.add("leaving");
    current.addEventListener("animationend", () => current.classList.remove("leaving"), { once: true });
  }
  next.classList.add("active");
  createSparks(storyText || next);
  lastShownIndex = newIndex;
}

voce?.addEventListener("timeupdate", () => {
  const t = voce.currentTime || 0;
  if (h1) h1.style.opacity = t < 13 ? 1 : 0;

  let currentIndex = 0;
  for (let i = 0; i < cues.length; i++) if (t >= cues[i].time) currentIndex = cues[i].index;
  setActiveLine(currentIndex);
});

// =========================
// TRANZITIE LA PAGINA 2
// =========================
voce?.addEventListener("ended", () => goToPage2());

function goToPage2(){
  if (intro) intro.classList.add("fade-out");
  setTimeout(() => {
    if (intro)  { intro.style.display = "none"; intro.classList.remove("fade-out"); }
    if (pagina2){ pagina2.style.display = "block"; pagina2.classList.add("fade-in"); }
    document.body.classList.remove("lock-scroll");
    try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (_) { window.scrollTo(0, 0); }

    if (!autoScrollOnce) {
      autoScrollOnce = true;
      setTimeout(() => {
        const startY = window.scrollY;
        const endY   = Math.max(0, document.body.scrollHeight - window.innerHeight);
        if (endY <= startY + 2) return;

        const duration = 8500;
        const startTime = performance.now();
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        function smoothScroll(now){
          const elapsed  = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased    = easeOutCubic(progress);
          const currentY = startY + (endY - startY) * eased;
          window.scrollTo(0, currentY);
          if (progress < 1) requestAnimationFrame(smoothScroll);
        }
        requestAnimationFrame(smoothScroll);
      }, 1500);
    }
  }, 2000);
}

// =========================
// SCANTEI
// =========================
function createSparks(anchorEl) {
  if (!sparkLayer || !anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const count = 24;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("div");
    s.className = "spark";
    const x = rect.left + rect.width/2 + (Math.random()-0.5)*rect.width*0.5;
    const y = rect.top  + rect.height/2 + (Math.random()-0.5)*rect.height*0.3;
    s.style.left = `${x}px`; s.style.top = `${y}px`;
    const tx = (Math.random()-0.5)*180; const ty = 100 + Math.random()*120;
    s.style.setProperty("--tx", `${tx}px`);
    s.style.setProperty("--ty", `${ty}px`);
    const colors = [["#fff8cc","#ffe49b"],["#ffffff","#e0dfff"],["#ffd7f5","#ffc2e9"]];
    const pick = colors[Math.floor(Math.random()*colors.length)];
    s.style.setProperty("--sparkColor1", pick[0]);
    s.style.setProperty("--sparkColor2", pick[1]);
    sparkLayer.appendChild(s);
    setTimeout(() => s.remove(), 3600);
  }
}

// =========================
// STELE
// =========================
function createStar(){
  if (!starsLayer) return;
  const star=document.createElement("div");
  star.className="shooting-star";
  star.style.top=(5+Math.random()*90)+"vh";
  star.style.left=(10+Math.random()*70)+"vw";
  starsLayer.appendChild(star);
  setTimeout(()=>star.remove(),2200);
}
(function loopStars(){ createStar(); setTimeout(loopStars, 800+Math.random()*1800); })();

// =========================
// FORMULAR RSVP (corectat)
// =========================
const rsvpForm = byId("rsvp-form"); // <form id="rsvp-form">...</form>

async function postJSON(url, body, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
        // nu folosi "no-cors"
      });
      if (r.ok) return r;
      const txt = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} ${txt}`);
    } catch (e) {
      if (i === tries - 1) throw e;              // dupa ultimul retry, propaga
      await new Promise(res => setTimeout(res, 4000)); // retry la cold-start Render
    }
  }
}

if (rsvpForm) {
  rsvpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Accepta mai multe denumiri de campuri din HTML
    const nume      = (getVal("nume", "name") || "").trim();
    const persoaneV = (getVal("numar_persoane", "persoane", "persons") || "1").trim();
    const prezRaw   = (getVal("prezenta", "status") || "").trim().toLowerCase();
    const note      = (getVal("note", "mesaj") || "").trim();
    const phone     = (getVal("phone", "telefon") || "").trim();

    const persoane = Number.parseInt(persoaneV, 10);
    // mapare robusta: da/particip/particip, nu/non
    const status = ["da", "particip", "participa", "participi"].includes(prezRaw) ? "particip"
                  : ["nu", "nu particip", "nu_particip"].includes(prezRaw)        ? "nu"
                  : (prezRaw === "particip" ? "particip" : (prezRaw === "nu" ? "nu" : ""));

    if (!nume) { alert("Te rog completeaza numele."); return; }
    if (!Number.isFinite(persoane) || persoane < 1) { alert("Alege numarul de persoane."); return; }
    if (!status) { alert("Alege daca participi."); return; }

    try {
      const resp = await postJSON(`${BACKEND}/rsvp`, { nume, persoane, status, note, phone });
      const data = await resp.json().catch(() => ({}));

      const msg = byId("rsvp-msg");
      if (msg) {
        msg.style.display = "block";
        msg.textContent = "Multumim! Confirmarea a fost trimisa.";
      } else {
        alert("Multumim! Confirmarea a fost trimisa.");
      }
      rsvpForm.reset();
    } catch (err) {
      console.error("RSVP error:", err);
      alert("Nu am putut trimite. Verifica conexiunea sau backend-ul. " + (err?.message || ""));
    }
  });
}

// =========================
// SKIP TO DETAILS + #detalii
// =========================
(function(){
  const btnSkip  = byId("skipToDetails");

  function goToDetails(){
    try { if (voce) { voce.pause(); voce.currentTime = 0; } } catch(_){}
    if (tapToStart) tapToStart.style.display = "none";
    goToPage2();
    if (location.hash !== "#detalii") {
      try { history.replaceState(null, "", "#detalii"); } catch(_){}
    }
    if (melodie && melodie.paused) { try { melodie.play(); } catch(_) {} }
  }

  btnSkip?.addEventListener("click", goToDetails);
  window.addEventListener("DOMContentLoaded", () => {
    if (location.hash === "#detalii") setTimeout(goToDetails, 60);
  });
})();

// =========================
// WAKE LOCK (optional)
// =========================
let wakeLock = null;
let noSleep = null;

async function keepAwakeOn() {
  if ("wakeLock" in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
      return;
    } catch (_) {}
  }
  // fallback doar daca NoSleep exista
  if (!noSleep && typeof NoSleep !== "undefined") noSleep = new NoSleep();
  try { noSleep?.enable?.(); } catch (_) {}
}

async function keepAwakeOff() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch (_) {}
    wakeLock = null;
  }
  try { noSleep?.disable?.(); } catch (_) {}
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && voce && !voce.paused) keepAwakeOn();
  else keepAwakeOff();
});
voce?.addEventListener("play",  keepAwakeOn);
voce?.addEventListener("pause", keepAwakeOff);
voce?.addEventListener("ended", keepAwakeOff);

// =========================
// HOUSEKEEPING
// =========================
window.addEventListener("beforeunload", () => { try { melodie?.pause?.(); } catch (_) {} });
