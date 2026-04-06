; ============================================================
;  StudyX - Custom NSIS installer / uninstaller script
;  Integrated via electron-builder's nsis.include option
; ============================================================

; Post-install hook
!macro customInstall
  ; Nothing extra needed on install.
  ; electron-builder creates shortcuts, registry entries and the uninstaller.
!macroend

; Post-uninstall hook
!macro customUnInstall
  ; User data is intentionally preserved.
  ; Study progress, profiles, AI library and backups should survive uninstall
  ; and reinstall, especially for manual upgrades between builds.
!macroend
