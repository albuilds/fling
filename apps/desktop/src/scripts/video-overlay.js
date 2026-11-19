const overlay = document.getElementById("overlay");
const selection = document.getElementById("selection");
const toolbar = document.getElementById("toolbar");
const status = document.getElementById("status");
const recordButton = document.getElementById("recordButton");
const cancelButton = document.getElementById("cancelButton");
const timer = document.getElementById("timer");
const timerProgress = document.getElementById("timerProgress");
const timerText = document.getElementById("timerText");
const discardRecordingButton = document.getElementById(
  "discardRecordingButton",
);
const redoRecordingButton = document.getElementById("redoRecordingButton");
const pauseRecordingButton = document.getElementById(
  "pauseRecordingButton",
);
const pauseRecordingIcon = document.getElementById("pauseRecordingIcon");
const finishRecordingButton = document.getElementById(
  "finishRecordingButton",
);
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

function setTimer(secondsRemaining, progress) {
  timerText.textContent = `${secondsRemaining}s`;
  timerProgress.style.transform = `scaleX(${progress})`;
  timer.classList.add("visible");
}

function setTimerPaused(secondsRemaining, progress) {
  timerText.textContent = `Paused ${secondsRemaining}s`;
  timerProgress.style.transform = `scaleX(${progress})`;
  timer.classList.add("visible");
}

function setTimerSaved() {
  timerText.textContent = "Saved";
  timerProgress.style.transform = "scaleX(1)";
  timer.classList.add("visible");
}

function setRecordingControlsDisabled(disabled) {
  discardRecordingButton.disabled = disabled;
  redoRecordingButton.disabled = disabled;
  pauseRecordingButton.disabled = disabled;
  finishRecordingButton.disabled = disabled;
}

function setPauseControlPaused(paused) {
  pauseRecordingIcon.classList.toggle("icon-pause", !paused);
  pauseRecordingIcon.classList.toggle("icon-play", paused);
  pauseRecordingButton.setAttribute(
    "aria-label",
    paused ? "Resume recording" : "Pause recording",
  );
  pauseRecordingButton.title = paused ? "Resume recording" : "Pause recording";
}

function getTimerPosition(rect) {
  const gap = 10;
  timer.classList.add("visible");

  const timerRect = timer.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const below = rect.top + rect.height + gap;
  const above = rect.top - timerRect.height - gap;
  const top =
    below + timerRect.height <= viewportHeight
      ? below
      : Math.max(gap, above);
  const centeredLeft = rect.left + rect.width / 2 - timerRect.width / 2;

  return {
    left: clamp(centeredLeft, gap, viewportWidth - timerRect.width - gap),
    top: clamp(top, gap, viewportHeight - timerRect.height - gap),
    width: timerRect.width,
    height: timerRect.height,
  };
}

function setTimerPosition(rect) {
  const position = getTimerPosition(rect);
  timer.style.left = `${position.left}px`;
  timer.style.top = `${position.top}px`;
  return position;
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

function getDesktopCaptureConstraints(source, captureAudio) {
  const videoMandatory = {
    chromeMediaSource: "desktop",
    chromeMediaSourceId: source.id,
    minWidth: source.width,
    maxWidth: source.width,
    minHeight: source.height,
    maxHeight: source.height,
    maxFrameRate: selectedFps,
  };

  return {
    audio: captureAudio
      ? {
          mandatory: {
            chromeMediaSource: "desktop",
          },
        }
      : false,
    video: {
      mandatory: videoMandatory,
    },
  };
}

async function getDesktopStream(source) {
  if (!includeSystemAudio) {
    return navigator.mediaDevices.getUserMedia(
      getDesktopCaptureConstraints(source, false),
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia(
      getDesktopCaptureConstraints(source, true),
    );
  } catch (error) {
    console.warn("Could not capture PC audio:", error);
    return navigator.mediaDevices.getUserMedia(
      getDesktopCaptureConstraints(source, false),
    );
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
  return navigator.mediaDevices.getUserMedia(getMicrophoneConstraints());
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
  recordButton.disabled = !selectedSaveLocally;

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

async function startRecording() {
  if (!selectedRect || isRecording || !selectedSaveLocally) return;

  isRecording = true;
  recordButton.disabled = true;
  setStatus("Preparing...");
  document.body.classList.add("recording");
  setTimer(selectedDuration, 1);
  const timerRect = setTimerPosition(selectedRect);
  setRecordingControlsDisabled(true);
  setPauseControlPaused(false);
  await window.flingVideo.setRecordingRegion({
    selection: selectedRect,
    timer: timerRect,
  });
  await window.flingVideo.setIgnoreMouseEvents(true);

  let desktopStream = null;
  let microphoneStream = null;
  let croppedStream = null;
  let audioMixer = null;
  let animationFrame = 0;
  let timerAnimationFrame = 0;
  let stopTimeout = 0;
  let shouldSaveRecording = true;
  let postStopAction = "save";
  let isPaused = false;
  let isStopping = false;
  let elapsedBeforePause = 0;
  let startedAt = 0;
  let recordedDurationMs = 0;

  try {
    const source = await window.flingVideo.getScreenSource();
    const streamResults = await Promise.allSettled([
      getDesktopStream(source),
      getMicrophoneStream(),
    ]);

    if (streamResults[0].status === "fulfilled") {
      desktopStream = streamResults[0].value;
    }
    if (streamResults[1].status === "fulfilled") {
      microphoneStream = streamResults[1].value;
    }

    const streamError = streamResults.find(
      (result) => result.status === "rejected",
    );
    if (streamError) throw streamError.reason;

    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = desktopStream;
    await video.play();

    const scaleX = video.videoWidth / window.innerWidth;
    const scaleY = video.videoHeight / window.innerHeight;
    const crop = {
      x: Math.round(selectedRect.left * scaleX),
      y: Math.round(selectedRect.top * scaleY),
      width: Math.round(selectedRect.width * scaleX),
      height: Math.round(selectedRect.height * scaleY),
    };

    const canvas = document.createElement("canvas");
    canvas.width = crop.width;
    canvas.height = crop.height;
    const context = canvas.getContext("2d");
    croppedStream = canvas.captureStream(selectedFps);
    audioMixer = addMixedAudioTracks(croppedStream, [
      desktopStream,
      microphoneStream,
    ]);

    const recorder = new MediaRecorder(
      croppedStream,
      getRecorderOptions(croppedStream.getAudioTracks().length > 0),
    );
    const chunks = [];
    const totalDurationMs = selectedDuration * 1000;

    function drawFrame() {
      context.drawImage(
        video,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      animationFrame = requestAnimationFrame(drawFrame);
    }

    function getElapsedMs(now = performance.now()) {
      if (isPaused) return elapsedBeforePause;
      return elapsedBeforePause + now - startedAt;
    }

    function getRemainingMs(now = performance.now()) {
      return Math.max(
        totalDurationMs - Math.min(getElapsedMs(now), totalDurationMs),
        0,
      );
    }

    function scheduleAutoStop() {
      clearTimeout(stopTimeout);
      const remainingMs = getRemainingMs();

      if (remainingMs <= 0) {
        stopRecording("save");
        return;
      }

      stopTimeout = setTimeout(() => {
        stopRecording("save");
      }, remainingMs);
    }

    function stopRecording(action) {
      if (isStopping || recorder.state === "inactive") return;

      isStopping = true;
      postStopAction = action;
      shouldSaveRecording = action === "save";
      // Measure the real length (pauses excluded) before stopping, so a
      // recording ended early is not reported as the full time limit.
      recordedDurationMs = Math.round(
        Math.min(getElapsedMs(), totalDurationMs),
      );
      setRecordingControlsDisabled(true);
      clearTimeout(stopTimeout);
      recorder.stop();
    }

    function pauseRecording() {
      if (isStopping || isPaused || recorder.state !== "recording") return;

      elapsedBeforePause = getElapsedMs();
      isPaused = true;
      clearTimeout(stopTimeout);
      cancelAnimationFrame(timerAnimationFrame);
      recorder.pause();

      const remainingMs = getRemainingMs();
      setPauseControlPaused(true);
      setTimerPaused(
        Math.ceil(remainingMs / 1000),
        remainingMs / totalDurationMs,
      );
    }

    function resumeRecording() {
      if (isStopping || !isPaused || recorder.state !== "paused") return;

      recorder.resume();
      isPaused = false;
      startedAt = performance.now();
      setPauseControlPaused(false);
      scheduleAutoStop();
      timerAnimationFrame = requestAnimationFrame(updateTimerFrame);
    }

    function togglePauseRecording() {
      if (isPaused) {
        resumeRecording();
      } else {
        pauseRecording();
      }
    }

    function updateTimerFrame(now) {
      const remainingMs = getRemainingMs(now);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const progress = remainingMs / totalDurationMs;

      setTimer(remainingSeconds, progress);

      if (remainingMs <= 0) {
        stopRecording("save");
        return;
      }

      if (!isPaused && recorder.state !== "inactive") {
        timerAnimationFrame = requestAnimationFrame(updateTimerFrame);
      }
    }

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", async () => {
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(timerAnimationFrame);
      clearTimeout(stopTimeout);
      stopStream(desktopStream);
      stopStream(microphoneStream);
      stopStream(croppedStream);
      await closeAudioMixer(audioMixer).catch((error) =>
        console.warn("Could not close audio mixer:", error),
      );

      if (!shouldSaveRecording) {
        await window.flingVideo.setIgnoreMouseEvents(false);
        await window.flingVideo.setRecordingRegion(null);
        activeRecording = null;
        isRecording = false;
        setPauseControlPaused(false);
        setRecordingControlsDisabled(false);

        if (postStopAction === "close") {
          window.flingVideo.closeOverlay();
          return;
        }

        document.body.classList.remove("recording");
        timer.classList.remove("visible");
        recordButton.disabled = false;

        if (postStopAction === "redo") {
          toolbar.classList.remove("visible");
          setStatus("Restarting...");
          startRecording().catch(handleRecordingStartError);
        }

        return;
      }

      try {
        setTimer(0, 0);
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const savedPath = await window.flingVideo.saveRecording(
          await blob.arrayBuffer(),
          recordedDurationMs,
        );
        await window.flingVideo.setIgnoreMouseEvents(false);
        await window.flingVideo.setRecordingRegion(null);
        activeRecording = null;
        isRecording = false;
        setPauseControlPaused(false);
        setTimerSaved();
        setTimeout(() => window.flingVideo.closeOverlay(), 600);
        console.log(`Saved recording to ${savedPath}`);
      } catch (error) {
        console.error("Could not save recording:", error);
        await window.flingVideo.setIgnoreMouseEvents(false);
        await window.flingVideo.setRecordingRegion(null);
        activeRecording = null;
        document.body.classList.remove("recording");
        toolbar.classList.add("visible");
        timer.classList.remove("visible");
        recordButton.disabled = false;
        setRecordingControlsDisabled(false);
        setPauseControlPaused(false);
        setStatus("Could not save recording");
        isRecording = false;
      }
    });

    setRecordingControlsDisabled(false);
    setPauseControlPaused(false);
    activeRecording = {
      cancel: () => stopRecording("close"),
      redo: () => stopRecording("redo"),
      togglePause: () => togglePauseRecording(),
      finish: () => stopRecording("save"),
    };
    drawFrame();
    recorder.start();
    startedAt = performance.now();
    scheduleAutoStop();
    timerAnimationFrame = requestAnimationFrame(updateTimerFrame);
  } catch (error) {
    cancelAnimationFrame(animationFrame);
    cancelAnimationFrame(timerAnimationFrame);
    clearTimeout(stopTimeout);
    stopStream(desktopStream);
    stopStream(microphoneStream);
    stopStream(croppedStream);
    await closeAudioMixer(audioMixer).catch(() => {});
    await window.flingVideo.setIgnoreMouseEvents(false);
    await window.flingVideo.setRecordingRegion(null);
    activeRecording = null;
    document.body.classList.remove("recording");
    toolbar.classList.add("visible");
    timer.classList.remove("visible");
    recordButton.disabled = false;
    setRecordingControlsDisabled(false);
    setPauseControlPaused(false);
    isRecording = false;
    throw error;
  }
}

async function handleRecordingStartError(error) {
  console.error("Could not start recording:", error);
  await window.flingVideo.setIgnoreMouseEvents(false);
  await window.flingVideo.setRecordingRegion(null);
  activeRecording = null;
  document.body.classList.remove("recording");
  toolbar.classList.add("visible");
  timer.classList.remove("visible");
  recordButton.disabled = false;
  setRecordingControlsDisabled(false);
  setPauseControlPaused(false);
  const isPermissionError = /NotAllowed|Permission|denied|Failed to get sources/i.test(
    `${error?.name} ${error?.message}`,
  );
  setStatus(
    isPermissionError
      ? "Screen Recording permission is needed"
      : "Could not start recording",
  );
  isRecording = false;
}

function startRecordingFromControls() {
  if (isDragging || isRecording || recordButton.disabled) return;
  if (!selectedSaveLocally) return;

  playRecordSound();
  startRecording().catch(handleRecordingStartError);
}

function isKeyboardControlTarget(target) {
  return target?.closest?.("button, input, select, textarea, [contenteditable]");
}

overlay.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || isRecording) return;
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
    microphoneButton.disabled = false;
    updateAudioControls();
  }
});

microphoneSelect.addEventListener("change", () => {
  selectedMicrophoneId = microphoneSelect.value;
});

discardRecordingButton.addEventListener("click", () => {
  activeRecording?.cancel();
});

redoRecordingButton.addEventListener("click", () => {
  activeRecording?.redo();
});

pauseRecordingButton.addEventListener("click", () => {
  activeRecording?.togglePause();
});

finishRecordingButton.addEventListener("click", () => {
  activeRecording?.finish();
});

recordButton.addEventListener("click", startRecordingFromControls);

cancelButton.addEventListener("click", () => {
  window.flingVideo.closeOverlay();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !isRecording) {
    window.flingVideo.closeOverlay();
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
  updateAudioControls();
  updateSaveLocalControl();
}

initializeRecordingOverlay();

navigator.mediaDevices.addEventListener?.("devicechange", () => {
  populateMicrophones();
});
