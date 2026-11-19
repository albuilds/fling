const uploadsContainer = document.getElementById("uploads");
const historyCount = document.getElementById("historyCount");
const refreshButton = document.getElementById("refreshButton");
const hint = document.querySelector(".hint");
let isLoading = false;

const icons = {
  image:
    `<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.5"/><path d="m21 15-5-5L5 19"/>`,
  video:
    `<rect x="3" y="5" width="15" height="14" rx="2"/><path d="m18 10 4-2v8l-4-2"/>`,
};

document.querySelectorAll("[data-window-action]").forEach((button) => {
  button.addEventListener("click", () => {
    window.flingWindow?.[button.dataset.windowAction]?.();
  });
});

function applyTheme(theme) {
  document.documentElement.dataset.theme =
    theme === "light" || theme === "dark" ? theme : "system";
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "Unknown size";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** index;
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderState(title, detail) {
  const state = document.createElement("div");
  state.className = "history-state";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const copy = document.createElement("span");
  copy.textContent = detail;
  state.append(heading, copy);
  uploadsContainer.replaceChildren(state);
}

function createActionButton(label, iconMarkup, action, disabled = false) {
  const button = document.createElement("button");
  button.className = "btn-icon";
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  button.innerHTML = iconMarkup;
  button.addEventListener("click", action);
  return button;
}

function renderUploads(captures) {
  const uploads = Array.isArray(captures) ? captures : [];
  historyCount.textContent = `${uploads.length} ${uploads.length === 1 ? "upload" : "uploads"}`;

  if (uploads.length === 0) {
    renderState(
      "No uploads yet",
      "Upload a screenshot or recording and it will appear here.",
    );
    hint.textContent = "No captures in your Fling account yet";
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const upload of uploads) {
    const type = upload.type === "video" ? "video" : "image";
    const expired = Boolean(
      upload.expiresAt && new Date(upload.expiresAt).getTime() <= Date.now(),
    );

    const row = document.createElement("div");
    row.className = "upload-row";

    const thumb = document.createElement("div");
    thumb.className = `thumb ${type}`;
    thumb.setAttribute("aria-hidden", "true");
    thumb.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[type]}</svg>`;

    const meta = document.createElement("div");
    meta.className = "upload-meta";
    const title = document.createElement("strong");
    title.textContent = upload.title || "Untitled capture";
    const detail = document.createElement("span");
    detail.textContent = `${formatTime(upload.createdAt)} · ${formatBytes(upload.byteSize)}`;
    meta.append(title, detail);

    const actions = document.createElement("div");
    actions.className = "upload-actions";
    const status = document.createElement("span");
    status.className = `status${expired ? " expired" : ""}`;
    status.textContent = expired ? "Expired" : "Uploaded";

    const copyButton = createActionButton(
      "Copy link",
      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/></svg>`,
      async () => {
        try {
          await window.flingHistory.copyLink(upload.shareUrl);
          copyButton.title = "Copied";
          hint.textContent = "Share link copied to clipboard";
          setTimeout(() => { copyButton.title = "Copy link"; }, 1400);
        } catch {
          hint.textContent = "Could not copy the share link";
        }
      },
      expired,
    );

    const openButton = createActionButton(
      "Open link",
      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>`,
      async () => {
        try {
          await window.flingHistory.openLink(upload.shareUrl);
        } catch {
          hint.textContent = "Could not open the share link";
        }
      },
      expired,
    );

    actions.append(status, copyButton, openButton);
    row.append(thumb, meta, actions);
    fragment.append(row);
  }

  uploadsContainer.replaceChildren(fragment);
  hint.textContent = "Showing recent captures in your Fling account";
}

async function loadHistory() {
  if (isLoading) return;
  isLoading = true;
  refreshButton.disabled = true;
  refreshButton.classList.add("loading");
  renderState("Loading uploads", "Fetching your latest captures...");

  try {
    const result = await window.flingHistory?.list?.();
    if (!result?.signedIn) {
      historyCount.textContent = "0 uploads";
      renderState(
        "Sign in to view history",
        "Connect Fling from the main window or tray menu, then refresh.",
      );
      hint.textContent = "Desktop is not connected to a Fling account";
      return;
    }
    renderUploads(result.captures);
  } catch (error) {
    console.error("Could not load history", error);
    historyCount.textContent = "Unavailable";
    renderState(
      "Could not load uploads",
      "Check that the Fling server is running, then try again.",
    );
    hint.textContent = "History request failed";
  } finally {
    isLoading = false;
    refreshButton.disabled = false;
    refreshButton.classList.remove("loading");
  }
}

refreshButton.addEventListener("click", () => void loadHistory());
window.flingHistory?.onChanged?.(() => void loadHistory());

window.addEventListener("DOMContentLoaded", async () => {
  const settings = await window.flingSettings?.get?.();
  applyTheme(settings?.appearance?.theme ?? "system");
  await loadHistory();
});
