const card = document.getElementById("authCard");
const signInButton = document.getElementById("signInButton");

document.querySelectorAll("[data-window-action]").forEach((button) => {
  button.addEventListener("click", () => window.flingWindow?.[button.dataset.windowAction]?.());
});

async function startSignIn() {
  card.dataset.state = "pending";
  signInButton.disabled = true;
  try {
    await window.flingAuth?.signIn?.();
  } catch (error) {
    card.dataset.state = "error";
    document.getElementById("errorCopy").textContent =
      error?.message || "The sign-in request could not be completed.";
  } finally {
    signInButton.disabled = false;
  }
}

signInButton.addEventListener("click", startSignIn);
document.getElementById("retryButton").addEventListener("click", startSignIn);

window.flingAuth?.onPending?.((data) => {
  document.getElementById("userCode").textContent = data.userCode;
  card.dataset.state = "pending";
});
window.flingAuth?.onComplete?.((data) => {
  const identity = data.user?.name || data.user?.email;
  if (identity) document.getElementById("successCopy").textContent = `Signed in as ${identity}. Opening Fling…`;
  card.dataset.state = "success";
});
window.flingAuth?.onError?.((data) => {
  document.getElementById("errorCopy").textContent = data.message;
  card.dataset.state = "error";
});

window.addEventListener("DOMContentLoaded", async () => {
  const settings = await window.flingSettings?.get?.();
  const theme = settings?.appearance?.theme;
  document.documentElement.dataset.theme =
    theme === "light" || theme === "dark" ? theme : "system";
});
