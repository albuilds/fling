const overlay = document.getElementById("overlay");
const selection = document.getElementById("selection");
const toolbar = document.getElementById("toolbar");
const status = document.getElementById("status");
const screenshotButton = document.getElementById("screenshotButton");
const cancelButton = document.getElementById("cancelButton");
const copyOption = document.getElementById("copyOption");
const saveOption = document.getElementById("saveOption");
const uploadOption = document.getElementById("uploadOption");
const uploadOptionLabel = document.getElementById("uploadOptionLabel");
const screenshotSound = new Audio("assets/sounds/screenshot-click.mp3");
screenshotSound.preload = "auto";

let startX = 0;
let startY = 0;
let isDragging = false;
let selectedRect = null;

const DEFAULT_SCREENSHOT_SETTINGS = {
  copyToClipboard: false,
  saveLocally: true,
  uploadToServer: false,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRect(currentX, currentY) {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const width = Math.abs(currentX - startX);
  const height = Math.abs(currentY - startY);
  return { left, top, width, height };
}

function setSelectionRect(rect) {
  selection.style.left = `${rect.left}px`;
  selection.style.top = `${rect.top}px`;
  selection.style.width = `${rect.width}px`;
  selection.style.height = `${rect.height}px`;
}

function setToolbarPosition(rect) {
  const gap = 10;
  toolbar.classList.add("visible");

  const toolbarRect = toolbar.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const below = rect.top + rect.height + gap;
  const top =
    below + toolbarRect.height <= viewportHeight
      ? below
      : Math.max(gap, rect.top - toolbarRect.height - gap);
  const centeredLeft = rect.left + rect.width / 2 - toolbarRect.width / 2;

  toolbar.style.left = `${clamp(centeredLeft, gap, viewportWidth - toolbarRect.width - gap)}px`;
  toolbar.style.top = `${clamp(top, gap, viewportHeight - toolbarRect.height - gap)}px`;
}

function hideToolbarStatus() {
  status.classList.remove("visible");
}

function playScreenshotSound() {
  screenshotSound.currentTime = 0;
  screenshotSound.play().catch(() => {});
}

function getScreenshotOptions() {
  return {
    copyToClipboard: copyOption.checked,
    saveLocally: saveOption.checked,
    uploadToServer: uploadOption.checked,
  };
}

function updateScreenshotButtonState() {
  screenshotButton.disabled =
    !copyOption.checked &&
    !saveOption.checked &&
    !uploadOption.checked;
}

function isKeyboardControlTarget(target) {
  return target?.closest?.("button, input, select, textarea, [contenteditable]");
}

function captureScreenshot() {
  if (isDragging || screenshotButton.disabled) return;

  playScreenshotSound();
  screenshotButton.disabled = true;
  status.textContent = "Capturing...";
  status.classList.add("visible");
  window.flingScreenshot?.requestScreenshot?.(
    selectedRect,
    getScreenshotOptions(),
  );
}

async function loadScreenshotSettings() {
  const [settings, auth] = await Promise.all([
    window.flingSettings?.get?.(),
    window.flingAuth?.get?.(),
  ]);
  applyTheme(settings?.appearance?.theme ?? "system");
  const screenshotSettings = {
    ...DEFAULT_SCREENSHOT_SETTINGS,
    ...settings?.screenshot,
  };

  copyOption.checked = screenshotSettings.copyToClipboard;
  saveOption.checked = screenshotSettings.saveLocally;
  const canUpload = auth?.signedIn === true;
  uploadOption.disabled = !canUpload;
  uploadOptionLabel.classList.toggle("disabled", !canUpload);
  uploadOptionLabel.title = canUpload
    ? "Upload this screenshot and create a share link"
    : "Sign in to upload screenshots";
  uploadOption.checked = canUpload && screenshotSettings.uploadToServer;
  updateScreenshotButtonState();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme =
    theme === "light" || theme === "dark" ? theme : "system";
}

overlay.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  isDragging = true;
  startX = event.clientX;
  startY = event.clientY;
  selectedRect = null;
  toolbar.classList.remove("visible");
  hideToolbarStatus();
  selection.classList.add("visible");
  setSelectionRect({ left: startX, top: startY, width: 0, height: 0 });
  overlay.setPointerCapture(event.pointerId);
});

overlay.addEventListener("pointermove", (event) => {
  if (!isDragging) return;
  const rect = getRect(event.clientX, event.clientY);
  setSelectionRect(rect);
});

overlay.addEventListener("pointerup", (event) => {
  if (!isDragging) return;
  isDragging = false;
  overlay.releasePointerCapture(event.pointerId);

  const rect = getRect(event.clientX, event.clientY);
  if (rect.width < 8 || rect.height < 8) {
    selection.classList.remove("visible");
    return;
  }

  selectedRect = rect;
  setSelectionRect(rect);
  setToolbarPosition(rect);
});

screenshotButton.addEventListener("click", captureScreenshot);

cancelButton.addEventListener("click", () => {
  window.flingScreenshot?.closeOverlay?.();
});

copyOption.addEventListener("change", updateScreenshotButtonState);
saveOption.addEventListener("change", updateScreenshotButtonState);
uploadOption.addEventListener("change", updateScreenshotButtonState);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.flingScreenshot?.closeOverlay?.();
  } else if (
    event.key === "Enter" &&
    !isKeyboardControlTarget(event.target)
  ) {
    event.preventDefault();
    captureScreenshot();
  }
});

window.flingScreenshot?.onPending?.(() => {
  status.textContent = "Capturing...";
  status.classList.add("visible");
});

window.flingScreenshot?.onSaved?.((savedPath) => {
  status.textContent = `Saved to ${savedPath}`;
  status.classList.add("visible");
});

window.flingScreenshot?.onError?.(() => {
  screenshotButton.disabled = false;
  status.textContent = "Could not save screenshot";
  status.classList.add("visible");
});

loadScreenshotSettings();
