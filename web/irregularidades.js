/* ===================================================================
   Irregularidades · E.030 (2026)
   Por ahora: irregularidad de rigidez (piso blando) · Tabla N° 11.
   K = V/δ por entrepiso, comparado con los superiores (70%/80%, 60%/70%).
   =================================================================== */

const API_URL = "http://127.0.0.1:8731";
const el = (id) => document.getElementById(id);
let ultimo = null;

async function pingApi() {
  try {
    const r = await fetch(`${API_URL}/ping`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    setApi(true, j.etabs ? "ETABS conectado" : "API activa (ETABS cerrado)");
  } catch { setApi(false, "ETABS: sin conexión"); }
}
function setApi(o, t) { el("apiDot").classList.toggle("online", o); el("apiText").textContent = t; }
function toast(tipo, titulo, msg) {
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.innerHTML = `<b></b><span></span>`;
  t.querySelector("b").textContent = titulo; t.querySelector("span").textContent = msg;
  el("toasts").appendChild(t); setTimeout(() => t.remove(), 6000);
}

const n3 = (x) => (x == null ? "—" : (Math.round(x * 1000) / 1000).toFixed(3));
// Sin separadores de miles; punto decimal (2 decimales).
const nK = (x) => (x == null ? "—" : (Math.round(x * 100) / 100).toString());

async function calcular() {
  el("btnCalcular").disabled = true;
  el("estado").textContent = "Leyendo rigideces de entrepiso de ETABS…";
  try {
    const r = await fetch(`${API_URL}/irregularidad_rigidez`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    const j = await r.json();
    if (!j.ok) {
      el("estado").textContent = j.mensaje || "No se pudo calcular.";
      toast("error", "No se pudo calcular", j.mensaje || "Error desconocido.");
      return;
    }
    el("estado").textContent = j.mensaje || "";
    render(j);
    toast("success", "Irregularidad evaluada", j.mensaje || "");
  } catch {
    el("estado").textContent = "No se pudo conectar con el puente. Abre ESPECTRA con ETABS abierto.";
    toast("error", "API no disponible", "Abre ESPECTRA con ETABS abierto  con ETABS abierto.");
  } finally {
    el("btnCalcular").disabled = false;
  }
}

function bloque(d, i) {
  const ok = !d.irregular;
  const etiqueta = d.extrema ? "EXTREMA (Iₐ = 0.50)" : d.irregular ? "IRREGULAR (Iₐ = 0.75)" : "REGULAR (Iₐ = 1.00)";
  const filas = d.filas.map((f) => {
    const cls = f.estado === "OK" ? "ok" : (f.estado === "—" ? "" : "no");
    return `<tr><td class="left">${f.story}</td><td>${nK(f.K)}</td>` +
           `<td>${n3(f.rsup)}</td><td>${n3(f.rprom)}</td>` +
           `<td class="${cls}">${f.estado}</td></tr>`;
  }).join("");
  return `<div class="dir-block" ${i > 0 ? 'style="margin-top:26px"' : ""}>` +
         `<div class="dir-head"><h3>${d.caso}</h3>` +
         `<span style="color:var(--muted);font-size:13px">dirección ${d.dir} · ${etiqueta}</span></div>` +
         `<div class="dir-cols">` +
         `<table class="u-table"><thead><tr><th>Entrepiso</th><th>K = V/δ (tonf/m)</th>` +
         `<th>K/K<sub>sup</sub></th><th>K/prom(3 sup)</th><th>Estado</th></tr></thead>` +
         `<tbody>${filas}</tbody></table>` +
         `<div class="kw"><canvas id="k-${i}"></canvas></div>` +
         `</div></div>`;
}

let charts = [];
function dibujar(i, d) {
  const css = getComputedStyle(document.documentElement);
  const col = "#2563eb";   // K/Ksup (azul)
  const muted = "#16a34a"; // K/prom (verde)
  const red = (css.getPropertyValue("--muted") || "#64748b").trim();  // límites en gris
  const grid = "rgba(0,0,0,.06)";
  const stories = d.filas.map((f) => f.story);     // de arriba (techo) hacia abajo
  const rsup = d.filas.map((f) => f.rsup);         // K / K_sup
  const rprom = d.filas.map((f) => f.rprom);       // K / prom(3 sup)
  charts.push(new Chart(el(`k-${i}`), {
    type: "line",
    data: { labels: stories, datasets: [
      { label: "K / Kₛᵤₚ", data: rsup, borderColor: col, backgroundColor: col,
        pointRadius: 3, borderWidth: 2.2, tension: 0.2, spanGaps: false },
      { label: "K / prom(3 sup)", data: rprom, borderColor: muted, backgroundColor: muted,
        pointRadius: 3, borderWidth: 2.2, tension: 0.2, spanGaps: false },
      { label: "Límite 0.7", data: stories.map(() => 0.7), borderColor: red,
        pointRadius: 0, borderWidth: 1.5, borderDash: [6, 4] },
      { label: "Límite 0.8", data: stories.map(() => 0.8), borderColor: red,
        pointRadius: 0, borderWidth: 1.5, borderDash: [2, 3] },
    ] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 22, font: { size: 11, weight: "600" } } },
                 title: { display: true, text: `Relaciones de rigidez · ${d.caso}`, font: { size: 12, weight: "700" } } },
      scales: {
        x: { beginAtZero: true, grid: { color: grid }, title: { display: true, text: "Relación (≥ 0.7 / 0.8)", font: { weight: "600" } } },
        y: { grid: { color: grid }, title: { display: true, text: "Entrepiso", font: { weight: "600" } } },
      },
    },
  }));
}

function render(j) {
  ultimo = j;
  try { sessionStorage.setItem("e030-irregularidad", JSON.stringify(j)); } catch {}
  el("resultados").classList.remove("hidden");
  charts.forEach((c) => c.destroy());
  charts = [];
  const casos = j.casos || [];
  el("bloques").innerHTML = casos.map((c, i) => bloque(c, i)).join("");
  casos.forEach((c, i) => dibujar(i, c));
}

function toggleTema() {
  const a = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", a === "dark" ? "light" : "dark");
  try { localStorage.setItem("e030-theme", a === "dark" ? "light" : "dark"); } catch {}
  if (ultimo) render(ultimo);
}

function restaurar() {
  try {
    const g = JSON.parse(sessionStorage.getItem("e030-irregularidad") || "null");
    if (g && Array.isArray(g.casos)) render(g);
  } catch {}
}

el("btnCalcular").addEventListener("click", calcular);
el("btnTheme").addEventListener("click", toggleTema);
el("sidebarToggle").addEventListener("click", () => document.querySelector(".app").classList.toggle("collapsed"));
restaurar();
pingApi();
setInterval(pingApi, 5000);
