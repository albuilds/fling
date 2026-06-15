// main.ts — Electron main process entry point.
// Manages the BrowserWindow and system tray for the Fling desktop app.
// The window hides instead of closing so the app stays alive in the tray.

console.log("Start app!");

import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, globalShortcut, screen } from 'electron'
import path from 'path'

class FlingApp {
  private tray: Tray | null = null
  private win: BrowserWindow | null = null
  private screenshotOverlay: BrowserWindow | null = null

  private createWindow() {
    this.win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      skipTaskbar: true,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    })
    this.win.loadFile(path.join(__dirname, '../src/index.html'))
    this.win.on('close', (e) => {
      e.preventDefault()
      this.win?.hide()
    })
  }

  private showPage(fileName: string) {
    this.win?.loadFile(path.join(__dirname, `../src/${fileName}`))
    this.win?.show()
    this.win?.focus()
  }

  private showScreenshotOverlay() {
    if (this.screenshotOverlay) {
      this.screenshotOverlay.focus()
      return
    }

    const { bounds } = screen.getPrimaryDisplay()
    this.screenshotOverlay = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    })

    this.screenshotOverlay.setAlwaysOnTop(true, 'screen-saver')
    this.screenshotOverlay.loadFile(path.join(__dirname, '../src/screenshot-overlay.html'))
    this.screenshotOverlay.once('ready-to-show', () => this.screenshotOverlay?.show())
    this.screenshotOverlay.on('closed', () => {
      this.screenshotOverlay = null
    })
  }

  private createTray() {
    const icon = nativeImage.createEmpty()
    this.tray = new Tray(icon)
    this.tray.setToolTip('Fling')
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open', click: () => this.showPage('index.html') },
      { label: 'History', click: () => this.showPage('history.html') },
      { label: 'Capture Region', accelerator: 'CommandOrControl+Shift+S', click: () => this.showScreenshotOverlay() },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.exit(0) } },
    ]))
    this.tray.on('click', () => {
      this.tray?.popUpContextMenu()
    })
  }

  start() {
    app.setAppUserModelId('fling')
    Menu.setApplicationMenu(null)
    this.registerWindowControls()
    this.registerScreenshotControls()
    this.createWindow()
    this.createTray()
    const registered = globalShortcut.register('CommandOrControl+Shift+S', () => this.showScreenshotOverlay())
    if (!registered) {
      console.warn('Could not register screenshot shortcut: CommandOrControl+Shift+S')
    }
  }

  private registerWindowControls() {
    ipcMain.on('window:minimize', () => this.win?.minimize())
    ipcMain.on('window:toggle-maximize', () => {
      if (!this.win) return
      if (this.win.isMaximized()) {
        this.win.unmaximize()
      } else {
        this.win.maximize()
      }
    })
    ipcMain.on('window:close', () => this.win?.close())
  }

  private registerScreenshotControls() {
    ipcMain.on('screenshot-overlay:close', () => this.screenshotOverlay?.close())
    ipcMain.on('screenshot-overlay:screenshot', () => {
      // Placeholder for the future capture implementation.
      this.screenshotOverlay?.webContents.send('screenshot-overlay:pending')
    })
  }
}

// Waits for Electron to finish initializing and creates the Fling applicaiton.
app.whenReady().then(() => new FlingApp().start())

// Removes shortcuts before full shutdown.
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
