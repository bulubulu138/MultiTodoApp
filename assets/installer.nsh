; MultiTodo Application - NSIS Custom Uninstall Script
; Feature: Ask user whether to delete user data during uninstallation

!macro customUnInstall
  ; Ask user whether to delete user data
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to delete all todo data?$\n$\nSelecting 'Yes' will permanently delete all todos, notes, and settings.$\nSelecting 'No' will keep your data for future use.$\n$\nData location: $APPDATA\MultiTodo" IDYES delete IDNO keep
  
  delete:
    ; User chose to delete data
    RMDir /r "$APPDATA\MultiTodo"
    DetailPrint "Deleted user data: $APPDATA\MultiTodo"
    Goto end
  
  keep:
    ; User chose to keep data
    DetailPrint "Kept user data: $APPDATA\MultiTodo"
    Goto end
  
  end:
!macroend

