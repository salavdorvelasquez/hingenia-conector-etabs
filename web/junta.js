/* ===================================================================
   Junta sísmica · E.030 (2026) · Artículo 52
   Lee el desplazamiento máximo (más crítico) por dirección de los combos
   D- desde ETABS y calcula la separación mínima s.
   =================================================================== */

const API_URL = "http://127.0.0.1:8731";
const el = (id) => document.getElementById(id);
let params = null;   // {Z, S, ...} reciclados de la página de Datos

// --- Reciclar Z y S desde la página de Datos (localStorage) ---
function cargarParams() {
  try { params = JSON.parse(localStorage.getItem("e030-params") || "null"); } catch { params = null; }
  if (!params || typeof params.Z !== "number") {
    el("estado").textContent =
      "⚠ Faltan Z y S. Abre primero la pestaña Datos y elige Zona y Suelo (se reciclan aquí).";
  }
}

// --- Estado de la API ---
async function pingApi() {
  try {
    const r = await fetch(`${API_URL}/ping`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    setApi(true, j.etabs ? "ETABS conectado" : "API activa (ETABS cerrado)");
  } catch { setApi(false, "ETABS: sin conexión"); }
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

// --- Cálculo de separación por dirección (Art. 52) ---
function sep(dEdif, dVec, Z, S, h, vecJunta) {
  const sForm = Math.max(0.02 * Z * S * h, 0.03);   // 52.2: 0.02·Z·S·h ≥ 0.03
  const sDesp = (2 / 3) * (dEdif + dVec);            // 52.2: ⅔ de la suma de desplazamientos
  const s = Math.max(sForm, sDesp, 0.03);
  // 52.3: separación al límite de propiedad
  const sepLim = vecJunta ? Math.max((2 / 3) * dEdif, s / 2) : (2 / 3) * dEdif;
  return { sForm, sDesp, s, sepLim };
}

const f = (x) => (Math.round(x * 1000) / 1000).toFixed(3);

function recompute() {
  if (!params || typeof params.Z !== "number") {
    el("estado").textContent = "Faltan Z y S: ábrelos en la pestaña Datos (se reciclan aquí).";
    return;
  }
  const Z = params.Z;
  const S = params.S;
  const hx = parseFloat(el("hx").value) || 0;
  const hy = parseFloat(el("hy").value) || 0;
  const dex = parseFloat(el("edifdx").value) || 0;   // Δmáx edificio X (editable)
  const dey = parseFloat(el("edifdy").value) || 0;   // Δmáx edificio Y (editable)
  const vecJunta = el("vecJunta").checked;
  const vdx = parseFloat(el("vecdx").value) || 0;
  const vdy = parseFloat(el("vecdy").value) || 0;

  const rx = sep(dex, vdx, Z, S, hx, vecJunta);
  const ry = sep(dey, vdy, Z, S, hy, vecJunta);

  const cm = (x) => (Math.round(x * 100 * 100) / 100).toFixed(2);  // m → cm (2 dec)

  el("resultados").classList.remove("hidden");
  const tb = el("tbody");
  tb.innerHTML = "";
  [["X", dex, vdx, rx], ["Y", dey, vdy, ry]].forEach(([d, de, dv, r]) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td><b>${d}</b></td><td>${cm(de)}</td><td>${cm(dv)}</td>` +
      `<td>${cm(r.sForm)}</td><td>${cm(r.sDesp)}</td>` +
      `<td class="res-big">${cm(r.s)}</td><td>${cm(r.sepLim)}</td>`;
    tb.appendChild(tr);
  });

  // Cuadro resumen por dirección (Δ₁, Δ₂ en cm; S, Z; h en m; s, SL en cm)
  const resumen = (de, dv, h, r) =>
    `<tr><td><b>Δ₁</b></td><td class="res-big">${cm(de)}</td><td><i>Desplazamiento edificio (cm)</i></td></tr>` +
    `<tr><td><b>Δ₂</b></td><td>${cm(dv)}</td><td><i>Desplazamiento vecino (cm)</i></td></tr>` +
    `<tr><td><b>S</b></td><td>${S}</td><td><i>Factor de suelo</i></td></tr>` +
    `<tr><td><b>Z</b></td><td>${Z}</td><td><i>Factor de zona</i></td></tr>` +
    `<tr><td><b>h</b></td><td>${f(h)}</td><td><i>Altura (m)</i></td></tr>` +
    `<tr><td><b>s</b></td><td class="res-big">${cm(r.s)}</td><td><i>Separación sísmica (cm)</i></td></tr>` +
    `<tr><td><b>SL</b></td><td>${cm(r.sepLim)}</td><td><i>Separación al límite (cm)</i></td></tr>`;
  el("resumenX").innerHTML = resumen(dex, vdx, hx, rx);
  el("resumenY").innerHTML = resumen(dey, vdy, hy, ry);

  el("nota52").textContent = vecJunta
    ? "La vecina tiene junta reglamentaria → separación al límite ≥ s/2 (Art. 52.3)."
    : "Sin junta reglamentaria en la vecina → además, sepárate de la edificación existente "
      + "en s/2 (propio) + s/2 (vecino) (Art. 52.4).";

  // Guardar (vive mientras la pestaña esté abierta · se usa en la Memoria).
  try {
    sessionStorage.setItem("e030-junta", JSON.stringify({
      vecJunta,
      inputs: { hx, hy, dex, dey, vdx, vdy, vecJunta },
      dir: {
        X: { h: hx, de: dex, dv: vdx, sForm: rx.sForm, sDesp: rx.sDesp, s: rx.s, sepLim: rx.sepLim },
        Y: { h: hy, de: dey, dv: vdy, sForm: ry.sForm, sDesp: ry.sDesp, s: ry.s, sepLim: ry.sepLim },
      },
    }));
  } catch (e) {}
}

function restaurar() {
  try {
    const g = JSON.parse(sessionStorage.getItem("e030-junta") || "null");
    if (!g || !g.inputs) return;
    const i = g.inputs;
    el("hx").value = i.hx || ""; el("hy").value = i.hy || "";
    el("edifdx").value = i.dex || ""; el("edifdy").value = i.dey || "";
    el("vecdx").value = i.vdx || ""; el("vecdy").value = i.vdy || "";
    el("vecJunta").checked = !!i.vecJunta;
    if (params && typeof params.Z === "number") recompute();
  } catch (e) {}
}

async function calcular() {
  el("btnCalcular").disabled = true;
  el("estado").textContent = "Leyendo desplazamientos de ETABS…";
  try {
    const r = await fetch(`${API_URL}/junta`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    const j = await r.json();
    if (!j.ok) {
      el("estado").textContent = j.mensaje || "No se pudo calcular.";
      if (j.guardar) { alert("⚠ " + j.mensaje); toast("warn", "Guarda tu modelo", j.mensaje); }
      else toast("error", "No se pudo calcular", j.mensaje || "Error desconocido.");
      return;
    }
    // Coloca el máximo de ETABS en los campos editables (el usuario puede cambiarlos)
    el("edifdx").value = j.dx;
    el("edifdy").value = j.dy;
    // Altura total del edificio desde ETABS (editable por el usuario)
    if (j.altura && j.altura > 0) { el("hx").value = j.altura; el("hy").value = j.altura; }
    el("estado").textContent = j.mensaje || "";
    recompute();
    toast("success", "Junta sísmica calculada", j.mensaje || "");
  } catch {
    el("estado").textContent =
      "No se pudo conectar con el puente. Verifica que ESPECTRA y ETABS estén abiertos.";
    toast("error", "API no disponible", "Abre ESPECTRA con ETABS abierto  con ETABS abierto.");
  } finally {
    el("btnCalcular").disabled = false;
  }
}

// --- Tema y menú ---
function toggleTema() {
  const actual = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const nuevo = actual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nuevo);
  try { localStorage.setItem("e030-theme", nuevo); } catch {}
}

el("btnCalcular").addEventListener("click", calcular);
["hx", "hy", "edifdx", "edifdy", "vecdx", "vecdy", "vecJunta"].forEach((id) =>
  el(id).addEventListener("input", recompute));
el("btnTheme").addEventListener("click", toggleTema);
el("sidebarToggle").addEventListener("click", () => document.querySelector(".app").classList.toggle("collapsed"));
cargarParams();
restaurar();
pingApi();
setInterval(pingApi, 5000);
