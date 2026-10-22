/* =========================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Camera + Switch Camera + Upload + Crop
   Six Photostrip Styles + Supabase Gallery + Guestbook
========================================================= */

/* =========================================================
   1. SUPABASE CONFIGURATION
========================================================= */

const SUPABASE_URL =
  "https://hxaudbnyagbfhhwuawua.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const STORAGE_BUCKET = "wedding-media";
const PHOTOS_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

const COUPLE_NAMES = "SYAHLEN & ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

const supabaseClient =
  window.supabase?.createClient
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      )
    : null;

/* =========================================================
   2. HTML ELEMENTS
========================================================= */

const homeButton = document.getElementById("homeButton");

const cameraPreview = document.getElementById("cameraPreview");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const startCameraButton = document.getElementById("startCameraButton");
const switchCameraButton = document.getElementById("switchCameraButton");
const captureButton = document.getElementById("captureButton");
const cameraCounter = document.getElementById("cameraCounter");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNumber = document.getElementById("countdownNumber");

const cameraModeButton = document.getElementById("cameraModeButton");
const uploadModeButton = document.getElementById("uploadModeButton");
const cameraPanel = document.getElementById("cameraPanel");
const uploadPanel = document.getElementById("uploadPanel");
const photoUploadInput = document.getElementById("photoUploadInput");
const uploadStatus = document.getElementById("uploadStatus");

const photoSlots = document.getElementById("photoSlots");
const retakeAllButton = document.getElementById("retakeAllButton");

const templateSelector = document.getElementById("templateSelector");
const photostripPreview = document.getElementById("photostripPreview");
const createStripButton = document.getElementById("createStripButton");

const boothView = document.getElementById("boothView");
const resultView = document.getElementById("resultView");
const galleryView = document.getElementById("galleryView");
const guestbookView = document.getElementById("guestbookView");

const photostripCanvas = document.getElementById("photostripCanvas");
const downloadStripButton = document.getElementById("downloadStripButton");
const saveStripButton = document.getElementById("saveStripButton");
const makeAnotherButton = document.getElementById("makeAnotherButton");
const resultStatus = document.getElementById("resultStatus");

const galleryGrid = document.getElementById("galleryGrid");

const guestbookForm = document.getElementById("guestbookForm");
const guestNameInput = document.getElementById("guestName");
const guestMessageInput = document.getElementById("guestMessage");
const submitGuestbookButton =
  document.getElementById("submitGuestbookButton");
const guestbookStatus = document.getElementById("guestbookStatus");
const guestbookMessages = document.getElementById("guestbookMessages");

/* =========================================================
   3. APPLICATION STATE
========================================================= */

let cameraStream = null;
let currentFacingMode = "user";
let currentCameraDeviceId = null;
let availableCameras = [];

let cameraStarting = false;
let switchingCamera = false;
let captureInProgress = false;
let uploadInProgress = false;
let savingStrip = false;
let submittingGuestbook = false;

let currentPhotoSource = "camera";
let currentPhotoIndex = 0;

let photoData = [null, null, null];

let selectedTemplate = "film";

let completedStripBlob = null;
let completedStripDataUrl = null;

/* =========================================================
   4. TEMPLATE DEFINITIONS
========================================================= */

const TEMPLATE_DETAILS = {
  film: {
    name: "Classic Film",
    title: `${COUPLE_NAMES} ♥`,
    footer: WEDDING_DATE,
    background: "#222222",
    border: "#222222",
    text: "#464343",
    photoBorder: "#555555",
    accent: "#ffffff",
    font: "700 34px Arial, sans-serif",
    footerFont: "20px Arial, sans-serif"
  },

  minimalist: {
    name: "Minimalist",
    title: "SYAHLEN ♥ ATIQAH",
    footer: WEDDING_DATE,
    background: "#ffffff",
    border: "#e7ded9",
    text: "#443536",
    photoBorder: "#f0e8e4",
    accent: "#c7b9b3",
    font: "600 31px Georgia, serif",
    footerFont: "19px Arial, sans-serif"
  },

  doodle: {
    name: "Love Doodle",
    title: "♡ LOVE ♡",
    footer: "FOREVER & ALWAYS",
    background: "#ffffff",
    border: "#f0d9df",
    text: "#2a75a7",
    photoBorder: "#9e9dda",
    accent: "#d4bdc3",
    font: "700 34px Arial, sans-serif",
    footerFont: "19px Arial, sans-serif"
  },

  elegant: {
    name: "Elegant",
    title: "SYAHLEN & ATIQAH",
    footer: WEDDING_DATE,
    background: "#fffdf9",
    border: "#c8ad7f",
    text: "#8a6d43",
    photoBorder: "#dfd1b6",
    accent: "#b99a68",
    font: "600 30px Georgia, serif",
    footerFont: "19px Georgia, serif"
  },

  chalkboard: {
    name: "Chalkboard",
    title: "D - DAY · 08.11.2026",
    footer: "♥ S & A ♥",
    background: "#080808",
    border: "#292929",
    text: "#f7f0e5",
    photoBorder: "#e9e2d6",
    accent: "#f7f0e5",
    font: "700 31px Arial, cursive",
    footerFont: "20px Georgia, serif"
  },

  blackwhite: {
    name: "Black & White",
    title: "LOVE IN B&W",
    footer: "S & A · 08.11.2026",
    background: "#ffffff",
    border: "#111111",
    text: "#111111",
    photoBorder: "#555555",
    accent: "#222222",
    font: "700 34px Arial, sans-serif",
    footerFont: "19px Arial, sans-serif"
  }
};

/* =========================================================
   5. GENERAL HELPERS
========================================================= */

function setStatus(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#a12e42" : "";
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => {
      reject(new Error("Unable to read this image."));
    };

    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => {
      reject(new Error("Unable to load this image."));
    };

    image.src = source;
  });
}

function makeMessage(text, className = "empty-state") {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = text;
  return element;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function invalidateCompletedStrip() {
  completedStripBlob = null;
  completedStripDataUrl = null;
}

function getViewElements() {
  return {
    booth: boothView,
    result: resultView,
    gallery: galleryView,
    guestbook: guestbookView
  };
}

/* =========================================================
   6. NAVIGATION
========================================================= */

function showView(viewName) {
  const views = getViewElements();

  if (!views[viewName]) return;

  Object.entries(views).forEach(([name, element]) => {
    if (!element) return;

    const isActive = name === viewName;

    element.hidden = !isActive;
    element.classList.toggle("active", isActive);
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    const isActive = button.dataset.view === viewName;

    button.classList.toggle("active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (viewName !== "booth") {
    stopCamera();
  }

  if (viewName === "gallery") {
    loadGallery();
  }

  if (viewName === "guestbook") {
    loadGuestbook();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

homeButton?.addEventListener("click", event => {
  event.preventDefault();
  showView("booth");
});

/* =========================================================
   7. CAMERA HELPERS
========================================================= */

async function getAvailableCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    availableCameras = [];
    return [];
  }

  try {
    const devices =
      await navigator.mediaDevices.enumerateDevices();

    availableCameras = devices.filter(
      device => device.kind === "videoinput"
    );

    return availableCameras;
  } catch (error) {
    console.warn("Unable to list cameras:", error);
    availableCameras = [];
    return [];
  }
}

function cameraLabelType(device) {
  const label = (device.label || "").toLowerCase();

  if (/front|user|facetime|selfie/.test(label)) {
    return "user";
  }

  if (/back|rear|environment|world/.test(label)) {
    return "environment";
  }

  return "unknown";
}

function buildCameraConstraints(facingMode) {
  return {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 960 },
      aspectRatio: { ideal: 4 / 3 }
    }
  };
}

async function requestCameraByFacingMode(facingMode) {
  return navigator.mediaDevices.getUserMedia(
    buildCameraConstraints(facingMode)
  );
}

async function requestCameraByDeviceId(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 960 },
      aspectRatio: { ideal: 4 / 3 }
    }
  });
}

function stopStream(stream) {
  if (!stream) return;

  stream.getTracks().forEach(track => {
    try {
      track.stop();
    } catch (error) {
      console.warn("Unable to stop camera track:", error);
    }
  });
}

function stopCamera() {
  const oldStream = cameraStream;
  cameraStream = null;

  if (cameraPreview) {
    cameraPreview.pause();
    cameraPreview.srcObject = null;
    cameraPreview.style.transform = "";
  }

  stopStream(oldStream);

  if (captureButton) {
    captureButton.disabled = true;
  }
}

function applyCameraPreviewMirror() {
  if (!cameraPreview) return;

  cameraPreview.style.transform =
    currentFacingMode === "user"
      ? "scaleX(-1)"
      : "none";
}

/* =========================================================
   8. START CAMERA
========================================================= */

async function startCamera() {
  if (cameraStarting || switchingCamera) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    alert(
      "Camera access is unavailable. Open this website using HTTPS or choose Upload photos."
    );
    return;
  }

  if (cameraStream && cameraPreview?.srcObject) {
    return;
  }

  cameraStarting = true;

  if (startCameraButton) {
    startCameraButton.disabled = true;
    startCameraButton.textContent = "Starting camera...";
  }

  if (switchCameraButton) {
    switchCameraButton.disabled = true;
  }

  try {
    let newStream = null;

    try {
      newStream = await requestCameraByFacingMode(
        currentFacingMode
      );
    } catch (error) {
      console.warn("Facing mode request failed:", error);
    }

    if (!newStream) {
      const cameras = await getAvailableCameras();

      const matchingCamera = cameras.find(
        device =>
          cameraLabelType(device) === currentFacingMode
      );

      if (matchingCamera) {
        try {
          newStream = await requestCameraByDeviceId(
            matchingCamera.deviceId
          );

          currentCameraDeviceId =
            matchingCamera.deviceId;
        } catch (error) {
          console.warn("Matching camera request failed:", error);
        }
      }
    }

    if (!newStream) {
      const cameras = await getAvailableCameras();

      if (cameras.length) {
        newStream = await requestCameraByDeviceId(
          cameras[0].deviceId
        );

        currentCameraDeviceId = cameras[0].deviceId;
      }
    }

    if (!newStream) {
      throw new Error("No compatible camera was found.");
    }

    const track = newStream.getVideoTracks()[0];
    const settings = track?.getSettings?.() || {};

    if (settings.deviceId) {
      currentCameraDeviceId = settings.deviceId;
    }

    if (
      settings.facingMode === "user" ||
      settings.facingMode === "environment"
    ) {
      currentFacingMode = settings.facingMode;
    }

    cameraStream = newStream;
    cameraPreview.srcObject = newStream;
    cameraPreview.autoplay = true;
    cameraPreview.playsInline = true;
    cameraPreview.muted = true;

    await new Promise((resolve, reject) => {
      if (
        cameraPreview.readyState >= 2 &&
        cameraPreview.videoWidth > 0
      ) {
        resolve();
        return;
      }

      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(
          new Error("The camera preview could not be loaded.")
        );
      };

      const cleanup = () => {
        cameraPreview.removeEventListener(
          "loadedmetadata",
          onReady
        );

        cameraPreview.removeEventListener(
          "error",
          onError
        );
      };

      cameraPreview.addEventListener(
        "loadedmetadata",
        onReady,
        { once: true }
      );

      cameraPreview.addEventListener(
        "error",
        onError,
        { once: true }
      );
    });

    await cameraPreview.play();

    applyCameraPreviewMirror();

    if (cameraPlaceholder) {
      cameraPlaceholder.hidden = true;
    }

    if (captureButton) {
      captureButton.disabled = currentPhotoIndex >= 3;
      captureButton.textContent =
        currentPhotoIndex >= 3
          ? "All photos captured"
          : "Take photo";
    }

    await getAvailableCameras();

    if (switchCameraButton) {
      switchCameraButton.disabled =
        availableCameras.length < 2;
    }
  } catch (error) {
    console.error("Camera start failed:", error);

    stopCamera();

    if (cameraPlaceholder) {
      cameraPlaceholder.hidden = false;
    }

    let message =
      "Unable to start the camera. ";

    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      message +=
        "Please allow camera access in your browser settings.";
    } else if (error.name === "NotFoundError") {
      message +=
        "No camera was found. You can upload photos instead.";
    } else if (error.name === "NotReadableError") {
      message +=
        "Your camera may be in use by another application.";
    } else {
      message +=
        error.message ||
        "Check camera permissions and try again.";
    }

    alert(message);
  } finally {
    cameraStarting = false;

    if (startCameraButton) {
      startCameraButton.disabled = false;
      startCameraButton.textContent = "Start camera";
    }

    if (switchCameraButton) {
      switchCameraButton.disabled =
        availableCameras.length < 2;
    }
  }
}

startCameraButton?.addEventListener("click", startCamera);

/* =========================================================
   9. SWITCH CAMERA
   Opens the replacement stream before releasing the old one.
========================================================= */

// =========================================================
// CAMERA SWITCHING — KEEP PREVIEW AT 4:3
// Syahlen & Atiqah Wedding Digital Photobooth
// =========================================================

async function switchCamera() {
  if (switchingCamera || cameraStarting) return;

  switchingCamera = true;

  if (switchCameraButton) {
    switchCameraButton.disabled = true;
  }

  try {
    // Remember whether the camera was already running.
    const cameraWasRunning = Boolean(cameraStream);

    // Determine the next camera.
    const nextFacingMode =
      currentFacingMode === "user" ? "environment" : "user";

    // Stop the previous camera stream.
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }

    if (cameraPreview) {
      cameraPreview.pause();
      cameraPreview.srcObject = null;

      // Keep the same preview element and its 4:3 frame.
      cameraPreview.style.width = "100%";
      cameraPreview.style.height = "100%";
      cameraPreview.style.aspectRatio = "4 / 3";
      cameraPreview.style.objectFit = "cover";
      cameraPreview.style.objectPosition = "center center";
    }

    // Request the opposite camera.
    let stream;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
    } catch (firstError) {
      // Fall back to the browser's default camera if needed.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true
      });
    }

    cameraStream = stream;

    const videoTrack = stream.getVideoTracks()[0];

    if (videoTrack) {
      const settings = videoTrack.getSettings();

      if (settings.facingMode) {
        currentFacingMode = settings.facingMode;
      } else {
        currentFacingMode = nextFacingMode;
      }

      currentCameraDeviceId = settings.deviceId || null;
    } else {
      currentFacingMode = nextFacingMode;
    }

    // Attach the new stream to the existing video element.
    if (cameraPreview) {
      cameraPreview.srcObject = stream;
      cameraPreview.style.display = "block";
      cameraPreview.style.width = "100%";
      cameraPreview.style.height = "100%";
      cameraPreview.style.aspectRatio = "4 / 3";
      cameraPreview.style.objectFit = "cover";
      cameraPreview.style.objectPosition = "center center";

      // Wait until the new camera dimensions are available.
      await new Promise((resolve, reject) => {
        if (cameraPreview.readyState >= 1) {
          resolve();
          return;
        }

        const onLoaded = () => {
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error("The camera preview could not be loaded."));
        };

        const cleanup = () => {
          cameraPreview.removeEventListener(
            "loadedmetadata",
            onLoaded
          );
          cameraPreview.removeEventListener("error", onError);
        };

        cameraPreview.addEventListener(
          "loadedmetadata",
          onLoaded,
          { once: true }
        );

        cameraPreview.addEventListener(
          "error",
          onError,
          { once: true }
        );
      });

      await cameraPreview.play();

      // Mirror the front-facing camera only.
      cameraPreview.style.transform =
        currentFacingMode === "user" ? "scaleX(-1)" : "none";
    }

    if (cameraPlaceholder) {
      cameraPlaceholder.hidden = true;
    }

    if (startCameraButton) {
      startCameraButton.textContent = "Camera ready";
    }

    if (captureButton) {
      captureButton.disabled = false;
    }

    console.log(
      "Camera switched successfully:",
      currentFacingMode
    );
  } catch (error) {
    console.error("Unable to switch camera:", error);

    setStatus(
      document.getElementById("cameraStatus"),
      "Unable to switch camera. Please check camera permissions.",
      true
    );
  } finally {
    switchingCamera = false;

    if (switchCameraButton) {
      switchCameraButton.disabled = false;
    }
  }
}

// Connect the switch-camera button.
if (switchCameraButton) {
  switchCameraButton.removeEventListener("click", switchCamera);
  switchCameraButton.addEventListener("click", switchCamera);
}

switchCameraButton?.addEventListener(
  "click",
  switchCamera
);

/* =========================================================
   10. CAMERA / UPLOAD MODE
========================================================= */

function setPhotoSource(source) {
  currentPhotoSource = source;

  const useCamera = source === "camera";

  cameraModeButton?.classList.toggle(
    "active",
    useCamera
  );

  uploadModeButton?.classList.toggle(
    "active",
    !useCamera
  );

  if (cameraPanel) {
    cameraPanel.hidden = !useCamera;
  }

  if (uploadPanel) {
    uploadPanel.hidden = useCamera;
  }

  if (useCamera) {
    startCamera();
  } else {
    stopCamera();
  }
}

cameraModeButton?.addEventListener("click", () => {
  setPhotoSource("camera");
});

uploadModeButton?.addEventListener("click", () => {
  setPhotoSource("upload");
});

/* =========================================================
   11. COUNTDOWN
========================================================= */

async function runCountdown(seconds = 3) {
  if (!countdownOverlay || !countdownNumber) return;

  countdownOverlay.hidden = false;

  for (let number = seconds; number > 0; number--) {
    countdownNumber.textContent = String(number);
    await delay(1000);
  }

  countdownNumber.textContent = "♥";

  await delay(350);

  countdownOverlay.hidden = true;
}

/* =========================================================
   12. CAMERA CAPTURE
   The captured image is cropped to the same 4:3 ratio
   as the camera preview.
========================================================= */

function captureCurrentFrame() {
  if (
    !cameraPreview ||
    !cameraStream ||
    cameraPreview.readyState < 2 ||
    !cameraPreview.videoWidth ||
    !cameraPreview.videoHeight
  ) {
    throw new Error(
      "The camera is not ready. Please try again."
    );
  }

  const sourceWidth = cameraPreview.videoWidth;
  const sourceHeight = cameraPreview.videoHeight;

  const outputWidth = 1200;
  const outputHeight = 900;

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = outputWidth / outputHeight;

  let cropX = 0;
  let cropY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else if (sourceRatio < targetRatio) {
    cropHeight = sourceWidth / targetRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  const canvas = document.createElement("canvas");

  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to capture this photo.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (currentFacingMode === "user") {
    context.translate(outputWidth, 0);
    context.scale(-1, 1);
  }

  context.drawImage(
    cameraPreview,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return canvas.toDataURL("image/jpeg", 0.94);
}

captureButton?.addEventListener("click", async () => {
  if (
    captureInProgress ||
    currentPhotoIndex >= 3 ||
    !cameraStream
  ) {
    return;
  }

  captureInProgress = true;
  captureButton.disabled = true;

  try {
    await runCountdown(3);

    if (!cameraStream) {
      throw new Error("The camera was disconnected.");
    }

    photoData[currentPhotoIndex] =
      captureCurrentFrame();

    currentPhotoIndex++;

    invalidateCompletedStrip();
    updatePhotoSlots();
    updatePhotostripPreview();
    updateCameraCounter();
    updateCreateButton();

    if (currentPhotoIndex >= 3) {
      captureButton.textContent = "All photos captured";
      stopCamera();
    } else {
      captureButton.textContent = "Take photo";
    }
  } catch (error) {
    console.error("Capture error:", error);

    alert(
      error.message ||
      "Unable to capture the photo. Please try again."
    );
  } finally {
    captureInProgress = false;

    if (
      captureButton &&
      currentPhotoIndex < 3 &&
      cameraStream
    ) {
      captureButton.disabled = false;
    }

    if (countdownOverlay) {
      countdownOverlay.hidden = true;
    }
  }
});

/* =========================================================
   13. CAMERA COUNTER
========================================================= */

function updateCameraCounter() {
  if (!cameraCounter) return;

  const total = photoData.filter(Boolean).length;
  cameraCounter.textContent = `${total} / 3`;
}

/* =========================================================
   14. CROP EDITOR
========================================================= */

let cropImage = null;
let cropZoom = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropDragging = false;
let cropStartX = 0;
let cropStartY = 0;
let cropStartOffsetX = 0;
let cropStartOffsetY = 0;
let cropResolver = null;
let cropRejecter = null;

function installCropEditor() {
  if (document.getElementById("photoCropModal")) return;

  const style = document.createElement("style");

  style.id = "photoCropStyles";

  style.textContent = `
    #photoCropModal {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(35, 10, 16, .78);
      backdrop-filter: blur(5px);
      overflow-y: auto;
    }

    #photoCropModal[hidden] {
      display: none !important;
    }

    .crop-editor-card {
      width: min(100%, 440px);
      max-height: calc(100dvh - 36px);
      overflow-y: auto;
      padding: 22px;
      border-radius: 20px;
      background: #fffaf6;
      color: #4a101c;
      font-family: inherit;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
    }

    .crop-editor-card h2 {
      margin: 0 0 8px;
      font-size: 25px;
      text-align: center;
    }

    .crop-editor-description {
      margin: 0 0 16px;
      color: #806e6b;
      font-size: 14px;
      line-height: 1.5;
      text-align: center;
    }

    #photoCropCanvas {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 4 / 3;
      background: #eadfd9;
      border: 3px solid #d8b9b6;
      border-radius: 10px;
      touch-action: none;
      cursor: grab;
    }

    .crop-zoom-label {
      display: flex;
      justify-content: space-between;
      margin: 18px 0 8px;
      font-size: 14px;
      font-weight: 600;
    }

    #photoCropZoom {
      width: 100%;
      accent-color: #4a101c;
    }

    .crop-editor-hint {
      margin: 10px 0 18px;
      color: #806e6b;
      font-size: 12px;
      text-align: center;
    }

    .crop-editor-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .crop-editor-actions button {
      min-height: 46px;
      padding: 11px;
      border: 1px solid #4a101c;
      border-radius: 10px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    #photoCropCancel {
      color: #4a101c;
      background: transparent;
    }

    #photoCropConfirm {
      color: #fff;
      background: #4a101c;
    }
  `;

  document.head.appendChild(style);

  const modal = document.createElement("div");

  modal.id = "photoCropModal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "photoCropHeading");

  modal.innerHTML = `
    <div class="crop-editor-card">
      <h2 id="photoCropHeading">Adjust your photo</h2>

      <p class="crop-editor-description">
        Drag your photo and adjust the zoom to fit the 4:3 frame.
      </p>

      <canvas
        id="photoCropCanvas"
        width="800"
        height="600"
      ></canvas>

      <div class="crop-zoom-label">
        <label for="photoCropZoom">Zoom</label>
        <span id="photoCropZoomValue">100%</span>
      </div>

      <input
        id="photoCropZoom"
        type="range"
        min="1"
        max="3"
        step="0.01"
        value="1"
      >

      <p class="crop-editor-hint">
        Drag the picture to adjust its position.
      </p>

      <div class="crop-editor-actions">
        <button type="button" id="photoCropCancel">
          Cancel
        </button>

        <button type="button" id="photoCropConfirm">
          Use this crop →
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const canvas = document.getElementById("photoCropCanvas");

  canvas.addEventListener("pointerdown", event => {
    if (!cropImage) return;

    cropDragging = true;
    cropStartX = event.clientX;
    cropStartY = event.clientY;
    cropStartOffsetX = cropOffsetX;
    cropStartOffsetY = cropOffsetY;

    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!cropDragging || !cropImage) return;

    const rect = canvas.getBoundingClientRect();

    cropOffsetX =
      cropStartOffsetX +
      (event.clientX - cropStartX) *
        canvas.width / rect.width;

    cropOffsetY =
      cropStartOffsetY +
      (event.clientY - cropStartY) *
        canvas.height / rect.height;

    clampCropPosition();
    drawCropEditor();
  });

  canvas.addEventListener("pointerup", () => {
    cropDragging = false;
  });

  canvas.addEventListener("pointercancel", () => {
    cropDragging = false;
  });

  document
    .getElementById("photoCropZoom")
    .addEventListener("input", event => {
      cropZoom = Number(event.target.value) || 1;

      document.getElementById(
        "photoCropZoomValue"
      ).textContent = `${Math.round(cropZoom * 100)}%`;

      clampCropPosition();
      drawCropEditor();
    });

  document
    .getElementById("photoCropCancel")
    .addEventListener("click", cancelPhotoCropper);

  document
    .getElementById("photoCropConfirm")
    .addEventListener("click", confirmCurrentCrop);

  modal.addEventListener("click", event => {
    if (event.target === modal) {
      cancelPhotoCropper();
    }
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      !modal.hidden
    ) {
      cancelPhotoCropper();
    }
  });
}

function getCropDimensions() {
  const canvas = document.getElementById("photoCropCanvas");

  if (!canvas || !cropImage) return null;

  const scale = Math.max(
    canvas.width / cropImage.naturalWidth,
    canvas.height / cropImage.naturalHeight
  ) * cropZoom;

  return {
    canvas,
    scale,
    width: cropImage.naturalWidth * scale,
    height: cropImage.naturalHeight * scale
  };
}

function clampCropPosition() {
  const dimensions = getCropDimensions();

  if (!dimensions) return;

  const { canvas, width, height } = dimensions;

  const maxX = Math.max(0, (width - canvas.width) / 2);
  const maxY = Math.max(0, (height - canvas.height) / 2);

  cropOffsetX = Math.max(-maxX, Math.min(maxX, cropOffsetX));
  cropOffsetY = Math.max(-maxY, Math.min(maxY, cropOffsetY));
}

function drawCropEditor() {
  const dimensions = getCropDimensions();

  if (!dimensions) return;

  const { canvas, width, height } = dimensions;
  const context = canvas.getContext("2d");

  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);

  const x = (canvas.width - width) / 2 + cropOffsetX;
  const y = (canvas.height - height) / 2 + cropOffsetY;

  context.save();
  context.beginPath();
  context.rect(0, 0, canvas.width, canvas.height);
  context.clip();

  context.drawImage(cropImage, x, y, width, height);

  context.restore();
}

function openPhotoCropper(dataURL, photoNumber) {
  installCropEditor();

  return new Promise(async (resolve, reject) => {
    try {
      cropImage = await loadImage(dataURL);

      cropZoom = 1;
      cropOffsetX = 0;
      cropOffsetY = 0;

      cropResolver = resolve;
      cropRejecter = reject;

      document.getElementById(
        "photoCropHeading"
      ).textContent = `Adjust photo ${photoNumber} of 3`;

      document.getElementById("photoCropZoom").value = "1";

      document.getElementById(
        "photoCropZoomValue"
      ).textContent = "100%";

      document.getElementById(
        "photoCropModal"
      ).hidden = false;

      drawCropEditor();

      document.getElementById("photoCropConfirm").focus();
    } catch (error) {
      reject(error);
    }
  });
}

function confirmCurrentCrop() {
  const dimensions = getCropDimensions();

  if (!dimensions || !cropImage || !cropResolver) return;

  const { canvas, scale, width, height } = dimensions;

  const x = (canvas.width - width) / 2 + cropOffsetX;
  const y = (canvas.height - height) / 2 + cropOffsetY;

  const output = document.createElement("canvas");

  output.width = 1200;
  output.height = 900;

  const context = output.getContext("2d");

  if (!context) {
    cancelPhotoCropper();
    return;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(
    cropImage,
    -x / scale,
    -y / scale,
    canvas.width / scale,
    canvas.height / scale,
    0,
    0,
    output.width,
    output.height
  );

  const result = output.toDataURL("image/jpeg", 0.94);

  const resolve = cropResolver;

  closeCropModal();
  resolve(result);
}

function cancelPhotoCropper() {
  const reject = cropRejecter;

  closeCropModal();

  if (reject) {
    reject(new Error("Photo cropping was cancelled."));
  }
}

function closeCropModal() {
  const modal = document.getElementById("photoCropModal");

  if (modal) modal.hidden = true;

  cropImage = null;
  cropDragging = false;
  cropResolver = null;
  cropRejecter = null;
}

/* =========================================================
   15. UPLOAD AND CROP THREE PHOTOS
========================================================= */

photoUploadInput?.addEventListener("change", async event => {
  if (uploadInProgress) return;

  const files = Array.from(event.target.files || []);

  if (files.length !== 3) {
    setStatus(
      uploadStatus,
      "Please select exactly three photos.",
      true
    );

    photoUploadInput.value = "";
    return;
  }

  if (files.some(file => !file.type.startsWith("image/"))) {
    setStatus(
      uploadStatus,
      "Please select image files only.",
      true
    );

    photoUploadInput.value = "";
    return;
  }

  if (files.some(file => file.size > 15 * 1024 * 1024)) {
    setStatus(
      uploadStatus,
      "Each photo must be smaller than 15 MB.",
      true
    );

    photoUploadInput.value = "";
    return;
  }

  uploadInProgress = true;
  photoUploadInput.disabled = true;

  stopCamera();

  try {
    const originals = [];

    for (const file of files) {
      originals.push(await readFileAsDataURL(file));
    }

    const croppedPhotos = [];

    for (let index = 0; index < originals.length; index++) {
      setStatus(
        uploadStatus,
        `Adjusting photo ${index + 1} of 3...`
      );

      const cropped = await openPhotoCropper(
        originals[index],
        index + 1
      );

      croppedPhotos.push(cropped);
    }

    photoData = croppedPhotos;
    currentPhotoIndex = 3;

    invalidateCompletedStrip();

    updatePhotoSlots();
    updatePhotostripPreview();
    updateCameraCounter();
    updateCreateButton();

    setStatus(
      uploadStatus,
      "All three photos are ready!"
    );
  } catch (error) {
    console.warn("Upload or cropping cancelled:", error);

    setStatus(
      uploadStatus,
      error.message || "Unable to prepare your photos.",
      true
    );
  } finally {
    closeCropModal();

    uploadInProgress = false;
    photoUploadInput.disabled = false;
    photoUploadInput.value = "";
  }
});

/* =========================================================
   16. PHOTO SLOTS
========================================================= */

function updatePhotoSlots() {
  for (let index = 0; index < 3; index++) {
    const image = document.getElementById(
      `photoSlot${index + 1}`
    );

    const slot = document.querySelector(
      `.photo-slot[data-slot="${index}"]`
    );

    const placeholder = slot?.querySelector(
      ".slot-placeholder"
    );

    if (!image) continue;

    if (photoData[index]) {
      image.src = photoData[index];
      image.hidden = false;

      if (placeholder) placeholder.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;

      if (placeholder) placeholder.hidden = false;
    }
  }
}

function updateCreateButton() {
  if (!createStripButton) return;

  createStripButton.disabled =
    !photoData.every(Boolean);
}

function clearCurrentPhotos() {
  photoData = [null, null, null];
  currentPhotoIndex = 0;

  invalidateCompletedStrip();

  if (photoUploadInput) {
    photoUploadInput.value = "";
  }

  if (captureButton) {
    captureButton.textContent = "Take photo";
    captureButton.disabled = true;
  }

  setStatus(uploadStatus, "No photos selected yet.");
  setStatus(resultStatus, "");

  updatePhotoSlots();
  updatePhotostripPreview();
  updateCameraCounter();
  updateCreateButton();
}

retakeAllButton?.addEventListener("click", () => {
  clearCurrentPhotos();

  if (currentPhotoSource === "camera") {
    startCamera();
  }
});

/* =========================================================
   17. TEMPLATE SELECTOR
========================================================= */

function setSelectedTemplate(templateName) {
  if (!TEMPLATE_DETAILS[templateName]) return;

  selectedTemplate = templateName;

  document.querySelectorAll(".template-option").forEach(button => {
    const active =
      button.dataset.template === templateName;

    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  invalidateCompletedStrip();
  updatePhotostripPreview();
}

templateSelector?.addEventListener("click", event => {
  const button = event.target.closest(".template-option");

  if (!button) return;

  setSelectedTemplate(button.dataset.template);
});

/* =========================================================
   18. LIVE PHOTOSTRIP PREVIEW
========================================================= */

function updatePhotostripPreview() {
  if (!photostripPreview) return;

  const details = TEMPLATE_DETAILS[selectedTemplate];

  photostripPreview.className =
    `photostrip-preview template-${selectedTemplate}`;

  const title = photostripPreview.querySelector(
    ".strip-preview-title"
  );

  const footer = photostripPreview.querySelector(
    ".strip-preview-footer"
  );

  if (title) {
    title.textContent = details.title;
  }

  if (footer) {
    footer.textContent = details.footer;
  }

  for (let index = 0; index < 3; index++) {
    const image = document.getElementById(
      `stripPreviewPhoto${index + 1}`
    );

    const frame = photostripPreview.querySelector(
      `[data-preview-slot="${index}"]`
    );

    const placeholder = frame?.querySelector("span");

    if (!image || !frame) continue;

    if (photoData[index]) {
      image.src = photoData[index];
      image.hidden = false;

      if (placeholder) placeholder.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;

      if (placeholder) placeholder.hidden = false;
    }
  }
}

/* =========================================================
   19. CANVAS IMAGE HELPERS
========================================================= */

function drawCoverImage(context, image, x, y, width, height) {
  const sourceWidth =
    image.naturalWidth || image.width;

  const sourceHeight =
    image.naturalHeight || image.height;

  const scale = Math.max(
    width / sourceWidth,
    height / sourceHeight
  );

  const cropWidth = width / scale;
  const cropHeight = height / scale;

  const cropX = (sourceWidth - cropWidth) / 2;
  const cropY = (sourceHeight - cropHeight) / 2;

  context.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    x,
    y,
    width,
    height
  );
}

function drawCenteredText(
  context,
  text,
  x,
  y,
  maxWidth,
  font,
  color
) {
  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = String(text).split("\n");
  const lineHeight = parseInt(font.match(/\d+/)?.[0] || "30", 10) * 1.25;

  lines.forEach((line, index) => {
    context.fillText(
      line,
      x,
      y + index * lineHeight,
      maxWidth
    );
  });

  context.restore();
}

function drawDecorations(context, template, width, height) {
  const colors = TEMPLATE_DETAILS[template];

  context.save();
  context.fillStyle = colors.accent;
  context.font = "27px Georgia, serif";
  context.textAlign = "center";

  if (template === "minimalist") {
    context.fillText("✦  ·  ♡", width * 0.18, height * 0.22);
    context.fillText("♡  ·  ✧", width * 0.82, height * 0.80);
  } else if (template === "doodle") {
    context.fillText("♡  ✦  ♡", width * 0.18, height * 0.22);
    context.fillText("✧  ♡  ✿", width * 0.82, height * 0.80);
  } else if (template === "chalkboard") {
    context.fillText("✧  ♡  ✦", width * 0.18, height * 0.22);
    context.fillText("✦  ♡  ✧", width * 0.82, height * 0.80);
  } else if (template === "elegant") {
    context.fillText("✧  ·  ❦", width * 0.18, height * 0.22);
    context.fillText("❦  ·  ✧", width * 0.82, height * 0.80);
  }

  context.restore();
}

/* =========================================================
   20. RENDER THE FINAL PHOTOSTRIP
   Slimmer, longer output with smaller download size
========================================================= */

async function renderPhotostrip() {
  if (!photoData.every(Boolean)) {
    throw new Error("Please add all three photos first.");
  }

  if (!photostripCanvas) {
    throw new Error("The photostrip canvas is missing.");
  }

  const details = TEMPLATE_DETAILS[selectedTemplate];

  const images = await Promise.all(
    photoData.map(source => loadImage(source))
  );

  const canvas = photostripCanvas;

  // Smaller width and a taller overall strip.
  const width = 480;

  const sidePadding = 28;
  const innerWidth = width - sidePadding * 2;

  // Keep the individual photo frames in 4:3 ratio.
  const photoWidth = innerWidth;
  const photoHeight = Math.round(photoWidth * 3 / 4);

  const photoGap = 16;
  const topPadding = 28;
  const titleHeight = 68;
  const footerHeight = 115;
  const bottomPadding = 55;

  const height =
    topPadding +
    titleHeight +
    photoHeight * 3 +
    photoGap * 2 +
    footerHeight +
    bottomPadding;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to render the photostrip.");
  }

  // Background and outer border.
  context.fillStyle = details.background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = details.border;
  context.lineWidth = selectedTemplate === "film" ? 9 : 3;

  context.strokeRect(
    6,
    6,
    width - 12,
    height - 12
  );

  const innerLeft = sidePadding;

  // Title.
  drawCenteredText(
    context,
    details.title,
    width / 2,
    topPadding + titleHeight / 2,
    innerWidth,
    details.font.replace(/\d+px/, "18px"),
    details.text
  );

  // Three photos.
  let photoY = topPadding + titleHeight;

    images.forEach(image => {
    context.save();

    if (selectedTemplate === "blackwhite") {
      // Draw the photo first, then convert its pixels to grayscale.
      const photoCanvas = document.createElement("canvas");
      photoCanvas.width = photoWidth;
      photoCanvas.height = photoHeight;

      const photoContext = photoCanvas.getContext("2d", {
        willReadFrequently: true
      });

      if (!photoContext) {
        throw new Error("Unable to process the black and white photo.");
      }

      drawCoverImage(
        photoContext,
        image,
        0,
        0,
        photoWidth,
        photoHeight
      );

      const imageData = photoContext.getImageData(
        0,
        0,
        photoWidth,
        photoHeight
      );

      const pixels = imageData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const gray = Math.round(
          0.299 * pixels[i] +
          0.587 * pixels[i + 1] +
          0.114 * pixels[i + 2]
        );

        pixels[i] = gray;
        pixels[i + 1] = gray;
        pixels[i + 2] = gray;
      }

      photoContext.putImageData(imageData, 0, 0);

      context.drawImage(
        photoCanvas,
        innerLeft,
        photoY,
        photoWidth,
        photoHeight
      );
    } else {
      context.filter = "none";

      drawCoverImage(
        context,
        image,
        innerLeft,
        photoY,
        photoWidth,
        photoHeight
      );
    }

    context.restore();

    context.strokeStyle = details.photoBorder;
    context.lineWidth = 5;

    context.strokeRect(
      innerLeft,
      photoY,
      photoWidth,
      photoHeight
    );

    photoY += photoHeight + photoGap;
  });

  // Decorative elements.
  drawDecorations(
    context,
    selectedTemplate,
    width,
    height
  );

  // Footer.
  drawCenteredText(
  context,
  details.footer,
  width / 2,
  height - bottomPadding - footerHeight / 2,
  innerWidth,
  details.footerFont,
  details.text
);

  // JPEG compression helps keep downloads smaller.
  completedStripBlob = await new Promise(resolve => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });

  if (!completedStripBlob) {
    throw new Error("Unable to prepare the photostrip image.");
  }

  completedStripDataUrl = canvas.toDataURL(
    "image/jpeg",
    0.82
  );
}

/* =========================================================
   21. CREATE PHOTOSTRIP
========================================================= */

createStripButton?.addEventListener("click", async () => {
  if (
    !photoData.every(Boolean) ||
    createStripButton.disabled
  ) {
    return;
  }

  createStripButton.disabled = true;
  createStripButton.textContent = "Creating your photostrip...";

  try {
    await renderPhotostrip();

    setStatus(resultStatus, "");

    showView("result");
  } catch (error) {
    console.error("Photostrip creation failed:", error);

    alert(
      error.message ||
      "Unable to create the photostrip. Please try again."
    );
  } finally {
    createStripButton.textContent = "Create my photostrip ↗";
    updateCreateButton();
  }
});

/* =========================================================
   22. DOWNLOAD PHOTOSTRIP
========================================================= */

downloadStripButton?.addEventListener("click", async () => {
  try {
    if (!completedStripBlob || !completedStripDataUrl) {
      await renderPhotostrip();
    }

    const url = URL.createObjectURL(completedStripBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "Syahlen-and-Atiqah-Photostrip.jpg";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);

    setStatus(resultStatus, "Your photostrip has been downloaded.");
  } catch (error) {
    console.error("Download failed:", error);

    setStatus(
      resultStatus,
      "Unable to download the photostrip. Please try again.",
      true
    );
  }
});

/* =========================================================
   23. SAVE PHOTOSTRIP TO SUPABASE
========================================================= */

saveStripButton?.addEventListener("click", async () => {
  if (savingStrip) return;

  if (!supabaseClient) {
    setStatus(
      resultStatus,
      "The gallery service is unavailable. Please reload the page.",
      true
    );
    return;
  }

  savingStrip = true;
  saveStripButton.disabled = true;
  saveStripButton.textContent = "Saving...";

  try {
    if (!completedStripBlob || !completedStripDataUrl) {
      await renderPhotostrip();
    }

    const fileName =
      `photostrips/${Date.now()}-${crypto.randomUUID()}.jpg`;

    const { error: uploadError } =
      await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, completedStripBlob, {
          contentType: "image/jpeg",
          upsert: false
        });

    if (uploadError) throw uploadError;

    const { error: insertError } =
      await supabaseClient
        .from(PHOTOS_TABLE)
        .insert({
          name: "A wedding guest",
          image_path: fileName
        });

    if (insertError) {
      await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .remove([fileName]);

      throw insertError;
    }

    setStatus(
      resultStatus,
      "Your photostrip has been saved to the wedding gallery."
    );

    saveStripButton.textContent = "Saved to gallery";
  } catch (error) {
    console.error("Saving photostrip failed:", error);

    setStatus(
      resultStatus,
      error.message ||
      "Unable to save the photostrip. Please try again.",
      true
    );

    saveStripButton.textContent = "Save to wedding gallery";
  } finally {
    savingStrip = false;
    saveStripButton.disabled = false;
  }
});

/* =========================================================
   24. MAKE ANOTHER STRIP
========================================================= */

makeAnotherButton?.addEventListener("click", () => {
  clearCurrentPhotos();

  if (saveStripButton) {
    saveStripButton.textContent = "Save to wedding gallery";
  }

  showView("booth");

  if (currentPhotoSource === "camera") {
    startCamera();
  }
});

/* =========================================================
   25. LOAD WEDDING GALLERY
========================================================= */

async function loadGallery() {
  if (!galleryGrid) return;

  if (!supabaseClient) {
    galleryGrid.replaceChildren(
      makeMessage("The wedding gallery is currently unavailable.")
    );
    return;
  }

  galleryGrid.replaceChildren(
    makeMessage("Loading wedding memories...")
  );

  try {
    const { data, error } = await supabaseClient
      .from(PHOTOS_TABLE)
      .select("id, name, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!data || data.length === 0) {
      galleryGrid.replaceChildren(
        makeMessage("No photostrips have been shared yet.")
      );
      return;
    }

    const cards = await Promise.all(
      data.map(async photo => {
        const { data: urlData, error: urlError } =
          await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(photo.image_path, 3600);

        let imageURL = "";

        if (!urlError && urlData?.signedUrl) {
          imageURL = urlData.signedUrl;
        } else {
          const publicResult =
            supabaseClient.storage
              .from(STORAGE_BUCKET)
              .getPublicUrl(photo.image_path);

          imageURL = publicResult.data?.publicUrl || "";
        }

        const card = document.createElement("article");
        card.className = "gallery-card";

        if (imageURL) {
          const image = document.createElement("img");

          image.src = imageURL;
          image.alt = "Wedding photostrip";
          image.loading = "lazy";

          card.appendChild(image);
        }

        const caption = document.createElement("div");
        caption.className = "gallery-card-caption";

        const guestName = document.createElement("strong");
        guestName.textContent = photo.name || "A wedding guest";

        const date = document.createElement("p");

        date.textContent = photo.created_at
          ? new Date(photo.created_at).toLocaleDateString()
          : "";

        caption.append(guestName, date);
        card.appendChild(caption);

        return card;
      })
    );

    galleryGrid.replaceChildren(...cards);
  } catch (error) {
    console.error("Gallery loading failed:", error);

    galleryGrid.replaceChildren(
      makeMessage(
        "Unable to load the wedding gallery. Please try again."
      )
    );
  }
}

/* =========================================================
   26. LOAD GUESTBOOK
========================================================= */

async function loadGuestbook() {
  if (!guestbookMessages) return;

  if (!supabaseClient) {
    guestbookMessages.replaceChildren(
      makeMessage("The guestbook is currently unavailable.")
    );
    return;
  }

  guestbookMessages.replaceChildren(
    makeMessage("Loading lovely messages...")
  );

  try {
    const { data, error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!data || data.length === 0) {
      guestbookMessages.replaceChildren(
        makeMessage("Be the first to leave a lovely message.")
      );
      return;
    }

    const entries = data.map(message => {
      const article = document.createElement("article");
      article.className = "guestbook-entry";

      const name = document.createElement("h3");
      name.className = "guestbook-entry-name";
      name.textContent =
        message.name || message.guest_name || "A wedding guest";

      const body = document.createElement("p");
      body.className = "guestbook-entry-message";
      body.textContent =
        message.message || message.wishes || "";

      const date = document.createElement("div");
      date.className = "guestbook-entry-date";

      date.textContent = message.created_at
        ? new Date(message.created_at).toLocaleDateString()
        : "";

      article.append(name, body, date);

      return article;
    });

    guestbookMessages.replaceChildren(...entries);
  } catch (error) {
    console.error("Guestbook loading failed:", error);

    guestbookMessages.replaceChildren(
      makeMessage(
        "Unable to load messages. Please refresh and try again."
      )
    );
  }
}

/* =========================================================
   27. SUBMIT GUESTBOOK MESSAGE
========================================================= */

guestbookForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (submittingGuestbook) return;

  if (!supabaseClient) {
    setStatus(
      guestbookStatus,
      "The guestbook service is unavailable. Please try again later.",
      true
    );
    return;
  }

  const name = guestNameInput?.value.trim() || "";
  const message = guestMessageInput?.value.trim() || "";

  if (!name || !message) {
    setStatus(
      guestbookStatus,
      "Please enter your name and wishes.",
      true
    );
    return;
  }

  submittingGuestbook = true;

  if (submitGuestbookButton) {
    submitGuestbookButton.disabled = true;
    submitGuestbookButton.textContent = "Sending...";
  }

  try {
    const { error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .insert({
        name,
        message
      });

    if (error) throw error;

    guestbookForm.reset();

    setStatus(
      guestbookStatus,
      "Your wishes have been sent. Thank you!"
    );

    await loadGuestbook();
  } catch (error) {
    console.error("Guestbook submission failed:", error);

    setStatus(
      guestbookStatus,
      error.message ||
      "Unable to send your wishes. Please try again.",
      true
    );
  } finally {
    submittingGuestbook = false;

    if (submitGuestbookButton) {
      submitGuestbookButton.disabled = false;
      submitGuestbookButton.textContent = "Send your wishes";
    }
  }
});

/* =========================================================
   28. INITIALIZE
========================================================= */

function initializePhotobooth() {
  setSelectedTemplate("film");

  updatePhotoSlots();
  updatePhotostripPreview();
  updateCameraCounter();
  updateCreateButton();

  if (switchCameraButton) {
    switchCameraButton.disabled = true;
  }

  if (cameraPlaceholder) {
    cameraPlaceholder.hidden = false;
  }

  loadGallery();
}

initializePhotobooth();