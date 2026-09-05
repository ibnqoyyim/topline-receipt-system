import { app } from 'electron'

export function applyOpenAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: []
  })
}
