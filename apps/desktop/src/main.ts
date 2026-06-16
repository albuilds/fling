// main.ts — Electron main process entry point.
// Manages the BrowserWindow and system tray for the Fling desktop app.
// The window hides instead of closing so the app stays alive in the tray.

console.log("Start app!");

import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, globalShortcut, screen, desktopCapturer, clipboard } from 'electron'
import fs from 'fs/promises'
import path from 'path'

type ScreenshotRect = {
  left: number
  top: number
  width: number
  height: number
}

type ScreenshotOptions = {
  copyToClipboard: boolean
  saveLocally: boolean
  uploadToServer: boolean
}

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
    ipcMain.on('screenshot-overlay:screenshot', async (_event, rect: ScreenshotRect | null, options: Partial<ScreenshotOptions> | null) => {
      await this.captureScreenshot(rect, options)
    })
  }

  private async captureScreenshot(rect: ScreenshotRect | null, requestedOptions: Partial<ScreenshotOptions> | null) {
    const overlay = this.screenshotOverlay
    if (!overlay) return
    const options = this.normalizeScreenshotOptions(requestedOptions)

    try {
      overlay.webContents.send('screenshot-overlay:pending')
      overlay.hide()
      await new Promise(resolve => setTimeout(resolve, 160))

      const display = screen.getPrimaryDisplay()
      const scaleFactor = display.scaleFactor || 1
      const captureArea = this.normalizeScreenshotRect(rect, display.bounds)
      const source = await this.getPrimaryScreenSource(display.id, display.bounds, scaleFactor)
      const image = source.thumbnail.crop({
        x: Math.round(captureArea.left * scaleFactor),
        y: Math.round(captureArea.top * scaleFactor),
        width: Math.round(captureArea.width * scaleFactor),
        height: Math.round(captureArea.height * scaleFactor),
      })

      let savedPath = ''

      console.log("in here");

      if (options.copyToClipboard) {
        this.writeScreenshotToClipboard(image)
      }

      if (options.saveLocally) {
        const folder = path.join(app.getPath('documents'), 'Fling Screenshots')
        await fs.mkdir(folder, { recursive: true })

        savedPath = path.join(folder, `fling-screenshot-${this.timestampForFileName()}.png`)
        await fs.writeFile(savedPath, image.toPNG())
      }

      overlay.webContents.send('screenshot-overlay:saved', savedPath)
      overlay.close()
    } catch (error) {
      console.error('Could not capture screenshot:', error)
      if (!overlay.isDestroyed()) {
        overlay.show()
        overlay.webContents.send('screenshot-overlay:error')
      }
    }
  }

  private normalizeScreenshotOptions(options: Partial<ScreenshotOptions> | null): ScreenshotOptions {
    return {
      copyToClipboard: options?.copyToClipboard === true,
      saveLocally: options?.saveLocally !== false,
      uploadToServer: options?.uploadToServer === true,
    }
  }

  private writeScreenshotToClipboard(image: Electron.NativeImage) {
    if (image.isEmpty()) {
      throw new Error("Cannot copy empty screenshot image");
    }

    clipboard.writeImage(image);
  }

  private async getPrimaryScreenSource(displayId: number, bounds: Electron.Rectangle, scaleFactor: number) {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(bounds.width * scaleFactor),
        height: Math.round(bounds.height * scaleFactor),
      },
    })

    return sources.find(source => source.display_id === String(displayId)) ?? sources[0]
  }

  private normalizeScreenshotRect(rect: ScreenshotRect | null, bounds: Electron.Rectangle): ScreenshotRect {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { left: 0, top: 0, width: bounds.width, height: bounds.height }
    }

    const left = Math.max(0, Math.min(rect.left, bounds.width))
    const top = Math.max(0, Math.min(rect.top, bounds.height))
    const right = Math.max(left, Math.min(rect.left + rect.width, bounds.width))
    const bottom = Math.max(top, Math.min(rect.top + rect.height, bounds.height))

    return {
      left,
      top,
      width: right - left,
      height: bottom - top,
    }
  }

  private timestampForFileName() {
    return new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
  }
}

// Waits for Electron to finish initializing and creates the Fling applicaiton.
app.whenReady().then(() => new FlingApp().start())

// Removes shortcuts before full shutdown.
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
