// ===== AUDIO DIN DOM =====
const voce    = document.getElementById("voceThea");
const melodie = document.getElementById("bgPiano");
try { melodie.volume = 0.3; } catch (_) {}

// ===== ELEMENTE =====
const intro       = document.getElementById("intro");
const pagina2     = document.getElementById("pagina2");
const tapToStart  = document.getElementById("tapToStart");
const storyText   = document.querySelector(".story-text");
const h1          = document.querySelector(".story-overlay h1");
const starsLayer  = document.getElementById("starsLayer");

// ===== STRAT SCÂNTEI =====
let sparkLayer = document.getElementById("sparkLayer");
if (!sparkLayer) {
  sparkLayer = document.createElement("div");
  sparkLayer.id = "sparkLayer";
  Object.assign(sparkLayer.style, {
    position: "fixed", inset: "0", pointerEvents: "none", zIndex: "9999"
  });
  document.body.appendChild(sparkLayer);
}

// ===== PARAGRAFE =====
const lines = storyText ? Array.from(storyText.querySelectorAll(".story-line")) : [];

// ===== TIMPI (secunde) → index =====
const cues = [
  { time: 13.0, index: 0 },
  { time: 13.0, index: 1 },
  { time: 30.0, index: 2 },
  { time: 44.0, index: 3 },
  { time: 59.0, index: 4 },
  { time: 64.0, index: 5 },
];

// ===== UTILS & STATE =====
const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
let lastShownIndex = -1;
let autoScrollOnce = false;
let started = false;

function setFirstLineActive() {
  if (!lines.length) return;
  lines.forEach((el) => el.classList.remove("active", "leaving"));
  lines[0].classList.add("active");
  lastShownIndex = 0;
}

// Reset audio la 0:00 și asigură indexarea (fără muted/unmute)
function ensureFromZero(audioEl) {
  if (!audioEl) return;
  try {
    audioEl.pause();
    audioEl.currentTime = 0;
    if (audioEl.readyState < 2) audioEl.load();
    audioEl.playbackRate = 1;
  } catch (_) {}
}

// Promite când elementul e gata să redea din buffer
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

// ===== START EXACT DE LA 0 (desktop: încercare automată; mobil: la gest) =====
async function startPlayback() {
  ensureFromZero(voce);
  ensureFromZero(melodie);

  await waitCanPlay(voce); // important pentru „tăierea” primului cuvânt
  try {
    await voce.play();                 // pornește VOCEA exact de la 0.000
    melodie.play().catch(() => {});    // pian paralel (dacă e permis)
    if (tapToStart) tapToStart.style.display = "none";
    started = true;
  } catch {
    // pe unele browsere desktop tot cere gest; lăsăm overlay-ul
    if (tapToStart) tapToStart.style.display = "flex";
  }
}

function startByGesture() {
  if (started) return;
  startPlayback();
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  resetIntroState();
  if (!isTouch) {
    // Desktop: încearcă să pornească fără să piardă primul cuvânt
    startPlayback();
  } else {
    // Mobil: așteaptă tap
    if (tapToStart) tapToStart.style.display = "flex";
  }
});

// Dacă revii în tab și încă nu a pornit, mai încearcă (desktop)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !started && !isTouch) {
    startPlayback();
  }
});

// iOS bfcache
window.addEventListener("pageshow", (e) => { if (e.persisted) resetIntroState(); });

// ===== START LA TAP / ENTER / SPACE =====
// ===== START LA TAP / ENTER / SPACE (unified, single-run) =====
function userStartOnce(e) {
  if (started) return;
  started = true;

  // curăță listener-ele ca să nu ceară încă un tap
  if (tapToStart) {
    tapToStart.removeEventListener("pointerdown", userStartOnce);
    tapToStart.removeEventListener("click", userStartOnce);
  }
  document.removeEventListener("keydown", keyStartOnce);

  // pornește SINCRON exact de la 0
  try { voce.pause(); melodie.pause(); } catch(_) {}
  try { voce.currentTime = 0; melodie.currentTime = 0; } catch(_){}
  try { if (voce.readyState < 2) voce.load(); } catch(_){}
  try { if (melodie.readyState < 2) melodie.load(); } catch(_){}

  const p1 = voce.play();
  const p2 = melodie.play();

  Promise.allSettled([p1, p2]).then(res => {
    const ok = res.some(r => r.status === "fulfilled");
    if (ok) {
      if (tapToStart) tapToStart.style.display = "none";
    } else {
      // dacă a fost blocat, permitem încă un tap
      started = false;
      if (tapToStart) tapToStart.style.display = "flex";
      attachStartListeners();
    }
  });
}

function keyStartOnce(e) {
  if (tapToStart && tapToStart.style.display === "none") return;
  if (e.code === "Enter" || e.code === "Space") {
    e.preventDefault();
    userStartOnce(e);
  }
}

function attachStartListeners() {
  if (!tapToStart) return;
  // pointerdown acoperă touch + mouse (evită dublu-tap)
  tapToStart.addEventListener("pointerdown", userStartOnce, { once: false });
  // fallback dacă nu există pointer events
  tapToStart.addEventListener("click", userStartOnce, { once: false });
  document.addEventListener("keydown", keyStartOnce);
}

// inițializează listener-ele dacă overlay-ul e vizibil
if (tapToStart) attachStartListeners();

// ===== SINCRONIZARE TEXT + TITLU =====
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

voce.addEventListener("timeupdate", () => {
  const t = voce.currentTime;

  // Titlul vizibil până la 13s, apoi dispare
  if (h1) h1.style.opacity = t < 13 ? 1 : 0;

  let currentIndex = 0;
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i].time) currentIndex = cues[i].index;
  }
  setActiveLine(currentIndex);
});

// ===== TRANZIȚIE LA PAGINA 2 =====
voce.addEventListener("ended", () => {
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
});

// ===== SCÂNTEI =====
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

// ===== STELE =====
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

// ===== FORMULAR RSVP =====
// ===== FORMULAR RSVP =====
const rsvpForm = document.getElementById("rsvp-form");
if (rsvpForm) {
  rsvpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const numeEl = document.getElementById("nume");
    const persEl = document.getElementById("persoane");
    const prezEl = document.getElementById("prezenta");

    const nume = (numeEl?.value || "").trim();
    const persoane = parseInt(persEl?.value || "1", 10);
    const prezentaRaw = (prezEl?.value || "").trim().toLowerCase();

    // normalizare: "particip" / "nu"
    const status =
      prezentaRaw === "particip" || prezentaRaw === "participi" || prezentaRaw === "da"
        ? "particip"
        : "nu";

    if (!nume || !status) {
      alert("Te rog completeaza numele si daca vii sau nu.");
      return;
    }

    console.log("RSVP trimis:", { name: nume, persons: persoane, status });

    try {
      const resp = await fetch("https://invitatie-botez-thea.onrender.com/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nume, persons: persoane, status }),
      });

      const data = await resp.json().catch(() => ({}));
      console.log("Raspuns server:", resp.status, data);

      if (resp.ok && (data.ok || data.success)) {
        const msg = document.getElementById("rsvp-msg");
        if (msg) {
          msg.style.display = "block";
          msg.textContent = "Multumim! Am inregistrat confirmarea ta.";
        } else {
          alert("Multumim! Am inregistrat confirmarea ta.");
        }
        rsvpForm.reset();
      } else {
        alert(`Nu am putut trimite confirmarea (cod ${resp.status}).`);
      }
    } catch (err) {
      console.error(err);
      alert("Serverul nu raspunde (verifica conexiunea).");
    }
  });
}

// oprește pianul la parasirea paginii
window.addEventListener("beforeunload", () => { try { melodie.pause(); } catch (_) {} });

// ===== SKIP TO DETAILS + DEEP-LINK (#detalii) =====
(function(){
  const btnSkip  = document.getElementById("skipToDetails");
  const voceEl   = document.getElementById("voceThea");
  const pianEl   = document.getElementById("bgPiano");
  const introEl  = document.getElementById("intro");
  const pagina2El= document.getElementById("pagina2");
  const tapStart = document.getElementById("tapToStart");

  function goToPage2(){
    try { if (voceEl) { voceEl.pause(); voceEl.currentTime = 0; } } catch(_){}
    if (tapStart) tapStart.style.display = "none";

    if (introEl) introEl.classList.add("fade-out");
    setTimeout(() => {
      if (introEl)  { introEl.style.display = "none"; introEl.classList.remove("fade-out"); }
      if (pagina2El){ pagina2El.style.display = "block"; pagina2El.classList.add("fade-in"); }
      document.body.classList.remove("lock-scroll");
      try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (_){ window.scrollTo(0,0); }

      if (location.hash !== "#detalii") {
        try { history.replaceState(null, "", "#detalii"); } catch(_){}
      }
      if (pianEl && pianEl.paused) { try { pianEl.play(); } catch(_) {} }

      if (!window.__autoScrollOnceInvoked) {
        window.__autoScrollOnceInvoked = true;
        setTimeout(() => {
          const startY = window.scrollY;
          const endY = Math.max(0, document.body.scrollHeight - window.innerHeight);
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

  if (btnSkip) btnSkip.addEventListener("click", goToPage2);

  window.addEventListener("DOMContentLoaded", () => {
    if (location.hash === "#detalii") setTimeout(goToPage2, 60);
  });
})();

// === MENȚINE ECRANUL ACTIV (Wake Lock + fallback NoSleep) ===
let wakeLock = null;
let noSleep = null;

async function keepAwakeOn() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
      return;
    } catch (_) { /* fallback mai jos */ }
  }
  if (!noSleep) noSleep = new NoSleep();
  try { noSleep.enable(); } catch (_) {}
}

async function keepAwakeOff() {
  if (wakeLock) {
    try { await wakeLock.release(); } catch (_) {}
    wakeLock = null;
  }
  if (noSleep) {
    try { noSleep.disable(); } catch (_) {}
  }
}

// reactivează când utilizatorul revine în tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && voce && !voce.paused) {
    keepAwakeOn();
  } else {
    keepAwakeOff();
  }
});

// leagă de voce
voce.addEventListener('play',  keepAwakeOn);
voce.addEventListener('pause', keepAwakeOff);
voce.addEventListener('ended', keepAwakeOff);
