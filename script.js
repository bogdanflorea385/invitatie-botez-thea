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

// ===== UTILS =====
const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
let lastShownIndex = -1;
let autoScrollOnce = false; // << adăugat: prevenim rularea multiplă

function setFirstLineActive() {
  if (!lines.length) return;
  lines.forEach((el) => el.classList.remove("active", "leaving"));
  lines[0].classList.add("active");
  lastShownIndex = 0;
}

function resetIntroState() {
  // reset audio
  try { voce.pause(); voce.currentTime = 0; } catch(_) {}
  try { melodie.pause(); melodie.currentTime = 0; } catch(_) {}

  // reset overlay + scroll
  if (intro) { intro.style.display = ""; intro.classList.remove("fade-out"); }
  if (pagina2) { pagina2.style.display = "none"; pagina2.classList.remove("fade-in"); }
  document.body.classList.add("lock-scroll");

  // arată overlay de start
  if (tapToStart) {
    tapToStart.style.display = "flex";
    tapToStart.textContent = "Apasa pentru a porni povestea 🌙";
  }

  setFirstLineActive();

  // re-afișează titlul
  if (h1) { h1.style.opacity = 1; }
}

function playAfterUserGesture() {
  voce.play().then(() => {
    if (tapToStart) tapToStart.style.display = "none";
    melodie.play().catch(() => {});
    if (h1) setTimeout(() => { h1.style.opacity = 0; }, 13000);
  }).catch(() => {
    if (tapToStart) {
      tapToStart.style.display = "flex";
      tapToStart.textContent = "Apasa din nou pentru a porni 🌙";
    }
  });
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  resetIntroState();

  // Desktop: încercăm autoplay; Mobil: NU (așteptăm tap)
  if (!isTouch) {
    voce.play().then(() => {
      if (tapToStart) tapToStart.style.display = "none";
      melodie.play().catch(() => {});
      if (h1) setTimeout(() => { h1.style.opacity = 0; }, 13000);
    }).catch(() => {
      if (tapToStart) tapToStart.style.display = "flex";
    });
  }
});

// Reinițializează când pagina revine din bfcache (iOS Safari)
window.addEventListener("pageshow", (e) => {
  if (e.persisted) resetIntroState();
});

// ===== START LA TAP (fără setInterval!) =====
function startNarration() { playAfterUserGesture(); }
if (tapToStart) {
  tapToStart.addEventListener("click", startNarration);
  tapToStart.addEventListener("touchstart", (e) => { e.preventDefault(); startNarration(); }, { passive: false });
  document.addEventListener("keydown", (e) => {
    if (tapToStart.style.display === "none") return;
    if (e.code === "Enter" || e.code === "Space") { e.preventDefault(); startNarration(); }
  });
}

// ===== SINCRONIZARE PE AUDIO =====
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

// ===== TRANZIȚIE LA PAGINA 2 =====
voce.addEventListener("ended", () => {
  if (intro) intro.classList.add("fade-out");
  setTimeout(() => {
    if (intro) { intro.style.display = "none"; intro.classList.remove("fade-out"); }
    if (pagina2) { pagina2.style.display = "block"; pagina2.classList.add("fade-in"); }
    document.body.classList.remove("lock-scroll");
    try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (_) { window.scrollTo(0, 0); }

    // ===== SCROLL AUTOMAT CU EASING (o singură dată) =====
    if (!autoScrollOnce) {
      autoScrollOnce = true;
      setTimeout(() => {
        const startY = window.scrollY;
        const endY = Math.max(0, document.body.scrollHeight - window.innerHeight);
        if (endY <= startY + 2) return; // dacă nu e de derulat, ieșim

        const duration = 8500; // ms
        const startTime = performance.now();

        function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

        function smoothScroll(now){
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeOutCubic(progress);
          const currentY = startY + (endY - startY) * eased;
          window.scrollTo(0, currentY);
          if (progress < 1) requestAnimationFrame(smoothScroll);
        }
        requestAnimationFrame(smoothScroll);
      }, 1500); // mică întârziere după fade-in
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
    s.style.setProperty("--tx", `${tx}px`); s.style.setProperty("--ty", `${ty}px`);
    const colors = [["#fff8cc","#ffe49b"],["#ffffff","#e0dfff"],["#ffd7f5","#ffc2e9"]];
    const pick = colors[Math.floor(Math.random()*colors.length)];
    s.style.setProperty("--sparkColor1", pick[0]); s.style.setProperty("--sparkColor2", pick[1]);
    sparkLayer.appendChild(s); setTimeout(() => s.remove(), 3600);
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nume, persoane, prezenta }),
      });
      const data = await resp.json();
      if (resp.ok && (data.ok || data.success || data.message)) {
        const msg = document.getElementById("rsvp-msg");
        if (msg) { msg.style.display = "block"; msg.textContent = data.message || "Multumim! Am inregistrat confirmarea ta ❤️"; }
        rsvpForm.reset();
      } else { alert("Nu am putut trimite confirmarea."); }
    } catch (err) { console.error(err); alert("Serverul nu raspunde. L-ai pornit cu python app.py?"); }
  });
}

// Oprim pianul când părăsim pagina
window.addEventListener("beforeunload", () => { try { melodie.pause(); } catch (_) {} });

// ===== SKIP TO DETAILS + DEEP-LINK (#detalii) =====
(function(){
  const btnSkip  = document.getElementById("skipToDetails");
  const voce     = document.getElementById("voceThea");
  const melodie  = document.getElementById("bgPiano");
  const intro    = document.getElementById("intro");
  const pagina2  = document.getElementById("pagina2");
  const tapStart = document.getElementById("tapToStart");

  async function goToPage2(){
    // oprește naratiunea și ascunde overlay-ul de start
    try { if (voce) { voce.pause(); voce.currentTime = 0; } } catch(_){}
    if (tapStart) tapStart.style.display = "none";

    // fade-out identic cu fluxul de la voce ended
    if (intro) intro.classList.add("fade-out");
    setTimeout(() => {
      if (intro) { intro.style.display = "none"; intro.classList.remove("fade-out"); }
      if (pagina2) { pagina2.style.display = "block"; pagina2.classList.add("fade-in"); }
      document.body.classList.remove("lock-scroll");
      try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (_){ window.scrollTo(0,0); }

      // setează hash pentru link partajabil
      if (location.hash !== "#detalii") {
        try { history.replaceState(null, "", "#detalii"); } catch(_){}
      }

      // pornește pianul ambiental dacă e oprit
      if (melodie && melodie.paused) {
        try { melodie.play(); } catch(_) {}
      }

      // rulare automată o singură dată, reutilizează aceeași protecție
      if (typeof window !== "undefined") {
        if (!window.__autoScrollOnceInvoked) {
          window.__autoScrollOnceInvoked = true;
          setTimeout(() => {
            const startY = window.scrollY;
            const endY = Math.max(0, document.body.scrollHeight - window.innerHeight);
            if (endY <= startY + 2) return;

            const duration = 8500; // ms
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
      }
    }, 2000);
  }

  // click pe butonul "Sari la detalii"
  if (btnSkip) {
    btnSkip.addEventListener("click", goToPage2);
  }

  // deep-link: deschide direct Pagina 2 când vine cu #detalii
  window.addEventListener("DOMContentLoaded", () => {
    if (location.hash === "#detalii") {
      // un mic delay pentru a permite montarea completă
      setTimeout(goToPage2, 60);
    }
  });
})();
