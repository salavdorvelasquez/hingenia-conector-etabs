/* ===================================================================
   Memoria de cálculo · E.030 (2026)
   2.1 Introducción · 2.2 Parámetros · 2.3 Regularidad · 2.4 Espectro ·
   2.6 Respuesta modal (periodos, cortantes, f) · Distorsiones.
   Parámetros reciclados de Datos; resultados (ETABS) vía /memoria.
   =================================================================== */

const API_URL = "http://127.0.0.1:8731";
const el = (id) => document.getElementById(id);
let params = null, chartEsp = null, chartCort = null, lastJ = null, lastD = null, lastS = null, generado = false;
let LIMITE_DERIVA = 0.007;   // límite de distorsión; se ajusta al elegido en la pestaña Derivas
// Tipografía LaTeX (Computer Modern) también en los gráficos de la memoria.
try { if (window.Chart) Chart.defaults.font.family = '"Computer Modern Serif","Latin Modern Roman",Georgia,serif'; } catch (e) {}
const COLORES_DEF = { x: "#2563eb", y: "#16a34a" };
let colores = { ...COLORES_DEF };

function cargarColores() {
  try {
    const c = JSON.parse(localStorage.getItem("e030-colors") || "null");
    if (c && c.x && c.y) colores = c;
  } catch {}
  el("colX").value = colores.x;
  el("colY").value = colores.y;
}
function guardarColores() {
  colores = { x: el("colX").value, y: el("colY").value };
  try { localStorage.setItem("e030-colors", JSON.stringify(colores)); } catch {}
  if (generado) renderEspectro();
  if (lastS) renderSistema(lastS);
  if (lastD) renderDerivas(lastD);
}

// Factor de amplificación sísmica C (idéntico a app.js)
function factorC(t, Tp, Tl) {
  if (t < 0.2 * Tp) return 1 + 7.5 * (t / Tp);
  if (t <= Tp) return 2.5;
  if (t < Tl) return 2.5 * (Tp / t);
  return 2.5 * (Tp * Tl) / (t * t);
}
const n3 = (x) => (Math.round(x * 1000) / 1000);
const n2 = (x) => (Math.round(x * 100) / 100);

// --- API status ---
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

// --- Carga (sin renderizar) los parámetros de Datos ---
function cargarParams() {
  try { params = JSON.parse(localStorage.getItem("e030-params") || "null"); } catch { params = null; }
  if (!params || typeof params.Z !== "number") {
    el("estado").textContent = "⚠ No hay parámetros. Abre la pestaña Datos y elige Zona/Suelo (se reciclan aquí).";
    return false;
  }
  return true;
}
function leerGuardado(key) {
  // Los resultados de cálculo viven en sessionStorage (hasta reiniciar la app).
  try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; }
}
const pctMasa = (x) => `${(x * 100).toFixed(1)} %`;

function renderParametros() {
  const p = params;
  const zonaN = (p.zona || "").replace("Z", "Zona ");
  const filas = [
    ["Factor de zona", `${zonaN}`, `Z = ${p.Z}`],
    ["Factor de importancia", `${p.uso || "—"}`, `U = ${p.U}`],
    ["Perfil de suelo", `${p.suelo || "—"}`, `S = ${p.S} · Tp = ${p.Tp} · Tl = ${p.Tl}`],
    ["Factor de irregularidad (Iₐ, Iₚ)", `Iₐ = ${p.Ia}`, `Iₚ = ${p.Ip}`],
    ["Factor de reducción", `R<sub>xx</sub> = ${n2(p.Rx)}`, `R<sub>yy</sub> = ${n2(p.Ry)}`],
  ];
  el("tablaParam").querySelector("tbody").innerHTML =
    filas.map((f) => `<tr><td class="left"><b>${f[0]}</b></td><td>${f[1]}</td><td>${f[2]}</td></tr>`).join("");
  el("introParam").textContent =
    `El análisis sísmico se efectuó siguiendo la Norma E.030. La edificación se calificó como categoría `
    + `«${p.uso || "—"}». Los parámetros empleados se resumen en la Tabla 1.`;
}

function renderRegularidad() {
  const reg = params.regular;
  el("regTexto").textContent = reg
    ? "De acuerdo con la Norma E.030, la edificación se considera REGULAR (Iₐ = Iₚ = 1.0), cumpliendo los requisitos de regularidad para su categoría de uso."
    : `De acuerdo con la Norma E.030, la edificación presenta irregularidad (Iₐ = ${params.Ia}, Iₚ = ${params.Ip}). `
      + "Se verifica que no presenta irregularidades extremas, cumpliendo los requisitos para su categoría de uso.";
}

function renderEspectro() {
  const p = params, sx = [], sy = [];
  // Puntos clave (quiebres del espectro E.030) + muestreo fino, para que las
  // esquinas salgan agudas y no redondeadas.
  const claves = [0, 0.2 * p.Tp, p.Tp, p.Tl];
  const ts = new Set();
  for (let t = 0; t <= 3.0 + 1e-9; t += 0.02) ts.add(n3(t));
  claves.forEach((t) => { if (t >= 0 && t <= 3.0) ts.add(n3(t)); });
  const orden = [...ts].sort((a, b) => a - b);
  orden.forEach((tr) => {
    const zucs = p.Z * p.U * p.S * factorC(tr, p.Tp, p.Tl);
    sx.push({ x: tr, y: zucs / p.Rx });
    sy.push({ x: tr, y: zucs / p.Ry });
  });
  if (chartEsp) chartEsp.destroy();
  const grid = "rgba(0,0,0,.06)";
  chartEsp = new Chart(el("chartEsp"), {
    type: "line",
    data: { datasets: [
      { label: "Sa/g · X (ZUCS/Rx)", data: sx, borderColor: colores.x, backgroundColor: "transparent", pointRadius: 0, borderWidth: 2.5, tension: 0 },
      { label: "Sa/g · Y (ZUCS/Ry)", data: sy, borderColor: colores.y, backgroundColor: "transparent", pointRadius: 0, borderWidth: 2.5, tension: 0 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 26, font: { size: 11, weight: "600" } } } },
      scales: {
        x: { type: "linear", min: 0, max: 3, ticks: { stepSize: 0.5 }, grid: { color: grid },
             title: { display: true, text: "Periodo T (s)", font: { weight: "600" } } },
        y: { beginAtZero: true, grid: { color: grid },
             title: { display: true, text: "Sa / g", font: { weight: "600" } } },
      },
    },
  });
}

// --- 2.6 y distorsiones (requiere ETABS) ---
async function postJson(path, body) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json();
}

// Marca una sección como no ejecutada (nota en su tabla/resumen).
function faltaSeccion(resumenId, tablaId, nombre) {
  if (resumenId && el(resumenId)) el(resumenId).innerHTML =
    `<span class="falta-nota">⚠ No se ejecutó la verificación: ${nombre}.</span>`;
  const t = el(tablaId);
  if (t) {
    const tb = t.querySelector("tbody");
    const cols = t.querySelectorAll("thead th").length || 1;
    if (tb) tb.innerHTML =
      `<tr><td colspan="${cols}" class="falta-nota" style="text-align:center">⚠ No se ejecutó la verificación: ${nombre}.</td></tr>`;
  }
}

function generar() {
  if (!cargarParams()) {
    toast("warn", "Faltan parámetros", "Abre la pestaña Datos y elige Zona/Suelo.");
    return;
  }
  // La memoria se arma con lo guardado en las pestañas anteriores (sessionStorage).
  const mas = leerGuardado("e030-masa");
  const esc = leerGuardado("e030-escalamiento");
  const der = leerGuardado("e030-derivas");
  const sis = leerGuardado("e030-sistema");
  const jun = leerGuardado("e030-junta");

  const okMas = !!(mas && Array.isArray(mas.modos));
  const okEsc = !!(esc && Array.isArray(esc.casos));
  const okDer = !!(der && Array.isArray(der.casos));
  const okSis = !!(sis && sis.direcciones);
  const okJun = !!(jun && jun.dir);

  const faltan = [];
  if (!okMas) faltan.push("Masa participativa");
  if (!okSis) faltan.push("Sistema estructural");
  if (!okEsc) faltan.push("Escalamiento sísmico");
  if (!okDer) faltan.push("Derivas");
  if (!okJun) faltan.push("Junta sísmica");

  // Ejecuta cada render protegido: si una sección falla, no corta las demás
  // (especialmente la Junta sísmica, que va al final).
  const safe = (fn) => { try { fn(); } catch (e) { console.error("Memoria:", e); } };

  lastJ = null; lastD = null; lastS = null;
  el("preview").style.display = "";
  safe(renderUbicacion);
  safe(() => renderResumenCS(esc, der, sis, jun));
  safe(renderParametros);
  safe(renderRegularidad);
  safe(renderEspectro);

  // 5. Masa participativa
  if (okMas) safe(() => renderMasa(mas));
  else faltaSeccion("masaTexto", "tablaMasa", "Masa participativa");

  // 6. Sistema estructural
  if (okSis) safe(() => { renderSistema(sis); lastS = sis; });
  else {
    el("sisTexto").innerHTML = `<span class="falta-nota">⚠ No se ejecutó la verificación: Sistema estructural.</span>`;
    el("infoX").textContent = ""; el("infoY").textContent = "";
  }

  // 7. Escalamiento sísmico
  if (okEsc) safe(() => renderEscalamiento(esc));
  else faltaSeccion("notaEsc", "tablaEsc", "Escalamiento sísmico");

  // 8. Distorsiones (requiere Derivas)
  if (okDer && typeof der.limite === "number") LIMITE_DERIVA = der.limite;  // límite elegido en Derivas
  if (okDer) safe(() => {
    const dMax = (dir) => {
      const v = der.casos.filter((c) => c.direccion === dir).map((c) => c.max);
      return v.length ? Math.max(...v) : 0;
    };
    renderDistorsiones({ drift_x: dMax("X"), drift_y: dMax("Y") });
    renderDerivas(der);
    lastD = der;
  });
  else {
    faltaSeccion(null, "tablaDist", "Derivas");
  }

  // 10. Junta sísmica
  if (okJun) safe(() => renderJunta(jun));
  else faltaSeccion("juntaNota", "tablaJunta", "Junta sísmica");

  // Aviso de verificaciones al inicio del documento: solo si falta algo.
  generado = true;
  const av = el("avisoVerif");
  if (faltan.length) {
    av.style.display = "";
    av.className = "no";
    av.innerHTML = "⚠ Verificaciones no ejecutadas: <b>" + faltan.join(", ") +
      "</b>. Las secciones correspondientes quedan marcadas. Ejecútalas en sus pestañas y vuelve a generar para completarlas.";
    el("estado").textContent = "Memoria generada con observaciones · falta: " + faltan.join(", ") + ".";
    toast("warn", "Memoria con observaciones", "Falta: " + faltan.join(", "));
  } else {
    av.style.display = "none";
    av.innerHTML = "";
    el("estado").textContent = "Memoria de cálculo generada.";
    toast("success", "Memoria generada", "Documento listo.");
  }
}

// --- Ubicación + mapa del Perú ---
function renderUbicacion() {
  const p = params || {};
  let u = null;
  try { u = JSON.parse(localStorage.getItem("e030-ubicacion") || "null"); } catch {}
  const zonaN = (p.zona || (u && u.zona) || "").toString();
  const Zval = typeof p.Z === "number" ? ` (Z = ${p.Z})` : "";
  let lugar = "";
  if (u && (u.distrito || u.provincia || u.departamento)) {
    lugar = "El proyecto se ubica en " +
      [u.distrito, u.provincia, u.departamento].filter(Boolean).join(", ") + ". ";
  }
  el("ubiTexto").innerHTML =
    `${lugar}Según la zonificación sísmica de la Norma E.030, corresponde a la ` +
    `<b>zona sísmica ${zonaN.replace("Z", "Z")}</b>${Zval}.`;
  const box = el("mapaMem");
  if (box && typeof MAPA_SVG !== "undefined") {
    box.innerHTML = MAPA_SVG;
    const svg = box.querySelector("svg");
    if (svg && u) colocarPinUbic(svg, u);
  }
}

// Pin (chincheta) en una coordenada del mapa.
function pinEnMapa(svg, cx, cy) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  const h = (vb && vb.height) || 1464;
  const k = (h * 0.05) / 24;
  const pin = document.createElementNS("http://www.w3.org/2000/svg", "g");
  pin.style.pointerEvents = "none";
  pin.innerHTML =
    '<path d="M0 0 C-7 -11 -11 -15 -11 -22 A11 11 0 1 1 11 -22 C11 -15 7 -11 0 0 Z" fill="#dc2626" stroke="#fff" stroke-width="2"/>' +
    '<circle cx="0" cy="-22" r="4.5" fill="#fff"/>';
  svg.appendChild(pin); // al final → encima de los distritos
  pin.setAttribute("transform", `translate(${cx},${cy}) scale(${k})`);
}

// Coloca el pin en el distrito (o centroide del departamento) de la ubicación.
function colocarPinUbic(svg, u) {
  try {
    let path = null;
    if (u.distrito && u.departamento) {
      path = svg.querySelector(
        `.dep[data-dep="${u.departamento}"][data-prov="${u.provincia}"][data-dist="${u.distrito}"]`);
    }
    if (path) {
      const b = path.getBBox();
      pinEnMapa(svg, b.x + b.width / 2, b.y + b.height / 2);
      return;
    }
    if (u.departamento) {  // centroide del departamento
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      svg.querySelectorAll(`.dep[data-dep="${u.departamento}"]`).forEach((p) => {
        try { const b = p.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); } catch {}
      });
      if (x0 !== Infinity) pinEnMapa(svg, (x0 + x1) / 2, (y0 + y1) / 2);
    }
  } catch (e) {}
}

// --- Cuadro resumen: cargas sísmicas + resultados por dirección ---
function renderResumenCS(esc, der, sis, jun) {
  const p = params;
  el("rsZ").textContent = p.Z;
  el("rsU").textContent = (Math.round(p.U * 100) / 100).toFixed(2);
  const sx = sis && sis.direcciones && sis.direcciones.X;
  const sy = sis && sis.direcciones && sis.direcciones.Y;
  const reg = p.regular ? "Regular" : "Irregular";
  el("rsR").innerHTML =
    `Rx = ${n2(p.Rx)}${sx ? ` (${sx.sistema}, ${reg})` : ` (${reg})`}<br>` +
    `Ry = ${n2(p.Ry)}${sy ? ` (${sy.sistema}, ${reg})` : ` (${reg})`}`;

  const frac = esc ? (esc.frac || (p.regular ? 0.8 : 0.9)) : (p.regular ? 0.8 : 0.9);
  const dirData = (dir) => {
    const cs = esc && Array.isArray(esc.casos) ? esc.casos.filter((c) => c.dir === dir) : [];
    const T = cs.length ? cs[0].T : null;
    const Vest = cs.length ? cs[0].Vest : null;
    const Vdin = cs.length ? Math.max(...cs.map((c) => c.Vdin)) : null;
    const f = (Vest && Vdin) ? Math.max(1, frac * Vest / Vdin) : null;
    const Vdis = (f && Vdin) ? f * Vdin : Vdin;       // cortante de diseño = f·Vdin
    const de = jun && jun.dir && jun.dir[dir] ? jun.dir[dir].de : null;  // despl. azotea (m)
    let drift = null;                                  // máx deriva (igual que pestaña Derivas)
    if (der && Array.isArray(der.casos)) {
      const v = der.casos.filter((c) => c.direccion === dir).map((c) => c.max);
      drift = v.length ? Math.max(...v) : null;
    }
    const sd = sis && sis.direcciones && sis.direcciones[dir];
    return { T, Vdis, de, drift, sistema: sd ? sd.sistema : null, R0: sd ? sd.R0 : null };
  };
  const fila = (label, d) =>
    `<tr><td><b>${label}</b></td><td>${d.sistema || "—"}</td><td>${d.R0 != null ? d.R0 : "—"}</td>` +
    `<td>${d.T != null ? n3(d.T) : "—"}</td><td>${d.Vdis != null ? n2(d.Vdis) : "—"}</td>` +
    `<td>${d.de != null ? n2(d.de * 100) : "—"}</td><td>${d.drift != null ? parseFloat(d.drift.toFixed(6)) : "—"}</td></tr>`;
  el("rsRes").innerHTML = fila("X-X", dirData("X")) + fila("Y-Y", dirData("Y"));
}

// --- Masa participativa ---
function renderMasa(m) {
  let fx = -1, fy = -1, mx = -1, my = -1;
  m.modos.forEach((md, i) => { if (md.ux > mx) { mx = md.ux; fx = i; } if (md.uy > my) { my = md.uy; fy = i; } });
  el("tablaMasa").querySelector("tbody").innerHTML = m.modos.map((md, i) => {
    const fund = (i === fx || i === fy);
    const tag = i === fx ? " (X)" : i === fy ? " (Y)" : "";
    return `<tr class="${fund ? "fund" : ""}"><td><b>${md.modo}</b>${tag}</td><td>${md.periodo}</td>` +
           `<td>${pctMasa(md.ux)}</td><td>${pctMasa(md.uy)}</td>` +
           `<td>${pctMasa(md.sumux)}</td><td>${pctMasa(md.sumuy)}</td></tr>`;
  }).join("");
}

// --- Escalamiento sísmico ---
function renderEscalamiento(esc) {
  const pc = Math.round((esc.frac || 0.9) * 100);
  el("thFracEsc").textContent = `${pc}% V est.`;
  el("tablaEsc").querySelector("tbody").innerHTML = (esc.casos || []).map((c) =>
    `<tr><td><b>${c.caso}</b></td><td>${c.dir}</td><td>${n3(c.T)}</td><td>${n2(c.C)}</td>` +
    `<td>${n2(c.Vest)}</td><td>${n2((esc.frac || 0.9) * c.Vest)}</td><td>${n2(c.Vdin)}</td>` +
    `<td><b>${n3(c.f)}</b></td></tr>`).join("");
  el("notaEsc").innerHTML =
    `Peso sísmico P = <b>${n2(esc.peso)}</b>. Cada caso tiene su propio f = ${pc}%·V<sub>est</sub> / V<sub>din</sub> ` +
    `(mínimo 1.0). Los factores se aplican dentro de las envolventes SISMO: XX/YY.`;
}

// --- Junta sísmica ---
function renderJunta(j) {
  const fila = (d, o) =>
    `<tr><td><b>${d}</b></td><td>${n3(o.de)}</td><td>${n3(o.dv)}</td>` +
    `<td>${n3(o.sForm)}</td><td>${n3(o.sDesp)}</td>` +
    `<td><b>${n3(o.s)}</b></td><td>${n3(o.sepLim)}</td></tr>`;
  el("tablaJunta").querySelector("tbody").innerHTML = fila("X", j.dir.X) + fila("Y", j.dir.Y);
  const nota = j.vecJunta
    ? "La edificación vecina tiene junta reglamentaria → separación al límite ≥ s/2 (Art. 52.3)."
    : "Sin junta reglamentaria en la vecina → además, separación de s/2 (propio) + s/2 (vecino) (Art. 52.4).";
  el("juntaNota").innerHTML =
    `<b>Separación sísmica mínima:</b> dirección X = <b>${n3(j.dir.X.s)} m</b> · ` +
    `dirección Y = <b>${n3(j.dir.Y.s)} m</b>. ${nota}`;
}

// --- 2.5 Sistema estructural (pasteles) ---
let pieXc = null, pieYc = null;
function pie(canvasId, prev, pct, sistema, gris) {
  const m = Math.max(0, Math.min(100, pct));
  const plomo = "#94a3b8";
  if (prev) prev.destroy();
  const data = gris ? [100] : [m, 100 - m];
  const labels = gris ? ["No aplica"] : ["Muros", "Pórticos / resto"];
  const bg = gris ? [plomo] : [colores.x, colores.y];
  return new Chart(el(canvasId), {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: bg, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: "60%",
      plugins: { legend: { display: !gris, position: "bottom" },
        title: { display: true, text: gris ? sistema : `${m.toFixed(1)}% muros · ${sistema}`, font: { size: 13, weight: "700" } } } },
  });
}
function renderSistema(s) {
  // Albañilería o péndulo invertido en la dirección → el % de muros de concreto
  // no aplica: el pastel se dibuja completamente plomo (sin colorear).
  const draw = (dir, canvasId, prev, infoId) => {
    const d = s.direcciones[dir];
    const gris = d.pendulo || d.albanileria;
    const cv = el(canvasId);
    if (cv) cv.style.display = "";
    const c = pie(canvasId, prev, d.porcentaje, d.sistema, gris);
    el(infoId).innerHTML = gris
      ? `<b>${d.sistema}</b> · R₀=${d.R0}`
      : `<b>${d.sistema}</b> · R₀=${d.R0} · ${d.porcentaje}%`;
    return c;
  };
  pieXc = draw("X", "pieX", pieXc, "infoX");
  pieYc = draw("Y", "pieY", pieYc, "infoY");
}

// --- Distorsiones: 4 gráficos de deriva por nivel ---
let driftCharts = [];
function renderDerivas(d) {
  el("capDeriva").style.display = "";
  driftCharts.forEach((c) => c.destroy());
  driftCharts = [];
  const grid = el("driftGrid");
  grid.innerHTML = "";
  d.casos.forEach((caso) => {
    const cumple = caso.max <= LIMITE_DERIVA;
    const cell = document.createElement("div");
    cell.className = "drift-cell";
    cell.innerHTML = `<b>${caso.caso} (${caso.direccion})</b> — máx ${caso.max} ${cumple ? "✔" : "✘"}<div class="dw"><canvas></canvas></div>`;
    grid.appendChild(cell);
    const stories = caso.perfil.map((p) => p.story);
    const drifts = caso.perfil.map((p) => p.drift);
    const gridColor = "rgba(0,0,0,.06)";
    driftCharts.push(new Chart(cell.querySelector("canvas"), {
      type: "line",
      data: { labels: stories, datasets: [
        { label: "Deriva Δ/h", data: drifts, borderColor: colores.x, backgroundColor: colores.x,
          pointRadius: 2.5, pointBackgroundColor: colores.x, borderWidth: 2.2, tension: 0.25 },
        { label: `Límite ${LIMITE_DERIVA}`, data: stories.map(() => LIMITE_DERIVA), borderColor: "#94a3b8",
          pointRadius: 0, borderWidth: 2, borderDash: [6, 4] },
      ] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 26, font: { size: 11, weight: "600" } } } },
        scales: { x: { title: { display: true, text: "Δ/h", font: { weight: "600" } }, beginAtZero: true, grid: { color: gridColor } },
                  y: { grid: { color: gridColor }, title: { display: true, text: "Nivel", font: { weight: "600" } } } } },
    }));
  });
}

function renderModal(j) {
  const p = params, frac = p.regular ? 0.8 : 0.9;
  el("thPct").textContent = `${Math.round(frac * 100)}% V est.`;
  const dirs = [
    { d: "X-X", T: j.Tx, R: p.Rx, Vd: j.Vdin_x },
    { d: "Y-Y", T: j.Ty, R: p.Ry, Vd: j.Vdin_y },
  ];
  const rows = dirs.map((o) => {
    const C = factorC(o.T, p.Tp, p.Tl);
    const Vest = (p.Z * p.U * C * p.S / o.R) * j.peso;
    const Vpct = frac * Vest;
    const f = o.Vd > 0 ? Vpct / o.Vd : 0;
    return `<tr><td><b>${o.d}</b></td><td>${n3(o.T)}</td><td>${n2(C)}</td>` +
           `<td>${n2(Vest)}</td><td>${n2(o.Vd)}</td><td>${n2(Vpct)}</td>` +
           `<td><b>${n3(f)}</b></td></tr>`;
  });
  el("tablaModal").querySelector("tbody").innerHTML = rows.join("");
  el("notaF").innerHTML =
    `Peso sísmico P = <b>${n2(j.peso)}</b>. El factor <b>f</b> escala la cortante dinámica al `
    + `${Math.round(frac * 100)}% de la estática (estructura ${p.regular ? "regular" : "irregular"}).`;
}

function renderDistorsiones(j) {
  const filas = [["X-X", j.drift_x], ["Y-Y", j.drift_y]];
  el("tablaDist").querySelector("tbody").innerHTML = filas.map(([d, dr]) => {
    const ok = dr <= LIMITE_DERIVA;
    return `<tr><td><b>${d}</b></td><td>${parseFloat(dr.toFixed(6))}</td><td>${LIMITE_DERIVA}</td>` +
           `<td style="color:${ok ? "var(--green)" : "var(--red)"};font-weight:800">${ok ? "CUMPLE" : "NO CUMPLE"}</td></tr>`;
  }).join("");
}

function renderCortantes(j) {
  const p = params;
  const Cx = factorC(j.Tx, p.Tp, p.Tl), Cy = factorC(j.Ty, p.Tp, p.Tl);
  const VestX = (p.Z * p.U * Cx * p.S / p.Rx) * j.peso;
  const VestY = (p.Z * p.U * Cy * p.S / p.Ry) * j.peso;
  el("capCort").style.display = "";
  el("wrapCort").style.display = "";
  if (chartCort) chartCort.destroy();
  chartCort = new Chart(el("chartCort"), {
    type: "bar",
    data: { labels: ["X-X", "Y-Y"], datasets: [
      { label: "V estática", data: [VestX, VestY], backgroundColor: colores.x },
      { label: "V dinámica", data: [j.Vdin_x, j.Vdin_y], backgroundColor: colores.y },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { weight: "600" } } } },
      scales: { y: { title: { display: true, text: "Cortante basal" }, beginAtZero: true } },
    },
  });
}

// --- Tema y menú ---
function toggleTema() {
  const a = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", a === "dark" ? "light" : "dark");
  try { localStorage.setItem("e030-theme", a === "dark" ? "light" : "dark"); } catch {}
  if (generado) renderEspectro();
  if (lastS) renderSistema(lastS);
  if (lastD) renderDerivas(lastD);
}

el("btnGenerar").addEventListener("click", generar);

// Convierte LaTeX a texto unicode legible (para Word).
function texToText(s) {
  if (!s) return "";
  return s
    .replace(/_\{([^{}]*)\}/g, "_$1")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/\\dfrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\cdot/g, "·").replace(/\\times/g, "×")
    .replace(/\\leq/g, "≤").replace(/\\geq/g, "≥")
    .replace(/\\left\(/g, "(").replace(/\\right\)/g, ")")
    .replace(/\\left\[/g, "[").replace(/\\right\]/g, "]")
    .replace(/\\qquad/g, "      ").replace(/\\quad/g, "    ")
    .replace(/\\[,;:]/g, " ").replace(/\\!/g, "")
    .replace(/\\%/g, "%")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Rasteriza un SVG (con fills en línea) a PNG data URL.
function svgAPng(svgEl, width) {
  return new Promise((resolve) => {
    try {
      const xml = new XMLSerializer().serializeToString(svgEl);
      const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
      const img = new Image();
      img.onload = () => {
        const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
        const w = (vb && vb.width) || img.width || 1000;
        const h = (vb && vb.height) || img.height || 1464;
        const cv = document.createElement("canvas");
        cv.width = width; cv.height = Math.round(width * h / w);
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        try { resolve(cv.toDataURL("image/png")); } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch { resolve(null); }
  });
}

// Descargar como Word (.docx): convierte gráficos a imágenes y fórmulas a texto.
el("btnDocx").addEventListener("click", async () => {
  const pv = el("preview");
  if (pv.style.display === "none") {
    toast("warn", "Genera primero", "Pulsa «Generar memoria» antes de descargar.");
    return;
  }
  if (typeof htmlDocx === "undefined") {
    toast("error", "Sin librería", "No se cargó html-docx-js (revisa tu conexión a internet).");
    return;
  }
  const clon = pv.cloneNode(true);
  // Gráficos (canvas) → imágenes PNG
  const origCanvas = pv.querySelectorAll("canvas");
  const clonCanvas = clon.querySelectorAll("canvas");
  clonCanvas.forEach((cv, i) => {
    try {
      const img = document.createElement("img");
      img.src = origCanvas[i].toDataURL("image/png");
      img.setAttribute("width", "460");
      cv.parentNode.replaceChild(img, cv);
    } catch (e) {}
  });
  // Mapa del Perú (SVG) → imagen PNG (Word no admite SVG)
  try {
    const svgOrig = pv.querySelector("#mapaMem svg");
    const svgClon = clon.querySelector("#mapaMem svg");
    if (svgOrig && svgClon) {
      const png = await svgAPng(svgOrig, 340);
      if (png) {
        const img = document.createElement("img");
        img.src = png; img.setAttribute("width", "300");
        svgClon.parentNode.replaceChild(img, svgClon);
      }
    }
  } catch (e) {}
  // Fórmulas KaTeX → texto limpio (unicode legible en Word)
  clon.querySelectorAll(".katex").forEach((k) => {
    const ann = k.querySelector("annotation");
    const it = document.createElement("p");
    it.setAttribute("style", "text-align:center;font-style:italic;margin:8px 0");
    it.textContent = ann ? texToText(ann.textContent) : k.textContent;
    const disp = k.closest(".katex-display") || k;
    disp.parentNode.replaceChild(it, disp);
  });
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><style>` +
    `body{font-family:'Times New Roman',serif;font-size:11pt;color:#000}` +
    `h2{text-align:center;font-size:15pt}h3{font-size:13pt;margin-top:14px}` +
    `p{text-align:justify;margin:6px 0}` +
    `table{border-collapse:collapse;margin:8px auto;font-size:10pt}` +
    `th,td{border:1px solid #888;padding:4px 9px;text-align:center}` +
    `.cap{font-style:italic;text-align:center;color:#555;margin:8px 0 4px}` +
    `img{display:block;margin:6px auto}` +
    `</style></head><body>${clon.innerHTML}</body></html>`;
  try {
    const blob = htmlDocx.asBlob(html);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Memoria_de_calculo_E030.docx";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("success", "Word generado", "Memoria descargada en .docx.");
  } catch (e) {
    toast("error", "No se pudo generar", "Error al crear el .docx.");
  }
});
el("btnConfig").addEventListener("click", () => el("cfgPanel").classList.toggle("show"));

// Edición manual: el usuario ajusta textos, números, R o criterios a su gusto.
let editando = false;
el("btnEditar").addEventListener("click", () => {
  const pv = el("preview");
  if (pv.style.display === "none") {
    toast("warn", "Genera primero", "Pulsa «Generar memoria» antes de editar.");
    return;
  }
  editando = !editando;
  pv.contentEditable = editando ? "true" : "false";
  pv.classList.toggle("editando", editando);
  el("btnEditar").textContent = editando ? "✓ Fijar edición" : "✏ Editar";
  el("btnEditar").classList.toggle("btn-brand", editando);
  el("btnEditar").classList.toggle("btn-soft", !editando);
  if (editando) {
    el("estado").textContent = "Modo edición: haz clic en cualquier texto, número o celda para modificarlo a mano.";
    toast("success", "Edición activada", "Documento editable. Vuelve a pulsar para fijarlo.");
  } else {
    el("estado").textContent = "Edición fijada. Tus cambios manuales se conservan en el documento y en el PDF.";
  }
});
el("colX").addEventListener("input", guardarColores);
el("colY").addEventListener("input", guardarColores);
el("cfgReset").addEventListener("click", () => {
  el("colX").value = COLORES_DEF.x; el("colY").value = COLORES_DEF.y; guardarColores();
});
el("btnTheme").addEventListener("click", toggleTema);
el("sidebarToggle").addEventListener("click", () => document.querySelector(".app").classList.toggle("collapsed"));
cargarColores();
cargarParams();
pingApi();
setInterval(pingApi, 5000);
