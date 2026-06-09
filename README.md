# Análisis Sísmico E.030 (2026) — App Web

Aplicación web para generar el **espectro de respuesta** según la Norma Peruana
**E.030 (versión 2026)**.

Calcula los parámetros sísmicos (Z, U, S, Tp, Tl), grafica el espectro elástico
`Sa = Z·U·C·S`, y permite **exportar** o **cargar directamente a ETABS**.

## Estructura

```
.
├── web/                 App web (frontend puro, sin servidor)
│   ├── index.html
│   ├── styles.css
│   ├── app.js           Cálculo del espectro (corre 100% en el navegador)
│   └── data/
│       ├── zonas_peru.js    Zonificación sísmica por distrito
│       └── mapa_svg.js      Mapa SVG del Perú
└── api/
    └── etabs_api.py     API local opcional: conecta la web con ETABS (COM, Windows)
```

## Uso básico (solo cálculo + export)

1. Abre **`web/index.html`** en cualquier navegador (doble clic).
2. Elige Zona, Categoría de uso y Perfil de suelo. Para S2/S3 puedes activar
   *Vs30* e interpolar S, Tp y Tl.
3. El gráfico y los parámetros se actualizan en vivo.
4. Botones **Exportar CSV / JSON** para importar a ETABS u otra herramienta.

> Nota: el gráfico usa Chart.js desde CDN, por lo que la primera carga requiere
> conexión a internet. El cálculo en sí es 100% local.

## Distribución al usuario final: instalador con asistente (recomendado)

El usuario **no instala Python ni comtypes**: se empaqueta todo —puente + web— en
un ejecutable (PyInstaller) y luego en un **instalador con asistente** (Inno Setup)
que se instala **una sola vez** en *Archivos de programa*, con logo, accesos
directos y desinstalador.

**Para generar el instalador (tú, una vez):**
```powershell
.\installer\build_installer.bat
```
Hace 3 pasos: (1) genera el icono `assets\espectra.ico`, (2) compila
`dist\ESPECTRA.exe` (~26 MB, autocontenido), (3) compila
`dist\ESPECTRA-Setup.exe` (~28 MB, el instalador).
Requiere `C:\Python` con `comtypes` + `pyinstaller`, e **Inno Setup 6**
(`winget install JRSoftware.InnoSetup`).

> Solo el puente (sin instalador): `.\build_exe.bat` → `dist\ESPECTRA.exe`.

**Para el usuario final:**
1. Descarga **`ESPECTRA-Setup.exe`** (desde el botón ⬇ de la app o un enlace).
2. Doble clic → asistente → *Instalar* (una sola vez). Crea accesos directos.
3. Abre **ETABS** y su modelo.
4. Abre **ESPECTRA** desde el menú inicio / escritorio.
5. Se abre solo el navegador en `http://127.0.0.1:8731`. Listo.

El icono (logo `〰 ESPECTRA`, gradiente naranja→rosa) va incrustado en el `.exe`,
en el instalador y en los accesos directos. Al abrir, ESPECTRA muestra una
**ventana moderna** (sin consola negra) con el estado en vivo de *Servidor* y
*ETABS* (verde/rojo) y botones *Abrir en el navegador* / *Detener*. Al
**minimizar**, se va a la **bandeja del sistema** (junto al reloj); clic en el
ícono o su menú la restaura. No necesita internet salvo para los CDN de los
gráficos.

## Integración con ETABS desde el código (desarrollo, solo Windows)

El navegador no puede hablar COM con ETABS, por lo que se incluye una API local.

1. Instala la dependencia (una sola vez):
   ```powershell
   pip install comtypes
   ```
2. Abre **ETABS** y tu modelo (desbloqueado).
3. Ejecuta la API (también sirve la web en `http://127.0.0.1:8731`):
   ```powershell
   python api/etabs_api.py
   ```
4. Se abre el navegador automáticamente. El indicador superior derecho pasará a
   **verde** ("ETABS conectado"). También puedes abrir `web/index.html` directo.
5. Ahora funcionan:
   - **Cargar a ETABS** → crea/actualiza la función de espectro *User Defined*.
   - **E.030 · Masas + Casos** → genera fuentes de masa, casos modales y
     estáticos no lineales, casos de espectro de respuesta y combinaciones
     direccionales (coeficiente 0.75 regular / 0.85 irregular).

La API escucha en `http://127.0.0.1:8731` y solo acepta conexiones locales.

## Parámetros implementados (E.030 2026)

- **Zonas:** Z4=0.45, Z3=0.35, Z2=0.25, Z1=0.10
- **Uso:** A2=1.50, B=1.30, C=1.00, Art. 19.3=0.80
- **Suelos fijos:** S0, S1, S4 (S4 en Z4 = *Requiere análisis específico*)
- **Suelos variables:** S2, S3 con interpolación por Vs30
- **Factor C:** rama lineal (T<0.2Tp), plateau 2.5 (0.2Tp≤T≤Tp),
  1/T (Tp<T<Tl), 1/T² (T≥Tl)
