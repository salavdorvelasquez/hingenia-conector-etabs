/* ===================================================================
   Derivas · E.030 (2026)
   Lee las derivas por nivel de los 4 combos D- desde ETABS (vía la API)
   y las grafica (deriva vs nivel) con la línea de límite (Tabla N° 14).
   =================================================================== */

const API_URL = "http://127.0.0.1:8731";
const el = (id) => document.getElementById(id);
let charts = [];
let ultimo = null;

// --- Estado de la API ---
async function pingApi() {
  try {
    const r = await fetch(`${API_URL}/ping`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    setApi(true, j.etabs ? "ETABS conectado" : "API activa (ETABS cerrado)");
  } catch {
    setApi(false, "ETABS: sin conexión");
  }
}
function setApi(online, text) {
  el("apiDot").classList.toggle("online", online);
  el("apiText").textContent = text;
}

function toast(tipo, titulo, msg) {
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.innerHTML = `<b></b><span></span>`;
  t.querySelector("b").textContent = titulo;
  t.querySelector("span").textContent = msg;
  el("toasts").appendChild(t);
  setTimeout(() => t.remove(), 6000);
}

// --- Cálculo ---
async function calcular() {
  el("btnCalcular").disabled = true;
  el("estado").textContent = "Leyendo derivas de ETABS… (si el modelo no está corrido, se ejecutará).";
  try {
    const r = await fetch(`${API_URL}/derivas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const j = await r.json();
    if (!j.ok) {
      el("estado").textContent = j.mensaje || "No se pudo calcular.";
      if (j.guardar) { alert("⚠ " + j.mensaje); toast("warn", "Guarda tu modelo", j.mensaje); }
      else toast("error", "No se pudo calcular", j.mensaje || "Error desconocido.");
      return;
    }
    el("estado").textContent = j.mensaje || "";
    render(j);
    toast("success", "Derivas calculadas", j.mensaje || "");
  } catch {
    el("estado").textContent =
      "No se pudo conectar con el puente. Verifica que ESPECTRA y ETABS estén abiertos.";
    toast("error", "API no disponible", "Abre ESPECTRA con ETABS abierto  con ETABS abierto.");
  } finally {
    el("btnCalcular").disabled = false;
  }
}

function dibujar(canvas, caso, limite) {
  const stories = caso.perfil.map((p) => p.story);
  const drifts = caso.perfil.map((p) => p.drift);
  const css = getComputedStyle(document.documentElement);
  const colLinea = "#2563eb";   // deriva (azul)
  const colLim = "#94a3b8";     // límite (plomo / gris)
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: stories,
      datasets: [
        {
          label: "Deriva",
          data: drifts,
          borderColor: colLinea,
          backgroundColor: colLinea,
          pointRadius: 3,
          tension: 0.25,
        },
        {
          label: `Límite ${limite}`,
          data: stories.map(() => limite),
          borderColor: colLim,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6, 4],
        },
      ],
    },
    options: {
      indexAxis: "y",       // niveles en el eje vertical, deriva en el horizontal
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { font: { weight: "600" }, boxWidth: 14 } },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${(+c.parsed.x).toFixed(5)}` } },
      },
      scales: {
        x: { title: { display: true, text: "Deriva (Δ/h)" }, beginAtZero: true },
        y: { title: { display: false } },
      },
    },
  });
}

function render(j) {
  ultimo = j;
  const limite = parseFloat(el("material").value);
  try { sessionStorage.setItem("e030-derivas", JSON.stringify({ ...j, limite })); } catch {}
  el("resultados").classList.remove("hidden");
  charts.forEach((c) => c.destroy());
  charts = [];
  const grid = el("grid");
  grid.innerHTML = "";

  j.casos.forEach((caso) => {
    const cumple = caso.max <= limite;
    const cell = document.createElement("div");
    cell.className = "drift-cell";
    cell.innerHTML =
      `<div class="dh"><b>${caso.caso} <span style="font-weight:600;color:var(--muted)">(${caso.direccion})</span></b>` +
      `<span class="badge ${cumple ? "ok" : "no"}">${cumple ? "CUMPLE" : "NO CUMPLE"}</span></div>` +
      `<div class="chart-wrap"><canvas></canvas></div>` +
      `<div class="se-estado" style="text-align:center">Máx: ${caso.max} @ ${caso.max_story} · límite ${limite}</div>`;
    grid.appendChild(cell);
    charts.push(dibujar(cell.querySelector("canvas"), caso, limite));
  });
}

// --- Tema y menú lateral ---
function toggleTema() {
  const actual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const nuevo = actual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nuevo);
  try { localStorage.setItem("e030-theme", nuevo); } catch {}
  if (ultimo) render(ultimo);
}

function restaurar() {
  try {
    const g = JSON.parse(sessionStorage.getItem("e030-derivas") || "null");
    if (g && Array.isArray(g.casos)) {
      if (g.limite != null) el("material").value = g.limite;  // restaura el material/límite elegido
      render(g);
    }
  } catch {}
}

el("btnCalcular").addEventListener("click", calcular);
el("material").addEventListener("change", () => {
  if (!ultimo) { try { ultimo = JSON.parse(sessionStorage.getItem("e030-derivas") || "null"); } catch {} }
  if (ultimo && Array.isArray(ultimo.casos)) render(ultimo);
});
el("btnTheme").addEventListener("click", toggleTema);
el("sidebarToggle").addEventListener("click", () => document.querySelector(".app").classList.toggle("collapsed"));
restaurar();
pingApi();
setInterval(pingApi, 5000);
