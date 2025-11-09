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

// ===== STRAT SCANTEI =====
let sparkLayer = document.getElementById("sparkLayer");
if (!sparkLayer) {
  sparkLayer = document.createElement("div");
  sparkLayer.id = "sparkLayer";
  sparkLayer.style.position = "fixed";
  sparkLayer.style.inset = "0";
  sparkLayer.style.pointerEvents = "none";
  sparkLayer.style.zIndex = "9999";
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

// ===== STATE =====
let lastShownIndex = -1;
let autoScrollOnce = false;

// ===== HELPERS =====
function setFirstLineActive() {
  if (!lines.length) return;
  lines.forEach((el) => el.classList.remove("active", "leaving"));
  lines[0].classList.add("active");
  lastShownIndex = 0;
}

function resetIntroState() {
  try { voce.pause(); voce.currentTime = 0; } catch(_) {}
  try { melodie.pause(); melodie.currentTime = 0; } catch(_) {}

  if (intro)  { intro.style.display = "";  intro.classList.remove("fade-out"); }
  if (pagina2){ pagina2.style.display = "none"; pagina2.classList.remove("fade-in"); }
  document.body.classList.add("lock-scroll");

  if (tapToStart) {
    tapToStart.style.display = "flex";
    tapToStart.textContent = "Apasa pentru a porni povestea 🌙";
  }
  setFirstLineActive();
  if (h1) h1.style.opacity = 1;
}

// ===== AUTOPLAY FARA CLICK (pian -> voce) =====
async function autoplaySequence() {
  try {
    // 1) pornim pianul discret
    melodie.muted = true;
    await melodie.play();
    setTimeout(() => { melodie.muted = false; }, 300);

    // 2) dupa un mic delay pornim vocea
    setTimeout(async () => {
      try {
        voce.muted = false;
        await voce.play();
        if (tapToStart) tapToStart.style.display = "none";
        if (h1) setTimeout(() => { h1.style.opacity = 0; }, 13000);
      } catch {
        // daca vocea e blocata, afisam fallback
        if (tapToStart) tapToStart.style.display = "flex";
      }
    }, 700);
  } catch {
    // daca chiar si pianul e blocat, folosim fallback pe gest
    if (tapToStart) tapToStart.style.display = "flex";
  }
}

// ===== FALLBACK LA GEST =====
function startByGesture() {
  // pornim imediat pianul si apoi vocea
  try { melodie.play().catch(() => {}); } catch(_) {}
  try {
    voce.play().then(() => {
      if (tapToStart) tapToStart.style.display = "none";
      if (h1) setTimeout(() => { h1.style.opacity = 0; }, 13000);
    }).catch(() => {
      if (tapToStart) tapToStart.style.display = "flex";
    });
  } catch(_) {}
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  resetIntroState();
  autoplaySequence(); // incercare fara click pe toate device-urile
});

// re-incercare cand revii in tab (unele mobile permit apoi)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && tapToStart && tapToStart.style.display !== "none") {
    autoplaySequence();
  }
});

// iOS bfcache
window.addEventListener("pageshow", (e) => { if (e.persisted) resetIntroState(); });

// ===== START LA TAP / ENTER / SPACE =====
if (tapToStart) {
  const run = (e) => { e && e.preventDefault && e.preventDefault(); startByGesture(); };
  tapToStart.addEventListener("click", run);
  tapToStart.addEventListener("touchstart", run, { passive: false });
  document.addEventListener("keydown", (e) => {
    if (tapToStart.style.display === "none") return;
    if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); startByGesture(); }
  });
}

// ===== SINCRONIZARE TEXT PE AUDIO =====
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
  let currentIndex = 0;
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i].time) currentIndex = cues[i].index;
  }
  setActiveLine(currentIndex);
});

// ===== TRANZITIE LA PAGINA 2 =====
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

// ===== SCANTEI =====
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
const rsvpForm = document.getElementById("rsvp-form");
if (rsvpForm) {
  rsvpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nume = document.getElementById("nume").value.trim();
    const persoane = document.getElementById("persoane").value;
    const prezenta = document.getElementById("prezenta").value;
    if (!nume || !prezenta) { alert("Te rog completeaza numele si daca vii sau nu."); return; }
    try {
      const resp = await fetch("http://127.0.0.1:5000/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nume, persoane, prezenta }),
      });
      const data = await resp.json();
      if (resp.ok && (data.ok || data.success || data.message)) {
        const msg = document.getElementById("rsvp-msg");
        if (msg) { msg.style.display = "block"; msg.textContent = data.message || "Multumim! Am inregistrat confirmarea ta ❤️"; }
        rsvpForm.reset();
      } else {
        alert("Nu am putut trimite confirmarea.");
      }
    } catch (err) {
      console.error(err);
      alert("Serverul nu raspunde. L-ai pornit cu python app.py?");
    }
  });
}

// opreste pianul la parasirea paginii
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
