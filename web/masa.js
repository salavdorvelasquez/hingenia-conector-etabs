/* ===================================================================
   Masa participativa modal · E.030 (2026)
   Lee "Modal Participating Mass Ratios" de ETABS (vía la API).
   =================================================================== */

const API_URL = "http://127.0.0.1:8731";
const el = (id) => document.getElementById(id);
const pct = (x) => `${(x * 100).toFixed(1)} %`;

async function pingApi() {
  try {
    const r = await fetch(`${API_URL}/ping`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    setApi(true, j.etabs ? "ETABS conectado" : "API activa (ETABS cerrado)");
    if (j.etabs && !casosCargados) cargarCasos();
  } catch { setApi(false, "ETABS: sin conexión"); }
}

// Llena el selector con los casos modales del modelo (sin mostrar resultados).
let casosCargados = false;
async function cargarCasos() {
  try {
    const r = await fetch(`${API_URL}/masa`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caso: null }), signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    if (!j.ok || !Array.isArray(j.casos) || !j.casos.length) return;
    const sel = el("caso");
    const actual = sel.value;
    sel.innerHTML = j.casos.map((c) => `<option value="${c}">${c}</option>`).join("");
    sel.value = actual && j.casos.includes(actual) ? actual : (j.caso || j.casos[0]);
    casosCargados = true;
  } catch { /* reintenta en el próximo ping */ }
}
function setApi(o, t) { el("apiDot").classList.toggle("online", o); el("apiText").textContent = t; }
function toast(tipo, titulo, msg) {
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.innerHTML = `<b></b><span></span>`;
  t.querySelector("b").textContent = titulo; t.querySelector("span").textContent = msg;
  el("toasts").appendChild(t); setTimeout(() => t.remove(), 6000);
}

async function calcular() {
  el("btnCalcular").disabled = true;
  el("estado").textContent = "Leyendo masa participativa de ETABS…";
  try {
    const r = await fetch(`${API_URL}/masa`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caso: el("caso").value || null }),
    });
    const j = await r.json();
    if (!j.ok) {
      el("estado").textContent = j.mensaje || "No se pudo leer.";
      if (j.guardar) { alert("⚠ " + j.mensaje); toast("warn", "Guarda tu modelo", j.mensaje); }
      else toast("error", "No se pudo leer", j.mensaje || "");
      return;
    }
    el("estado").textContent = j.mensaje || "";
    render(j);
    toast("success", "Masa participativa leída", j.mensaje || "");
  } catch {
    el("estado").textContent = "No se pudo conectar con el puente. Abre ESPECTRA con ETABS abierto.";
    toast("error", "API no disponible", "Abre ESPECTRA con ETABS abierto");
  } finally {
    el("btnCalcular").disabled = false;
  }
}

function render(j) {
  try { sessionStorage.setItem("e030-masa", JSON.stringify(j)); } catch {}
  // Poblar el selector de casos (la primera vez) y marcar el actual
  if (Array.isArray(j.casos)) {
    const sel = el("caso");
    if (sel.options.length <= 1) {
      sel.innerHTML = j.casos.map((c) => `<option value="${c}">${c}</option>`).join("");
    }
    sel.value = j.caso;
  }
  el("resultados").classList.remove("hidden");
  const modos = Array.isArray(j.modos) ? j.modos : [];
  // Modos fundamentales (mayor masa en cada dirección)
  let fx = -1, fy = -1, mx = -1, my = -1;
  modos.forEach((m, i) => { if (m.ux > mx) { mx = m.ux; fx = i; } if (m.uy > my) { my = m.uy; fy = i; } });

  const tb = el("tabla").querySelector("tbody");
  tb.innerHTML = modos.map((m, i) => {
    const fund = (i === fx || i === fy);
    const tag = i === fx ? " (X)" : i === fy ? " (Y)" : "";
    return `<tr class="${fund ? "fund" : ""}"><td><b>${m.modo}</b>${tag}</td><td>${m.periodo}</td>` +
           `<td>${pct(m.ux)}</td><td>${pct(m.uy)}</td><td>${pct(m.uz)}</td><td>${pct(m.rz)}</td>` +
           `<td>${pct(m.sumux)}</td><td>${pct(m.sumuy)}</td></tr>`;
  }).join("");
}

function toggleTema() {
  const a = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", a === "dark" ? "light" : "dark");
  try { localStorage.setItem("e030-theme", a === "dark" ? "light" : "dark"); } catch {}
}

function restaurar() {
  try {
    const g = JSON.parse(sessionStorage.getItem("e030-masa") || "null");
    if (g && Array.isArray(g.modos)) render(g);
  } catch {}
}

el("btnCalcular").addEventListener("click", calcular);
el("caso").addEventListener("change", calcular);
el("btnTheme").addEventListener("click", toggleTema);
el("sidebarToggle").addEventListener("click", () => document.querySelector(".app").classList.toggle("collapsed"));
restaurar();
pingApi();
setInterval(pingApi, 5000);
