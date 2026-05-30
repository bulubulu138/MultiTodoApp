; MultiTodo Application - NSIS Custom Uninstall Script
; Feature: Keep user data during uninstallation and notify user

!macro customUnInstall
  ; Notify user that data is preserved
  MessageBox MB_OK|MB_ICONINFORMATION "MultiTodo has been uninstalled.$\n$\nYour todo data, notes, and settings have been preserved at:$\n$APPDATA\MultiTodo$\n$\nIf you want to delete this data, please remove the folder manually."

  ; Keep user data - do not delete
  DetailPrint "User data preserved at: $APPDATA\MultiTodo"
!macroend

