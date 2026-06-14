// main.ts — Electron main process entry point.
// Manages the BrowserWindow and system tray for the Fling desktop app.
// The window hides instead of closing so the app stays alive in the tray.

console.log("Start app!");

import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
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
    })
    this.win.loadFile(path.join(__dirname, '../src/index.html'))
    this.win.on('close', (e) => {
      e.preventDefault()
      this.win?.hide()
    })
  }

  private createTray() {
    const icon = nativeImage.createEmpty()
    this.tray = new Tray(icon)
    this.tray.setToolTip('Fling')
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open', click: () => { this.win?.show(); this.win?.focus() } },
      { label: 'Quit', click: () => { app.exit(0) } },
    ]))
    this.tray.on('click', () => {
      this.tray?.popUpContextMenu()
    })
  }

  start() {
    app.setAppUserModelId('fling')
    Menu.setApplicationMenu(null)
    this.createWindow()
    this.createTray()
  }
}

app.whenReady().then(() => new FlingApp().start())
