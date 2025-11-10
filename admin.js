// === Config ===
const BACKEND = "https://invitatie-botez-thea.onrender.com";
const LS_KEY  = "thea_admin_key";

// === Util ===
const $    = (s)=>document.querySelector(s);
const tbody= $("#tbody");
const q    = $("#search");
const stC  = $("#stConfirm");
const stR  = $("#stRefuz");
const stP  = $("#stPers");
const stT  = $("#stTotal");

function download(filename, text){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));
  a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 500);
}

function csvEscape(s){
  if (s == null) return "";
  s = String(s).replace(/"/g,'""');
  return `"${s}"`;
}

// === Admin key (parola) ===
async function getKey(){
  let key = localStorage.getItem(LS_KEY);
  if (!key){
    key = prompt("Parola admin (ex: Thea2025):")?.trim();
    if (!key) throw new Error("Fara cheie admin.");
    localStorage.setItem(LS_KEY, key);
  }
  return key;
}

// === Load & Render ===
let ALL = [];

async function loadData(){
  const key = await getKey();
  const url = `${BACKEND}/lista?key=${encodeURIComponent(key)}`;
  const r = await fetch(url);
  if (r.status === 403){ localStorage.removeItem(LS_KEY); throw new Error("Parola incorecta."); }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  ALL = await r.json();
  render();
  await loadStats(key);
}

async function loadStats(key){
  const r = await fetch(`${BACKEND}/stats?key=${encodeURIComponent(key)}`);
  if (r.ok){
    const s = await r.json();
    stC.textContent = s.confirmari ?? 0;
    stR.textContent = s.refuzuri ?? 0;
    stP.textContent = s.total_persoane ?? 0;
    stT.textContent = s.total_inregistrari ?? 0;
  }
}

function render(){
  const term = (q.value || "").trim().toLowerCase();
  let rows = ALL;

  if (term){
    rows = ALL.filter(x =>
      (x.nume||"").toLowerCase().includes(term) ||
      (x.status||"").toLowerCase().includes(term) ||
      String(x.phone||"").toLowerCase().includes(term) ||
      String(x.note||"").toLowerCase().includes(term)
    );
  }

  if (!rows.length){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#666">Nu exista inregistrari.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((x, i)=>{
    const badge = x.status === "particip"
      ? `<span class="badge ok">particip</span>`
      : `<span class="badge no">nu</span>`;
    return `
      <tr data-id="${x.id}">
        <td>${i+1}</td>
        <td>${x.nume||""}</td>
        <td>${badge}</td>
        <td>${x.persoane ?? ""}</td>
        <td>${x.phone ?? ""}</td>
        <td>${x.note ?? ""}</td>
        <td>${x.timestamp?.replace("T"," ").slice(0,19) || ""}</td>
        <td class="actions"><button data-del="${x.id}">Sterge</button></td>
      </tr>
    `;
  }).join("");
}

// === Delete ===
tbody.addEventListener("click", async (e)=>{
  const id = e.target?.getAttribute?.("data-del");
  if (!id) return;
  if (!confirm("Sigur stergi aceasta inregistrare?")) return;

  const key = await getKey();
  const r = await fetch(`${BACKEND}/sterge/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`, {
    method: "DELETE"
  });
  if (!r.ok){
    alert(`Nu s-a putut sterge (HTTP ${r.status}).`);
    return;
  }
  ALL = ALL.filter(x => x.id !== id);
  render();
  loadStats(key).catch(()=>{});
});

// === Export CSV ===
$("#btnExport").addEventListener("click", ()=>{
  const rows = [
    ["id","nume","status","persoane","telefon","note","timestamp"].map(csvEscape).join(",")
  ];
  for (const x of ALL){
    rows.push([
      x.id, x.nume, x.status, x.persoane, x.phone||"", x.note||"", x.timestamp
    ].map(csvEscape).join(","));
  }
  download(`rsvp_${new Date().toISOString().slice(0,10)}.csv`, rows.join("\n"));
});

// === Refresh & Search ===
$("#btnRefresh").addEventListener("click", ()=> loadData().catch(err => alert(err.message)));
$("#search").addEventListener("input", ()=> render());

// === Init ===
loadData().catch(err => alert(err.message));
