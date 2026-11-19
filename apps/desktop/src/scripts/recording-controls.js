const discardButton = document.getElementById("discardRecordingButton");
const redoButton = document.getElementById("redoRecordingButton");
const pauseButton = document.getElementById("pauseRecordingButton");
const pauseIcon = document.getElementById("pauseRecordingIcon");
const finishButton = document.getElementById("finishRecordingButton");
const timerText = document.getElementById("timerText");
const timerProgress = document.getElementById("timerProgress");
const controls = window.flingRecordingControls;

for (const [button, action] of [
  [discardButton, "cancel"],
  [redoButton, "redo"],
  [pauseButton, "pause"],
  [finishButton, "finish"],
]) {
  button.addEventListener("click", () => controls.sendAction(action));
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !discardButton.disabled) {
    controls.sendAction("cancel");
  }
});

controls.onTimer(({ label, progress, paused, canCancel, canControl }) => {
  timerText.textContent = label;
  timerProgress.style.transform = `scaleX(${progress})`;
  discardButton.disabled = !canCancel;
  redoButton.disabled = !canControl;
  finishButton.disabled = !canControl;
  pauseButton.disabled = !canControl;
  pauseIcon.classList.toggle("icon-pause", !paused);
  pauseIcon.classList.toggle("icon-play", paused);
  const pauseLabel = paused ? "Resume recording" : "Pause recording";
  pauseButton.title = pauseLabel;
  pauseButton.setAttribute("aria-label", pauseLabel);
});
