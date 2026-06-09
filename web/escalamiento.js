/* ===================================================================
   Escalamiento sísmico · E.030 (2026)
   Calcula el factor f = (90%/80%·Vest)/Vdin por dirección y reescala
   los combos de diseño (SDXMasaY±, SDYMasaX±) en ETABS.
   Z, U, S, Tp, Tl, R se reciclan de la página de Datos.
   =================================================================== */

const API_URL = "http://127.0.0.1:8731";
const el = (id) => document.getElementById(id);
let params = null;
const n2 = (x) => (Math.round(x * 100) / 100);
const n3 = (x) => (Math.round(x * 1000) / 1000);

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

function cargarParams() {
  try { params = JSON.parse(localStorage.getItem("e030-params") || "null"); } catch { params = null; }
  if (!params || typeof params.Z !== "number") {
    el("estado").textContent = "⚠ Faltan parámetros. Abre la pestaña Datos y elige Zona, Suelo y R.";
    return false;
  }
  return true;
}

async function calcular() {
  if (!cargarParams()) return;
  el("btnCalcular").disabled = true;
  el("estado").textContent = "Calculando y aplicando el escalamiento en ETABS…";
  try {
    const r = await fetch(`${API_URL}/escalamiento`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Z: params.Z, U: params.U, S: params.S, Tp: params.Tp, Tl: params.Tl,
        Rx: params.Rx, Ry: params.Ry, regular: params.regular, uso: params.uso,
      }),
    });
    const j = await r.json();
    if (!j.ok) {
      el("estado").textContent = j.mensaje || "No se pudo calcular.";
      if (j.guardar) { alert("⚠ " + j.mensaje); toast("warn", "Guarda tu modelo", j.mensaje); }
      else toast("error", "No se pudo calcular", j.mensaje || "");
      return;
    }
    el("estado").textContent = j.mensaje || "";
    render(j);
    toast("success", "Escalamiento aplicado", j.mensaje || "");
  } catch {
    el("estado").textContent = "No se pudo conectar con el puente. Abre ESPECTRA con ETABS abierto.";
    toast("error", "API no disponible", "Abre ESPECTRA con ETABS abierto");
  } finally {
    el("btnCalcular").disabled = false;
  }
}

function render(j) {
  el("resultados").classList.remove("hidden");
  try { sessionStorage.setItem("e030-escalamiento", JSON.stringify(j)); } catch {}
  const pc = Math.round(j.frac * 100);
  el("thFrac").textContent = `${pc}% V est.`;
  el("tbody").innerHTML = (j.casos || []).map((c) =>
    `<tr><td><b>${c.caso}</b></td><td>${c.dir}</td><td>${n3(c.T)}</td><td>${n2(c.C)}</td>` +
    `<td>${n2(c.Vest)}</td><td>${n2(j.frac * c.Vest)}</td><td>${n2(c.Vdin)}</td>` +
    `<td class="fbig">${n3(c.f)}</td></tr>`).join("");
  el("nota").innerHTML =
    `Peso sísmico P = <b>${n2(j.peso)}</b>. Cada caso tiene su propio f = ${pc}%·V<sub>est</sub> / V<sub>din</sub> ` +
    `(mínimo 1.0), porque el sismo + y − dan cortantes distintas. Los factores se aplican a cada caso ` +
    `dentro de las envolventes <b>SISMO: XX/YY</b>. Es idempotente (la cortante base se lee de los casos elásticos).`;
}

function toggleTema() {
  const a = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", a === "dark" ? "light" : "dark");
  try { localStorage.setItem("e030-theme", a === "dark" ? "light" : "dark"); } catch {}
}

function restaurar() {
  try {
    const g = JSON.parse(sessionStorage.getItem("e030-escalamiento") || "null");
    if (g && Array.isArray(g.casos)) render(g);
  } catch {}
}

el("btnCalcular").addEventListener("click", calcular);
el("btnTheme").addEventListener("click", toggleTema);
el("sidebarToggle").addEventListener("click", () => document.querySelector(".app").classList.toggle("collapsed"));
cargarParams();
restaurar();
pingApi();
setInterval(pingApi, 5000);
