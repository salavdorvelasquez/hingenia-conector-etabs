@echo off
REM ==============================================================
REM  Compila ESPECTRA en un unico .exe (puente ETABS + web).
REM  Requiere:  C:\Python  con  comtypes  y  pyinstaller.
REM
REM  Resultado:  dist\ESPECTRA.exe   (autocontenido, sin instalar Python)
REM ==============================================================
setlocal
cd /d "%~dp0"

echo === Limpiando compilaciones anteriores ===
if exist build  rmdir /s /q build
if exist dist   rmdir /s /q dist
if exist ESPECTRA.spec del /q ESPECTRA.spec

echo === Compilando con PyInstaller (esto tarda 1-3 min) ===
"C:\Python\python.exe" -m PyInstaller ^
  --noconfirm ^
  --onefile ^
  --windowed ^
  --name ESPECTRA ^
  --icon "assets\espectra.ico" ^
  --add-data "web;web" ^
  --add-data "assets;assets" ^
  --hidden-import comtypes ^
  --collect-submodules comtypes ^
  --collect-submodules pystray ^
  --hidden-import PIL.Image ^
  "api\etabs_api.py"

if errorlevel 1 (
  echo.
  echo *** ERROR al compilar. Revisa el mensaje de arriba. ***
  pause
  exit /b 1
)

echo.
echo ==============================================================
echo  LISTO.  El ejecutable esta en:   dist\ESPECTRA.exe
echo  El usuario solo abre ETABS y da doble clic a ese .exe.
echo ==============================================================
pause
