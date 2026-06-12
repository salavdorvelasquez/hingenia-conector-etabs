@echo off
REM ==============================================================
REM  Genera el INSTALADOR completo de ESPECTRA:
REM    1) icono (assets\espectra.ico)
REM    2) puente autocontenido (dist\ESPECTRA.exe)  via build_exe.bat
REM    3) instalador con asistente (dist\ESPECTRA-Setup.exe) via Inno Setup
REM ==============================================================
setlocal
cd /d "%~dp0.."

set "PY=C:\Python\python.exe"
set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"

echo === [1/3] Generando icono ===
"%PY%" "installer\make_icon.py" || (echo ERROR icono & pause & exit /b 1)

echo === [1b] Generando gráficos de presentación del instalador (ESPECTRA + Hingenia + crédito) ===
"%PY%" "installer\make_installer_graphics.py" || (echo ERROR gráficos instalador & pause & exit /b 1)

echo === [2/3] Compilando el puente (ESPECTRA.exe) ===
call "build_exe.bat" < nul
if not exist "dist\ESPECTRA.exe" (echo ERROR: no se genero dist\ESPECTRA.exe & pause & exit /b 1)

echo === [3/3] Compilando el instalador con Inno Setup ===
if not exist "%ISCC%" (
  echo ERROR: no se encontro Inno Setup en "%ISCC%".
  echo Instalalo con:  winget install JRSoftware.InnoSetup
  pause & exit /b 1
)
"%ISCC%" "installer\espectra.iss" || (echo ERROR Inno Setup & pause & exit /b 1)

echo.
echo ==============================================================
echo  LISTO.  Instalador en:   dist\ESPECTRA-Setup.exe
echo  Eso es lo unico que distribuyes al usuario final.
echo ==============================================================
pause
