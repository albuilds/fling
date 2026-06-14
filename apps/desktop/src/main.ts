// main.ts — Electron main process entry point.
// Manages the BrowserWindow and system tray for the Fling desktop app.
// The window hides instead of closing so the app stays alive in the tray.

console.log("Start app!");

import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron'
import path from 'path'

class FlingApp {
  private tray: Tray | null = null
  private win: BrowserWindow | null = null

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

  private createTray() {
    const icon = nativeImage.createEmpty()
    this.tray = new Tray(icon)
    this.tray.setToolTip('Fling')
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open', click: () => this.showPage('index.html') },
      { label: 'History', click: () => this.showPage('history.html') },
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
    this.createWindow()
    this.createTray()
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
}

app.whenReady().then(() => new FlingApp().start())
