; ============================================================================
;  ESPECTRA - Instalador (Inno Setup)
;  Asistente grafico que instala el puente ETABS UNA SOLA VEZ en
;  "Archivos de programa", con accesos directos, logo y desinstalador.
;  Compilar con:  installer\build_installer.bat
; ============================================================================

#define MyAppName "ESPECTRA"
#define MyAppVersion "1.0.1"
#define MyAppPublisher "ESPECTRA"
#define MyAppExeName "ESPECTRA.exe"

[Setup]
; AppId fijo (GUID) => permite detectar instalaciones previas y actualizar
; sobre la misma, en vez de instalar dos veces.
AppId={{8F3C2A91-7E4D-4B6A-9C12-A1B2C3D4E5F6}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppVerName={#MyAppName} {#MyAppVersion}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
; Carpeta y nombre del instalador resultante
OutputDir=..\dist
OutputBaseFilename=ESPECTRA-Setup
; Logo / iconos
SetupIconFile=..\assets\espectra.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
; Instala para toda la maquina (Archivos de programa) -> pide elevacion una vez
PrivilegesRequired=admin
; Cierra la app si esta corriendo durante una actualizacion
CloseApplications=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName} ahora"; Flags: nowait postinstall skipifsilent
