/* ===================================================================
   Análisis Sísmico E.030 (2026) — Generador de espectro de respuesta
   Todo el cálculo corre en el navegador (sin servidor).
   =================================================================== */

// --- DATOS SÍSMICOS (según Norma Técnica E.030) ---
const Z_VALORES = { Z4: 0.45, Z3: 0.35, Z2: 0.25, Z1: 0.10 };
const USOS = { "Categoría A2": 1.50, "Categoría B": 1.30, "Categoría C": 1.00, "Art. 19.3": 0.80 };

const S_FIJO = {
  Z4: { S0: 0.80, S1: 1.00, S4: "Req. Análisis" },
  Z3: { S0: 0.80, S1: 1.00, S4: 1.30 },
  Z2: { S0: 0.80, S1: 1.00, S4: 1.70 },
  Z1: { S0: 0.80, S1: 1.00, S4: 2.40 },
};

const S_VAR = {
  Z4: { S2: [1.00, 1.10], S3: [1.10, 1.20] },
  Z3: { S2: [1.00, 1.15], S3: [1.15, 1.20] },
  Z2: { S2: [1.00, 1.30], S3: [1.30, 1.40] },
  Z1: { S2: [1.00, 1.30], S3: [1.30, 1.60] },
};

const T_FIJO = {
  S0: { Tp: 0.30, Tl: 3.00 },
  S1: { Tp: 0.40, Tl: 2.50 },
  S4: { Tp: 1.20, Tl: 1.60 },
};

const T_VAR = {
  S2: { Tp: [0.40, 0.60], Tl: [2.50, 2.00] },
  S3: { Tp: [0.60, 0.90], Tl: [2.00, 1.60] },
};

const V_LIM = { S2: [550, 350], S3: [350, 200] };

const API_URL = "http://127.0.0.1:8731";

// --- Estado ---
const state = {
  numModosMax: 9,
  numModosMin: 3,
  modosMaxManual: false,  // true si el usuario fijó Modos Máximos a mano
  modosAutoDone: false,   // ya se calculó nº pisos × 3 desde ETABS
  espectro: null, // { T:[], Sa:[], curvas:{}, Tp, Tl, Z, U, S, Rx, Ry, nombre, puntos:[[t,Sa]] }
  selectedCurves: new Set(["ZUCS", "ZUCS/RX", "ZUCS/RY"]),
};

// Metadatos de cada curva del ploteo
const CURVA_META = {
  "C":       { label: "C",       color: "#7c3aed" },
  "ZUCS":    { label: "ZUCS",    color: "#f5621e" },
  "ZUCS/RX": { label: "ZUCS/Rx", color: "#2563eb" },
  "ZUCS/RY": { label: "ZUCS/Ry", color: "#16a34a" },
};

// Perfiles de suelo, de menos a más desfavorable
const SUELO_ORDEN = ["S0", "S1", "S2", "S3", "S4"];
const SUELO_NOMBRE = {
  S0: "S0 (Roca dura)", S1: "S1 (Muy rígido)", S2: "S2 (Intermedio)",
  S3: "S3 (Blando)", S4: "S4 (Excepcional)",
};

// =====================================================================
// Cálculo de parámetros y espectro
// =====================================================================
// Persistencia del formulario de Datos (para no reiniciar al cambiar de pestaña)
const FORM_IDS = ["zona", "uso", "suelo", "vs30", "roX", "roY", "ia", "ip", "ts"];
function guardarForm() {
  try {
    const o = {};
    FORM_IDS.forEach((id) => { const e = el(id); if (e) o[id] = e.value; });
    if (el("chkVs30")) o.chkVs30 = el("chkVs30").checked;
    o.modosMax = state.numModosMax; o.modosMin = state.numModosMin; o.modosMaxManual = state.modosMaxManual;
    localStorage.setItem("e030-form", JSON.stringify(o));
  } catch (e) {}
}
function restaurarForm() {
  try {
    const o = JSON.parse(localStorage.getItem("e030-form") || "null");
    if (!o) return;
    FORM_IDS.forEach((id) => { if (o[id] != null && el(id)) el(id).value = o[id]; });
    if (typeof o.chkVs30 === "boolean" && el("chkVs30")) el("chkVs30").checked = o.chkVs30;
    if (Number.isFinite(o.modosMax)) state.numModosMax = o.modosMax;
    if (Number.isFinite(o.modosMin)) state.numModosMin = o.modosMin;
    if (o.modosMaxManual) state.modosMaxManual = true;
  } catch (e) {}
}

function calcularParametros() {
  guardarForm();
  const z = el("zona").value;
  const uText = el("uso").value;
  const s = el("suelo").value;
  const chk = el("chkVs30").checked;
  const v = parseFloat(el("vs30").value) || 450.0;

  // Coeficiente de reducción R = Ro · Ia · Ip (por dirección)
  const roX = parseFloat(el("roX").value) || 1;
  const roY = parseFloat(el("roY").value) || 1;
  const ia = parseFloat(el("ia").value) || 1;
  const ip = parseFloat(el("ip").value) || 1;
  const Rx = Math.max(roX * ia * ip, 0.01);
  const Ry = Math.max(roY * ia * ip, 0.01);
  actualizarRegBadge();

  const Z = Z_VALORES[z];
  const U = USOS[uText];

  let S, Tp, Tl;

  if (s === "S0" || s === "S1" || s === "S4") {
    S = S_FIJO[z][s];
    Tp = T_FIJO[s].Tp;
    Tl = T_FIJO[s].Tl;
  } else {
    if (!chk) {
      S = S_VAR[z][s][1];
      Tp = T_VAR[s].Tp[1];
      Tl = T_VAR[s].Tl[1];
    } else {
      const [vh, vl] = V_LIM[s];
      const vClamp = vh > vl ? Math.max(Math.min(v, vh), vl) : Math.max(Math.min(v, vl), vh);
      const f = (vh - vClamp) / (vh - vl);
      S = S_VAR[z][s][0] + f * (S_VAR[z][s][1] - S_VAR[z][s][0]);
      Tp = T_VAR[s].Tp[0] + f * (T_VAR[s].Tp[1] - T_VAR[s].Tp[0]);
      Tl = T_VAR[s].Tl[0] + f * (T_VAR[s].Tl[1] - T_VAR[s].Tl[0]);
    }
  }

  // --- Validación Zona 4 (solo categoría A2/B): debe cumplirse Ts < 0.65·Tp ---
  const tsAplica = z === "Z4" && (uText === "Categoría A2" || uText === "Categoría B");
  if (tsAplica) evaluarAvisoZ4(z, s, Tp, parseFloat(el("ts").value) || 0);
  else setAviso("");

  // Caso "Requiere análisis específico"
  if (typeof S === "string") {
    state.espectro = null;
    mostrarEspectroVacio();
    return;
  }

  // Vectores de las curvas
  const T = linspace(0.01, 5.0, 500);
  const curvas = {
    "C":       T.map((t) => factorC(t, Tp, Tl)),
    "ZUCS":    T.map((t) => Z * U * S * factorC(t, Tp, Tl)),
    "ZUCS/RX": T.map((t) => (Z * U * S * factorC(t, Tp, Tl)) / Rx),
    "ZUCS/RY": T.map((t) => (Z * U * S * factorC(t, Tp, Tl)) / Ry),
  };
  const Sa = curvas["ZUCS"]; // espectro elástico (footer / exportación)

  // Puntos para ETABS (t = 0 .. 5, paso 0.05) — siempre el espectro elástico ZUCS
  const puntos = [];
  for (let t = 0; t <= 5.0 + 1e-3; t += 0.05) {
    const tR = round3(t);
    puntos.push([tR, Z * U * S * factorC(tR, Tp, Tl)]);
  }

  const nombre = `E030-${z}-U${U}-${s}`;
  state.espectro = { T, Sa, curvas, Tp, Tl, Z, U, S, Rx, Ry, nombre, puntos, z, s };
  // Comparte los parámetros con las otras páginas (Junta sísmica, Memoria, etc.)
  try {
    localStorage.setItem("e030-params", JSON.stringify({
      Z, U, S, Tp, Tl, Rx, Ry, zona: z, suelo: s,
      Ia: ia, Ip: ip, RoX: roX, RoY: roY, uso: el("uso").value, regular: esRegular(),
    }));
  } catch (e) {}
  dibujarEspectro();
}

// Advertencia E.030 para Zona 4: se exige Ts < 0.65·Tp
function evaluarAvisoZ4(z, s, Tp, ts) {
  if (z !== "Z4" || typeof Tp !== "number") return setAviso("");
  const lim = 0.65 * Tp;
  if (ts < lim) return setAviso("");
  const idx = SUELO_ORDEN.indexOf(s);
  const sig = idx >= 0 && idx < SUELO_ORDEN.length - 1 ? SUELO_NOMBRE[SUELO_ORDEN[idx + 1]] : null;
  setAviso(
    `⚠ Zona 4: debe cumplirse Ts < 0.65·Tp = ${lim.toFixed(3)} s. ` +
    `Con Ts = ${ts.toFixed(3)} s no se cumple. ` +
    (sig ? `Trabaje con el siguiente perfil de suelo más desfavorable: ${sig}.`
         : `Ya está en el suelo más desfavorable (S4): requiere análisis específico.`)
  );
}

function setAviso(msg) {
  const box = el("avisoZ4");
  if (!msg) { box.classList.add("hidden"); box.textContent = ""; }
  else { box.textContent = msg; box.classList.remove("hidden"); }
}

// Factor de amplificación sísmica C (E.030)
function factorC(t, Tp, Tl) {
  if (t < 0.2 * Tp) return 1 + 7.5 * (t / Tp);
  if (t <= Tp) return 2.5;
  if (t < Tl) return 2.5 * (Tp / t);
  return 2.5 * (Tp * Tl) / (t * t);
}

// =====================================================================
// Gráfico (Chart.js)
// =====================================================================
let chart = null;

// Colores del gráfico según el tema activo (claro / oscuro)
function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  return {
    grid: cs.getPropertyValue("--plot-grid").trim() || "rgba(0,0,0,0.08)",
    tick: cs.getPropertyValue("--muted").trim() || "#7a7269",
    ink: cs.getPropertyValue("--ink").trim() || "#1a1512",
  };
}

function dibujarEspectro() {
  const e = state.espectro;
  const col = chartColors();

  // Curvas seleccionadas; si no hay ninguna marcada, no se grafica nada
  const keys = ["C", "ZUCS", "ZUCS/RX", "ZUCS/RY"].filter((k) => state.selectedCurves.has(k));
  if (keys.length === 0) {
    if (chart) { chart.destroy(); chart = null; }
    el("plotEmpty").textContent = "Selecciona una curva para graficar";
    el("plotEmpty").classList.remove("hidden");
    el("plotFooter").textContent = "";
    return;
  }
  el("plotEmpty").classList.add("hidden");

  const datasets = keys.map((k) => ({
    label: CURVA_META[k].label,
    data: e.T.map((t, i) => ({ x: t, y: e.curvas[k][i] })),
    borderColor: CURVA_META[k].color,
    backgroundColor: hexA(CURVA_META[k].color, 0.12),
    borderWidth: 2.4,
    pointRadius: 0,
    tension: 0.1,
    fill: { target: "origin", above: hexA(CURVA_META[k].color, keys.length === 1 ? 0.14 : 0.10) },
  }));

  const maxY = Math.max(...keys.flatMap((k) => e.curvas[k])) * 1.1 || 1;

  const cfg = {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "nearest", intersect: false },
      scales: {
        x: {
          type: "linear", min: 0, max: 5,
          title: { display: true, text: "T (s)", color: col.tick },
          grid: { color: col.grid },
          ticks: { color: col.tick },
        },
        y: {
          min: 0, max: maxY,
          title: { display: true, text: "Sa (g) / C", color: col.tick },
          grid: { color: col.grid },
          ticks: { color: col.tick },
        },
      },
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          callbacks: {
            title: (it) => `T = ${it[0].parsed.x.toFixed(3)} s`,
            label: (it) => `${it.dataset.label} = ${it.parsed.y.toFixed(4)}`,
          },
        },
      },
    },
    plugins: [verticalLinesPlugin(e.Tp, e.Tl)],
  };

  if (chart) chart.destroy();
  chart = new Chart(el("chart"), cfg);

  const maxSa = Math.max(...e.Sa);
  el("plotFooter").textContent =
    `${e.nombre}   ·   Tp = ${e.Tp.toFixed(3)} s   ·   Tl = ${e.Tl.toFixed(3)} s   ·   ` +
    `Rx = ${e.Rx.toFixed(2)}   ·   Ry = ${e.Ry.toFixed(2)}   ·   Sa,máx = ${maxSa.toFixed(4)} g`;
}

// Plugin para dibujar líneas verticales en Tp y Tl
function verticalLinesPlugin(Tp, Tl) {
  return {
    id: "vlines",
    afterDraw(c) {
      const { ctx, chartArea: area, scales } = c;
      [["Tp", Tp], ["Tl", Tl]].forEach(([label, val]) => {
        const x = scales.x.getPixelForValue(val);
        ctx.save();
        ctx.strokeStyle = "rgba(255,85,85,0.7)";
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(x, area.top); ctx.lineTo(x, area.bottom); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#ff5555";
        ctx.font = "12px sans-serif";
        ctx.fillText(`${label} = ${val.toFixed(3)} s`, x + 5, area.top + (label === "Tp" ? 16 : 32));
        ctx.restore();
      });
    },
  };
}

function mostrarEspectroVacio() {
  if (chart) { chart.destroy(); chart = null; }
  el("plotEmpty").textContent = "Requiere Análisis Específico";
  el("plotEmpty").classList.remove("hidden");
  el("plotFooter").textContent = "";
}

// =====================================================================
// Exportaciones
// =====================================================================
function exportarCSV() {
  if (!requiereEspectro()) return;
  const e = state.espectro;
  let csv = "Nombre,Periodo (s),Sa (g),Amortiguamiento\n";
  e.puntos.forEach(([t, sa], i) => {
    csv += `${e.nombre},${gFormat(t)},${sa.toFixed(4)},${i === 0 ? "0.05" : ""}\n`;
  });
  descargar(`${e.nombre}.csv`, csv, "text/csv");
  toast("success", "CSV exportado", `${e.puntos.length} puntos del espectro.`);
}

function exportarJSON() {
  if (!requiereEspectro()) return;
  const e = state.espectro;
  const obj = {
    norma: "E.030 (2026)",
    nombre: e.nombre,
    parametros: { Z: e.Z, U: e.U, S: e.S, Tp: e.Tp, Tl: e.Tl, zona: e.z, suelo: e.s },
    espectro: e.puntos.map(([t, sa]) => ({ T: gFormat(t), Sa: +sa.toFixed(4) })),
  };
  descargar(`${e.nombre}.json`, JSON.stringify(obj, null, 2), "application/json");
  toast("success", "JSON exportado", `${e.puntos.length} puntos del espectro.`);
}

// Exporta las curvas seleccionadas como archivos .txt SEPARADOS (uno por curva).
// Cada archivo contiene SOLO números (T y valor, sin encabezados); la curva se
// identifica únicamente en el NOMBRE del archivo.
function exportarTXT(curvas) {
  if (!requiereEspectro()) return;
  const e = state.espectro;
  const base = Array.isArray(curvas) && curvas.length
    ? curvas
    : ["C", "ZUCS", "ZUCS/RX", "ZUCS/RY"].filter((k) => state.selectedCurves.has(k));
  const keys = base.length ? base : ["ZUCS"];

  // Etiqueta segura para el nombre de archivo (sin "/", inválido en nombres)
  const TAG = { "C": "C", "ZUCS": "ZUCS", "ZUCS/RX": "ZUCS-Rx", "ZUCS/RY": "ZUCS-Ry" };

  keys.forEach((k, i) => {
    let txt = "";
    for (let t = 0; t <= 5.0 + 1e-3; t += 0.05) {
      const tR = round3(t);
      const c = factorC(tR, e.Tp, e.Tl);
      const zucs = e.Z * e.U * e.S * c;
      const val = { "C": c, "ZUCS": zucs, "ZUCS/RX": zucs / e.Rx, "ZUCS/RY": zucs / e.Ry }[k];
      txt += val.toFixed(4) + "\n";
    }
    // Descargas escalonadas para que el navegador no bloquee múltiples archivos
    setTimeout(() => descargar(`${e.nombre}_${TAG[k]}.txt`, txt, "text/plain"), i * 300);
  });

  toast("success", "TXT exportado", `${keys.length} archivo(s) separado(s): ${keys.map((k) => TAG[k]).join(", ")}.`);
}

// =====================================================================
// API ETABS (servidor Python local opcional)
// =====================================================================
async function pingApi() {
  try {
    const r = await fetch(`${API_URL}/ping`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    setApi(true, j.etabs ? "ETABS conectado" : "API activa (ETABS cerrado)");
    if (j.etabs) autoModosMax();
    return j;
  } catch {
    setApi(false, "ETABS: sin conexión");
    return null;
  }
}

// Modos Máximos por defecto = nº de pisos × 3 (de ETABS). El usuario puede cambiarlo.
async function autoModosMax() {
  if (state.modosAutoDone || state.modosMaxManual) return;
  try {
    const r = await fetch(`${API_URL}/niveles`, { signal: AbortSignal.timeout(2000) });
    const j = await r.json();
    if (!j.ok || !Array.isArray(j.niveles)) return;
    const nPisos = j.niveles.filter((n) => !/base/i.test(String(n))).length;
    if (nPisos > 0) {
      state.modosAutoDone = true;
      state.numModosMax = nPisos * 3;
      if (el("modosMax")) el("modosMax").value = state.numModosMax;
    }
  } catch { /* reintenta en el próximo ping */ }
}

function setApi(online, text) {
  el("apiDot").classList.toggle("online", online);
  el("apiText").textContent = text;
}

async function cargarAEtabs() {
  if (!requiereEspectro()) return;
  const e = state.espectro;
  toast("warn", "Enviando a ETABS…", "Conectando con la API local.");
  try {
    const r = await fetch(`${API_URL}/cargar_espectro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: e.nombre, puntos: e.puntos }),
    });
    const j = await r.json();
    if (j.ok) toast("success", "Cargado a ETABS", j.mensaje);
    else toast("error", "Error en ETABS", j.mensaje);
  } catch {
    toast("error", "API no disponible", "Abre ESPECTRA con ETABS abierto  en esta PC con ETABS abierto.");
  }
}

async function generarMasasE030() {
  const e = state.espectro;
  if (!e) { toast("warn", "Sin espectro", "El suelo seleccionado requiere análisis específico."); return; }
  toast("warn", "Generando en ETABS…", "Masas, casos modales y combinaciones.");
  try {
    const r = await fetch(`${API_URL}/generar_masas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uso: el("uso").value,
        nombre_espectro: e.nombre,
        modos_max: state.numModosMax,
        modos_min: state.numModosMin,
        regular: esRegular(),
        rx: e.Rx,
        ry: e.Ry,
      }),
    });
    const j = await r.json();
    if (j.ok) toast("success", "E.030 generado", j.mensaje);
    else toast("error", "Error en ETABS", j.mensaje);
  } catch {
    toast("error", "API no disponible", "Abre ESPECTRA con ETABS abierto  en esta PC con ETABS abierto.");
  }
}

// Acción única "ETABS": carga el espectro y genera masas + casos E.030
async function procesarETABS() {
  if (!requiereEspectro()) return;
  await cargarAEtabs();
  await generarMasasE030();
}

function requiereEspectro() {
  if (!state.espectro) {
    toast("warn", "Sin datos de espectro", "El suelo seleccionado requiere análisis específico.");
    return false;
  }
  return true;
}

// =====================================================================
// UI: visibilidad Vs30, modal, eventos
// =====================================================================
// Regularidad derivada de los factores de irregularidad: regular sólo si Ia = Ip = 1
function esRegular() {
  return parseFloat(el("ia").value) === 1 && parseFloat(el("ip").value) === 1;
}
function actualizarRegBadge() {
  const b = el("regBadge"); if (!b) return;
  const reg = esRegular();
  b.textContent = "Estructura: " + (reg ? "Regular" : "Irregular");
  b.classList.toggle("irr", !reg);
}

function actualizarVisibilidad() {
  const s = el("suelo").value;
  const esVar = s === "S2" || s === "S3";
  el("vs30Block").classList.toggle("hidden", !esVar);
  if (!esVar) el("chkVs30").checked = false;
  el("vs30Input").classList.toggle("hidden", !(esVar && el("chkVs30").checked));

  // Ts solo aplica a Zona 4 con categoría A2 o B
  const z = el("zona").value, u = el("uso").value;
  const tsAplica = z === "Z4" && (u === "Categoría A2" || u === "Categoría B");
  el("tsBlock").classList.toggle("hidden", !tsAplica);
}

function recalcular() {
  actualizarVisibilidad();
  calcularParametros();
}

// =====================================================================
// Mapa / ubicación: Departamento → Provincia → Distrito → Zona
// =====================================================================
function fillOptions(sel, arr, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>` + arr.map((x) => `<option>${x}</option>`).join("");
}

function zonaDetectada() {
  if (typeof ZONAS_PERU === "undefined") return null;
  const dep = ZONAS_PERU[el("selDep").value];
  if (!dep) return null;
  const prov = dep[el("selProv").value];
  if (!prov) return null;
  return prov[el("selDist").value] || null;
}

// Coloca un pin de ubicación en (cx,cy) del mapa
function placeMarkerAt(svg, cx, cy) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  const h = vb && vb.height ? vb.height : 600;
  const k = (h * 0.05) / 24;
  let pin = svg.querySelector("#mapPin");
  if (!pin) {
    pin = document.createElementNS("http://www.w3.org/2000/svg", "g");
    pin.setAttribute("id", "mapPin");
    pin.style.pointerEvents = "none";
    pin.innerHTML =
      '<path d="M0 0 C-7 -11 -11 -15 -11 -22 A11 11 0 1 1 11 -22 C11 -15 7 -11 0 0 Z" fill="#1a1512" stroke="#fff" stroke-width="2"/>' +
      '<circle cx="0" cy="-22" r="4.5" fill="#fff"/>';
  }
  svg.appendChild(pin); // siempre al final → encima de los distritos
  pin.setAttribute("transform", `translate(${cx},${cy}) scale(${k})`);
  pin.style.display = "";
}

function placeMarkerPath(path) {
  const svg = el("mapaBox") && el("mapaBox").querySelector("svg");
  if (!svg || !path) return;
  let b; try { b = path.getBBox(); } catch { return; }
  placeMarkerAt(svg, b.x + b.width / 2, b.y + b.height / 2);
}

// Pin en el centroide del conjunto de distritos de un departamento
function placeMarkerDep(dep) {
  const svg = el("mapaBox") && el("mapaBox").querySelector("svg");
  if (!svg || !dep) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  svg.querySelectorAll('.dep[data-dep="' + dep + '"]').forEach((p) => {
    try { const b = p.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); } catch {}
  });
  if (x0 === Infinity) return;
  placeMarkerAt(svg, (x0 + x1) / 2, (y0 + y1) / 2);
}

function actualizarZonaDetectada() {
  const z = zonaDetectada();
  el("zonaResult").textContent = z ? `Zona sísmica: ${z} (${Z_VALORES[z].toFixed(2)})` : "Zona sísmica: —";
  // Resalta la banda de respaldo y la leyenda
  document.querySelectorAll("#modalMapa .zb").forEach((b) =>
    b.classList.toggle("on", !!z && b.classList.contains(z.toLowerCase()))
  );
  document.querySelectorAll("#mapaLegend [data-zone]").forEach((s) =>
    s.classList.toggle("on", !!z && s.dataset.zone === z)
  );
}

function initMapa() {
  if (typeof ZONAS_PERU === "undefined") return;
  const selDep = el("selDep"), selProv = el("selProv"), selDist = el("selDist");
  fillOptions(selDep, Object.keys(ZONAS_PERU), "Departamento");
  fillOptions(selProv, [], "Provincia");
  fillOptions(selDist, [], "Distrito");

  // Inyecta el mapa SVG interactivo y conecta clic por departamento
  const box = el("mapaBox");
  if (box && typeof MAPA_SVG !== "undefined") {
    box.innerHTML = MAPA_SVG;
    box.querySelectorAll(".dep").forEach((p) => {
      p.addEventListener("click", () => {
        const z = p.dataset.zone, dep = p.dataset.dep, prov = p.dataset.prov, dist = p.dataset.dist;
        box.querySelectorAll(".dep.sel").forEach((o) => o.classList.remove("sel"));
        p.classList.add("sel");
        placeMarkerPath(p);
        // Sincroniza departamento → provincia → distrito exactos
        if (ZONAS_PERU[dep]) {
          selDep.value = dep;
          fillOptions(selProv, Object.keys(ZONAS_PERU[dep]), "Provincia");
          if (prov && ZONAS_PERU[dep][prov]) {
            selProv.value = prov;
            fillOptions(selDist, Object.keys(ZONAS_PERU[dep][prov]), "Distrito");
            if (dist && ZONAS_PERU[dep][prov][dist]) selDist.value = dist;
          } else { fillOptions(selDist, [], "Distrito"); }
        }
        actualizarZonaDetectada();
        if (z) el("zona").value = z; // deja lista la zona para "Aplicar"
      });
      const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
      t.textContent = `${p.dataset.dist || p.dataset.dep} · ${p.dataset.dep} · Zona ${p.dataset.zone}`;
      p.appendChild(t);
    });
  }

  const limpiarSel = () => box.querySelectorAll(".dep.sel").forEach((o) => o.classList.remove("sel"));

  selDep.addEventListener("change", () => {
    fillOptions(selProv, Object.keys(ZONAS_PERU[selDep.value] || {}), "Provincia");
    fillOptions(selDist, [], "Distrito");
    limpiarSel();
    if (selDep.value) placeMarkerDep(selDep.value);
    actualizarZonaDetectada();
  });
  selProv.addEventListener("change", () => {
    fillOptions(selDist, Object.keys((ZONAS_PERU[selDep.value] || {})[selProv.value] || {}), "Distrito");
    actualizarZonaDetectada();
  });
  selDist.addEventListener("change", () => {
    actualizarZonaDetectada();
    limpiarSel();
    const path = box.querySelector('.dep[data-dep="' + selDep.value + '"][data-prov="' + selProv.value + '"][data-dist="' + selDist.value + '"]');
    if (path) { path.classList.add("sel"); placeMarkerPath(path); }
  });

  el("btnMapa").addEventListener("click", () => el("modalMapa").classList.remove("hidden"));
  // Modal Tabla N° 7 (Categoría / factor U)
  el("btnTablaU").addEventListener("click", () => el("modalTablaU").classList.remove("hidden"));
  el("btnCerrarTablaU").addEventListener("click", () => el("modalTablaU").classList.add("hidden"));
  el("modalTablaU").addEventListener("click", (ev) => { if (ev.target === el("modalTablaU")) el("modalTablaU").classList.add("hidden"); });

  // Modal Tablas N° 4 y N° 5 (Parámetros de sitio S, Tp, Tl)
  el("btnTablaS").addEventListener("click", () => el("modalTablaS").classList.remove("hidden"));
  el("btnCerrarTablaS").addEventListener("click", () => el("modalTablaS").classList.add("hidden"));
  el("modalTablaS").addEventListener("click", (ev) => { if (ev.target === el("modalTablaS")) el("modalTablaS").classList.add("hidden"); });

  // Modal Tabla N° 10 (Sistemas estructurales y R0)
  el("btnTablaR").addEventListener("click", () => el("modalTablaR").classList.remove("hidden"));
  el("btnCerrarTablaR").addEventListener("click", () => el("modalTablaR").classList.add("hidden"));
  el("modalTablaR").addEventListener("click", (ev) => { if (ev.target === el("modalTablaR")) el("modalTablaR").classList.add("hidden"); });

  // Modal Tablas N° 11 y N° 12 (Irregularidades)
  el("btnTablaIrr").addEventListener("click", () => el("modalTablaIrr").classList.remove("hidden"));
  el("btnCerrarTablaIrr").addEventListener("click", () => el("modalTablaIrr").classList.add("hidden"));
  el("modalTablaIrr").addEventListener("click", (ev) => { if (ev.target === el("modalTablaIrr")) el("modalTablaIrr").classList.add("hidden"); });

  // Selección directa desde las tablas (clic en fila/encabezado → asigna valor)
  wirePick("modalTablaU", (t) => {
    if (!t.dataset.uso) return null;
    el("uso").value = t.dataset.uso;
    return `Categoría aplicada: ${t.dataset.uso}.`;
  });
  wirePick("modalTablaS", (t) => {
    if (!t.dataset.suelo) return null;
    el("suelo").value = t.dataset.suelo;
    return `Perfil de suelo aplicado: ${t.dataset.suelo}.`;
  });
  wirePick("modalTablaR", (t) => {
    if (!t.dataset.ro) return null;
    el("roX").value = t.dataset.ro;
    el("roY").value = t.dataset.ro;
    return `R₀ = ${t.dataset.ro} aplicado a Ro X y Ro Y.`;
  });
  wirePick("modalTablaIrr", (t) => {
    if (t.dataset.ia != null) { el("ia").value = t.dataset.ia; return `Iₐ = ${t.dataset.ia} aplicado.`; }
    if (t.dataset.ip != null) { el("ip").value = t.dataset.ip; return `Iₚ = ${t.dataset.ip} aplicado.`; }
    return null;
  });
  el("btnCancelMapa").addEventListener("click", () => el("modalMapa").classList.add("hidden"));
  el("modalMapa").addEventListener("click", (ev) => { if (ev.target === el("modalMapa")) el("modalMapa").classList.add("hidden"); });
  el("btnAplicarMapa").addEventListener("click", () => {
    const sel = el("mapaBox") && el("mapaBox").querySelector(".dep.sel");
    const z = zonaDetectada() || (sel ? sel.dataset.zone : null);
    if (!z) return toast("warn", "Selecciona ubicación", "Haz clic en un departamento del mapa o elige distrito.");
    const etiqueta = el("selDist").value || (sel ? sel.dataset.dep : el("selDep").value);
    el("zona").value = z;
    try {
      localStorage.setItem("e030-ubicacion", JSON.stringify({
        departamento: el("selDep").value || (sel ? sel.dataset.dep : ""),
        provincia: el("selProv").value || "",
        distrito: el("selDist").value || "",
        zona: z,
      }));
    } catch (e) {}
    el("modalMapa").classList.add("hidden");
    recalcular();
    toast("success", "Zona aplicada", `${etiqueta}: ${z} (${Z_VALORES[z].toFixed(2)}).`);
  });
}

// Asocia clic en filas/encabezados marcados (.pickrow / .pickth) de una tabla
// modal con una acción que asigna el valor y cierra el modal.
function wirePick(modalId, apply) {
  const modal = el(modalId);
  if (!modal) return;
  modal.addEventListener("click", (ev) => {
    const t = ev.target.closest(".pickrow, .pickth");
    if (!t || !modal.contains(t)) return;
    const msg = apply(t);
    if (msg == null) return;
    recalcular();
    modal.classList.add("hidden");
    toast("success", "Valor aplicado", msg);
  });
}

// =====================================================================
// Utilidades
// =====================================================================
const el = (id) => document.getElementById(id);
const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
const round3 = (x) => Math.round(x * 1000) / 1000;
const gFormat = (x) => parseFloat(x.toFixed(6)).toString(); // imita '{0:g}' de Python
const hexA = (hex, a) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// =====================================================================
// Tema claro / oscuro
// =====================================================================
function initTema() {
  let t = "light";
  try { t = localStorage.getItem("e030-theme") || "light"; } catch {}
  document.documentElement.setAttribute("data-theme", t);
}

function toggleTema() {
  const actual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const nuevo = actual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nuevo);
  try { localStorage.setItem("e030-theme", nuevo); } catch {}
  if (state.espectro) dibujarEspectro(); // re-pintar con los colores del tema
}

function descargar(nombre, contenido, mime) {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

function toast(tipo, titulo, msg) {
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.innerHTML = `<b></b><span></span>`;
  t.querySelector("b").textContent = titulo;
  t.querySelector("span").textContent = msg;
  el("toasts").appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// =====================================================================
// Inicialización
// =====================================================================
function init() {
  initTema();

  ["zona", "uso", "suelo"].forEach((id) => el(id).addEventListener("change", recalcular));
  el("chkVs30").addEventListener("change", recalcular);
  el("vs30").addEventListener("input", calcularParametros);

  // Coeficientes de reducción R y período Ts (validación Zona 4)
  ["roX", "roY", "ia", "ip", "ts"].forEach((id) => el(id).addEventListener("input", calcularParametros));

  // Tema oscuro / claro
  el("btnTheme").addEventListener("click", toggleTema);

  // Selector de curvas del ploteo (C, ZUCS, ZUCS/Rx, ZUCS/Ry)
  // C y ZUCS son mutuamente excluyentes (data-group="base"); Rx/Ry son libres.
  document.querySelectorAll("#curveToggle button").forEach((b) => {
    b.addEventListener("click", () => {
      const k = b.dataset.curve;
      const group = b.dataset.group;
      const activar = !state.selectedCurves.has(k);

      if (activar && group) {
        // Desactivar las demás del mismo grupo (selección única)
        document.querySelectorAll(`#curveToggle button[data-group="${group}"]`).forEach((o) => {
          if (o !== b) { o.classList.remove("active"); state.selectedCurves.delete(o.dataset.curve); }
        });
      }
      if (activar) { state.selectedCurves.add(k); b.classList.add("active"); }
      else { state.selectedCurves.delete(k); b.classList.remove("active"); }

      if (state.espectro) dibujarEspectro();
    });
  });

  // Navegación entre vistas (Datos / secciones en desarrollo)
  function mostrarVista(view, titulo) {
    const dev = view !== "datos";
    el("viewDatos").classList.toggle("hidden", dev);
    el("viewDev").classList.toggle("hidden", !dev);
    if (dev) el("devTitle").textContent = titulo || "Sección";
  }
  document.querySelectorAll(".nav a[data-view]").forEach((a) => {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      document.querySelectorAll(".nav a").forEach((x) => x.classList.remove("active"));
      a.classList.add("active");
      mostrarVista(a.dataset.view, a.dataset.title);
    });
  });
  el("btnVolverDatos").addEventListener("click", () => {
    document.querySelectorAll(".nav a").forEach((x) => x.classList.toggle("active", x.dataset.view === "datos"));
    mostrarVista("datos");
  });

  // Aviso de Versión Pro
  el("btnPro").addEventListener("click", (ev) => {
    ev.preventDefault();
    toast("warn", "Versión Pro", "Las funcionalidades extra están en desarrollo.");
  });

  // Modal de autor
  el("btnAutor").addEventListener("click", () => el("modalAutor").classList.remove("hidden"));
  el("btnCerrarAutor").addEventListener("click", () => el("modalAutor").classList.add("hidden"));
  el("modalAutor").addEventListener("click", (ev) => { if (ev.target === el("modalAutor")) el("modalAutor").classList.add("hidden"); });

  // Cargar: solo si el modelo está DESBLOQUEADO en ETABS; si no, alerta.
  el("btnEtabs").addEventListener("click", async () => {
    let connected = false, locked = true;
    try {
      const r = await fetch(`${API_URL}/ping`, { signal: AbortSignal.timeout(2500) });
      const j = await r.json();
      connected = !!j.etabs; locked = !!j.locked;
    } catch { connected = false; }
    if (!connected) {
      toast("error", "Sin conexión", "Abre ETABS con un modelo cargado.");
      return;
    }
    if (locked) {
      toast("warn", "Modelo bloqueado", "Pulsa «Actualizar» para desbloquear el modelo y vuelve a Cargar.");
      return;
    }
    procesarETABS();
  });

  // Borrar datos: reinicia todo desde cero (resultados + parámetros + formulario).
  el("btnBorrar").addEventListener("click", () => {
    try {
      sessionStorage.clear();
      ["e030-params", "e030-form", "e030-colors"].forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
    toast("success", "Datos borrados", "Todo reiniciado desde cero.");
    setTimeout(() => location.reload(), 1300);
  });

  // Actualizar: requiere haber corrido los demás análisis. Toma RoX/RoY del
  // Sistema estructural (Ia/Ip se mantienen) y desbloquea el modelo en ETABS.
  el("btnActualizar").addEventListener("click", async () => {
    const need = [
      ["e030-masa", "Masa participativa", (v) => Array.isArray(v.modos)],
      ["e030-derivas", "Derivas", (v) => Array.isArray(v.casos)],
      ["e030-sistema", "Sistema estructural", (v) => v.direcciones],
      ["e030-escalamiento", "Escalamiento sísmico", (v) => Array.isArray(v.casos)],
      ["e030-junta", "Junta sísmica", (v) => v.dir],
    ];
    const faltan = []; let sis = null;
    need.forEach(([k, nombre, test]) => {
      let v = null; try { v = JSON.parse(sessionStorage.getItem(k) || "null"); } catch {}
      if (!(v && test(v))) faltan.push(nombre);
      if (k === "e030-sistema" && v) sis = v;
    });
    if (faltan.length) {
      toast("warn", "Faltan análisis", "Primero corre: " + faltan.join(", ") + ".");
      return;
    }
    // RoX/RoY desde el Sistema estructural (Ia e Ip se mantienen). Solo se
    // aplica un R0 válido (≥ 1); si no, se deja el campo para que el usuario
    // lo ingrese a mano. Los campos siempre quedan editables.
    const valido = (x) => Number.isFinite(+x) && +x >= 1;
    const r0x = sis.direcciones && sis.direcciones.X ? sis.direcciones.X.R0 : null;
    const r0y = sis.direcciones && sis.direcciones.Y ? sis.direcciones.Y.R0 : null;
    const aplicados = [], manual = [];
    if (valido(r0x)) { el("roX").value = r0x; aplicados.push("RoX=" + r0x); } else manual.push("RoX");
    if (valido(r0y)) { el("roY").value = r0y; aplicados.push("RoY=" + r0y); } else manual.push("RoY");
    recalcular();
    if (manual.length) {
      toast("warn", "Ingresa a mano", "Sistema no dio un R₀ válido para: " + manual.join(", ") + ". Escríbelo tú.");
    }
    // Desbloquear el modelo en ETABS para poder volver a Cargar.
    try {
      const r = await fetch(`${API_URL}/desbloquear`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const j = await r.json();
      if (j.ok) toast("success", "Actualizado", (aplicados.join(", ") || "Sin cambios de R₀") + ". " + j.mensaje);
      else toast("error", "ETABS", j.mensaje || "No se pudo desbloquear el modelo.");
    } catch {
      toast("error", "API no disponible", "No se pudo desbloquear (¿API y ETABS abiertos?).");
    }
    pingApi();
  });

  // Descargar TXT: abre modal para elegir las curvas
  el("btnExport").addEventListener("click", () => {
    if (!requiereEspectro()) return;
    document.querySelectorAll(".exCurve").forEach((c) => { c.checked = state.selectedCurves.has(c.value); });
    el("modalExport").classList.remove("hidden");
  });
  el("btnCancelExport").addEventListener("click", () => el("modalExport").classList.add("hidden"));
  el("modalExport").addEventListener("click", (ev) => { if (ev.target === el("modalExport")) el("modalExport").classList.add("hidden"); });
  el("btnDescargarTxt").addEventListener("click", () => {
    const sel = [...document.querySelectorAll(".exCurve:checked")].map((c) => c.value);
    if (!sel.length) return toast("warn", "Selecciona curvas", "Marca al menos una curva para descargar.");
    exportarTXT(sel);
    el("modalExport").classList.add("hidden");
  });

  initMapa();

  // Modal de ajustes
  el("btnAjustes").addEventListener("click", () => {
    el("modosMax").value = state.numModosMax;
    el("modosMin").value = state.numModosMin;
    el("modalAjustes").classList.remove("hidden");
  });
  el("btnCancelAjustes").addEventListener("click", () => el("modalAjustes").classList.add("hidden"));
  el("btnGuardarAjustes").addEventListener("click", () => {
    const max = parseInt(el("modosMax").value, 10);
    const min = parseInt(el("modosMin").value, 10);
    if (isNaN(max) || isNaN(min)) return toast("error", "Valores inválidos", "Ingresa enteros válidos.");
    if (min > max) return toast("error", "Error", "El mínimo no puede ser mayor al máximo.");
    state.numModosMax = max; state.numModosMin = min;
    state.modosMaxManual = true;  // el usuario fijó el valor → no autocalcular
    guardarForm();
    el("modalAjustes").classList.add("hidden");
    toast("success", "Ajustes guardados", `Modos: ${min} a ${max}.`);
  });

  restaurarForm();
  recalcular();
  pingApi();
  setInterval(pingApi, 5000);
}

document.addEventListener("DOMContentLoaded", init);
