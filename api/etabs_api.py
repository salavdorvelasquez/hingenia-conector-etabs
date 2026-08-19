"""
==============================================================================
API ETABS para la app web "Análisis Sísmico E.030 (2026)"
------------------------------------------------------------------------------
Pequeño servidor HTTP LOCAL que permite a la app web (web/index.html) enviar el
espectro y generar masas/casos/combinaciones en ETABS vía la API COM (comtypes).

Sólo funciona en la misma PC Windows donde corre ETABS.

USO:
    1. Abre ETABS y el modelo (desbloqueado).
    2. Ejecuta:   python api/etabs_api.py
    3. Abre web/index.html en el navegador. El indicador superior pasará a verde.

Dependencias:  pip install comtypes
(Sólo se necesita 'comtypes'; el resto es librería estándar de Python.)
==============================================================================
"""

import json
import os
import sys
import mimetypes
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ETABS es una aplicacion WinForms y su API COM no es reentrante: dos hilos
# llamandola a la vez pueden corromper su interfaz (ToolStrip) y tumbarla con
# un IndexOutOfRangeException. El servidor es multihilo, asi que todo acceso a
# SapModel se serializa con este candado.
ETABS_LOCK = threading.RLock()

HOST = "127.0.0.1"
PORT = 8731

# Version de ESPECTRA. Debe coincidir con MyAppVersion de installer/espectra.iss
# y con el tag vX.Y.Z que dispara el release en GitHub Actions.
APP_VERSION = "1.0.15"

# De aqui se leen las versiones publicadas para avisar de actualizaciones.
GITHUB_REPO = "salavdorvelasquez/hingenia-conector-etabs"
RELEASE_API = "https://api.github.com/repos/%s/releases/latest" % GITHUB_REPO
INSTALADOR_ASSET = "ESPECTRA-Setup.exe"


# ----------------------------------------------------------------------------
# Ubicación de la carpeta "web" (sirve los archivos estáticos de la app).
# Funciona tanto al correr con Python como dentro del .exe (PyInstaller).
# ----------------------------------------------------------------------------
def _base_dir():
    if getattr(sys, "frozen", False):
        # Empaquetado: PyInstaller extrae los datos en sys._MEIPASS.
        return getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    # En desarrollo: la raíz del proyecto (un nivel sobre /api).
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


WEB_DIR = os.path.join(_base_dir(), "web")


# ----------------------------------------------------------------------------
# Actualizaciones: se consulta la ultima release publicada en GitHub y, si hay
# una mas nueva, se descarga su instalador y se lanza. ESPECTRA se cierra para
# que el instalador pueda reemplazar el .exe en uso.
# ----------------------------------------------------------------------------
def _version_tupla(txt):
    """'v1.0.10' -> (1, 0, 10). Lo que no sea numero se ignora."""
    partes = []
    for trozo in str(txt).lstrip("vV").split("."):
        num = ""
        for ch in trozo:
            if ch.isdigit():
                num += ch
            else:
                break
        partes.append(int(num) if num else 0)
    while len(partes) < 3:
        partes.append(0)
    return tuple(partes[:3])


def buscar_actualizacion(timeout=6):
    """Devuelve {'hay': bool, 'version': str, 'url': str} o {'hay': False, 'error': str}.

    Nunca lanza: si no hay internet o GitHub no responde, se informa y ya.
    """
    import urllib.request
    try:
        req = urllib.request.Request(
            RELEASE_API,
            headers={"Accept": "application/vnd.github+json",
                     "User-Agent": "ESPECTRA/%s" % APP_VERSION},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            datos = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        return {"hay": False, "error": str(e)}

    tag = datos.get("tag_name") or ""
    if not tag:
        return {"hay": False, "error": "La release publicada no tiene tag."}

    url = ""
    for asset in datos.get("assets") or []:
        if asset.get("name") == INSTALADOR_ASSET:
            url = asset.get("browser_download_url") or ""
            break

    hay = _version_tupla(tag) > _version_tupla(APP_VERSION)
    return {"hay": bool(hay and url), "version": tag.lstrip("vV"),
            "url": url, "notas": datos.get("html_url") or ""}


def descargar_e_instalar(url, progreso=None):
    """Baja el instalador y lo lanza YA ELEVADO.

    Se pide la elevacion aqui, con el verbo "runas", en vez de dejar que el
    instalador se relance solo: al relanzarse comprueba que su proceso padre
    sea el mismo ejecutable y esa comprobacion fallaba con
    "Security validation failure: parent process has different executable!".

    Tampoco se cierra ESPECTRA: de eso se encarga el propio instalador, que
    lleva CloseApplications y sabe cerrar la app antes de reemplazar el .exe.

    'progreso' es un callable(texto) opcional para ir contando en la ventana.
    Devuelve (True, ruta) o (False, mensaje de error).
    """
    import tempfile
    import urllib.request
    # Carpeta propia por descarga: si quedo un instalador anterior bloqueado,
    # no se pisa con este.
    carpeta = tempfile.mkdtemp(prefix="espectra-")
    destino = os.path.join(carpeta, INSTALADOR_ASSET)
    try:
        if progreso:
            progreso("Descargando la actualizacion...")
        req = urllib.request.Request(
            url, headers={"User-Agent": "ESPECTRA/%s" % APP_VERSION})
        with urllib.request.urlopen(req, timeout=60) as r, open(destino, "wb") as f:
            total = int(r.headers.get("Content-Length") or 0)
            bajado = 0
            while True:
                trozo = r.read(65536)
                if not trozo:
                    break
                f.write(trozo)
                bajado += len(trozo)
                if progreso and total:
                    progreso("Descargando... %d %%" % int(bajado * 100 / total))
    except Exception as e:
        return False, "No se pudo descargar: %s" % e

    try:
        if progreso:
            progreso("Abriendo el instalador...")
        import ctypes
        # SW_SHOWNORMAL = 1. Por debajo de 32 el valor devuelto es un error.
        rc = ctypes.windll.shell32.ShellExecuteW(None, "runas", destino, None, carpeta, 1)
        if int(rc) <= 32:
            if int(rc) == 1223:      # ERROR_CANCELLED: el usuario dijo que no
                return False, "Se cancelo el permiso de administrador."
            os.startfile(destino)    # ultimo recurso
    except Exception as e:
        return False, "Se descargo en %s pero no se pudo abrir: %s" % (destino, e)
    return True, destino


def _installer_path():
    """Ruta del instalador a ofrecer en el botón de descarga.

    Prefiere el instalador con asistente (ESPECTRA-Setup.exe); si no está,
    cae al ejecutable del puente. Busca junto al .exe en uso y en dist\\.
    (En el futuro modelo web-online, esto se reemplaza por una URL alojada.)"""
    cands = []
    if getattr(sys, "frozen", False):
        here = os.path.dirname(sys.executable)
        cands += [os.path.join(here, "ESPECTRA-Setup.exe")]
    cands += [
        os.path.join(_base_dir(), "dist", "ESPECTRA-Setup.exe"),
        os.path.join(_base_dir(), "dist", "ESPECTRA.exe"),
    ]
    if getattr(sys, "frozen", False):
        cands.append(sys.executable)  # último recurso: el propio puente
    for c in cands:
        if c and os.path.isfile(c):
            return c
    return None

# Las herramientas son SOLO LECTURA: no guardan, no corren ni modifican el modelo.
NO_ANALIZADO = ("El modelo no está analizado. Córrelo tú en ETABS (Analyze → Run Analysis, F5) "
                "y vuelve a intentar. Esta herramienta solo LEE resultados: no guarda, no corre "
                "ni modifica tu modelo.")

try:
    import comtypes.client
    COMTYPES_OK = True
except ImportError:
    COMTYPES_OK = False


# ----------------------------------------------------------------------------
# Conexión a ETABS
# ----------------------------------------------------------------------------
def get_sapmodel():
    """Devuelve (SapModel, None) o (None, mensaje_error).

    Inicializa COM en el hilo actual (el servidor es multihilo, por lo que cada
    petición corre en un hilo distinto y necesita su propio CoInitialize)."""
    if not COMTYPES_OK:
        return None, "Falta el paquete 'comtypes'. Instálalo con: pip install comtypes"
    try:
        comtypes.CoInitialize()
    except Exception:
        pass  # ya inicializado en este hilo
    # 1) Método clásico: objeto activo registrado en la ROT.
    try:
        etabs = comtypes.client.GetActiveObject("CSI.ETABS.API.ETABSObject")
        return etabs.SapModel, None
    except Exception as e1:
        err1 = e1
    # 2) Método recomendado por CSI (ETABS v1 Helper). A veces engancha el
    #    objeto activo cuando GetActiveObject falla con MK_E_UNAVAILABLE.
    try:
        helper = comtypes.client.CreateObject("ETABSv1.Helper")
        helper = helper.QueryInterface(comtypes.gen.ETABSv1.cHelper)
        etabs = helper.GetObject("CSI.ETABS.API.ETABSObject")
        return etabs.SapModel, None
    except Exception as e2:
        return None, (
            "No se pudo conectar a ETABS. Abre ETABS y CARGA un modelo (.EDB); "
            "con la pantalla de inicio vacía no se registra el objeto COM. "
            f"Detalle: GetActiveObject={err1}  |  Helper={e2}"
        )


# ----------------------------------------------------------------------------
# 1) Cargar función de espectro de respuesta (User Defined)
# ----------------------------------------------------------------------------
def cargar_espectro(nombre, puntos):
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}

    try:
        # Reconstruye el formato plano de la tabla que espera la API de ETABS
        # Campos por fila: Nombre, Periodo, Aceleración, Amortiguamiento, (extra)
        flat = []
        for i, (t, sa) in enumerate(puntos):
            flat.append(nombre)
            flat.append("{0:g}".format(round(float(t), 3)))
            flat.append(f"{float(sa):.4f}")
            flat.append("0.05" if i == 0 else "")
            flat.append("")
        data = tuple(flat)

        TableVersion, fieldsKeys, NumberRecords, TableData = 1, [], 0, []
        (TableVersion, fieldsKeys, NumberRecords, TableData, ret) = \
            SapModel.DatabaseTables.GetTableForEditingArray(
                "Functions - Response Spectrum - User Defined", None,
                TableVersion, fieldsKeys, NumberRecords, TableData)

        TableData = data
        NumberRecords = int(len(TableData) / len(fieldsKeys))

        (TableVersion, fieldsKeys, TableData, ret) = \
            SapModel.DatabaseTables.SetTableForEditingArray(
                "Functions - Response Spectrum - User Defined",
                TableVersion, fieldsKeys, NumberRecords, TableData)

        nfe = nem = nwm = nim = 0
        (nfe, nem, nwm, nim, ImportError_, ret) = \
            SapModel.DatabaseTables.ApplyEditedTables(True, nfe, nem, nwm, nim, None)

        return {"ok": True, "mensaje": f"Espectro '{nombre}' cargado. Puntos: {NumberRecords}."}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error al cargar el espectro: {e}"}


# ----------------------------------------------------------------------------
# 2) Generar masas, casos modales, espectrales y combinaciones (E.030)
# ----------------------------------------------------------------------------
def _asignar_pier_todo(SapModel):
    """Asigna el pier 'TODO' SOLO a los muros de CONCRETO (material tipo Concrete),
    para que Sistema estructural lea la cortante tomada por muros de concreto y
    diferencie de la albañilería u otros materiales (que ETABS también reconoce
    como muro). Es una escritura: solo corre durante la Carga (desbloqueado).
    Devuelve el número de muros de concreto etiquetados."""
    try:
        SapModel.PierLabel.SetPier("TODO")  # define la etiqueta de pier
    except Exception:
        pass

    # Conjunto de materiales y cuáles son de concreto (eMatType.Concrete = 2)
    mats, concretos = set(), set()
    try:
        mr = SapModel.PropMaterial.GetNameList()
        for m in (list(mr[1]) if len(mr) >= 2 and mr[1] else []):
            mats.add(m)
            try:
                gm = SapModel.PropMaterial.GetMaterial(m)
                t = gm[0] if isinstance(gm, (list, tuple)) else gm
                if int(t) == 2:
                    concretos.add(m)
            except Exception:
                continue
    except Exception:
        pass

    # Cache sección de muro -> ¿es de concreto?
    sec_conc = {}

    def seccion_es_concreto(sec):
        if sec in sec_conc:
            return sec_conc[sec]
        matname = None
        try:
            gw = SapModel.PropArea.GetWall(sec)
            cand = [x for x in gw if isinstance(x, str) and x in mats]
            matname = cand[0] if cand else None
        except Exception:
            matname = None
        es = bool(matname and matname in concretos)
        sec_conc[sec] = es
        return es

    try:
        res = SapModel.AreaObj.GetNameList()
        nombres = list(res[1]) if len(res) >= 2 and res[1] else []
    except Exception:
        nombres = []
    n = 0
    for nm in nombres:
        try:
            r = SapModel.AreaObj.GetDesignOrientation(nm)
            tipo = r[0] if isinstance(r, (list, tuple)) else r
            if int(tipo) != 1:        # no es muro (orientación Wall)
                continue
            pr = SapModel.AreaObj.GetProperty(nm)
            sec = pr[0] if isinstance(pr, (list, tuple)) else pr
            if not seccion_es_concreto(sec):
                continue              # omite albañilería u otros materiales
            SapModel.AreaObj.SetPier(nm, "TODO")
            n += 1
        except Exception:
            continue
    return n


def generar_masas(uso, nombre_espectro, modos_max, modos_min, regular, rx=1.0, ry=1.0):
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}

    try:
        nfe = nem = nwm = nim = 0

        # Etiqueta los muros con el pier 'TODO' (necesario para Sistema estructural).
        n_muros = _asignar_pier_todo(SapModel)
        TableVersion, fieldsKeys, NumberRecords, TableData = 1, [], 0, []

        # ---- Mass Source Definition ----
        (TableVersion, fieldsKeys, NumberRecords, TableData, ret) = \
            SapModel.DatabaseTables.GetTableForEditingArray(
                "Mass Source Definition", None, TableVersion, fieldsKeys, NumberRecords, TableData)

        if uso in ("Categoría C", "Art. 19.3"):
            rows = [
                ['Masa', 'Yes', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'No', '', '', 'Dead', '1', ''],
                ['Masa', 'Yes', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'No', '', '', 'Live', '0.25', ''],
                ['MasaX+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.05', '0.00', 'Dead', '1', ''],
                ['MasaX+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.05', '0.00', 'Live', '0.25', ''],
                ['MasaX-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '-0.05', '0.00', 'Dead', '1', ''],
                ['MasaX-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '-0.05', '0.00', 'Live', '0.25', ''],
                ['MasaY+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '0.05', 'Dead', '1', ''],
                ['MasaY+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '0.05', 'Live', '0.25', ''],
                ['MasaY-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '-0.05', 'Dead', '1', ''],
                ['MasaY-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '-0.05', 'Live', '0.25', ''],
            ]
        else:
            # Categorías A y B: la masa y las combinaciones incluyen "Roof Live".
            # NOTA: el patrón/caso "Roof Live" lo crea el usuario en ETABS; aquí NO
            # se crea por código, solo se referencia.
            rows = [
                ['Masa', 'Yes', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'No', '', '', 'Dead', '1', ''],
                ['Masa', 'Yes', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'No', '', '', 'Live', '0.50', ''],
                ['Masa', 'Yes', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'No', '', '', 'Roof Live', '0.25', ''],
                ['MasaX+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.05', '0.00', 'Dead', '1', ''],
                ['MasaX+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.05', '0.00', 'Live', '0.50', ''],
                ['MasaX+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.05', '0.00', 'Roof Live', '0.25', ''],
                ['MasaX-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '-0.05', '0.00', 'Dead', '1', ''],
                ['MasaX-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '-0.05', '0.00', 'Live', '0.50', ''],
                ['MasaX-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '-0.05', '0.00', 'Roof Live', '0.25', ''],
                ['MasaY+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '0.05', 'Dead', '1', ''],
                ['MasaY+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '0.05', 'Live', '0.50', ''],
                ['MasaY+', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '0.05', 'Roof Live', '0.25', ''],
                ['MasaY-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '-0.05', 'Dead', '1', ''],
                ['MasaY-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '-0.05', 'Live', '0.50', ''],
                ['MasaY-', 'No', 'Yes', 'No', 'Yes', 'No', 'No', 'Yes', 'Yes', '0.00', '-0.05', 'Roof Live', '0.25', ''],
            ]

        TableData = [v for row in rows for v in row]
        NumberRecords = int(len(TableData) / len(fieldsKeys))
        SapModel.DatabaseTables.SetTableForEditingArray(
            "Mass Source Definition", TableVersion, fieldsKeys, NumberRecords, TableData)
        SapModel.DatabaseTables.ApplyEditedTables(True, nfe, nem, nwm, nim, None)

        lista_masas = ["Masa", "MasaX+", "MasaX-", "MasaY+", "MasaY-"]

        # Casos estáticos no lineales
        for m in lista_masas:
            caso = m.upper()
            SapModel.LoadCases.StaticNonlinear.SetCase(caso)
            SapModel.LoadCases.StaticNonlinear.SetMassSource(caso, m)

        # Casos modales
        for m in lista_masas:
            nolineal = m.upper()
            modal = "Modal" if m == "Masa" else "Modal" + m
            SapModel.LoadCases.ModalEigen.SetCase(modal)
            SapModel.LoadCases.ModalEigen.SetNumberModes(modal, int(modos_max), int(modos_min))
            SapModel.LoadCases.ModalEigen.SetInitialCase(modal, nolineal)

        # Asignar caso modal a cada caso estático no lineal
        for m in lista_masas:
            nolineal = m.upper()
            modal = "Modal" if m == "Masa" else "Modal" + m
            SapModel.LoadCases.StaticNonlinear.SetModalCase(nolineal, modal)

        # Casos de espectro de respuesta 
        SapModel.SetPresentUnits(12)  # tonnef·m·°C
        g = 9.806

        casos_esp = {
            "(ZUCS g) SDX": "Modal",
            "(ZUCS g) SDY": "Modal",
            "(ZUCS g) SDXMasaY+": "ModalMasaY+",
            "(ZUCS g) SDXMasaY-": "ModalMasaY-",
            "(ZUCS g) SDYMasaX+": "ModalMasaX+",
            "(ZUCS g) SDYMasaX-": "ModalMasaX-",
        }
        for caso, modal in casos_esp.items():
            SapModel.LoadCases.ResponseSpectrum.SetCase(caso)
            SapModel.LoadCases.ResponseSpectrum.SetModalCase(caso, modal)

        cargas = {
            "(ZUCS g) SDX": "U1",
            "(ZUCS g) SDY": "U2",
            "(ZUCS g) SDXMasaY+": "U1",
            "(ZUCS g) SDXMasaY-": "U1",
            "(ZUCS g) SDYMasaX+": "U2",
            "(ZUCS g) SDYMasaX-": "U2",
        }
        for caso, dirn in cargas.items():
            SapModel.LoadCases.ResponseSpectrum.SetLoads(
                caso, 1, [dirn], [nombre_espectro], [g], ["Global"], [0.0])

        # Caso de espectro de respuesta VERTICAL (U3) — análisis dinámico (4.6.2):
        # usa 2/3 del espectro horizontal. La reducción por R se aplica luego en la
        # combinación de diseño "SV" (con el R más crítico = menor de Rx, Ry).
        SapModel.LoadCases.ResponseSpectrum.SetCase("(ZUCS g) SISMO: VERTICAL")
        SapModel.LoadCases.ResponseSpectrum.SetModalCase("(ZUCS g) SISMO: VERTICAL", "Modal")
        SapModel.LoadCases.ResponseSpectrum.SetLoads(
            "(ZUCS g) SISMO: VERTICAL", 1, ["U3"], [nombre_espectro], [(2.0 / 3.0) * g], ["Global"], [0.0])



        # ---- Combinaciones direccionales 100% + 30% para DERIVAS (prefijo "D-") ----
        # El caso espectral cargado es elástico (ZUCS·g). La deriva inelástica se
        # obtiene multiplicando por 0.75 (estructura regular) u 0.85 (irregular).
        # NO se divide por R: el R que reduce el espectro se cancela con el R que
        # amplifica los desplazamientos (0.75·R·δe/R = 0.75·δe).
        coeff = 0.75 if regular else 0.85
        combos = [
            # (nombre, principal, secundario)
            ("D-SDXMasaY+", "(ZUCS g) SDXMasaY+", "(ZUCS g) SDY"),
            ("D-SDXMasaY-", "(ZUCS g) SDXMasaY-", "(ZUCS g) SDY"),
            ("D-SDYMasaX+", "(ZUCS g) SDYMasaX+", "(ZUCS g) SDX"),
            ("D-SDYMasaX-", "(ZUCS g) SDYMasaX-", "(ZUCS g) SDX"),
        ]
        for nombre, principal, secundario in combos:
            SapModel.RespCombo.Add(nombre, 3)
            SapModel.RespCombo.SetCaseList(nombre, 0, principal, 1.0 * coeff)
            SapModel.RespCombo.SetCaseList(nombre, 0, secundario, 0.30 * coeff)

        # ---- Combinaciones de DISEÑO por dirección (ZUCS/R) ----
        # Nombres DIRECTOS (sin prefijo "D-", para no chocar con las de derivas).
        # 100% + 30%: el principal se divide por la R de su dirección y el
        # secundario (ortogonal) por la R de la dirección ortogonal. R = R0·Ia·Ip.
        rx = float(rx) if rx else 1.0
        ry = float(ry) if ry else 1.0
        combos_diseno = [
            # (nombre, principal, R_principal, secundario, R_secundario)
            ("SDXMasaY+", "(ZUCS g) SDXMasaY+", rx, "(ZUCS g) SDY", ry),
            ("SDXMasaY-", "(ZUCS g) SDXMasaY-", rx, "(ZUCS g) SDY", ry),
            ("SDYMasaX+", "(ZUCS g) SDYMasaX+", ry, "(ZUCS g) SDX", rx),
            ("SDYMasaX-", "(ZUCS g) SDYMasaX-", ry, "(ZUCS g) SDX", rx),
        ]
        def _ret_ok(r):
            # comtypes devuelve int (0) o lista/tupla con el ret al final;
            # 0 (o todos 0) = éxito.
            if isinstance(r, (list, tuple)):
                return all(v == 0 for v in r)
            return r == 0

        fallos = []
        for nombre, principal, rp, secundario, rs in combos_diseno:
            SapModel.RespCombo.Delete(nombre)  # idempotente: recrear limpio si ya existía
            r_add = SapModel.RespCombo.Add(nombre, 3)
            r1 = SapModel.RespCombo.SetCaseList(nombre, 0, principal, 1.0 / rp)
            r2 = SapModel.RespCombo.SetCaseList(nombre, 0, secundario, 0.30 / rs)
            if not (_ret_ok(r_add) and _ret_ok(r1) and _ret_ok(r2)):
                fallos.append(f"{nombre} (Add={r_add}, SF1={r1}, SF2={r2})")

        # ---- Combinación de DISEÑO vertical (SV) ----
        # Sismo vertical = 2/3 del espectro horizontal MÁS CRÍTICO (el de menor R).
        # El caso "(ZUCS g) SISMO: VERTICAL" ya trae el factor 2/3; aquí solo se reduce por R_min.
        r_min = min(rx, ry)
        SapModel.RespCombo.Delete("SISMO: VERTICAL")
        SapModel.RespCombo.Add("SISMO: VERTICAL", 3)  # SRSS (un solo caso → equivale a lineal)
        SapModel.RespCombo.SetCaseList("SISMO: VERTICAL", 0, "(ZUCS g) SISMO: VERTICAL", 1.0 / r_min)

        # ---- Combinaciones SÍSMICAS por dirección (envolvente ±excentricidad) ----
        # SISMO: XX = envolvente de las combos de diseño en X (masa excéntrica ±);
        # SISMO: YY igual en Y. Las combos de diseño son COMBINACIONES → CNameType=1.
        sismo = [
            ("SISMO: XX", ["SDXMasaY+", "SDXMasaY-"]),
            ("SISMO: YY", ["SDYMasaX+", "SDYMasaX-"]),
        ]
        for nombre, casos in sismo:
            SapModel.RespCombo.Delete(nombre)
            SapModel.RespCombo.Add(nombre, 1)  # 1 = Envelope
            for c in casos:
                SapModel.RespCombo.SetCaseList(nombre, 1, c, 1.0)  # 1 = combinación

        # ---- Combinaciones de diseño en concreto (E.060) ----
        # Categorías A y B incluyen "Roof Live"; C y Art. 19.3 no (coherente con
        # la fuente de masas). CNameType: 0 = caso de carga, 1 = combinación.
        con_roof = uso not in ("Categoría C", "Art. 19.3")

        def grav(cm, cv):
            """Términos gravitacionales (caso, CNameType, factor)."""
            filas = [("Dead", 0, cm)]
            if cv is not None:
                filas.append(("Live", 0, cv))
                if con_roof:
                    filas.append(("Roof Live", 0, cv))
            return filas

        # El sismo se toma solo con signo (+): el espectro de respuesta es no
        # direccional y ETABS ya entrega los valores máximo/mínimo (±), por lo que
        # las combinaciones con "-S" serían redundantes.
        combos_e060 = [
            ("COMB1: 1.4CM+1.7CV",     grav(1.4, 1.7),   []),
            ("COMB2: 1.25(CM+CV)+SX",  grav(1.25, 1.25), [("SISMO: XX", 1, 1.0)]),
            ("COMB3: 1.25(CM+CV)+SY",  grav(1.25, 1.25), [("SISMO: YY", 1, 1.0)]),
            ("COMB4: 0.90CM+SX",       grav(0.90, None), [("SISMO: XX", 1, 1.0)]),
            ("COMB5: 0.90CM+SY",       grav(0.90, None), [("SISMO: YY", 1, 1.0)]),
        ]
        # Limpia combinaciones de versiones anteriores (incluían "-S" y COMB6-9).
        obsoletas = [
            "COMB3: 1.25(CM+CV)-SX", "COMB4: 1.25(CM+CV)+SY", "COMB5: 1.25(CM+CV)-SY",
            "COMB6: 0.90CM+SX", "COMB7: 0.90CM-SX", "COMB8: 0.90CM+SY", "COMB9: 0.90CM-SY",
        ]
        for n in obsoletas:
            SapModel.RespCombo.Delete(n)
        for nombre, gravs, sismos in combos_e060:
            SapModel.RespCombo.Delete(nombre)
            SapModel.RespCombo.Add(nombre, 0)  # 0 = Linear Add
            for caso, cn, sf in gravs + sismos:
                SapModel.RespCombo.SetCaseList(nombre, cn, caso, sf)

        # ---- Bloque 2: combinaciones CON sismo vertical (+SV) ----
        # Mismas combinaciones sísmicas pero sumando el sismo vertical, para diseñar
        # los elementos que la norma lo exige (voladizos, grandes luces, pre/postensado,
        # elementos verticales). El sismo vertical actúa simultáneamente con el horizontal.
        combos_v = [
            ("COMB2-SV: 1.25(CM+CV)+SX+SV", grav(1.25, 1.25), [("SISMO: XX", 1, 1.0), ("SV", 1, 1.0)]),
            ("COMB3-SV: 1.25(CM+CV)+SY+SV", grav(1.25, 1.25), [("SISMO: YY", 1, 1.0), ("SV", 1, 1.0)]),
            ("COMB4-SV: 0.90CM+SX+SV",      grav(0.90, None), [("SISMO: XX", 1, 1.0), ("SV", 1, 1.0)]),
            ("COMB5-SV: 0.90CM+SY+SV",      grav(0.90, None), [("SISMO: YY", 1, 1.0), ("SV", 1, 1.0)]),
        ]
        for nombre, gravs, sismos in combos_v:
            SapModel.RespCombo.Delete(nombre)
            SapModel.RespCombo.Add(nombre, 0)  # 0 = Linear Add
            for caso, cn, sf in gravs + sismos:
                SapModel.RespCombo.SetCaseList(nombre, cn, caso, sf)

        # ---- Dos envolventes: SIN sismo vertical y CON sismo vertical ----
        # ENVOLVENTE   = COMB1-5 (uso general, sin sismo vertical)
        # ENVOLVENTE-SV = COMB1 (gravedad) + COMB2-SV a COMB5-SV (con sismo vertical)
        SapModel.RespCombo.Delete("ENVOLVENTE")
        SapModel.RespCombo.Add("ENVOLVENTE", 1)  # 1 = Envelope
        for nombre, _, _ in combos_e060:
            SapModel.RespCombo.SetCaseList("ENVOLVENTE", 1, nombre, 1.0)

        SapModel.RespCombo.Delete("ENVOLVENTE-SV")
        SapModel.RespCombo.Add("ENVOLVENTE-SV", 1)  # 1 = Envelope
        SapModel.RespCombo.SetCaseList("ENVOLVENTE-SV", 1, "COMB1: 1.4CM+1.7CV", 1.0)
        for nombre, _, _ in combos_v:
            SapModel.RespCombo.SetCaseList("ENVOLVENTE-SV", 1, nombre, 1.0)

        msg = (f"Masas, casos modales, espectrales y combinaciones creadas "
               f"(derivas coeff={coeff}; diseño 1/Rx={1.0/rx:.4f}, 1/Ry={1.0/ry:.4f}; "
               f"sismo vertical SISMO: VERTICAL = 2/3·espectro/R_min, R_min={r_min:.2f}). "
               f"Pier 'TODO' asignado a {n_muros} muro(s) de concreto.")
        if fallos:
            msg += "  [AVISO] No se crearon estas combinaciones de diseño: " + "; ".join(fallos)
        return {"ok": True, "mensaje": msg}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error en la operación: {e}"}


# ----------------------------------------------------------------------------
# 3) Sistema estructural: % de cortante en muros vs total (Art. 20 · Tabla N° 8)
# ----------------------------------------------------------------------------
def _leer_tabla(SapModel, nombre):
    """Lee una tabla de ETABS y la devuelve como (columnas, filas-dict). Python puro."""
    res = SapModel.DatabaseTables.GetTableForDisplayArray(nombre, GroupName="")
    cols = list(res[2])
    nrec = int(res[3])
    flat = list(res[4])
    nc = len(cols)
    filas = [dict(zip(cols, flat[i * nc:(i + 1) * nc])) for i in range(nrec)]
    return cols, filas


def _abs_num(x):
    try:
        return abs(float(x))
    except (TypeError, ValueError):
        return 0.0


def _clasificar_sistema(pct):
    """(sistema, R0) según el % de cortante en la base tomado por los muros."""
    if pct >= 70:
        return "Muros estructurales", 6
    if pct >= 30:
        return "Dual", 7
    return "Pórticos", 8


def _contar_muros_concreto(SapModel):
    """Cuantos objetos area son muros (orientacion Wall) de material concreto.

    Sirve para saber si un modelo sin fuerzas de pier es simplemente aporticado
    o si tiene muros a los que les falta la etiqueta de pier.
    """
    try:
        mats, concretos = set(), set()
        mr = SapModel.PropMaterial.GetNameList()
        for m in (list(mr[1]) if len(mr) >= 2 and mr[1] else []):
            mats.add(m)
            try:
                gm = SapModel.PropMaterial.GetMaterial(m)
                t = gm[0] if isinstance(gm, (list, tuple)) else gm
                if int(t) == 2:
                    concretos.add(m)
            except Exception:
                continue

        sec_conc = {}

        def es_concreto(sec):
            if sec in sec_conc:
                return sec_conc[sec]
            mn = None
            try:
                gw = SapModel.PropArea.GetWall(sec)
                cand = [x for x in gw if isinstance(x, str) and x in mats]
                mn = cand[0] if cand else None
            except Exception:
                mn = None
            sec_conc[sec] = bool(mn and mn in concretos)
            return sec_conc[sec]

        n = 0
        res = SapModel.AreaObj.GetNameList()
        for nm in (list(res[1]) if len(res) >= 2 and res[1] else []):
            try:
                o = SapModel.AreaObj.GetDesignOrientation(nm)
                if int(o[0] if isinstance(o, (list, tuple)) else o) != 1:
                    continue
                pr = SapModel.AreaObj.GetProperty(nm)
                sec = pr[0] if isinstance(pr, (list, tuple)) else pr
                if es_concreto(sec):
                    n += 1
            except Exception:
                continue
        return n
    except Exception:
        return 0


def _albanileria_por_direccion(SapModel):
    """Devuelve {'X': bool, 'Y': bool}: si hay muros de albañilería (material NO
    de concreto) que actúan en cada dirección, identificados por geometría
    (un muro que se extiende en X resiste en X). Para Art. 22.2."""
    res = {"X": False, "Y": False}
    try:
        mats, conc = set(), set()
        mr = SapModel.PropMaterial.GetNameList()
        for m in (list(mr[1]) if len(mr) >= 2 and mr[1] else []):
            mats.add(m)
            try:
                gm = SapModel.PropMaterial.GetMaterial(m)
                t = gm[0] if isinstance(gm, (list, tuple)) else gm
                if int(t) == 2:
                    conc.add(m)
            except Exception:
                continue
        sec_mat = {}

        def mat_de(sec):
            if sec in sec_mat:
                return sec_mat[sec]
            mn = None
            try:
                gw = SapModel.PropArea.GetWall(sec)
                cand = [x for x in gw if isinstance(x, str) and x in mats]
                mn = cand[0] if cand else None
            except Exception:
                mn = None
            sec_mat[sec] = mn
            return mn

        names = SapModel.AreaObj.GetNameList()
        for nm in (list(names[1]) if len(names) >= 2 and names[1] else []):
            try:
                o = SapModel.AreaObj.GetDesignOrientation(nm)
                if int(o[0] if isinstance(o, (list, tuple)) else o) != 1:
                    continue
                pr = SapModel.AreaObj.GetProperty(nm)
                sec = pr[0] if isinstance(pr, (list, tuple)) else pr
                mn = mat_de(sec)
                if (not mn) or (mn in conc):
                    continue  # desconocido o concreto → no es albañilería
                gp = SapModel.AreaObj.GetPoints(nm)
                pts = list(gp[1]) if len(gp) >= 2 and gp[1] else []
                xs, ys = [], []
                for p in pts:
                    c = SapModel.PointObj.GetCoordCartesian(p)
                    xs.append(c[0]); ys.append(c[1])
                if not xs:
                    continue
                dx = max(xs) - min(xs); dy = max(ys) - min(ys)
                res["X" if dx >= dy else "Y"] = True
            except Exception:
                continue
    except Exception:
        pass
    return res


def niveles():
    """Lista los nombres de niveles (stories) del modelo, para que el usuario
    elija en qué nivel revisar el sistema estructural."""
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        res = SapModel.Story.GetNameList()
        return {"ok": True, "niveles": list(res[1])}
    except Exception as e:
        return {"ok": False, "mensaje": f"No se pudieron leer los niveles: {e}"}


def sistema_estructural(piso=None, pendulo=False):
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        casos = {"X": ["SDXMasaY+", "SDXMasaY-"], "Y": ["SDYMasaX+", "SDYMasaX-"]}
        todos = casos["X"] + casos["Y"]

        # Mostrar las combinaciones de diseño en las tablas de salida
        try:
            SapModel.DatabaseTables.SetLoadCombinationsSelectedForDisplay(todos)
        except Exception:
            pass  # si la firma difiere, las tablas pueden traer todo igualmente

        def leer_fuerzas():
            # Sin muros de concreto no existe la tabla Pier Forces. No es un
            # error: significa que ese nivel no tiene muros y el sistema es de
            # porticos, asi que se sigue con la lista vacia.
            try:
                _, pf = _leer_tabla(SapModel, "Pier Forces")
            except Exception:
                pf = []
            _, sf = _leer_tabla(SapModel, "Story Forces")
            return pf, sf

        # Solo lectura: el modelo debe estar analizado. NO se reasignan piers ni se
        # corre/guarda. Se leen los muros con los piers que ya tengas definidos.
        if not bool(SapModel.GetModelIsLocked()):
            return {"ok": False, "mensaje": NO_ANALIZADO}
        reuso = True
        pier, story = leer_fuerzas()
        # Sin piers el cortante de muros es cero y la clasificacion da Porticos,
        # que es justo lo que corresponde a un modelo sin muros. Se avisa por si
        # el usuario si tiene muros y lo que falta es asignarles el pier.
        # Sin muros de concreto no hay nada que etiquetar: el sistema es de
        # porticos y no procede pedir piers. Solo se pide si los muros existen.
        sin_piers = not pier
        muros_concreto = _contar_muros_concreto(SapModel) if sin_piers else None
        faltan_piers = bool(sin_piers and muros_concreto)
        # Si existe un pier 'TODO' (agregado), se usa solo ese; si no, se suman todos.
        usar_todo = any(r.get("Pier") == "TODO" for r in pier)

        # Nivel a revisar: el que indica el usuario (piso). Si no indica ninguno,
        # se usa el piso base = donde el cortante acumulado (Bottom) es máximo.
        # Tanto el cortante total como el de muros se miden en ESE mismo nivel.
        piso_base = piso or None
        if not piso_base:
            vmax = -1.0
            for r in story:
                if r.get("Location") != "Bottom":
                    continue
                v = max(_abs_num(r.get("VX")), _abs_num(r.get("VY")))
                if v > vmax:
                    vmax, piso_base = v, r.get("Story")

        def v_total(caso, comp):  # cortante en la base, en el piso base
            vals = [_abs_num(r.get(comp)) for r in story
                    if r.get("OutputCase") == caso and r.get("Location") == "Bottom"
                    and r.get("Story") == piso_base]
            return max(vals) if vals else 0.0

        def v_muros(caso):  # cortante de muros en el piso base
            # Por pier se toma el MÁXIMO absoluto de sus filas (el espectro da + y - de
            # igual magnitud; sumarlas duplicaría). Luego se suman los piers (o el TODO).
            por_v2, por_v3 = {}, {}
            for r in pier:
                if (r.get("OutputCase") == caso and r.get("Story") == piso_base
                        and r.get("Location") == "Bottom"):
                    pn = r.get("Pier")
                    if usar_todo and pn != "TODO":
                        continue
                    por_v2[pn] = max(por_v2.get(pn, 0.0), _abs_num(r.get("V2")))
                    por_v3[pn] = max(por_v3.get(pn, 0.0), _abs_num(r.get("V3")))
            return max(sum(por_v2.values()), sum(por_v3.values()))

        detalle, direcciones, sin_datos = [], {}, True
        for d, lista in casos.items():
            comp = "VX" if d == "X" else "VY"
            mejor = None
            for caso in lista:
                vt = v_total(caso, comp)
                vm = v_muros(caso)
                if vt:
                    sin_datos = False
                pct = (vm / vt * 100.0) if vt else 0.0
                sistema, r0 = _clasificar_sistema(pct)
                fila = {"caso": caso, "direccion": d, "v_muros": round(vm, 2),
                        "v_total": round(vt, 2), "porcentaje": round(pct, 1),
                        "sistema": sistema, "R0": r0}
                detalle.append(fila)
                if mejor is None or pct > mejor["porcentaje"]:
                    mejor = fila
            direcciones[d] = mejor

        if sin_datos:
            return {"ok": False, "mensaje": "No se obtuvieron cortantes. Verifica que las "
                    "combinaciones de diseño (SDXMasaY±, SDYMasaX±) existan y corre el "
                    "análisis."}

        # --- Art. 22: péndulo invertido (22.3) o albañilería en la dirección (22.2) ---
        alb = _albanileria_por_direccion(SapModel)
        for d in ("X", "Y"):
            m = direcciones.get(d)
            if not m:
                continue
            m["albanileria"] = bool(alb.get(d))
            m["pendulo"] = bool(pendulo)
            if pendulo:
                m["sistema"] = "Péndulo invertido (Art. 22.3)"
                m["R0"] = 2.5
            elif alb.get(d):
                m["R0"] = min(m["R0"], 3)   # 22.2: se toma el menor R0 (albañilería = 3)
                m["sistema"] = m["sistema"] + " + Albañilería (Art. 22.2)"

        origen = "resultados existentes" if reuso else "análisis ejecutado"
        if faltan_piers:
            origen += " · hay muros de concreto sin pier asignado"
        elif sin_piers:
            origen += " · el modelo no tiene muros de concreto"
        return {"ok": True, "direcciones": direcciones, "detalle": detalle,
                "nivel": piso_base, "pendulo": bool(pendulo), "albanileria": alb,
                "sin_piers": sin_piers, "faltan_piers": faltan_piers,
                "muros_concreto": muros_concreto,
                "mensaje": f"Nivel {piso_base} — X: {direcciones['X']['sistema']} "
                           f"(R0={direcciones['X']['R0']}); Y: {direcciones['Y']['sistema']} "
                           f"(R0={direcciones['Y']['R0']}) · {origen}."}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error al calcular el sistema estructural: {e}"}


# ----------------------------------------------------------------------------
# 4) Derivas: perfil de deriva por nivel para los 4 combos D- (Art. 51 · Tabla N° 14)
# ----------------------------------------------------------------------------
def derivas():
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        # (combo, dirección de deriva relevante)
        cases = [("D-SDXMasaY+", "X"), ("D-SDXMasaY-", "X"),
                 ("D-SDYMasaX+", "Y"), ("D-SDYMasaX-", "Y")]

        # Mostrar las combinaciones D- en la tabla de salida
        try:
            SapModel.DatabaseTables.SetLoadCombinationsSelectedForDisplay([c for c, _ in cases])
        except Exception:
            pass

        # Solo lectura: el modelo debe estar analizado (no se corre ni se guarda aquí).
        if not bool(SapModel.GetModelIsLocked()):
            return {"ok": False, "mensaje": NO_ANALIZADO}
        reuso = True

        _, drifts = _leer_tabla(SapModel, "Story Drifts")

        def perfil(caso, direccion):  # [{story, drift}] de arriba (techo) a abajo (base)
            por_story, z = {}, {}
            for r in drifts:
                if r.get("OutputCase") != caso or r.get("Direction") != direccion:
                    continue
                s = r.get("Story")
                por_story[s] = max(por_story.get(s, 0.0), _abs_num(r.get("Drift")))
                z[s] = _abs_num(r.get("Z"))
            items = sorted(por_story.items(), key=lambda kv: z.get(kv[0], 0.0), reverse=True)
            return [{"story": s, "drift": round(d, 6)} for s, d in items]

        resultado, sin_datos = [], True
        for caso, direccion in cases:
            p = perfil(caso, direccion)
            if p:
                sin_datos = False
            dmax = max((it["drift"] for it in p), default=0.0)
            dmax_story = next((it["story"] for it in p if it["drift"] == dmax), None)
            resultado.append({"caso": caso, "direccion": direccion, "perfil": p,
                              "max": round(dmax, 6), "max_story": dmax_story})

        if sin_datos:
            return {"ok": False, "mensaje": "No se obtuvieron derivas. Verifica que existan las "
                    "combinaciones D- (genera primero Masas + Combinaciones) y que el modelo "
                    "esté analizado."}

        origen = "resultados existentes" if reuso else "análisis ejecutado"
        return {"ok": True, "casos": resultado,
                "mensaje": f"Derivas de {len(resultado)} casos · {origen}."}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error al calcular las derivas: {e}"}


# ----------------------------------------------------------------------------
# 5) Junta sísmica: desplazamiento máximo (más crítico) por dirección (Art. 52)
# ----------------------------------------------------------------------------
def junta():
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        cases = {"X": ["D-SDXMasaY+", "D-SDXMasaY-"], "Y": ["D-SDYMasaX+", "D-SDYMasaX-"]}
        todos = cases["X"] + cases["Y"]
        try:
            SapModel.DatabaseTables.SetLoadCombinationsSelectedForDisplay(todos)
        except Exception:
            pass

        if not bool(SapModel.GetModelIsLocked()):
            return {"ok": False, "mensaje": NO_ANALIZADO}
        reuso = True
        try:
            SapModel.SetPresentUnits(12)  # tonf, m, C
        except Exception:
            pass

        # Altura total del edificio (suma de alturas de entrepiso).
        altura = 0.0
        try:
            _, sdef = _leer_tabla(SapModel, "Story Definitions")
            altura = round(sum(_abs_num(r.get("Height")) for r in sdef), 2)
        except Exception:
            altura = 0.0

        _, disp = _leer_tabla(SapModel, "Story Max Over Avg Displacements")

        def dmax(lista, direccion):  # desplazamiento máximo (más crítico) en la dirección
            vals = [_abs_num(r.get("Maximum")) for r in disp
                    if r.get("OutputCase") in lista and r.get("Direction") == direccion]
            return max(vals) if vals else 0.0

        dx = dmax(cases["X"], "X")
        dy = dmax(cases["Y"], "Y")
        if dx == 0 and dy == 0:
            return {"ok": False, "mensaje": "No se obtuvieron desplazamientos. Verifica que "
                    "existan las combinaciones D- y que el modelo esté analizado."}

        origen = "resultados existentes" if reuso else "análisis ejecutado"
        return {"ok": True, "dx": round(dx, 5), "dy": round(dy, 5), "altura": altura,
                "mensaje": f"Δmáx X = {dx:.4f} m · Δmáx Y = {dy:.4f} m · h = {altura} m · {origen}."}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error al calcular la junta sísmica: {e}"}


# ----------------------------------------------------------------------------
# 6) Memoria de cálculo: periodos, peso, cortantes y derivas (desde ETABS)
# ----------------------------------------------------------------------------
def memoria(uso=None):
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        combos = ["SDXMasaY+", "SDXMasaY-", "SDYMasaX+", "SDYMasaX-",
                  "D-SDXMasaY+", "D-SDXMasaY-", "D-SDYMasaX+", "D-SDYMasaX-"]
        try:
            SapModel.DatabaseTables.SetLoadCombinationsSelectedForDisplay(combos)
        except Exception:
            pass

        if not bool(SapModel.GetModelIsLocked()):
            return {"ok": False, "mensaje": NO_ANALIZADO}
        reuso = True

        # Periodos fundamentales: modo con mayor masa participante en X y en Y
        _, modal = _leer_tabla(SapModel, "Modal Participating Mass Ratios")
        tx = ty = 0.0
        ux_max = uy_max = -1.0
        for r in modal:
            per = _abs_num(r.get("Period"))
            ux, uy = _abs_num(r.get("UX")), _abs_num(r.get("UY"))
            if ux > ux_max:
                ux_max, tx = ux, per
            if uy > uy_max:
                uy_max, ty = uy, per

        # Reacciones en la base: peso sísmico (MASA) y cortante dinámico (combos diseño)
        _, base = _leer_tabla(SapModel, "Base Reactions")

        def reac(caso, comp):
            return max([_abs_num(r.get(comp)) for r in base if r.get("OutputCase") == caso] or [0.0])

        # Peso sísmico P según la fuente de masas (igual que en generar_masas):
        # C / Art.19.3 → Dead + 0.25·Live; A/B → Dead + 0.50·Live + 0.25·Roof Live.
        fz_dead = reac("Dead", "FZ")
        fz_live = reac("Live", "FZ")
        fz_roof = reac("Roof Live", "FZ")
        if uso in ("Categoría C", "Art. 19.3"):
            peso = fz_dead + 0.25 * fz_live
        else:
            peso = fz_dead + 0.50 * fz_live + 0.25 * fz_roof
        vdin_x = max(reac("SDXMasaY+", "FX"), reac("SDXMasaY-", "FX"))
        vdin_y = max(reac("SDYMasaX+", "FY"), reac("SDYMasaX-", "FY"))

        # Derivas máximas por dirección (combos D-)
        _, drifts = _leer_tabla(SapModel, "Story Drifts")

        def drift_max(lista, direccion):
            return max([_abs_num(r.get("Drift")) for r in drifts
                        if r.get("OutputCase") in lista and r.get("Direction") == direccion] or [0.0])

        dx = drift_max(["D-SDXMasaY+", "D-SDXMasaY-"], "X")
        dy = drift_max(["D-SDYMasaX+", "D-SDYMasaX-"], "Y")

        origen = "resultados existentes" if reuso else "análisis ejecutado"
        return {"ok": True,
                "Tx": round(tx, 3), "Ty": round(ty, 3),
                "ux": round(ux_max, 4), "uy": round(uy_max, 4),
                "peso": round(peso, 2),
                "Vdin_x": round(vdin_x, 3), "Vdin_y": round(vdin_y, 3),
                "drift_x": round(dx, 6), "drift_y": round(dy, 6),
                "mensaje": f"Tx={tx:.3f}s, Ty={ty:.3f}s · P={peso:.1f} · {origen}."}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error al generar la memoria: {e}"}


# ----------------------------------------------------------------------------
# 7) Masa participativa modal (Modal Participating Mass Ratios)
# ----------------------------------------------------------------------------
def masa_participativa(caso=None):
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        if not bool(SapModel.GetModelIsLocked()):
            return {"ok": False, "mensaje": NO_ANALIZADO}
        reuso = True

        _, modal = _leer_tabla(SapModel, "Modal Participating Mass Ratios")

        # Casos modales disponibles (Modal, ModalMasaX+, ModalMasaY+, ...)
        casos = []
        for r in modal:
            c = r.get("Case")
            if c and c not in casos:
                casos.append(c)
        sel = caso if caso in casos else (casos[0] if casos else None)

        modos = []
        for r in modal:
            if r.get("Case") != sel:
                continue
            m = r.get("Mode")
            if m is None or str(m).strip() == "":
                continue
            modos.append({
                "modo": str(m),
                "periodo": round(_abs_num(r.get("Period")), 3),
                "ux": round(_abs_num(r.get("UX")), 4),
                "uy": round(_abs_num(r.get("UY")), 4),
                "uz": round(_abs_num(r.get("UZ")), 4),
                "rz": round(_abs_num(r.get("RZ")), 4),
                "sumux": round(_abs_num(r.get("SumUX")), 4),
                "sumuy": round(_abs_num(r.get("SumUY")), 4),
                "sumrz": round(_abs_num(r.get("SumRZ")), 4),
            })
        if not modos:
            return {"ok": False, "mensaje": "No se obtuvo la masa participativa. Verifica que el "
                    "modelo tenga un caso modal analizado."}

        sumux = modos[-1]["sumux"]
        sumuy = modos[-1]["sumuy"]
        origen = "resultados existentes" if reuso else "análisis ejecutado"
        return {"ok": True, "casos": casos, "caso": sel, "modos": modos,
                "sumux": sumux, "sumuy": sumuy,
                "mensaje": f"{sel}: {len(modos)} modos · ΣUX={sumux*100:.1f}% · ΣUY={sumuy*100:.1f}% · {origen}."}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error al leer la masa participativa: {e}"}


# ----------------------------------------------------------------------------
# 8) Escalamiento sísmico: factor f y reescalado de los combos de diseño
# ----------------------------------------------------------------------------
def _factor_c(t, tp, tl):
    """Factor de amplificación sísmica C (E.030), igual que en la web."""
    if t < 0.2 * tp:
        return 1 + 7.5 * (t / tp)
    if t <= tp:
        return 2.5
    if t < tl:
        return 2.5 * (tp / t)
    return 2.5 * (tp * tl) / (t * t)


def escalamiento(p):
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        p = p or {}
        Z = float(p.get("Z") or 0); U = float(p.get("U") or 0); S = float(p.get("S") or 0)
        Tp = float(p.get("Tp") or 0); Tl = float(p.get("Tl") or 0)
        rx = float(p.get("Rx") or 1); ry = float(p.get("Ry") or 1)
        uso = p.get("uso")
        regular = bool(p.get("regular"))
        if not (Z and U and S and Tp and Tl):
            return {"ok": False, "mensaje": "Faltan parámetros (Z, U, S, Tp, Tl). Ábrelos en Datos."}

        try:
            SapModel.DatabaseTables.SetLoadCombinationsSelectedForDisplay(
                ["SDXMasaY+", "SDXMasaY-", "SDYMasaX+", "SDYMasaX-"])
        except Exception:
            pass

        # El modelo debe estar analizado. El escalamiento solo MODIFICA combos (post-
        # proceso), no corre ni guarda el modelo; tú guardas en ETABS cuando quieras.
        if not bool(SapModel.GetModelIsLocked()):
            return {"ok": False, "mensaje": NO_ANALIZADO}

        # Periodos fundamentales (modo de mayor masa por dirección)
        _, modal = _leer_tabla(SapModel, "Modal Participating Mass Ratios")
        tx = ty = 0.0; uxm = uym = -1.0
        for r in modal:
            per = _abs_num(r.get("Period")); ux = _abs_num(r.get("UX")); uy = _abs_num(r.get("UY"))
            if ux > uxm: uxm, tx = ux, per
            if uy > uym: uym, ty = uy, per

        # Peso sísmico y cortante dinámico BASE (de los casos elásticos /R → idempotente)
        _, base = _leer_tabla(SapModel, "Base Reactions")

        def reac(c, comp):
            return max([_abs_num(r.get(comp)) for r in base if r.get("OutputCase") == c] or [0.0])

        fz_d = reac("Dead", "FZ"); fz_l = reac("Live", "FZ"); fz_r = reac("Roof Live", "FZ")
        peso = (fz_d + 0.25 * fz_l) if uso in ("Categoría C", "Art. 19.3") \
            else (fz_d + 0.50 * fz_l + 0.25 * fz_r)
        # Cortante estática por dirección
        frac = 0.8 if regular else 0.9
        cx = _factor_c(tx, Tp, Tl); cy = _factor_c(ty, Tp, Tl)
        vest_x = Z * U * cx * S / rx * peso
        vest_y = Z * U * cy * S / ry * peso

        # CUATRO factores: el + y el - tienen cortante dinámica distinta, así que
        # cada combo de diseño tiene su propio f = (frac·Vest_dir)/Vdin_combo  (≥ 1).
        # Vdin de cada combo = reacción del caso elástico /R (base, idempotente).
        def factor(elastico, comp, R, vest):
            vd = reac(elastico, comp) / R
            f = max(1.0, (frac * vest / vd) if vd else 1.0)
            return vd, f

        vd_xp, f_xp = factor("(ZUCS g) SDXMasaY+", "FX", rx, vest_x)
        vd_xm, f_xm = factor("(ZUCS g) SDXMasaY-", "FX", rx, vest_x)
        vd_yp, f_yp = factor("(ZUCS g) SDYMasaX+", "FY", ry, vest_y)
        vd_ym, f_ym = factor("(ZUCS g) SDYMasaX-", "FY", ry, vest_y)

        # Combos de DISEÑO a su valor base (1/R), sin escalar (100% + 30%).
        combos_base = [
            ("SDXMasaY+", "(ZUCS g) SDXMasaY+", rx, "(ZUCS g) SDY", ry),
            ("SDXMasaY-", "(ZUCS g) SDXMasaY-", rx, "(ZUCS g) SDY", ry),
            ("SDYMasaX+", "(ZUCS g) SDYMasaX+", ry, "(ZUCS g) SDX", rx),
            ("SDYMasaX-", "(ZUCS g) SDYMasaX-", ry, "(ZUCS g) SDX", rx),
        ]
        for nombre, prin, rp, sec, rs in combos_base:
            SapModel.RespCombo.Delete(nombre)
            SapModel.RespCombo.Add(nombre, 3)
            SapModel.RespCombo.SetCaseList(nombre, 0, prin, 1.0 / rp)
            SapModel.RespCombo.SetCaseList(nombre, 0, sec, 0.30 / rs)

        # Cada factor (≥1) se aplica a SU caso dentro de la envolvente SISMO.
        sismo = [("SISMO: XX", [("SDXMasaY+", f_xp), ("SDXMasaY-", f_xm)]),
                 ("SISMO: YY", [("SDYMasaX+", f_yp), ("SDYMasaX-", f_ym)])]
        for nombre, items in sismo:
            SapModel.RespCombo.Delete(nombre)
            SapModel.RespCombo.Add(nombre, 1)  # 1 = Envelope
            for c, fdir in items:
                SapModel.RespCombo.SetCaseList(nombre, 1, c, fdir)  # 1 = combinación · factor f

        casos = [
            {"caso": "SDXMasaY+", "dir": "X", "T": round(tx, 3), "C": round(cx, 3),
             "Vest": round(vest_x, 2), "Vdin": round(vd_xp, 2), "f": round(f_xp, 3)},
            {"caso": "SDXMasaY-", "dir": "X", "T": round(tx, 3), "C": round(cx, 3),
             "Vest": round(vest_x, 2), "Vdin": round(vd_xm, 2), "f": round(f_xm, 3)},
            {"caso": "SDYMasaX+", "dir": "Y", "T": round(ty, 3), "C": round(cy, 3),
             "Vest": round(vest_y, 2), "Vdin": round(vd_yp, 2), "f": round(f_yp, 3)},
            {"caso": "SDYMasaX-", "dir": "Y", "T": round(ty, 3), "C": round(cy, 3),
             "Vest": round(vest_y, 2), "Vdin": round(vd_ym, 2), "f": round(f_ym, 3)},
        ]
        return {"ok": True, "peso": round(peso, 2), "frac": frac, "casos": casos,
                "mensaje": f"Escalamiento aplicado (4 factores): "
                           f"X+={f_xp:.3f}, X-={f_xm:.3f}, Y+={f_yp:.3f}, Y-={f_ym:.3f}."}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error en el escalamiento sísmico: {e}"}


# ----------------------------------------------------------------------------
# 8) Desbloquear el modelo (para volver a cargar tras analizar)
# ----------------------------------------------------------------------------
def desbloquear():
    """Desbloquea el modelo en ETABS (SetModelIsLocked False) para poder volver
    a modificarlo/cargarlo. Es una operación de escritura solicitada por el usuario."""
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        if not bool(SapModel.GetModelIsLocked()):
            return {"ok": True, "locked": False,
                    "mensaje": "El modelo ya estaba desbloqueado. Puedes pulsar Cargar."}
        SapModel.SetModelIsLocked(False)
        locked = bool(SapModel.GetModelIsLocked())
        return {"ok": not locked, "locked": locked,
                "mensaje": "Modelo desbloqueado. Ya puedes pulsar Cargar de nuevo."
                if not locked else "No se pudo desbloquear el modelo."}
    except Exception as e:
        return {"ok": False, "mensaje": f"No se pudo desbloquear el modelo: {e}"}


# ----------------------------------------------------------------------------
# 10) Modos de vibracion: actualizar solo el numero de modos de los casos
#     modales existentes, sin rehacer masas ni combinaciones.
# ----------------------------------------------------------------------------

def get_modos():
    """Lee los modos que tiene ahora mismo el caso modal del modelo.

    GetNumberModes devuelve los valores por parametros de salida; comtypes los
    entrega en una tupla cuyo orden puede variar segun la version, asi que se
    toman los dos primeros enteros y se descarta el codigo de retorno final.
    """
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    for caso in ("Modal", "ModalMasaX+", "ModalMasaY+"):
        try:
            ret = SapModel.LoadCases.ModalEigen.GetNumberModes(caso, 0, 0)
            if not isinstance(ret, (list, tuple)):
                continue
            valores = [int(v) for v in ret[:-1] if isinstance(v, int)]
            if len(valores) >= 2 and valores[0] > 0:
                return {"ok": True, "caso": caso,
                        "modos_max": valores[0], "modos_min": valores[1]}
        except Exception:
            continue
    return {"ok": False, "mensaje": "No se encontro ningun caso modal en el modelo."}

def set_modos(modos_max, modos_min, correr=True):
    """Actualiza NumberModes en todos los casos modales del modelo.

    El usuario ajusta los modos desde ESPECTRA cuando con niveles x 3 no se
    llega al 90 % de masa efectiva (E.030 Art. 40.2). Aqui solo se toca el
    caso modal: las masas, los casos estaticos y las combinaciones se quedan
    como estaban.
    """
    try:
        modos_max = int(modos_max)
        modos_min = int(modos_min)
    except (TypeError, ValueError):
        return {"ok": False, "mensaje": "Los modos deben ser numeros enteros."}
    if modos_max < 1 or modos_min < 1:
        return {"ok": False, "mensaje": "Los modos deben ser mayores que cero."}
    if modos_min > modos_max:
        return {"ok": False, "mensaje": "El minimo no puede ser mayor que el maximo."}

    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        if bool(SapModel.GetModelIsLocked()):
            SapModel.SetModelIsLocked(False)
            if bool(SapModel.GetModelIsLocked()):
                return {"ok": False, "guardar": True,
                        "mensaje": "El modelo esta bloqueado y no se pudo desbloquear. "
                                   "Desbloquealo en ETABS y vuelve a intentarlo."}

        casos = ["Modal", "ModalMasaX+", "ModalMasaX-", "ModalMasaY+", "ModalMasaY-"]
        aplicados, faltan = [], []
        for caso in casos:
            try:
                ret = SapModel.LoadCases.ModalEigen.SetNumberModes(caso, modos_max, modos_min)
                if isinstance(ret, (list, tuple)):
                    ret = ret[-1]
                if int(ret) == 0:
                    aplicados.append(caso)
                else:
                    faltan.append(caso)
            except Exception:
                faltan.append(caso)

        if not aplicados:
            return {"ok": False, "aplicados": [], "faltan": faltan,
                    "mensaje": "No se encontro ningun caso modal. Genera antes las masas y "
                               "combinaciones desde la pestana Datos."}
        msg = "Modos actualizados a %d-%d en: %s." % (modos_min, modos_max, ", ".join(aplicados))
        if faltan:
            msg += " No estaban en el modelo: %s." % ", ".join(faltan)

        # El usuario no tiene por que ir a ETABS a pulsar Run: cambiar los modos
        # solo sirve si el modelo se vuelve a analizar.
        analizado = False
        if correr:
            try:
                SapModel.Analyze.RunAnalysis()
                analizado = True
                msg += " Analisis ejecutado; ya puedes leer la masa participativa."
            except Exception as e:
                msg += " No se pudo correr el analisis (%s): hazlo en ETABS." % e
        else:
            msg += " Corre el analisis en ETABS para leer la masa participativa."

        return {"ok": True, "aplicados": aplicados, "faltan": faltan, "analizado": analizado,
                "modos_max": modos_max, "modos_min": modos_min, "mensaje": msg}
    except Exception as e:
        return {"ok": False, "mensaje": "No se pudieron actualizar los modos: %s" % e}

# ----------------------------------------------------------------------------
# 9) Irregularidad de rigidez (piso blando) · Tabla N° 11 (E.030)
# ----------------------------------------------------------------------------
# ----------------------------------------------------------------------------
# 9b) Irregularidad de masa o peso - Tabla N 11 (Ia = 0,90)
# ----------------------------------------------------------------------------
def irregularidad_masa():
    """Peso de cada piso frente al del piso de arriba y al del piso de abajo.

    Hay irregularidad cuando el peso de un piso es mayor que 1.5 veces el de un
    piso adyacente. Se listan todos los niveles con sus dos comparaciones (V1
    contra el superior, V2 contra el inferior); los extremos dejan vacia la que
    no tiene vecino.

    Los pesos salen de Mass Summary by Story, en ETABS:
    Display > Show Tables > Model Definition > Other Definitions > Mass Data.
    """
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        _, masas = _leer_tabla(SapModel, "Mass Summary by Story")
        _, sdef = _leer_tabla(SapModel, "Story Definitions")
        if not masas:
            return {"ok": False, "mensaje": "No se pudo leer la masa por nivel. Define la fuente "
                    "de masa en ETABS (Define / Mass Source) y vuelve a intentarlo."}

        # Story Definitions viene del techo hacia abajo y no incluye la base,
        # que no es un piso y no debe entrar en la comparacion.
        orden = []
        for r in sdef:
            st = r.get("Story")
            if st and st not in orden:
                orden.append(st)

        por_piso = {}
        for r in masas:
            st = r.get("Story")
            if st:
                por_piso[st] = _abs_num(r.get("UX"))

        niveles = [st for st in orden if st in por_piso]
        if len(niveles) < 2:
            return {"ok": False, "mensaje": "Hacen falta al menos dos niveles para comparar pesos."}

        filas, irregular = [], False
        for i, st in enumerate(niveles):
            w = por_piso.get(st, 0.0)
            fila = {"story": st, "wi": round(w, 4),
                    "razon_sup": None, "razon_inf": None, "v1": "", "v2": ""}
            if i > 0:                       # hay piso encima
                ws = por_piso.get(niveles[i - 1], 0.0)
                if ws > 0:
                    rz = w / ws
                    fila["razon_sup"] = round(rz, 3)
                    fila["v1"] = "Irreg." if rz > 1.5 else "Reg."
                    if rz > 1.5:
                        irregular = True
            if i + 1 < len(niveles):        # hay piso debajo
                wi_ = por_piso.get(niveles[i + 1], 0.0)
                if wi_ > 0:
                    rz = w / wi_
                    fila["razon_inf"] = round(rz, 3)
                    fila["v2"] = "Irreg." if rz > 1.5 else "Reg."
                    if rz > 1.5:
                        irregular = True
            filas.append(fila)

        return {"ok": True, "irregular": irregular, "Ia": 0.90 if irregular else 1.0,
                "azotea": niveles[0], "base": niveles[-1], "filas": filas,
                "ruta": "Display > Show Tables > Model Definition > Other Definitions > "
                        "Mass Data > Mass Summary by Story",
                "mensaje": ("Irregularidad de masa: el peso de al menos un piso supera 1.5 veces "
                            "el de un piso adyacente (Ia = 0.90)." if irregular else
                            "Sin irregularidad de masa: ningun piso supera 1.5 veces el peso de "
                            "un piso adyacente.")}
    except Exception as e:
        return {"ok": False, "mensaje": "Error al revisar la irregularidad de masa: %s" % e}


# ----------------------------------------------------------------------------
# 9c) Irregularidad torsional y torsional extrema - Tabla N 12 (Ip = 0,75 / 0,60)
# ----------------------------------------------------------------------------
def irregularidad_torsion(limite=0.007):
    """Deriva maxima de un extremo frente a la deriva promedio del entrepiso.

    Irregular por encima de 1.3 y extrema por encima de 1.5 (Tabla N 13). Solo
    se exige donde la deriva maxima pasa del 50 % del limite de distorsion, asi
    que por debajo de ese umbral la fila queda como que no aplica.

    Se lee "Diaphragm Max Over Avg Drifts", que da Max y Avg ya en deriva
    (Delta/h). En ETABS:
    Display > Show Tables > Analysis Results > Joint Output > Displacements.
    Al ser por diafragma, solo aparecen los entrepisos que tienen uno, que es
    justo la condicion de diafragma rigido que pide el criterio.

    Se usan las combinaciones D-, que ya traen la excentricidad accidental.
    """
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        limite = float(limite)
    except (TypeError, ValueError):
        limite = 0.007
    umbral = 0.5 * limite
    # (combinacion, direccion de analisis, titulo del bloque)
    bloques_def = [
        ("D-SDXMasaY+", "X", "Direccion X - Masa Y+"),
        ("D-SDXMasaY-", "X", "Direccion X - Masa Y-"),
        ("D-SDYMasaX+", "Y", "Direccion Y - Masa X+"),
        ("D-SDYMasaX-", "Y", "Direccion Y - Masa X-"),
    ]
    combos = [b[0] for b in bloques_def]
    try:
        try:
            SapModel.DatabaseTables.SetLoadCombinationsSelectedForDisplay(combos)
        except Exception:
            pass   # si la firma difiere, la tabla puede traer todo igualmente

        _, tabla = _leer_tabla(SapModel, "Diaphragm Max Over Avg Drifts")
        if not tabla:
            return {"ok": False, "mensaje": "No se pudieron leer las derivas por diafragma. "
                    "El criterio solo aplica con diafragma rigido: asigna diafragma a los "
                    "entrepisos en ETABS y corre el analisis."}

        _, sdef = _leer_tabla(SapModel, "Story Definitions")
        orden = []
        for r in sdef:
            st = r.get("Story")
            if st and st not in orden:
                orden.append(st)

        # ETABS repite cada fila con StepType Max y Min; nos quedamos con la peor.
        datos = {}
        for r in tabla:
            caso = r.get("OutputCase")
            if caso not in combos:
                continue
            item = str(r.get("Item") or "")
            d = item.strip()[-1:].upper()      # "Diaph D1 X" -> "X"
            if d not in ("X", "Y"):
                continue
            mx = _abs_num(r.get("Max Drift"))
            av = _abs_num(r.get("Avg Drift"))
            razon = (mx / av) if av > 0 else _abs_num(r.get("Ratio"))
            k = (caso, d, r.get("Story"))
            if razon > datos.get(k, (0.0, 0.0, 0.0))[0]:
                datos[k] = (razon, mx, av)

        bloques, hay_irr, hay_ext = [], False, False
        for caso, direccion, titulo in bloques_def:
            filas = []
            for st in orden:
                v = datos.get((caso, direccion, st))
                if not v:
                    continue
                razon, mx, av = v
                aplica = mx > umbral
                estado = "No aplica"
                if aplica:
                    if razon > 1.5:
                        estado, hay_ext = "Extrema", True
                    elif razon > 1.3:
                        estado, hay_irr = "Irregular", True
                    else:
                        estado = "Regular"
                filas.append({"story": st, "max": round(mx, 6), "avg": round(av, 6),
                              "razon": round(razon, 3), "aplica": aplica, "estado": estado})
            if filas:
                bloques.append({"titulo": titulo, "caso": caso,
                                "direccion": direccion, "filas": filas})

        if not bloques:
            return {"ok": False, "mensaje": "No se encontraron las combinaciones D-. Generalas "
                    "desde la pestana Datos y corre el analisis."}

        ip = 0.60 if hay_ext else (0.75 if hay_irr else 1.0)
        if hay_ext:
            msg = "Irregularidad torsional extrema: la razon maximo/promedio supera 1.5 (Ip = 0.60)."
        elif hay_irr:
            msg = "Irregularidad torsional: la razon maximo/promedio supera 1.3 (Ip = 0.75)."
        else:
            msg = ("Sin irregularidad torsional: ningun entrepiso con deriva por encima del 50 % "
                   "del limite supera la razon de 1.3.")
        return {"ok": True, "irregular": hay_irr or hay_ext, "extrema": hay_ext,
                "Ip": ip, "limite": limite, "umbral": round(umbral, 6), "bloques": bloques,
                "ruta": "Display > Show Tables > Analysis Results > Joint Output > "
                        "Displacements > Diaphragm Max Over Avg Drift",
                "mensaje": msg}
    except Exception as e:
        return {"ok": False, "mensaje": "Error al revisar la irregularidad torsional: %s" % e}


def irregularidad_rigidez():
    """Verifica la irregularidad de rigidez (piso blando) leyendo 'Story Stiffness'.
    Criterio E.030 (por entrepiso, comparando con los superiores):
      - Irregular  (Ia=0.75): K_i < 0.70·K_sup   o   K_i < 0.80·prom(3 sup).
      - Extrema    (Ia=0.50): K_i < 0.60·K_sup   o   K_i < 0.70·prom(3 sup)."""
    SapModel, err = get_sapmodel()
    if err:
        return {"ok": False, "mensaje": err}
    try:
        if not bool(SapModel.GetModelIsLocked()):
            return {"ok": False, "mensaje": NO_ANALIZADO}

        # Fija las unidades a tonf, m, C (eUnits Ton_m_C = 12) para que la rigidez
        # salga en tonf/m de forma consistente.
        try:
            SapModel.SetPresentUnits(12)
        except Exception:
            pass

        # ETABS no siempre computa 'Story Stiffness' (requiere diafragmas), así que
        # la rigidez de entrepiso se calcula como K = V / δ, donde V es el cortante
        # de entrepiso (Story Forces) y δ = desplazamiento RELATIVO del centro de
        # masa del diafragma (igual que ETABS en su tabla 'Story Stiffness', método
        # de fuerzas: K = V / (U_CM,i − U_CM,inferior)).
        # Se usan las 4 combinaciones de deriva D- (incluyen la torsión accidental).
        combos = [("D-SDXMasaY+", "X"), ("D-SDXMasaY-", "X"),
                  ("D-SDYMasaX+", "Y"), ("D-SDYMasaX-", "Y")]
        try:
            SapModel.DatabaseTables.SetLoadCombinationsSelectedForDisplay([c for c, _ in combos])
        except Exception:
            pass

        _, forces = _leer_tabla(SapModel, "Story Forces")
        _, cmd = _leer_tabla(SapModel, "Diaphragm Center Of Mass Displacements")
        _, sdef = _leer_tabla(SapModel, "Story Definitions")
        if not forces or not cmd:
            return {"ok": False, "mensaje": "No hay fuerzas de entrepiso ni desplazamientos del "
                    "centro de masa. Verifica que el modelo esté analizado, tenga diafragma y "
                    "existan las combinaciones de deriva D-SDXMasaY+ / D-SDYMasaX+."}

        orden = []
        for r in sdef:
            s = r.get("Story")
            if s not in orden:
                orden.append(s)  # Story Definitions viene de arriba (techo) hacia abajo

        def evaluar(combo, direccion):
            comp = "VX" if direccion == "X" else "VY"
            ucomp = "UX" if direccion == "X" else "UY"
            V, U = {}, {}
            for r in forces:
                if r.get("OutputCase") != combo:
                    continue
                s = r.get("Story")
                V[s] = max(V.get(s, 0.0), _abs_num(r.get(comp)))
            for r in cmd:
                if r.get("OutputCase") != combo:
                    continue
                s = r.get("Story")
                U[s] = max(U.get(s, 0.0), _abs_num(r.get(ucomp)))  # despl. del CM (Max)
            # entrepisos con datos, de arriba (techo) hacia abajo
            sts = [s for s in orden if s in U and s in V]
            datos = []  # [(story, K)]
            for k, s in enumerate(sts):
                u_inf = U[sts[k + 1]] if (k + 1) < len(sts) else 0.0  # piso inferior; base = 0
                delta = U[s] - u_inf       # desplazamiento relativo del CM (entrepiso)
                kk = (V[s] / delta) if delta > 0 else 0.0
                if kk > 0:
                    datos.append((s, kk))
            Ks = [k for _, k in datos]
            out, soft, extrema = [], False, False
            for i, (s, k) in enumerate(datos):
                rsup = rprom = None
                estado = "—"
                if i >= 1:
                    ksup = Ks[i - 1]
                    rsup = (k / ksup) if ksup else None
                    # El promedio SOLO aplica si hay 3 entrepisos superiores; si no,
                    # no se calcula (no hay con qué promediar).
                    if i >= 3:
                        prom = sum(Ks[i - 3:i]) / 3.0
                        rprom = (k / prom) if prom else None
                    falla_ext = (rsup is not None and rsup < 0.60) or (rprom is not None and rprom < 0.70)
                    falla_soft = (rsup is not None and rsup < 0.70) or (rprom is not None and rprom < 0.80)
                    if falla_ext:
                        extrema = True; estado = "EXTREMA"
                    elif falla_soft:
                        soft = True; estado = "IRREGULAR"
                    else:
                        estado = "OK"
                out.append({"story": s, "K": round(k, 2),
                            "rsup": round(rsup, 3) if rsup is not None else None,
                            "rprom": round(rprom, 3) if rprom is not None else None,
                            "estado": estado})
            Ia = 0.50 if extrema else (0.75 if soft else 1.0)
            return {"caso": combo, "dir": direccion, "filas": out, "Ia": Ia,
                    "irregular": soft or extrema, "extrema": extrema}

        return {"ok": True, "casos": [evaluar(c, d) for c, d in combos],
                "mensaje": "Irregularidad de rigidez (piso blando) evaluada · 4 casos D- · Tabla N° 11."}
    except Exception as e:
        return {"ok": False, "mensaje": f"Error en irregularidad de rigidez: {e}"}


# ----------------------------------------------------------------------------
# Servidor HTTP
# ----------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        # hingenia.com es una pagina publica y 127.0.0.1 es red local: Chrome y
        # Edge exigen esta cabecera (Private Network Access) para dejar pasar la
        # peticion. Sin ella el navegador corta antes de llegar aqui.
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "600")

    def _send(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/ping":
            with ETABS_LOCK:
                SapModel, err = get_sapmodel()
                locked = None
                if err is None:
                    try:
                        locked = bool(SapModel.GetModelIsLocked())
                    except Exception:
                        locked = None
            self._send({"ok": True, "etabs": err is None, "locked": locked,
                        "version": APP_VERSION,
                        "mensaje": "API activa" if err is None else err})
        elif self.path == "/niveles":
            with ETABS_LOCK:
                datos = niveles()
            self._send(datos)
        elif self.path == "/modos":
            with ETABS_LOCK:
                datos = get_modos()
            self._send(datos)
        elif self.path == "/actualizacion":
            # No toca ETABS: fuera del candado para no bloquear el modelo.
            info = buscar_actualizacion()
            info["ok"] = True
            info["actual"] = APP_VERSION
            self._send(info)
        elif self.path == "/descargar":
            self._serve_installer()
        else:
            self._serve_static()

    # --- Descarga del instalador del puente (ESPECTRA.exe) --------------
    def _serve_installer(self):
        path = _installer_path()
        if not path or not os.path.isfile(path):
            return self._send({"ok": False, "mensaje":
                "Instalador no disponible. Compílalo con build_exe.bat (dist\\ESPECTRA.exe)."}, 404)
        try:
            size = os.path.getsize(path)
            fname = os.path.basename(path)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", 'attachment; filename="%s"' % fname)
            self.send_header("Content-Length", str(size))
            self.end_headers()
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except OSError:
            self._send({"ok": False, "mensaje": "No se pudo leer el instalador."}, 500)

    # --- Servidor de archivos estáticos (la app web) --------------------
    def _serve_static(self):
        # Ruta del navegador → archivo dentro de WEB_DIR. "/" → index.html.
        rel = self.path.split("?", 1)[0].split("#", 1)[0].lstrip("/")
        if rel == "":
            rel = "index.html"
        # Normaliza y evita salir de WEB_DIR (path traversal).
        base = os.path.normpath(WEB_DIR)
        full = os.path.normpath(os.path.join(base, rel))
        if full != base and not full.startswith(base + os.sep):
            return self._send({"ok": False, "mensaje": "Ruta no encontrada"}, 404)
        if not os.path.isfile(full):
            return self._send({"ok": False, "mensaje": "Ruta no encontrada"}, 404)
        try:
            with open(full, "rb") as f:
                data = f.read()
        except OSError:
            return self._send({"ok": False, "mensaje": "No se pudo leer el archivo"}, 500)
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._send({"ok": False, "mensaje": "JSON inválido"}, 400)

        with ETABS_LOCK:
            if self.path == "/cargar_espectro":
                self._send(cargar_espectro(payload.get("nombre"), payload.get("puntos", [])))
            elif self.path == "/generar_masas":
                self._send(generar_masas(
                    payload.get("uso"), payload.get("nombre_espectro"),
                    payload.get("modos_max", 9), payload.get("modos_min", 3),
                    payload.get("regular", True),
                    payload.get("rx", 1.0), payload.get("ry", 1.0)))
            elif self.path == "/sistema_estructural":
                self._send(sistema_estructural(payload.get("piso"), payload.get("pendulo", False)))
            elif self.path == "/derivas":
                self._send(derivas())
            elif self.path == "/junta":
                self._send(junta())
            elif self.path == "/memoria":
                self._send(memoria(payload.get("uso")))
            elif self.path == "/masa":
                self._send(masa_participativa(payload.get("caso")))
            elif self.path == "/escalamiento":
                self._send(escalamiento(payload))
            elif self.path == "/desbloquear":
                self._send(desbloquear())
            elif self.path == "/irregularidad_rigidez":
                self._send(irregularidad_rigidez())
            elif self.path == "/irregularidad_masa":
                self._send(irregularidad_masa())
            elif self.path == "/irregularidad_torsion":
                self._send(irregularidad_torsion(payload.get("limite", 0.007)))
            elif self.path == "/modos":
                self._send(set_modos(payload.get("modos_max"), payload.get("modos_min"),
                                     payload.get("correr", True)))
            else:
                self._send({"ok": False, "mensaje": "Ruta no encontrada"}, 404)

    def log_message(self, *args):
        pass  # silencia el log por petición


# URL que abre el botón "Abrir en el navegador". El bridge solo expone la API
# de ETABS en HOST:PORT — la UI del calculador vive en hingenia.com. El usuario
# debe estar logueado y con plan activo (gate de membresía en el plugin
# hingenia-apps). Para testear contra staging, cambiar a pruebas.hingenia.com.
# Override por variable de entorno HINGENIA_WEB_URL si hace falta.
URL = os.environ.get(
    "HINGENIA_WEB_URL",
    "https://hingenia.com/apps/calculador-estructural/",
)


def _log(msg):
    """print seguro: en modo --windowed (sin consola) stdout puede ser None."""
    try:
        print(msg)
    except Exception:
        pass


def _abrir_navegador():
    try:
        import webbrowser
        webbrowser.open(URL)
    except Exception:
        pass


def _etabs_conectado():
    """True si se puede enganchar ETABS ahora mismo (para el indicador)."""
    SapModel, err = get_sapmodel()
    return err is None


# ----------------------------------------------------------------------------
# Interfaz gráfica moderna (Tkinter) — reemplaza la ventana negra de consola.
# ----------------------------------------------------------------------------
def _grad_color(t, c1=(245, 98, 30), c2=(251, 93, 62), c3=(236, 72, 153)):
    def lerp(a, b, k):
        return tuple(int(round(a[i] + (b[i] - a[i]) * k)) for i in range(3))
    rgb = lerp(c1, c2, t / 0.55) if t <= 0.55 else lerp(c2, c3, (t - 0.55) / 0.45)
    return "#%02x%02x%02x" % rgb


def _run_gui(srv):
    import math
    import threading
    import tkinter as tk

    # (El servidor ya corre en un hilo iniciado por main()).

    W = 460
    BRAND, INK, MUTED, BG = "#f5621e", "#0f172a", "#64748b", "#ffffff"
    GREEN, RED = "#16a34a", "#ef4444"

    # Identidad propia en Windows: hace que la barra de tareas use el ícono de
    # ESPECTRA (y no agrupe la app bajo "python"/"tk").
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("ESPECTRA.E030")
    except Exception:
        pass

    root = tk.Tk()
    root.title("ESPECTRA")
    root.configure(bg=BG)
    root.resizable(False, False)

    # Ícono de ESPECTRA por dos vías (barra de título + barra de tareas), para
    # que NUNCA se vea el ícono por defecto de Tkinter.
    _ico = os.path.join(_base_dir(), "assets", "espectra.ico")
    _png = os.path.join(_base_dir(), "assets", "espectra.png")
    try:
        root.iconbitmap(default=_ico)
    except Exception:
        pass
    try:
        root._iconimg = tk.PhotoImage(file=_png)  # se guarda la referencia
        root.iconphoto(True, root._iconimg)
    except Exception:
        pass

    tray = {"icon": None}  # ícono de la bandeja del sistema (se crea más abajo)

    # ---- Cabecera compacta, con el estilo de la presentacion ----
    HH, LIGHT = 108, "#f8f7f5"
    head = tk.Canvas(root, width=W, height=HH, highlightthickness=0, bd=0, bg=LIGHT)
    head.pack(fill="x")

    # Filo de color arriba, como en la presentacion.
    for x in range(W):
        head.create_line(x, 0, x, 4, fill=_grad_color(x / max(1, W - 1)))

    # Icono: cuadrado de esquinas redondeadas con degradado en diagonal.
    ix, iy, isz, rad = 22, 20, 58, 15
    for dy in range(isz):
        # Cerca de las esquinas la fila se acorta, y asi salen redondeadas.
        rec = 0
        if dy < rad:
            rec = rad - int((rad * rad - (rad - dy) ** 2) ** 0.5)
        elif dy > isz - rad:
            rec = rad - int((rad * rad - (rad - (isz - dy)) ** 2) ** 0.5)
        head.create_line(ix + rec, iy + dy, ix + isz - rec, iy + dy,
                         fill=_grad_color(min(1.0, dy / float(isz))))

    # Onda blanca del logo.
    cx, cy, amp, wide = ix + isz / 2, iy + isz / 2, 7, 30
    pts = []
    for i in range(61):
        t = i / 60
        pts += [cx - wide / 2 + wide * t, cy - amp * math.sin(t * 2 * math.pi * 2)]
    head.create_line(*pts, fill="white", width=5, capstyle="round",
                     joinstyle="round", smooth=True)

    tx = ix + isz + 16
    head.create_text(tx, 38, text="ESPECTRA", anchor="w", fill=INK,
                     font=("Segoe UI", 18, "bold"))
    head.create_text(tx + 1, 60, text="Análisis Sísmico E.030 (2026)", anchor="w",
                     fill=MUTED, font=("Segoe UI", 8))
    head.create_text(W - 20, 24, text="v" + APP_VERSION, anchor="e",
                     fill=MUTED, font=("Segoe UI", 9, "bold"))
    head.create_text(W / 2, 92, text="Con HINGENIA · Ing. Abel Max Julcarima Espíritu",
                     fill=MUTED, font=("Segoe UI", 8))

    body = tk.Frame(root, bg=BG)
    body.pack(fill="both", expand=True, padx=24, pady=(10, 12))

    def fila(parent, titulo):
        f = tk.Frame(parent, bg=BG)
        f.pack(fill="x", pady=3)
        dot = tk.Label(f, text="●", fg=MUTED, bg=BG, font=("Segoe UI", 13))
        dot.pack(side="left")
        tk.Label(f, text=titulo, fg=INK, bg=BG, width=9, anchor="w",
                 font=("Segoe UI", 10, "bold")).pack(side="left", padx=(8, 0))
        val = tk.Label(f, text="…", fg=MUTED, bg=BG, anchor="w",
                       font=("Segoe UI", 10))
        val.pack(side="left")
        return dot, val, f

    dot_srv, val_srv, _ = fila(body, "Servidor")
    dot_etabs, val_etabs, _ = fila(body, "ETABS")
    # Linea suave que separa el estado de las acciones.
    tk.Frame(body, bg="#e9e5e0", height=1).pack(fill="x", pady=(10, 0))

    dot_srv.config(fg=GREEN)
    val_srv.config(text=f"Activo · 127.0.0.1:{PORT}", fg=INK)

    # ---- Botones ----
    btns = tk.Frame(body, bg=BG)
    btns.pack(fill="x", pady=(10, 0))

    def mk_btn(parent, text, cmd, primary=True):
        b = tk.Button(parent, text=text, command=cmd, cursor="hand2",
                      relief="flat", bd=0, padx=14, pady=7,
                      font=("Segoe UI", 10, "bold"),
                      fg="white" if primary else MUTED,
                      bg=BRAND if primary else "#eef1f5",
                      activebackground="#d94e12" if primary else "#e2e8f0",
                      activeforeground="white" if primary else INK)
        return b

    mk_btn(btns, "Abrir web", _abrir_navegador, True).pack(
        side="left", fill="x", expand=True)

    btn_buscar = mk_btn(btns, "Actualizar", lambda: None, False)
    btn_buscar.pack(side="left", fill="x", expand=True, padx=(10, 0))

    def detener():
        try:
            if tray["icon"] is not None:
                tray["icon"].stop()
        except Exception:
            pass
        try:
            threading.Thread(target=srv.shutdown, daemon=True).start()
        except Exception:
            pass
        root.destroy()

    mk_btn(btns, "Salir", detener, False).pack(
        side="left", fill="x", expand=True, padx=(10, 0))

    # ---- Actualizaciones ------------------------------------------------
    # La comprobacion va en un hilo aparte: si no hay internet, la ventana no
    # se queda colgada esperando a GitHub.
    nueva = {"url": "", "version": ""}

    def estado(txt, color=None):
        nota.config(text=txt, fg=color or MUTED)

    def _instalar_actualizacion():
        btn_buscar.config(state="disabled", text="Descargando…")

        def _worker():
            ok, res = descargar_e_instalar(
                nueva["url"],
                progreso=lambda t: root.after(0, lambda: estado(t, INK)))
            if ok:
                # El instalador cierra ESPECTRA el solo cuando le toque
                # reemplazar el ejecutable; cerrarla antes rompia su
                # comprobacion de proceso padre.
                root.after(0, lambda: (
                    estado("Instalador abierto: sigue sus pasos.", INK),
                    btn_buscar.config(state="normal", text="Actualizar")))
            else:
                root.after(0, lambda: (estado(res, RED),
                                       btn_buscar.config(state="normal", text="Actualizar")))

        threading.Thread(target=_worker, daemon=True).start()

    # Un solo boton para las dos cosas: si ya se sabe que hay version nueva se
    # instala, y si no, primero se comprueba.
    def _actualizar():
        if nueva.get("url"):
            _instalar_actualizacion()
        else:
            _revisar_version(True)

    def _revisar_version(manual=False):
        if manual:
            btn_buscar.config(state="disabled", text="Buscando…")
            estado("Comprobando si hay una versión nueva…")

        def _worker():
            info = buscar_actualizacion()

            def _pintar():
                if manual:
                    btn_buscar.config(state="normal", text="Actualizar")
                if info.get("hay"):
                    nueva["url"] = info["url"]
                    nueva["version"] = info["version"]
                    estado("Hay la versión %s disponible." % info["version"], INK)
                    btn_buscar.config(text="Actualizar a " + info["version"],
                                      fg="white", bg=BRAND,
                                      activebackground="#d94e12",
                                      activeforeground="white")
                elif info.get("error"):
                    if manual:
                        estado("Sin conexión para comprobar actualizaciones.")
                elif manual:
                    estado("ESPECTRA está al día.", GREEN)

            root.after(0, _pintar)

        threading.Thread(target=_worker, daemon=True).start()
        # Una vez al dia basta: esto no es algo que haya que sondear. El boton
        # esta para cuando el usuario no quiera esperar a la siguiente.
        if not manual:
            root.after(24 * 60 * 60 * 1000, _revisar_version)

    btn_buscar.config(command=_actualizar)
    root.after(1500, _revisar_version)

    nota = tk.Label(body, text="Deja esta ventana abierta mientras trabajas con ETABS.",
                    fg=MUTED, bg=BG, font=("Segoe UI", 8))
    nota.pack(anchor="w", pady=(9, 0))

    # ---- Sondeo del estado de ETABS ----
    def refrescar():
        ok = _etabs_conectado() if COMTYPES_OK else False
        if not COMTYPES_OK:
            dot_etabs.config(fg=RED); val_etabs.config(text="comtypes no disponible", fg=MUTED)
        elif ok:
            dot_etabs.config(fg=GREEN); val_etabs.config(text="Conectado", fg=INK)
        else:
            dot_etabs.config(fg=RED); val_etabs.config(text="Sin conexión (abre ETABS)", fg=MUTED)
        root.after(3000, refrescar)

    root.after(300, refrescar)

    # ---- Bandeja del sistema (solo aparece cuando la ventana está minimizada) ----
    def _set_tray_visible(v):
        try:
            if tray["icon"] is not None:
                tray["icon"].visible = v
        except Exception:
            pass

    def _restaurar_ventana():
        # Vuelve la ventana a la barra de tareas y QUITA el ícono de la bandeja.
        _set_tray_visible(False)
        root.deiconify()
        try:
            root.state("normal")
        except Exception:
            pass
        root.lift()
        root.focus_force()

    def _on_unmap(_e=None):
        # Al minimizar: esconder de la barra de tareas y MOSTRAR solo en la bandeja.
        if tray["icon"] is not None and root.state() == "iconic":
            _set_tray_visible(True)
            root.withdraw()

    def _crear_tray():
        try:
            import pystray
            from PIL import Image
            img = Image.open(os.path.join(_base_dir(), "assets", "espectra.png"))
        except Exception:
            return None
        menu = pystray.Menu(
            pystray.MenuItem("Abrir ESPECTRA", lambda i, it: root.after(0, _restaurar_ventana),
                             default=True),
            pystray.MenuItem("Abrir en el navegador", lambda i, it: _abrir_navegador()),
            pystray.MenuItem("Detener", lambda i, it: root.after(0, detener)),
        )
        return pystray.Icon("espectra", img, "ESPECTRA %s · E.030" % APP_VERSION, menu)

    tray["icon"] = _crear_tray()
    if tray["icon"] is not None:
        # Arranca OCULTO: solo se mostrará en la bandeja al minimizar.
        threading.Thread(
            target=lambda: tray["icon"].run(setup=lambda ic: setattr(ic, "visible", False)),
            daemon=True).start()
        root.bind("<Unmap>", _on_unmap)

    root.protocol("WM_DELETE_WINDOW", detener)
    # Centra la ventana.
    root.update_idletasks()
    w, h = root.winfo_width(), root.winfo_height()
    x = (root.winfo_screenwidth() - w) // 2
    y = (root.winfo_screenheight() - h) // 3
    root.geometry(f"+{x}+{y}")
    root.mainloop()


def _serve_console(srv):
    """Respaldo sin GUI: el servidor ya corre en su hilo; aquí solo se espera."""
    import time
    _log("=" * 60)
    _log(" ESPECTRA · Análisis Sísmico E.030 (2026)")
    _log(f" Servidor en {URL}   ·   Ctrl+C para detener")
    _log("=" * 60)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        _log("\n Servidor detenido.")
    finally:
        try:
            srv.shutdown()
        except Exception:
            pass


def main():
    try:
        srv = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        # Puerto ocupado: probablemente ya hay otra ventana de ESPECTRA.
        try:
            import tkinter.messagebox as mb
            import tkinter as tk
            r = tk.Tk(); r.withdraw()
            mb.showwarning("ESPECTRA",
                           f"El puerto {PORT} ya está en uso.\n\n"
                           "¿Ya hay otra ventana de ESPECTRA abierta?\n"
                           "Ciérrala e intenta de nuevo.")
            r.destroy()
        except Exception:
            _log(f" [ERROR] El puerto {PORT} ya está en uso. Cierra la otra ventana.")
        return

    # El servidor corre en un hilo (una sola vez); el navegador se abre una vez.
    import threading
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    threading.Timer(0.6, _abrir_navegador).start()

    # Por defecto: ventana moderna. Con ESPECTRA_CONSOLE=1 fuerza consola.
    if os.environ.get("ESPECTRA_CONSOLE") == "1":
        _serve_console(srv)
        return
    try:
        _run_gui(srv)
    except Exception as e:
        # Si Tkinter falla por algún motivo, no dejes al usuario sin app.
        _log(f" [AVISO] No se pudo abrir la ventana ({e}); uso modo consola.")
        _serve_console(srv)


if __name__ == "__main__":
    main()
