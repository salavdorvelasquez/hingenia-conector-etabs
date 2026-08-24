; ============================================================================
;  ESPECTRA - Instalador (Inno Setup)
;  Asistente gráfico con pantalla de presentación de marca.
;  Muestra primero un diseño bonito con logos ESPECTRA + Hingenia
;  y crédito al Ingeniero Abel Max Julcarima Espíritu.
;
;  Compilar con: installer\build_installer.bat
;  El CI (release.yml) genera los assets automáticamente.
; ============================================================================

#define MyAppName "ESPECTRA"
#define MyAppVersion "1.0.31"
#define MyAppPublisher "Ing. Abel Max Julcarima Espíritu"
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

; ================== BRANDING DEL INSTALADOR ==================
; Icono principal de la ventana y desinstalador
SetupIconFile=..\assets\espectra.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

; Imagen lateral izquierda del wizard (todo el asistente se ve con marca)
; Usamos .bmp (no PNG) para máxima compatibilidad y evitar "bitmap image is not valid"
WizardImageFile=..\assets\espectra-wizard-banner.bmp
; Imagen pequeña superior derecha del wizard
WizardSmallImageFile=..\assets\espectra-wizard-small.bmp

WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible

; Instala para toda la máquina (Archivos de programa) -> pide elevación una vez
PrivilegesRequired=admin
; Cierra la app si está corriendo durante una actualización. "force" termina
; los procesos que no responden en vez de preguntar al usuario: ESPECTRA vive
; en la bandeja y su ventana no siempre atiende el WM_CLOSE que manda Inno.
CloseApplications=force
RestartApplications=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; Imagen de presentación de marca (solo se extrae temporalmente para la primera pantalla)
; Usamos .bmp para máxima compatibilidad al cargar con TBitmapImage
Source: "..\assets\espectra-presentation.bmp"; DestDir: "{tmp}"; Flags: dontcopy

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName} ahora"; Flags: nowait postinstall skipifsilent

; ============================================================================
; PANTALLA DE PRESENTACIÓN CON BRANDING (ESPECTRA + Hingenia + crédito)
; Aparece como primera pantalla al abrir el instalador.
; El diseño está mayormente en la imagen generada (hermosa y controlada).
; ============================================================================
[Code]
var
  PresentationPage: TWizardPage;

procedure CreatePresentationPage;
var
  Image: TBitmapImage;
  NoteLabel: TLabel;
  SurfaceWidth, SurfaceHeight: Integer;
begin
  PresentationPage := CreateCustomPage(
    wpWelcome,
    'ESPECTRA',
    'Conector para ETABS • Análisis Sísmico E.030 (2026)'
  );

  // Extraer la imagen de presentación (generada con make_installer_graphics.py)
  // Usamos .bmp para evitar errores "bitmap image is not valid"
  ExtractTemporaryFile('espectra-presentation.bmp');

  // Imagen principal centrada (el diseño completo con logos y crédito)
  Image := TBitmapImage.Create(PresentationPage);
  Image.Parent := PresentationPage.Surface;
  Image.Bitmap.LoadFromFile(ExpandConstant('{tmp}\espectra-presentation.bmp'));

  // Centrar horizontalmente
  SurfaceWidth := PresentationPage.Surface.Width;
  Image.Width := Image.Bitmap.Width;
  Image.Height := Image.Bitmap.Height;
  Image.Left := (SurfaceWidth - Image.Width) div 2;
  Image.Top := 20;
  Image.Stretch := False;

  // Nota inferior sutil (debajo de la imagen con el crédito ya incluido)
  NoteLabel := TLabel.Create(PresentationPage);
  NoteLabel.Parent := PresentationPage.Surface;
  NoteLabel.Caption := 'Haz clic en Siguiente para continuar con la instalación.';
  NoteLabel.Font.Size := 9;
  NoteLabel.Font.Color := $666666;  // gris suave
  NoteLabel.Top := Image.Top + Image.Height + 18;
  NoteLabel.Left := (SurfaceWidth - NoteLabel.Width) div 2;
end;

procedure InitializeWizard();
begin
  CreatePresentationPage;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // Saltamos la página de bienvenida por defecto de Inno Setup.
  // La primera pantalla que ve el usuario es nuestra presentación con branding.
  Result := (PageID = wpWelcome);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Codigo: Integer;
begin
  // Antes de copiar nada, se cierra cualquier ESPECTRA que siga vivo. Puede
  // haber varios a la vez -uno por cada arranque- y basta que quede uno para
  // que el archivo esté en uso y el instalador acabe preguntando qué hacer.
  // El usuario no tiene por qué saber de esto, así que se resuelve solo.
  //
  // Sin /T a proposito: cuando la actualizacion se lanza desde el boton de
  // ESPECTRA, este instalador es proceso HIJO suyo, y /T mata el arbol
  // entero, con lo que se cerraba a si mismo antes de copiar nada.
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM ESPECTRA.exe',
       '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  Sleep(900);
  Result := '';
end;
