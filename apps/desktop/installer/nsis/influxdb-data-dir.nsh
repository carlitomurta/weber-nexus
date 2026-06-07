!include LogicLib.nsh
!include nsDialogs.nsh

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

  ${NSD_CreateLabel} 0u 0u 100% 22u "Choose where Nexus will store local InfluxDB time-series data."
  Pop $1

  ${NSD_CreateText} 0u 34u 77% 12u "$NexusInfluxDataDir"
  Pop $NexusInfluxDataDirText

  ${NSD_CreateBrowseButton} 80% 33u 20% 14u "Browse..."
  Pop $2
  ${NSD_OnClick} $2 NexusInfluxDataDirBrowse

  ${NSD_CreateLabel} 0u 58u 100% 32u "This folder stores register readings used for analytics and machine learning. Choose a local drive with enough free space."
  Pop $3

  nsDialogs::Show
FunctionEnd

Function NexusInfluxDataDirBrowse
  ${NSD_GetText} $NexusInfluxDataDirText $NexusInfluxDataDir

  nsDialogs::SelectFolderDialog "Select InfluxDB data folder" "$NexusInfluxDataDir"
  Pop $0

  ${If} $0 != error
    StrCpy $NexusInfluxDataDir $0
    ${NSD_SetText} $NexusInfluxDataDirText "$NexusInfluxDataDir"
  ${EndIf}
FunctionEnd

Function NexusInfluxDataDirPageLeave
  ${NSD_GetText} $NexusInfluxDataDirText $NexusInfluxDataDir

  ${If} $NexusInfluxDataDir == ""
    MessageBox MB_ICONEXCLAMATION "Choose a folder for InfluxDB data."
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
    MessageBox MB_ICONSTOP "Nexus could not save the InfluxDB data folder configuration."
    Abort
  ${EndIf}
!macroend
