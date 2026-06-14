!include LogicLib.nsh
!include nsDialogs.nsh

!ifndef BUILD_UNINSTALLER

Var NexusInfluxDataDir
Var NexusInfluxDataDirText

!macro customPageAfterChangeDir
  Page custom NexusInfluxDataDirPage NexusInfluxDataDirPageLeave
!macroend

Function NexusInfluxDataDirPage
  ${If} $NexusInfluxDataDir == ""
    StrCpy $NexusInfluxDataDir "$LOCALAPPDATA\Weber Nexus\influxdb"
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0

  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0u 0u 100% 22u "Escolha onde o Nexus vai armazenar os dados locais."
  Pop $1

  ${NSD_CreateText} 0u 34u 77% 12u "$NexusInfluxDataDir"
  Pop $NexusInfluxDataDirText

  ${NSD_CreateBrowseButton} 80% 33u 20% 14u "Browse..."
  Pop $2
  ${NSD_OnClick} $2 NexusInfluxDataDirBrowse

  ${NSD_CreateLabel} 0u 58u 100% 32u "Esta pasta vai guardar os dados para analise e machine learning. Escolha um armazenamento local (HD/SSD) com espaço livre suficiente."
  Pop $3

  nsDialogs::Show
FunctionEnd

Function NexusInfluxDataDirBrowse
  ${NSD_GetText} $NexusInfluxDataDirText $NexusInfluxDataDir

  nsDialogs::SelectFolderDialog "Selecione a pasta de armazenamento de dados" "$NexusInfluxDataDir"
  Pop $0

  ${If} $0 != error
    StrCpy $NexusInfluxDataDir $0
    ${NSD_SetText} $NexusInfluxDataDirText "$NexusInfluxDataDir"
  ${EndIf}
FunctionEnd

Function NexusInfluxDataDirPageLeave
  ${NSD_GetText} $NexusInfluxDataDirText $NexusInfluxDataDir

  ${If} $NexusInfluxDataDir == ""
    MessageBox MB_ICONEXCLAMATION "Escolha uma pasta para armazenamento de dados."
    Abort
  ${EndIf}
FunctionEnd

!macro customInstall
  ${If} $NexusInfluxDataDir == ""
    StrCpy $NexusInfluxDataDir "$LOCALAPPDATA\Weber Nexus\influxdb"
  ${EndIf}

  CreateDirectory "$NexusInfluxDataDir"
  CreateDirectory "$APPDATA\Weber Nexus"

  ClearErrors
  WriteINIStr "$APPDATA\Weber Nexus\runtime-config.ini" "influxdb" "dataDir" "$NexusInfluxDataDir"
  ${If} ${Errors}
    MessageBox MB_ICONSTOP "Nexus não pôde salvar a pasta de configuração."
    Abort
  ${EndIf}
!macroend

!else

!macro customUnInstall
  DetailPrint "Parando runtime do Nexus..."
  nsExec::ExecToStack 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Method POST -Uri ''http://127.0.0.1:3000/runtime/stop'' -TimeoutSec 3 | Out-Null } catch { }"'
  Pop $0
  Pop $1
  Sleep 1500
!macroend

!endif
