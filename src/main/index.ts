import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import appIcon from '../../build/topline_icon.ico?asset'
import splashLogo from '../../assets/topline_icon_512.png?asset'
import { ensureFirstBackup } from './backup'
import { closeDatabase, initDatabase } from './db'
import { registerIpcHandlers } from './ipc'
import { readSettings } from './ipc/session'
import { closeSplash, showSplash } from './splash'
import { applyOpenAtLogin } from './startup'
import { setMainWindow } from './window'

function createWindow(): void {
  const splash = showSplash(splashLogo)
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Topline Receipt System',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  setMainWindow(mainWindow)

  let revealed = false
  function revealMain(): void {
    if (revealed) return
    revealed = true
    void splash.finished.then(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
      }
      closeSplash(splash.window)
    })
  }

  mainWindow.on('ready-to-show', revealMain)
  setTimeout(revealMain, 6000)

  mainWindow.on('closed', () => {
    setMainWindow(null)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.topline.receiptsystem')
  initDatabase()
  ensureFirstBackup()
  applyOpenAtLogin(readSettings().openAtLogin)
  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})
