// Electron main process entry point.
//
// Fling runs as a tray app: the main window hides instead of closing, and
// captures are started from the tray menu or global keyboard shortcuts.
// See src/app/ for the individual pieces.

import { app, globalShortcut } from "electron";
import { FlingApp } from "./app/fling-app";

app.whenReady().then(async () => {
  try {
    await new FlingApp().start();
  } catch (error) {
    console.error("Could not start Fling:", error);
    app.exit(1);
  }
});

// Removes shortcuts before full shutdown.
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
