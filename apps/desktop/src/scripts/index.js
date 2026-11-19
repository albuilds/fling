document.querySelectorAll("[data-window-action]").forEach((button) => {
  button.addEventListener("click", () => {
    window.flingWindow?.[button.dataset.windowAction]?.();
  });
});

const DEFAULT_SETTINGS = {
  afterCapture: {
    openBrowser: true,
    copyUrl: true,
    showNotification: true,
  },
  screenshot: {
    copyToClipboard: false,
    saveLocally: true,
    uploadToServer: false,
  },
  recording: {
    saveLocally: true,
    durationSeconds: 10,
    fps: 30,
    quality: "medium",
    includeSystemAudio: false,
    includeMicrophone: false,
    microphoneId: "",
  },
  shortcuts: {
    captureRegion: "CommandOrControl+Shift+S",
    captureFullscreen: "CommandOrControl+Shift+F",
    recordVideo: "CommandOrControl+Shift+R",
  },
  appearance: {
    theme: "system",
  },
};

let settings = clone(DEFAULT_SETTINGS);
const shortcuts = {};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent);

/** How a key in an Electron accelerator is labeled on this platform. */
function toDisplayKey(key) {
  if (key === "CommandOrControl" || key === "CmdOrCtrl") return IS_MAC ? "⌘" : "Ctrl";
  if (key === "Command" || key === "Cmd") return "⌘";
  if (key === "Control" || key === "Ctrl") return IS_MAC ? "⌃" : "Ctrl";
  if (key === "Alt" || key === "Option") return IS_MAC ? "⌥" : "Alt";
  if (key === "Shift") return IS_MAC ? "⇧" : "Shift";
  return key;
}

function parseShortcut(accelerator) {
  if (!accelerator) return null;
  const parts = accelerator.split("+").filter(Boolean);
  return parts.length > 0 ? parts.map(toDisplayKey) : null;
}

function renderShortcut(id) {
  const el = document.querySelector(`.shortcut-input[data-id="${id}"]`);
  const keys = parseShortcut(shortcuts[id]);
  if (!keys) {
    el.textContent = "Not set";
    return;
  }
  const content = document.createDocumentFragment();
  keys.forEach((key, index) => {
    // Mac shortcuts read as ⌘⇧S, other platforms as Ctrl+Shift+S.
    if (index > 0 && !IS_MAC) content.append(document.createTextNode("+"));
    const keyElement = document.createElement("span");
    keyElement.className = "key";
    keyElement.textContent = key;
    content.append(keyElement);
  });
  el.replaceChildren(content);
}

function normalizeKey(event) {
  if (event.code?.startsWith("Key")) return event.code.slice(3);
  if (event.code?.startsWith("Digit")) return event.code.slice(5);
  if (event.key === " ") return "Space";
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
}

/**
 * Turns a key press into an Electron accelerator. Returns null while only
 * modifiers are held, and "needs-modifier" for a bare key: global shortcuts
 * without Cmd/Ctrl or Option/Alt would steal that key from every other app.
 */
function shortcutFromEvent(event) {
  const ignored = ["Control", "Alt", "Shift", "Meta"];
  if (ignored.includes(event.key)) return null;

  const mods = [];
  if (event.ctrlKey || event.metaKey) mods.push("CommandOrControl");
  if (event.altKey) mods.push("Alt");
  if (event.shiftKey) mods.push("Shift");

  const hasMainModifier = event.ctrlKey || event.metaKey || event.altKey;
  if (!hasMainModifier) return "needs-modifier";

  return [...mods, normalizeKey(event)].join("+");
}

/** Names of shortcuts that share the same key combination. */
function findDuplicateShortcuts() {
  const labels = {
    captureRegion: "Capture region",
    captureFullscreen: "Capture full screen",
    recordVideo: "Record video",
  };
  const seen = new Map();
  for (const [id, accelerator] of Object.entries(shortcuts)) {
    if (!accelerator) continue;
    if (seen.has(accelerator)) return [labels[seen.get(accelerator)], labels[id]];
    seen.set(accelerator, id);
  }
  return null;
}

function applySettings(nextSettings) {
  settings = {
    ...clone(DEFAULT_SETTINGS),
    ...nextSettings,
    appearance: {
      ...DEFAULT_SETTINGS.appearance,
      ...nextSettings?.appearance,
    },
    afterCapture: {
      ...DEFAULT_SETTINGS.afterCapture,
      ...nextSettings?.afterCapture,
    },
    screenshot: {
      ...DEFAULT_SETTINGS.screenshot,
      ...nextSettings?.screenshot,
    },
    recording: {
      ...DEFAULT_SETTINGS.recording,
      ...nextSettings?.recording,
    },
    shortcuts: {
      ...DEFAULT_SETTINGS.shortcuts,
      ...nextSettings?.shortcuts,
    },
  };

  Object.keys(shortcuts).forEach((key) => delete shortcuts[key]);
  Object.assign(shortcuts, settings.shortcuts);

  applyTheme(settings.appearance.theme);
  document.getElementById("theme").value = settings.appearance.theme;
  document.getElementById("openBrowser").checked =
    settings.afterCapture.openBrowser;
  document.getElementById("copyUrl").checked = settings.afterCapture.copyUrl;
  document.getElementById("showNotif").checked =
    settings.afterCapture.showNotification;
  document.getElementById("copyScreenshot").checked =
    settings.screenshot.copyToClipboard;
  document.getElementById("uploadScreenshot").checked =
    settings.screenshot.uploadToServer;
  document.getElementById("saveLocal").checked =
    settings.screenshot.saveLocally && settings.recording.saveLocally;
  document.getElementById("recordDuration").value = String(
    settings.recording.durationSeconds,
  );
  document.getElementById("recordFps").value = String(settings.recording.fps);
  document.getElementById("recordQuality").value =
    settings.recording.quality;
  document.getElementById("recordSystemAudio").checked =
    settings.recording.includeSystemAudio;
  document.getElementById("recordMicrophone").checked =
    settings.recording.includeMicrophone;

  Object.keys(shortcuts).forEach(renderShortcut);
}

function readSettingsFromForm() {
  const saveLocally = document.getElementById("saveLocal").checked;

  return {
    appearance: {
      theme: document.getElementById("theme").value,
    },
    afterCapture: {
      openBrowser: document.getElementById("openBrowser").checked,
      copyUrl: document.getElementById("copyUrl").checked,
      showNotification: document.getElementById("showNotif").checked,
    },
    screenshot: {
      copyToClipboard: document.getElementById("copyScreenshot").checked,
      saveLocally,
      uploadToServer: document.getElementById("uploadScreenshot").checked,
    },
    recording: {
      saveLocally,
      durationSeconds: Number(document.getElementById("recordDuration").value),
      fps: Number(document.getElementById("recordFps").value),
      quality: document.getElementById("recordQuality").value,
      includeSystemAudio:
        document.getElementById("recordSystemAudio").checked,
      includeMicrophone: document.getElementById("recordMicrophone").checked,
      microphoneId: settings.recording.microphoneId,
    },
    shortcuts: { ...shortcuts },
  };
}

function applyTheme(theme) {
  document.documentElement.dataset.theme =
    theme === "light" || theme === "dark" ? theme : "system";
}

function renderAccount(auth) {
  const identity = auth?.user?.name || auth?.user?.email;
  const signedIn = Boolean(auth?.signedIn);
  document.getElementById("accountTitle").textContent =
    signedIn ? identity || "Fling account" : "Not signed in";
  document.getElementById("accountDescription").textContent = signedIn
    ? "Your desktop is connected and ready to share captures"
    : "Connect Fling to upload and share captures";
  document.getElementById("accountStatus").textContent =
    signedIn ? "Connected" : "Offline";
  document.getElementById("accountState").classList.toggle(
    "signed-in",
    signedIn,
  );
  document.getElementById("accountSignIn").hidden = signedIn;
  document.getElementById("accountSignOut").hidden = !signedIn;
}

document.getElementById("accountSignIn").addEventListener("click", () => {
  void window.flingAuth?.signIn?.();
});

document.getElementById("accountSignOut").addEventListener("click", async () => {
  const auth = await window.flingAuth?.signOut?.();
  renderAccount(auth);
});

document.getElementById("theme").addEventListener("change", (event) => {
  applyTheme(event.target.value);
});

// Shortcut recording
let recording = null;

document.querySelectorAll(".shortcut-input").forEach((el) => {
  el.addEventListener("click", () => {
    if (recording) {
      document
        .querySelector(`.shortcut-input[data-id="${recording}"]`)
        ?.classList.remove("recording");
    }
    recording = el.dataset.id;
    el.classList.add("recording");
    el.textContent = "Press keys…";
  });
});

function stopRecordingShortcut() {
  if (!recording) return;
  const id = recording;
  recording = null;
  document
    .querySelector(`.shortcut-input[data-id="${id}"]`)
    ?.classList.remove("recording");
  renderShortcut(id);
}

document.addEventListener("keydown", (e) => {
  if (!recording) return;
  e.preventDefault();

  // Escape cancels and keeps the previous shortcut.
  if (e.key === "Escape") {
    stopRecordingShortcut();
    return;
  }

  const shortcut = shortcutFromEvent(e);
  if (!shortcut) return;
  if (shortcut === "needs-modifier") {
    const el = document.querySelector(`.shortcut-input[data-id="${recording}"]`);
    el.textContent = IS_MAC ? "Add ⌘ or ⌥…" : "Add Ctrl or Alt…";
    return;
  }

  shortcuts[recording] = shortcut;
  stopRecordingShortcut();
  Object.keys(shortcuts).forEach(renderShortcut);
});

document.addEventListener("click", (e) => {
  if (!recording) return;
  if (!e.target.closest(".shortcut-input")) stopRecordingShortcut();
});

// Clear buttons
document.querySelectorAll("[data-clear]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.clear;
    shortcuts[id] = null;
    renderShortcut(id);
  });
});

// Reset defaults
let saveStatusTimer = 0;

function showSavedStatus(message = "Settings saved", isError = false) {
  const status = document.getElementById("saveStatus");
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.classList.add("visible");
  clearTimeout(saveStatusTimer);
  saveStatusTimer = setTimeout(
    () => status.classList.remove("visible"),
    isError ? 5000 : 2500,
  );
}

document.getElementById("resetBtn").addEventListener("click", async () => {
  const nextSettings =
    (await window.flingSettings?.reset?.()) ?? clone(DEFAULT_SETTINGS);
  applySettings(nextSettings);
  showSavedStatus("Settings reset");
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  stopRecordingShortcut();
  const duplicate = findDuplicateShortcuts();
  if (duplicate) {
    showSavedStatus(`${duplicate[0]} and ${duplicate[1]} use the same shortcut`, true);
    return;
  }

  try {
    const requestedSettings = readSettingsFromForm();
    const nextSettings =
      (await window.flingSettings?.save?.(requestedSettings)) ??
      requestedSettings;
    applySettings(nextSettings);
    showSavedStatus();
  } catch (error) {
    console.error("Could not save settings", error);
    showSavedStatus("Could not save settings", true);
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  const [savedSettings, auth] = await Promise.all([
    window.flingSettings?.get?.(),
    window.flingAuth?.get?.(),
  ]);
  applySettings(savedSettings ?? clone(DEFAULT_SETTINGS));
  renderAccount(auth);
});
