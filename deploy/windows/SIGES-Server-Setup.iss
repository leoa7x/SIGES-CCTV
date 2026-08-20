; Compile on Windows with Inno Setup after Build-OfflineBundle.ps1.
[Setup]
AppName=SIGES-CCTV Server
AppVersion=1.0
DefaultDirName={autopf}\SIGES-CCTV-Installer
DisableProgramGroupPage=yes
OutputBaseFilename=SIGES-Server-Setup
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=admin
[Files]
Source: "out\payload\*"; DestDir: "{app}\payload"; Flags: recursesubdirs ignoreversion
Source: "out\Install-SIGES.ps1"; DestDir: "{app}"; Flags: ignoreversion
[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\Install-SIGES.ps1"""; Flags: runascurrentuser waituntilterminated
