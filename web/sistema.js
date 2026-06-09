/* ===================================================================
   Sistema estructural · E.030 (2026)
   Corre el análisis en ETABS (vía la API local), calcula el % de cortante
   en la base tomado por los muros y clasifica el sistema por dirección.
   =================================================================== */

const API_URL = "http://127.0.0.1:8731";
const el = (id) => document.getElementById(id);
let chartX = null, chartY = null, ultimo = null;

// --- Estado de la API ---
async function pingApi() {
  try {
    const r = await fetch(`${API_URL}/ping`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    setApi(true, j.etabs ? "ETABS conectado" : "API activa (ETABS cerrado)");
    if (j.etabs && !nivelesCargados) cargarNiveles();
  } catch {
    setApi(false, "ETABS: sin conexión");
  }
}
function setApi(online, text) {
  el("apiDot").classList.toggle("online", online);
  el("apiText").textContent = text;
}

// --- Cargar la lista de niveles del modelo en el selector ---
let nivelesCargados = false;
async function cargarNiveles() {
  try {
    const r = await fetch(`${API_URL}/niveles`, { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    if (!j.ok || !Array.isArray(j.niveles)) return;
    const sel = el("nivel");
    const actual = sel.value;
    sel.innerHTML = '<option value="">Piso base (automático)</option>';
    j.niveles.forEach((n) => {
      const o = document.createElement("option");
      o.value = n; o.textContent = n;
      sel.appendChild(o);
    });
    sel.value = actual;
    nivelesCargados = true;
  } catch { /* reintenta en el próximo ping */ }
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
  el("estado").textContent = "Corriendo el análisis en ETABS… (puede tardar varios segundos).";
  try {
    const r = await fetch(`${API_URL}/sistema_estructural`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ piso: el("nivel").value || null }),
    });
    const j = await r.json();
    if (!j.ok) {
      el("estado").textContent = j.mensaje || "No se pudo calcular.";
      if (j.guardar) {
        alert("⚠ " + j.mensaje);
        toast("warn", "Guarda tu modelo", j.mensaje);
      } else {
        toast("error", "No se pudo calcular", j.mensaje || "Error desconocido.");
      }
      return;
    }
    el("estado").textContent = j.mensaje || "";
    render(j);
    toast("success", "Sistema estructural calculado", j.mensaje || "");
  } catch (e) {
    el("estado").textContent =
      "No se pudo conectar con el puente. Verifica que ESPECTRA y ETABS estén abiertos.";
    toast("error", "API no disponible", "Abre ESPECTRA con ETABS abierto  con ETABS abierto.");
  } finally {
    el("btnCalcular").disabled = false;
  }
}

// --- Gráfico de pastel (doughnut) por dirección ---
function dibujarPie(canvasId, anterior, pct, sistema, gris) {
  const muros = Math.max(0, Math.min(100, pct));
  const colMuros = "#2563eb";   // muros (azul)
  const colResto = "#16a34a";   // pórticos / resto (verde)
  const plomo = "#94a3b8";      // plomo (albañilería / péndulo)
  if (anterior) anterior.destroy();
  const data = gris ? [100] : [muros, 100 - muros];
  const labels = gris ? ["No aplica"] : ["Muros", "Pórticos / resto"];
  const bg = gris ? [plomo] : [colMuros, colResto];
  return new Chart(el(canvasId), {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: bg, borderWidth: 0 }] },
    options: {
      responsive: true,
      cutout: "62%",
      plugins: {
        legend: { display: !gris, position: "bottom", labels: { font: { weight: "600" } } },
        title: { display: true, text: gris ? sistema : `${muros.toFixed(1)} % en muros — ${sistema}`, font: { size: 14, weight: "800" } },
        tooltip: { enabled: !gris, callbacks: { label: (c) => `${c.label}: ${c.parsed.toFixed(1)} %` } },
      },
    },
  });
}

let baseResult = null;   // resultado del API (albañilería aplicada, sin péndulo)

// Recibe el resultado del API y lo guarda como base.
function render(j) {
  baseResult = j;
  try { sessionStorage.setItem("e030-sistema-base", JSON.stringify(j)); } catch {}
  aplicar();
}

// Aplica el péndulo invertido por dirección (override R₀=2.5) y dibuja.
function aplicar() {
  if (!baseResult || !baseResult.direcciones) return;
  const eff = JSON.parse(JSON.stringify(baseResult));
  ["X", "Y"].forEach((d) => {
    const chk = el("pendulo" + d) && el("pendulo" + d).checked;
    const m = eff.direcciones[d];
    if (!m) return;
    m.pendulo = !!chk;
    if (chk) { m.sistema = "Péndulo invertido (Art. 22.3)"; m.R0 = 2.5; }
  });
  ultimo = eff;
  try { sessionStorage.setItem("e030-sistema", JSON.stringify(eff)); } catch {}
  dibujarResultado(eff);
}

function dibujarResultado(j) {
  el("resultados").classList.remove("hidden");
  const x = j.direcciones.X, y = j.direcciones.Y;

  chartX = dibujarPie("pieX", chartX, x.porcentaje, x.sistema, x.pendulo || x.albanileria);
  chartY = dibujarPie("pieY", chartY, y.porcentaje, y.sistema, y.pendulo || y.albanileria);

  el("infoX").innerHTML =
    `<div class="sis">${x.sistema}</div><div class="r0">R₀ = ${x.R0}</div>` +
    `<div>${x.porcentaje} % del cortante en muros</div>`;
  el("infoY").innerHTML =
    `<div class="sis">${y.sistema}</div><div class="r0">R₀ = ${y.R0}</div>` +
    `<div>${y.porcentaje} % del cortante en muros</div>`;

  // Tabla de detalle por caso
  const tb = el("tablaDetalle").querySelector("tbody");
  tb.innerHTML = "";
  (j.detalle || []).forEach((d) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td class="left">${d.caso}</td><td>${d.direccion}</td>` +
      `<td>${d.v_muros}</td><td>${d.v_total}</td><td><b>${d.porcentaje} %</b></td>` +
      `<td>${d.sistema}</td><td>${d.R0}</td>`;
    tb.appendChild(tr);
  });
}

// --- Tema claro/oscuro y menú lateral (igual que en index) ---
function toggleTema() {
  const actual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const nuevo = actual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nuevo);
  try { localStorage.setItem("e030-theme", nuevo); } catch {}
  if (baseResult) aplicar();  // recolorear los pasteles con la paleta del tema
}

function restaurar() {
  try {
    const base = JSON.parse(sessionStorage.getItem("e030-sistema-base") || "null");
    const eff = JSON.parse(sessionStorage.getItem("e030-sistema") || "null");
    if (base && base.direcciones) {
      baseResult = base;
      if (eff && eff.direcciones) {
        if (el("penduloX")) el("penduloX").checked = !!(eff.direcciones.X && eff.direcciones.X.pendulo);
        if (el("penduloY")) el("penduloY").checked = !!(eff.direcciones.Y && eff.direcciones.Y.pendulo);
      }
      aplicar();
    }
  } catch {}
}

el("btnCalcular").addEventListener("click", calcular);
el("penduloX").addEventListener("change", aplicar);
el("penduloY").addEventListener("change", aplicar);
el("btnTheme").addEventListener("click", toggleTema);
el("sidebarToggle").addEventListener("click", () => document.querySelector(".app").classList.toggle("collapsed"));
restaurar();
pingApi();
setInterval(pingApi, 5000);
