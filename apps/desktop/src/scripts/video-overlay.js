const overlay = document.getElementById("overlay");
const selection = document.getElementById("selection");
const toolbar = document.getElementById("toolbar");
const status = document.getElementById("status");
const recordButton = document.getElementById("recordButton");
const cancelButton = document.getElementById("cancelButton");
const saveLocalButton = document.getElementById("saveLocalButton");
const systemAudioButton = document.getElementById("systemAudioButton");
const microphoneButton = document.getElementById("microphoneButton");
const microphoneSelect = document.getElementById("microphoneSelect");
const durationOptions = Array.from(
  document.querySelectorAll(".duration-option"),
);
const fpsOptions = Array.from(document.querySelectorAll(".fps-option"));
const qualityOptions = Array.from(
  document.querySelectorAll(".quality-option"),
);
const recordSound = new Audio("assets/sounds/screenshot-click.mp3");
recordSound.preload = "auto";

let startX = 0;
let startY = 0;
let isDragging = false;
let selectedRect = null;
let selectedDuration = 10;
let selectedFps = 30;
let selectedQuality = "medium";
let selectedSaveLocally = true;
let includeSystemAudio = false;
let includeMicrophone = false;
let selectedMicrophoneId = "";
let isRecording = false;
let activeRecording = null;
let isLoadingSettings = true;
let isCheckingMicrophone = false;

const DEFAULT_RECORDING_SETTINGS = {
  saveLocally: true,
  durationSeconds: 10,
  fps: 30,
  quality: "medium",
  includeSystemAudio: false,
  includeMicrophone: false,
  microphoneId: "",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRect(currentX, currentY) {
  currentX = clamp(currentX, 0, window.innerWidth);
  currentY = clamp(currentY, 0, window.innerHeight);
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

function setStatus(message) {
  status.textContent = message;
  status.classList.add("visible");
}

function playRecordSound() {
  recordSound.currentTime = 0;
  recordSound.play().catch(() => {});
}

function getBitsPerSecond() {
  const megapixels = (selectedRect.width * selectedRect.height) / 1000000;
  const qualityMultipliers = {
    low: 1.2,
    medium: 2.5,
    high: 5,
  };
  const fpsMultiplier = selectedFps / 30;
  return Math.round(
    Math.max(
      900000,
      megapixels * qualityMultipliers[selectedQuality] * fpsMultiplier * 1000000,
    ),
  );
}

function getRecorderOptions(hasAudio) {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType = candidates.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  const options = {
    videoBitsPerSecond: getBitsPerSecond(),
  };
  if (hasAudio) {
    options.audioBitsPerSecond = 128000;
  }
  return mimeType ? { ...options, mimeType } : options;
}

async function getDesktopStream(sourceId) {
  const constraints = {
    audio: includeSystemAudio ? { mandatory: { chromeMediaSource: "desktop" } } : false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxFrameRate: selectedFps,
      },
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (includeSystemAudio && !stream.getAudioTracks().some((track) => track.readyState === "live")) {
      stopStream(stream);
      throw new Error("System audio did not provide a live track");
    }
    return stream;
  } catch (error) {
    if (!includeSystemAudio) throw error;
    throw new Error("System audio unavailable. Turn off PC audio to record without it.", { cause: error });
  }
}

function getMicrophoneConstraints() {
  const audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  if (selectedMicrophoneId) {
    audio.deviceId = { exact: selectedMicrophoneId };
  }

  return {
    audio,
    video: false,
  };
}

async function getMicrophoneStream() {
  if (!includeMicrophone) return null;
  try {
    return await navigator.mediaDevices.getUserMedia(getMicrophoneConstraints());
  } catch (error) {
    throw new Error("Microphone unavailable. Check access or turn off Mic.", { cause: error });
  }
}

function addMixedAudioTracks(recordingStream, audioStreams) {
  const streamsWithAudio = audioStreams.filter(
    (stream) => stream && stream.getAudioTracks().length > 0,
  );
  if (streamsWithAudio.length === 0) return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const destination = audioContext.createMediaStreamDestination();
  const sourceNodes = streamsWithAudio.map((stream) => {
    const sourceStream = new MediaStream(stream.getAudioTracks());
    const sourceNode = audioContext.createMediaStreamSource(sourceStream);
    sourceNode.connect(destination);
    return sourceNode;
  });

  destination.stream
    .getAudioTracks()
    .forEach((track) => recordingStream.addTrack(track));

  return { audioContext, sourceNodes };
}

function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function closeAudioMixer(audioMixer) {
  if (!audioMixer) return;
  audioMixer.sourceNodes.forEach((sourceNode) => sourceNode.disconnect());
  await audioMixer.audioContext.close();
}

function updateAudioControls() {
  systemAudioButton.classList.toggle("active", includeSystemAudio);
  systemAudioButton.setAttribute("aria-pressed", String(includeSystemAudio));
  microphoneButton.classList.toggle("active", includeMicrophone);
  microphoneButton.setAttribute("aria-pressed", String(includeMicrophone));
  microphoneSelect.disabled = !includeMicrophone;
  microphoneSelect.classList.toggle("enabled", includeMicrophone);
}

function updateSaveLocalControl() {
  saveLocalButton.classList.toggle("active", selectedSaveLocally);
  saveLocalButton.setAttribute("aria-pressed", String(selectedSaveLocally));
  recordButton.disabled = isLoadingSettings || isCheckingMicrophone || isRecording || !selectedSaveLocally;

  if (!selectedSaveLocally) {
    setStatus("Enable Save to keep a local recording");
  } else if (status.textContent === "Enable Save to keep a local recording") {
    status.classList.remove("visible");
  }
}

function setActiveOption(options, value) {
  options.forEach((option) => {
    const optionValue =
      option.dataset.duration ?? option.dataset.fps ?? option.dataset.quality;
    option.classList.toggle("active", optionValue === String(value));
  });
}

async function loadRecordingSettings() {
  const settings = await window.flingSettings?.get?.();
  applyTheme(settings?.appearance?.theme ?? "system");
  const recordingSettings = {
    ...DEFAULT_RECORDING_SETTINGS,
    ...settings?.recording,
  };

  selectedDuration = recordingSettings.durationSeconds;
  selectedFps = recordingSettings.fps;
  selectedQuality = recordingSettings.quality;
  selectedSaveLocally = recordingSettings.saveLocally;
  includeSystemAudio = recordingSettings.includeSystemAudio;
  includeMicrophone = recordingSettings.includeMicrophone;
  selectedMicrophoneId = recordingSettings.microphoneId;

  setActiveOption(durationOptions, selectedDuration);
  setActiveOption(fpsOptions, selectedFps);
  setActiveOption(qualityOptions, selectedQuality);
  updateAudioControls();
  updateSaveLocalControl();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme =
    theme === "light" || theme === "dark" ? theme : "system";
}

async function populateMicrophones() {
  let devices = [];

  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch (error) {
    console.warn("Could not enumerate microphones:", error);
  }

  const microphones = devices.filter((device) => device.kind === "audioinput");
  const previousValue = selectedMicrophoneId || microphoneSelect.value;
  microphoneSelect.replaceChildren();

  if (microphones.length === 0) {
    microphoneSelect.add(new Option("No microphone", ""));
    includeMicrophone = false;
    updateAudioControls();
    return 0;
  }

  microphoneSelect.add(new Option("Default mic", ""));
  microphones.forEach((device, index) => {
    const label = device.label || `Microphone ${index + 1}`;
    microphoneSelect.add(new Option(label, device.deviceId));
  });

  const hasPreviousValue = Array.from(microphoneSelect.options).some(
    (option) => option.value === previousValue,
  );
  microphoneSelect.value = hasPreviousValue ? previousValue : "";
  selectedMicrophoneId = microphoneSelect.value;
  updateAudioControls();
  return microphones.length;
}

async function requestMicrophoneList() {
  const permissionStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false,
  });
  stopStream(permissionStream);
  return populateMicrophones();
}

const videoControls = window.flingVideo;

function updateTimer(label, progress, { paused = false, canCancel = true, canControl = false } = {}) {
  videoControls.updateTimer({ label, progress, paused, canCancel, canControl });
}

async function restoreSelection(message) {
  await videoControls.reset();
  activeRecording = null;
  isRecording = false;
  document.body.classList.remove("recording");
  setToolbarPosition(selectedRect);
  updateSaveLocalControl();
  setStatus(message);
}

async function startRecording(sourceId) {
  isRecording = true;
  recordButton.disabled = true;
  document.body.classList.add("recording");

  let desktopStream;
  let microphoneStream;
  let croppedStream;
  let audioMixer;
  const video = document.createElement("video");
  let videoFrame = 0;
  let timerInterval = 0;
  let stopTimeout = 0;

  async function releaseMedia() {
    video.cancelVideoFrameCallback(videoFrame);
    clearInterval(timerInterval);
    clearTimeout(stopTimeout);
    video.pause();
    video.srcObject = null;
    stopStream(desktopStream);
    stopStream(microphoneStream);
    stopStream(croppedStream);
    await closeAudioMixer(audioMixer).catch(console.warn);
  }

  try {
    sourceId ??= await videoControls.start(selectedRect);
    const [desktop, microphone] = await Promise.allSettled([
      getDesktopStream(sourceId),
      getMicrophoneStream(),
    ]);
    if (desktop.status === "fulfilled") desktopStream = desktop.value;
    if (microphone.status === "fulfilled") microphoneStream = microphone.value;
    if (desktop.status === "rejected") throw desktop.reason;
    if (microphone.status === "rejected") throw microphone.reason;

    video.muted = true;
    video.srcObject = desktopStream;
    await video.play();

    const scaleX = video.videoWidth / window.innerWidth;
    const scaleY = video.videoHeight / window.innerHeight;
    const x = Math.round(selectedRect.left * scaleX);
    const y = Math.round(selectedRect.top * scaleY);
    const cropWidth = Math.round((selectedRect.left + selectedRect.width) * scaleX) - x;
    const cropHeight = Math.round((selectedRect.top + selectedRect.height) * scaleY) - y;
    if (cropWidth <= 0 || cropHeight <= 0) throw new Error("The selected region is too small");

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d");
    croppedStream = canvas.captureStream(selectedFps);
    audioMixer = addMixedAudioTracks(croppedStream, [desktopStream, microphoneStream]);
    if (audioMixer?.audioContext.state === "suspended") await audioMixer.audioContext.resume();

    const recorder = new MediaRecorder(
      croppedStream,
      getRecorderOptions(croppedStream.getAudioTracks().length > 0),
    );
    const chunks = [];
    const totalDurationMs = selectedDuration * 1000;
    let postStopAction = "save";
    let isPaused = false;
    let isStopping = false;
    let elapsedBeforePause = 0;
    let startedAt = 0;
    let recordedDurationMs = 0;
    let recorderError;

    function drawFrame() {
      context.drawImage(video, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      videoFrame = video.requestVideoFrameCallback(drawFrame);
    }

    function getElapsedMs() {
      return elapsedBeforePause + (isPaused ? 0 : performance.now() - startedAt);
    }

    function getRemainingMs() {
      return Math.max(0, totalDurationMs - getElapsedMs());
    }

    function updateTimeRemaining() {
      const remainingMs = getRemainingMs();
      const label = `${isPaused ? "Paused " : ""}${Math.ceil(remainingMs / 1000)}s`;
      updateTimer(label, remainingMs / totalDurationMs, { paused: isPaused, canControl: true });
    }

    function stopRecording(action) {
      if (isStopping || recorder.state === "inactive") return;
      isStopping = true;
      postStopAction = action;
      recordedDurationMs = Math.round(Math.min(getElapsedMs(), totalDurationMs));
      clearInterval(timerInterval);
      clearTimeout(stopTimeout);
      const label = action === "save" ? "Saving…" : action === "redo" ? "Restarting…" : "Cancelling…";
      updateTimer(label, 0, { canCancel: false });
      recorder.stop();
    }

    function runTimer() {
      updateTimeRemaining();
      timerInterval = setInterval(updateTimeRemaining, 100);
      stopTimeout = setTimeout(() => stopRecording("save"), getRemainingMs());
    }

    function togglePause() {
      if (isStopping) return;
      if (recorder.state === "recording") {
        recorder.pause();
        elapsedBeforePause = getElapsedMs();
        isPaused = true;
        clearInterval(timerInterval);
        clearTimeout(stopTimeout);
        updateTimeRemaining();
      } else if (recorder.state === "paused") {
        recorder.resume();
        isPaused = false;
        startedAt = performance.now();
        runTimer();
      }
    }

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener("error", (event) => {
      recorderError = event.error ?? new Error("MediaRecorder failed");
    });
    recorder.addEventListener("stop", async () => {
      if (!isStopping) {
        recordedDurationMs = Math.round(Math.min(getElapsedMs(), totalDurationMs));
        updateTimer("Saving…", 0, { canCancel: false });
      }
      await releaseMedia();

      if (postStopAction === "close") {
        videoControls.closeOverlay();
        return;
      }
      if (postStopAction === "redo") {
        activeRecording = null;
        updateTimer("Restarting…", 1);
        await startRecording(sourceId);
        return;
      }

      try {
        if (recorderError) throw recorderError;
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const savedPath = await videoControls.saveRecording(await blob.arrayBuffer(), recordedDurationMs);
        updateTimer("Saved", 1, { canCancel: false });
        setTimeout(() => videoControls.closeOverlay(), 600);
        console.log(`Saved recording to ${savedPath}`);
      } catch (error) {
        console.error("Could not save recording:", error);
        await restoreSelection(recorderError ? "Recording was interrupted" : "Could not save recording");
      }
    }, { once: true });

    drawFrame();
    recorder.start();
    startedAt = performance.now();
    desktopStream.getVideoTracks()[0].addEventListener("ended", () => stopRecording("save"), { once: true });
    activeRecording = {
      cancel: () => stopRecording("close"),
      redo: () => stopRecording("redo"),
      pause: togglePause,
      finish: () => stopRecording("save"),
    };
    runTimer();
  } catch (error) {
    await releaseMedia();
    console.error("Could not start recording:", error);
    const message = error?.message ?? "";
    const permissionError = /NotAllowed|Permission|denied|Failed to get sources/i.test(
      `${error?.name} ${message}`,
    );
    await restoreSelection(
      /^(System audio|Microphone) unavailable/.test(message)
        ? message
        : permissionError ? "Screen Recording permission is needed" : "Could not start recording",
    );
  }
}

function startRecordingFromControls() {
  if (!selectedRect || isDragging || isRecording || recordButton.disabled) return;
  playRecordSound();
  void startRecording();
}

function isKeyboardControlTarget(target) {
  return target?.closest?.("button, input, select, textarea, [contenteditable]");
}

overlay.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || isRecording || isLoadingSettings) return;
  isDragging = true;
  startX = event.clientX;
  startY = event.clientY;
  selectedRect = null;
  toolbar.classList.remove("visible");
  status.classList.remove("visible");
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

overlay.addEventListener("lostpointercapture", () => {
  if (!isDragging) return;
  isDragging = false;
  selection.classList.remove("visible");
});

durationOptions.forEach((button) => {
  button.addEventListener("click", () => {
    selectedDuration = Number(button.dataset.duration);
    durationOptions.forEach((option) =>
      option.classList.toggle("active", option === button),
    );
  });
});

fpsOptions.forEach((button) => {
  button.addEventListener("click", () => {
    selectedFps = Number(button.dataset.fps);
    fpsOptions.forEach((option) =>
      option.classList.toggle("active", option === button),
    );
  });
});

qualityOptions.forEach((button) => {
  button.addEventListener("click", () => {
    selectedQuality = button.dataset.quality;
    qualityOptions.forEach((option) =>
      option.classList.toggle("active", option === button),
    );
  });
});

saveLocalButton.addEventListener("click", () => {
  selectedSaveLocally = !selectedSaveLocally;
  updateSaveLocalControl();
});

systemAudioButton.addEventListener("click", () => {
  includeSystemAudio = !includeSystemAudio;
  updateAudioControls();
});

microphoneButton.addEventListener("click", async () => {
  if (includeMicrophone) {
    includeMicrophone = false;
    updateAudioControls();
    return;
  }

  microphoneButton.disabled = true;
  isCheckingMicrophone = true;
  updateSaveLocalControl();
  setStatus("Checking microphone...");

  try {
    const microphoneCount = await requestMicrophoneList();
    if (microphoneCount === 0) {
      throw new Error("No microphone input devices found");
    }
    includeMicrophone = true;
    status.classList.remove("visible");
  } catch (error) {
    console.error("Could not access microphone:", error);
    includeMicrophone = false;
    setStatus("Microphone unavailable");
  } finally {
    isCheckingMicrophone = false;
    microphoneButton.disabled = false;
    updateAudioControls();
    updateSaveLocalControl();
  }
});

microphoneSelect.addEventListener("change", () => {
  selectedMicrophoneId = microphoneSelect.value;
});

videoControls.onAction((action) => {
  if (activeRecording) {
    activeRecording[action]?.();
  } else if (action === "cancel") {
    videoControls.closeOverlay();
  }
});

recordButton.addEventListener("click", startRecordingFromControls);

cancelButton.addEventListener("click", () => {
  window.flingVideo.closeOverlay();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (activeRecording) activeRecording.cancel();
    else videoControls.closeOverlay();
  } else if (
    event.key === "Enter" &&
    !isKeyboardControlTarget(event.target)
  ) {
    event.preventDefault();
    startRecordingFromControls();
  }
});

async function initializeRecordingOverlay() {
  await loadRecordingSettings();
  await populateMicrophones();
}

initializeRecordingOverlay().catch(console.error).finally(() => {
  isLoadingSettings = false;
  updateSaveLocalControl();
});

navigator.mediaDevices.addEventListener?.("devicechange", () => {
  if (!isRecording && !isLoadingSettings && !isCheckingMicrophone) void populateMicrophones();
});
