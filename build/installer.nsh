; ============================================================
;  StudyX — Custom NSIS installer / uninstaller script
;  Integrated via electron-builder's nsis.include option
; ============================================================

; ── Post-install: first-run setup ───────────────────────────────────────────
!macro customInstall
  ; Nothing extra needed on install — electron-builder handles shortcuts,
  ; registry entries, and uninstaller automatically.
!macroend

; ── Post-uninstall: clean up all user data ───────────────────────────────────
!macro customUnInstall
  ; Remove Zustand / localStorage (Electron stores these in APPDATA)
  RMDir /r "$APPDATA\StudyX"
  RMDir /r "$APPDATA\StudyX-Dev"

  ; Remove the Chromium-based user profile the Electron main process created
  ; (GPU cache, network cache, storage, IndexedDB, etc.)
  RMDir /r "$LOCALAPPDATA\StudyX"

  ; NOTE: Documents\StudyX-Backups is intentionally left intact.
  ; The user's study backups are personal data and should survive uninstall.
!macroend
