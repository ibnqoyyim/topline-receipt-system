!macro customInstall
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Topline Receipt System" '"$INSTDIR\Topline Receipt System.exe"'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Topline Receipt System"
!macroend
