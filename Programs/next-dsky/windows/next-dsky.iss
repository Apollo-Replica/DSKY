; Inno Setup script for the Next DSKY desktop app. Built by windows/package.mjs,
; which passes AppVersion, StageDir, OutputDir and OutputName.
;
; Installs per user (no admin prompt) into %LOCALAPPDATA%\Programs\Next DSKY.
; Settings and logs live in %APPDATA%\Next DSKY, so upgrades and uninstalls
; keep them.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef StageDir
  #define StageDir "..\dist\windows\app"
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif
#ifndef OutputName
  #define OutputName "next-dsky-windows-x64-setup"
#endif

#define AppName "Next DSKY"
#define AppExe "Next DSKY.exe"

[Setup]
AppId={{7C1B0F5E-4E7A-4C59-9A3B-2D5F1E0A6C11}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Apollo Replica
AppPublisherURL=https://github.com/Apollo-Replica/DSKY
AppSupportURL=https://discord.gg/CHZaYj5UNu
AppUpdatesURL=https://github.com/Apollo-Replica/DSKY/releases
DefaultDirName={localappdata}\Programs\{#AppName}
DisableDirPage=auto
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#OutputDir}
OutputBaseFilename={#OutputName}
SetupIconFile=dsky.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; A running copy is closed in PrepareToInstall (Restart Manager can't close Electron).
CloseApplications=no

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[CustomMessages]
en.AutoStart=Start {#AppName} when I sign in to Windows
es.AutoStart=Iniciar {#AppName} al entrar en Windows

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "{cm:AutoStart}"; Flags: unchecked

[InstallDelete]
; Drop the previous version's app and Electron files so stale ones don't linger.
Type: filesandordirs; Name: "{app}\resources"
Type: filesandordirs; Name: "{app}\locales"

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{userstartup}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; Tasks: autostart

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; Close the app before its files are removed. Matched by full path, so
; nothing else is touched.
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -Command ""Get-Process -Name 'Next DSKY' -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -eq '{app}\{#AppExe}' } | Stop-Process -Force"""; Flags: runhidden; RunOnceId: "StopApp"

[Code]
// Closes a running copy of this install (matched by full path) so its files
// can be replaced. Settings are already on disk, nothing is lost.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -Command "Get-Process -Name ''Next DSKY'' -ErrorAction SilentlyContinue | ' +
    'Where-Object { $_.Path -eq ''' + ExpandConstant('{app}\{#AppExe}') + ''' } | Stop-Process -Force; ' +
    'Start-Sleep -Milliseconds 500"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := '';
end;
