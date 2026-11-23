; Inno Setup script for Next DSKY on Windows. Built by windows/package.mjs,
; which passes AppVersion, StageDir, OutputDir and OutputName.
;
; Installs per user (no admin prompt) into %LOCALAPPDATA%\Programs\Next DSKY.
; Settings live in %APPDATA%\Next DSKY, so upgrades and uninstalls keep them.

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
#define AppExe "next-dsky.exe"
; Quotes doubled: it is expanded inside quoted section parameters.
#define ServerArgs '""{app}\server.cjs"" --data-dir ""{userappdata}\Next DSKY""'

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
UninstallDisplayIcon={app}\dsky.ico
UninstallDisplayName={#AppName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[CustomMessages]
en.AutoStart=Start {#AppName} when I sign in to Windows
es.AutoStart=Iniciar {#AppName} al entrar en Windows
en.LaunchNow=Open {#AppName} now
es.LaunchNow=Abrir {#AppName} ahora

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "{cm:AutoStart}"; Flags: unchecked

[InstallDelete]
; Drop the previous version's frontend and modules so stale files don't linger.
Type: filesandordirs; Name: "{app}\out"
Type: filesandordirs; Name: "{app}\node_modules"

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; The console window shows the server log; closing it stops the DSKY.
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; Parameters: "{#ServerArgs} --open"; WorkingDir: "{app}"; IconFilename: "{app}\dsky.ico"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Parameters: "{#ServerArgs} --open"; WorkingDir: "{app}"; IconFilename: "{app}\dsky.ico"; Tasks: desktopicon
Name: "{userstartup}\{#AppName}"; Filename: "{app}\{#AppExe}"; Parameters: "{#ServerArgs}"; WorkingDir: "{app}"; IconFilename: "{app}\dsky.ico"; Flags: runminimized; Tasks: autostart

[Run]
Filename: "{app}\{#AppExe}"; Parameters: "{#ServerArgs} --open"; WorkingDir: "{app}"; Description: "{cm:LaunchNow}"; Flags: postinstall nowait skipifsilent

[UninstallRun]
; Stop a running server before its files are removed. Matched by full path,
; so other node or DSKY processes are left alone.
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -Command ""Get-Process -Name next-dsky -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -eq '{app}\{#AppExe}' } | Stop-Process -Force"""; Flags: runhidden; RunOnceId: "StopServer"
