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

function toDisplayKey(key) {
  if (key === "CommandOrControl") return "Ctrl";
  if (key === "Command") return "Cmd";
  if (key === "Control") return "Ctrl";
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
    if (index > 0) content.append(document.createTextNode("+"));
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

function shortcutFromEvent(event) {
  const ignored = ["Control", "Alt", "Shift", "Meta"];
  if (ignored.includes(event.key)) return null;

  const mods = [];
  if (event.ctrlKey || event.metaKey) mods.push("CommandOrControl");
  if (event.altKey) mods.push("Alt");
  if (event.shiftKey) mods.push("Shift");

  return [...mods, normalizeKey(event)].join("+");
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
      uploadToServer: false,
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

document.addEventListener("keydown", (e) => {
  if (!recording) return;
  e.preventDefault();

  const shortcut = shortcutFromEvent(e);
  if (!shortcut) return;

  shortcuts[recording] = shortcut;

  const el = document.querySelector(
    `.shortcut-input[data-id="${recording}"]`,
  );
  el.classList.remove("recording");
  recording = null;
  Object.keys(shortcuts).forEach(renderShortcut);
});

document.addEventListener("click", (e) => {
  if (!recording) return;
  if (!e.target.classList.contains("shortcut-input")) {
    const el = document.querySelector(
      `.shortcut-input[data-id="${recording}"]`,
    );
    el?.classList.remove("recording");
    renderShortcut(recording);
    recording = null;
  }
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
function showSavedStatus(message = "Settings saved") {
  const status = document.getElementById("saveStatus");
  status.textContent = message;
  status.classList.add("visible");
  setTimeout(() => status.classList.remove("visible"), 2500);
}

document.getElementById("resetBtn").addEventListener("click", async () => {
  const nextSettings =
    (await window.flingSettings?.reset?.()) ?? clone(DEFAULT_SETTINGS);
  applySettings(nextSettings);
  showSavedStatus("Settings reset");
});

document.getElementById("saveBtn").addEventListener("click", async () => {
  const requestedSettings = readSettingsFromForm();
  const nextSettings =
    (await window.flingSettings?.save?.(requestedSettings)) ??
    requestedSettings;
  applySettings(nextSettings);
  showSavedStatus();
});

window.addEventListener("DOMContentLoaded", async () => {
  const [savedSettings, auth] = await Promise.all([
    window.flingSettings?.get?.(),
    window.flingAuth?.get?.(),
  ]);
  applySettings(savedSettings ?? clone(DEFAULT_SETTINGS));
  renderAccount(auth);
});
