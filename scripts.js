/* =========================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Six Photostrip Styles + Camera + Upload + Crop Editor
   Supabase Storage + Gallery + Guestbook
========================================================= */

/* =========================
   1. SUPABASE CONFIGURATION
========================= */

const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const STORAGE_BUCKET = "wedding-media";
const PHOTOS_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

const COUPLE_NAMES = "SYAHLEN & ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

const supabaseClient =
  window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

/* =========================
   2. ELEMENTS
========================= */

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

const retakeAllButton = document.getElementById("retakeAllButton");
const createStripButton = document.getElementById("createStripButton");
const templateSelector = document.getElementById("templateSelector");
const photostripPreview = document.getElementById("photostripPreview");

const photostripCanvas = document.getElementById("photostripCanvas");
const downloadStripButton = document.getElementById("downloadStripButton");
const saveStripButton = document.getElementById("saveStripButton");
const makeAnotherButton = document.getElementById("makeAnotherButton");
const resultStatus = document.getElementById("resultStatus");

const galleryGrid = document.getElementById("galleryGrid");

const guestbookForm = document.getElementById("guestbookForm");
const guestNameInput = document.getElementById("guestName");
const guestMessageInput = document.getElementById("guestMessage");
const submitGuestbookButton = document.getElementById("submitGuestbookButton");
const guestbookStatus = document.getElementById("guestbookStatus");
const guestbookMessages = document.getElementById("guestbookMessages");

/* =========================
   3. STATE
========================= */

let cameraStream = null;
let currentFacingMode = "user";
let currentCameraDeviceId = null;
let availableCameras = [];
let cameraStarting = false;
let captureInProgress = false;
let switchingCamera = false;

let selectedTemplate = "minimalist";
let currentPhotoIndex = 0;
let photoData = [null, null, null];
let completedStripBlob = null;
let completedStripDataUrl = null;
let currentPhotoSource = "camera";
let isSavingStrip = false;
let isSubmittingGuestbook = false;

/* =========================
   4. SIX PHOTOSTRIP STYLES
========================= */

const TEMPLATE_DETAILS = {
  minimalist: {
    name: "Minimalist White",
    title: "SYAHLEN  ♥  ATIQAH",
    footer: WEDDING_DATE
  },

  doodle: {
    name: "Doodle Style",
    title: "Syahlen & Atiqah",
    footer: WEDDING_DATE
  },

  chalkboard: {
    name: "Chalkboard",
    title: "SYAHLEN & ATIQAH",
    footer: WEDDING_DATE
  },

  colorful: {
    name: "Colorful Doodle",
    title: "Syahlen & Atiqah",
    footer: WEDDING_DATE
  },

  elegant: {
    name: "Elegant Serif",
    title: "S Y A H L E N\n&  A T I Q A H",
    footer: WEDDING_DATE
  },

  retro: {
    name: "Retro Handwritten",
    title: "Syahlen & Atiqah",
    footer: WEDDING_DATE
  }
};

const TEMPLATE_COLORS = {
  minimalist: {
    background: "#fffdfb",
    border: "#e7e0dc",
    text: "#25201e",
    photoBorder: "#ffffff"
  },

  doodle: {
    background: "#fffaf0",
    border: "#24201e",
    text: "#211d1b",
    photoBorder: "#ffffff"
  },

  chalkboard: {
    background: "#171716",
    border: "#e9e1d2",
    text: "#fffaf0",
    photoBorder: "#f5efe4"
  },

  colorful: {
    background: "#fff8e9",
    border: "#f1d9bd",
    text: "#283f9e",
    photoBorder: "#ffffff"
  },

  elegant: {
    background: "#f7eee6",
    border: "#c9b39c",
    text: "#342a26",
    photoBorder: "#fffaf5"
  },

  retro: {
    background: "#fff0df",
    border: "#e6b89c",
    text: "#27201d",
    photoBorder: "#fffaf3"
  }
};

const TEMPLATE_NAMES = Object.keys(TEMPLATE_DETAILS);

/* =========================
   5. GENERAL HELPERS
========================= */

function setStatus(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#a12e42" : "";
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load this photo."));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read the selected photo."));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

/* =========================================================
   6. PHOTO CROP EDITOR
========================================================= */

let cropImage = null;
let cropZoom = 1;
let cropOffsetX = 0;
let cropOffsetY = 0;
let cropDragging = false;
let cropDragStartX = 0;
let cropDragStartY = 0;
let cropStartOffsetX = 0;
let cropStartOffsetY = 0;
let cropResolver = null;

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
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
      font-family: inherit;
    }

    .crop-editor-card h2 {
      margin: 0 0 8px;
      font-family: Georgia, serif;
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

    #photoCropReset {
      color: #4a101c;
      background: transparent;
    }

    #photoCropConfirm {
      color: #fff;
      background: #4a101c;
    }

    .crop-editor-progress {
      margin-bottom: 14px;
      color: #9b6c74;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-align: center;
      text-transform: uppercase;
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
      <div id="photoCropProgress" class="crop-editor-progress">
        PHOTO 1 OF 3
      </div>
      <h2 id="photoCropHeading">Adjust your photo</h2>
      <p class="crop-editor-description">
        Move your photo inside the 4:3 frame and adjust the zoom.
      </p>
      <canvas id="photoCropCanvas" width="800" height="600"></canvas>
      <div class="crop-zoom-label">
        <label for="photoCropZoom">Zoom</label>
        <span id="photoCropZoomValue">100%</span>
      </div>
      <input id="photoCropZoom" type="range"
        min="1" max="3" step="0.01" value="1">
      <p class="crop-editor-hint">
        Drag the picture to adjust its position.
      </p>
      <div class="crop-editor-actions">
        <button type="button" id="photoCropReset">Reset crop</button>
        <button type="button" id="photoCropConfirm">Use this crop →</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const canvas = document.getElementById("photoCropCanvas");

  canvas.addEventListener("pointerdown", event => {
    if (!cropImage) return;

    cropDragging = true;
    cropDragStartX = event.clientX;
    cropDragStartY = event.clientY;
    cropStartOffsetX = cropOffsetX;
    cropStartOffsetY = cropOffsetY;

    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!cropDragging || !cropImage) return;

    const rect = canvas.getBoundingClientRect();

    cropOffsetX = cropStartOffsetX +
      (event.clientX - cropDragStartX) * canvas.width / rect.width;

    cropOffsetY = cropStartOffsetY +
      (event.clientY - cropDragStartY) * canvas.height / rect.height;

    clampCropPosition();
    drawCropEditor();
  });

  canvas.addEventListener("pointerup", () => {
    cropDragging = false;
  });

  canvas.addEventListener("pointercancel", () => {
    cropDragging = false;
  });

  document.getElementById("photoCropZoom").addEventListener("input", event => {
    cropZoom = Number(event.target.value) || 1;

    document.getElementById("photoCropZoomValue").textContent =
      `${Math.round(cropZoom * 100)}%`;

    clampCropPosition();
    drawCropEditor();
  });

  document.getElementById("photoCropReset").addEventListener("click", resetCropPosition);
  document.getElementById("photoCropConfirm").addEventListener("click", confirmCurrentCrop);
}

function resetCropPosition() {
  cropZoom = 1;
  cropOffsetX = 0;
  cropOffsetY = 0;

  const zoomInput = document.getElementById("photoCropZoom");
  const zoomValue = document.getElementById("photoCropZoomValue");

  if (zoomInput) zoomInput.value = "1";
  if (zoomValue) zoomValue.textContent = "100%";

  drawCropEditor();
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

  cropOffsetX = Math.max(
    -(width - canvas.width) / 2,
    Math.min((width - canvas.width) / 2, cropOffsetX)
  );

  cropOffsetY = Math.max(
    -(height - canvas.height) / 2,
    Math.min((height - canvas.height) / 2, cropOffsetY)
  );
}

function drawCropEditor() {
  const dimensions = getCropDimensions();
  if (!dimensions) return;

  const { canvas, scale, width, height } = dimensions;
  const context = canvas.getContext("2d");

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
  if (!context) return;

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
  cropResolver = null;
  resolve(result);
}

function openPhotoCropper(dataUrl, photoNumber) {
  installCropEditor();

  return new Promise(async (resolve, reject) => {
    try {
      cropImage = await getImageFromDataUrl(dataUrl);
      cropZoom = 1;
      cropOffsetX = 0;
      cropOffsetY = 0;
      cropResolver = resolve;

      document.getElementById("photoCropProgress").textContent =
        `PHOTO ${photoNumber} OF 3`;

      document.getElementById("photoCropZoom").value = "1";
      document.getElementById("photoCropZoomValue").textContent = "100%";
      document.getElementById("photoCropModal").hidden = false;

      drawCropEditor();
      document.getElementById("photoCropConfirm").focus();
    } catch (error) {
      reject(error);
    }
  });
}

function closePhotoCropper() {
  const modal = document.getElementById("photoCropModal");
  if (modal) modal.hidden = true;

  cropImage = null;
  cropDragging = false;
}

/* =========================
   7. NAVIGATION
========================= */

function showView(viewName) {
  const viewMap = {
    booth: document.getElementById("boothView"),
    result: document.getElementById("resultView"),
    gallery: document.getElementById("galleryView"),
    guestbook: document.getElementById("guestbookView")
  };

  Object.entries(viewMap).forEach(([name, element]) => {
    if (!element) return;

    element.classList.toggle("active", name === viewName);
    element.hidden = name !== viewName;
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  if (viewName === "gallery") loadGallery();
  if (viewName === "guestbook") loadGuestbook();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.getElementById("homeButton")?.addEventListener("click", event => {
  event.preventDefault();
  showView("booth");
});

/* =========================
   8. CAMERA
========================= */

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (cameraPreview) {
    cameraPreview.pause();
    cameraPreview.srcObject = null;
    cameraPreview.style.transform = "none";
  }

  if (captureButton) captureButton.disabled = true;
}

async function getAvailableCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    availableCameras = [];
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter(device => device.kind === "videoinput");
    return availableCameras;
  } catch (error) {
    console.warn("Unable to list cameras:", error);
    availableCameras = [];
    return [];
  }
}

function cameraLabelType(device) {
  const label = (device.label || "").toLowerCase();

  if (/front|user|facetime|selfie/.test(label)) return "user";
  if (/back|rear|environment|world/.test(label)) return "environment";

  return "unknown";
}

async function requestCameraByFacingMode(facingMode) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { exact: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 960 }
    }
  });
}

async function requestCameraByDeviceId(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 960 }
    }
  });
}

async function startCamera() {
  if (cameraStarting) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Camera access is unavailable. Please use HTTPS or choose Upload photos.");
    return;
  }

  cameraStarting = true;

  if (startCameraButton) {
    startCameraButton.disabled = true;
    startCameraButton.textContent = "Starting camera...";
  }

  if (switchCameraButton) switchCameraButton.disabled = true;

  try {
    const previousDeviceId = currentCameraDeviceId;

    stopCamera();

    let newStream = null;

    try {
      newStream = await requestCameraByFacingMode(currentFacingMode);
    } catch (error) {
      console.warn("Facing-mode request failed:", error);
    }

    if (!newStream) {
      const cameras = await getAvailableCameras();
      const matchingCamera = cameras.find(
        device => cameraLabelType(device) === currentFacingMode
      );

      if (matchingCamera) {
        try {
          newStream = await requestCameraByDeviceId(matchingCamera.deviceId);
          currentCameraDeviceId = matchingCamera.deviceId;
        } catch (error) {
          console.warn("Matching camera failed:", error);
        }
      }
    }

    if (!newStream) {
      const cameras = await getAvailableCameras();
      const alternative = cameras.find(
        device => device.deviceId !== previousDeviceId
      );

      if (alternative) {
        newStream = await requestCameraByDeviceId(alternative.deviceId);
        currentCameraDeviceId = alternative.deviceId;
      }
    }

    if (!newStream) {
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
    }

    cameraStream = newStream;

    const track = cameraStream.getVideoTracks()[0];
    const settings = track?.getSettings?.() || {};

    if (settings.deviceId) currentCameraDeviceId = settings.deviceId;

    if (settings.facingMode === "user" ||
        settings.facingMode === "environment") {
      currentFacingMode = settings.facingMode;
    }

    cameraPreview.srcObject = cameraStream;
    cameraPreview.autoplay = true;
    cameraPreview.playsInline = true;
    cameraPreview.muted = true;

    await new Promise((resolve, reject) => {
      if (cameraPreview.readyState >= 1 && cameraPreview.videoWidth > 0) {
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
        cameraPreview.removeEventListener("loadedmetadata", onLoaded);
        cameraPreview.removeEventListener("error", onError);
      };

      cameraPreview.addEventListener("loadedmetadata", onLoaded, { once: true });
      cameraPreview.addEventListener("error", onError, { once: true });
    });

    await cameraPreview.play();

    cameraPreview.style.transform =
      currentFacingMode === "user" ? "scaleX(-1)" : "none";

    if (cameraPlaceholder) cameraPlaceholder.hidden = true;

    if (captureButton && currentPhotoIndex < 3) {
      captureButton.disabled = false;
      captureButton.textContent = "Take photo";
    }

    await getAvailableCameras();

    if (switchCameraButton) switchCameraButton.disabled = false;
  } catch (error) {
    console.error("Camera error:", error);
    stopCamera();

    if (cameraPlaceholder) cameraPlaceholder.hidden = false;

    let message = "Unable to start the camera. ";

    if (error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError") {
      message += "Please allow camera access in your browser settings.";
    } else if (error.name === "NotFoundError") {
      message += "No compatible camera was found. You can upload photos instead.";
    } else if (error.name === "NotReadableError") {
      message += "Your camera may be in use by another application.";
    } else {
      message += "Please check camera permissions and try again.";
    }

    alert(message);
  } finally {
    cameraStarting = false;

    if (startCameraButton) {
      startCameraButton.disabled = false;
      startCameraButton.textContent = "Start camera";
    }

    if (switchCameraButton) switchCameraButton.disabled = false;
  }
}

async function switchCamera() {
  if (switchingCamera || cameraStarting) return;

  switchingCamera = true;

  try {
    await getAvailableCameras();

    if (availableCameras.length < 2) {
      alert("Only one camera is available to this browser.");
      return;
    }

    const previousDeviceId = currentCameraDeviceId;
    const targetMode = currentFacingMode === "user" ? "environment" : "user";

    const matchingCamera = availableCameras.find(
      device => cameraLabelType(device) === targetMode
    );

    currentFacingMode = targetMode;
    currentCameraDeviceId = matchingCamera?.deviceId || null;

    stopCamera();
    await startCamera();

    if (
      cameraStream &&
      previousDeviceId &&
      currentCameraDeviceId === previousDeviceId
    ) {
      const alternative = availableCameras.find(
        device => device.deviceId !== previousDeviceId
      );

      if (alternative) {
        stopCamera();

        cameraStream = await requestCameraByDeviceId(alternative.deviceId);
        currentCameraDeviceId = alternative.deviceId;

        const track = cameraStream.getVideoTracks()[0];
        const settings = track?.getSettings?.() || {};

        if (settings.facingMode) currentFacingMode = settings.facingMode;

        cameraPreview.srcObject = cameraStream;
        await cameraPreview.play();

        cameraPreview.style.transform =
          currentFacingMode === "user" ? "scaleX(-1)" : "none";

        if (cameraPlaceholder) cameraPlaceholder.hidden = true;
        if (captureButton && currentPhotoIndex < 3) {
          captureButton.disabled = false;
        }
      }
    }
  } catch (error) {
    console.error("Camera switching failed:", error);
    alert("Unable to switch cameras. Please check your browser permissions.");
  } finally {
    switchingCamera = false;
    if (switchCameraButton) switchCameraButton.disabled = false;
  }
}

startCameraButton?.addEventListener("click", startCamera);
switchCameraButton?.addEventListener("click", switchCamera);

/* =========================
   9. CAMERA / UPLOAD MODES
========================= */

function setPhotoSource(source) {
  currentPhotoSource = source;

  const useCamera = source === "camera";

  cameraModeButton?.classList.toggle("active", useCamera);
  uploadModeButton?.classList.toggle("active", !useCamera);

  if (cameraPanel) cameraPanel.hidden = !useCamera;
  if (uploadPanel) uploadPanel.hidden = useCamera;

  if (useCamera) startCamera();
  else stopCamera();
}

cameraModeButton?.addEventListener("click", () => setPhotoSource("camera"));
uploadModeButton?.addEventListener("click", () => setPhotoSource("upload"));

/* =========================
   10. COUNTDOWN AND CAPTURE
========================= */

async function runCountdown(seconds = 3) {
  if (!countdownOverlay || !countdownNumber) return;

  countdownOverlay.hidden = false;

  for (let number = seconds; number > 0; number--) {
    countdownNumber.textContent = number;
    await wait(1000);
  }

  countdownNumber.textContent = "♥";
  await wait(350);
  countdownOverlay.hidden = true;
}

function captureCurrentFrame() {
  if (
    !cameraPreview ||
    !cameraStream ||
    cameraPreview.readyState < 2 ||
    !cameraPreview.videoWidth ||
    !cameraPreview.videoHeight
  ) {
    throw new Error("The camera is not ready yet. Please try again.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to capture this photo.");

  if (currentFacingMode === "user") {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

captureButton?.addEventListener("click", async () => {
  if (captureInProgress || currentPhotoIndex >= 3) return;

  captureInProgress = true;
  captureButton.disabled = true;

  try {
    await runCountdown(3);

    photoData[currentPhotoIndex] = captureCurrentFrame();
    currentPhotoIndex++;

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
    console.error(error);
    alert(error.message || "Unable to capture the photo.");
  } finally {
    captureInProgress = false;

    if (captureButton && currentPhotoIndex < 3 && cameraStream) {
      captureButton.disabled = false;
    }
  }
});

function updateCameraCounter() {
  if (cameraCounter) {
    cameraCounter.textContent = `${photoData.filter(Boolean).length} / 3`;
  }
}

/* =========================
   11. UPLOAD AND CROP PHOTOS
========================= */

photoUploadInput?.addEventListener("change", async event => {
  const files = Array.from(event.target.files || []);

  if (files.length !== 3) {
    setStatus(uploadStatus, "Please select exactly three photos.", true);
    photoUploadInput.value = "";
    return;
  }

  if (files.some(file => !file.type.startsWith("image/"))) {
    setStatus(uploadStatus, "Please select image files only.", true);
    photoUploadInput.value = "";
    return;
  }

  if (files.some(file => file.size > 15 * 1024 * 1024)) {
    setStatus(uploadStatus, "Each photo must be smaller than 15 MB.", true);
    photoUploadInput.value = "";
    return;
  }

  stopCamera();
  photoUploadInput.disabled = true;
  setStatus(uploadStatus, "Preparing your photos for cropping...");

  try {
    const originals = await Promise.all(files.map(async file => {
      const dataUrl = await readFileAsDataUrl(file);
      await getImageFromDataUrl(dataUrl);
      return dataUrl;
    }));

    const croppedPhotos = [];

    for (let index = 0; index < originals.length; index++) {
      setStatus(uploadStatus, `Adjusting photo ${index + 1} of 3...`);

      const cropped = await openPhotoCropper(originals[index], index + 1);
      croppedPhotos.push(cropped);
      closePhotoCropper();
    }

    photoData = croppedPhotos;
    currentPhotoIndex = 3;

    updatePhotoSlots();
    updatePhotostripPreview();
    updateCameraCounter();
    updateCreateButton();

    setStatus(uploadStatus, "All three cropped photos are ready!");
  } catch (error) {
    console.error("Photo upload/cropping error:", error);
    closePhotoCropper();

    setStatus(
      uploadStatus,
      error.message || "Unable to prepare your photos. Please try again.",
      true
    );
  } finally {
    photoUploadInput.disabled = false;
    photoUploadInput.value = "";
  }
});

/* =========================
   12. PHOTO SLOTS / RETAKE
========================= */

function updatePhotoSlots() {
  for (let index = 0; index < 3; index++) {
    const image = document.getElementById(`photoSlot${index + 1}`);
    const slot = document.querySelector(`.photo-slot[data-slot="${index}"]`);
    const placeholder = slot?.querySelector(".slot-placeholder");

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

function clearCurrentStrip() {
  photoData = [null, null, null];
  currentPhotoIndex = 0;
  completedStripBlob = null;
  completedStripDataUrl = null;

  if (photoUploadInput) photoUploadInput.value = "";
  if (captureButton) captureButton.textContent = "Take photo";

  setStatus(uploadStatus, "No photos selected yet.");
  setStatus(resultStatus, "");

  updatePhotoSlots();
  updatePhotostripPreview();
  updateCameraCounter();
  updateCreateButton();
}

retakeAllButton?.addEventListener("click", () => {
  clearCurrentStrip();

  if (currentPhotoSource === "camera") startCamera();
});

/* =========================
   13. TEMPLATE SELECTOR
   Create six choices automatically
========================= */

function ensureTemplateOptions() {
  if (!templateSelector) return;

  const existingButtons = Array.from(
    templateSelector.querySelectorAll(".template-option")
  );

  const existingByTemplate = new Map();

  existingButtons.forEach(button => {
    existingByTemplate.set(button.dataset.template, button);
  });

  TEMPLATE_NAMES.forEach(templateName => {
    let button = existingByTemplate.get(templateName);

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "template-option";
      button.dataset.template = templateName;
      templateSelector.appendChild(button);
    }

    button.dataset.template = templateName;
    button.textContent = TEMPLATE_DETAILS[templateName].name;
    button.setAttribute("aria-label", `Select ${TEMPLATE_DETAILS[templateName].name}`);
  });

  existingButtons.forEach(button => {
    if (!TEMPLATE_DETAILS[button.dataset.template]) {
      button.remove();
    }
  });
}

function setSelectedTemplate(templateName) {
  if (!TEMPLATE_DETAILS[templateName]) return;

  selectedTemplate = templateName;

  document.querySelectorAll(".template-option").forEach(button => {
    const selected = button.dataset.template === templateName;

    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  updatePhotostripPreview();
}

templateSelector?.addEventListener("click", event => {
  const button = event.target.closest(".template-option");
  if (!button) return;

  setSelectedTemplate(button.dataset.template);
});

/* =========================
   14. LIVE PHOTOSTRIP PREVIEW
========================= */

function updatePhotostripPreview() {
  if (!photostripPreview) return;

  const details = TEMPLATE_DETAILS[selectedTemplate];

  photostripPreview.className =
    `photostrip-preview template-${selectedTemplate}`;

  const title = photostripPreview.querySelector(".strip-preview-title");
  const footer = photostripPreview.querySelector(".strip-preview-footer");

  if (title) title.textContent = details.title.replace("\n", " ");
  if (footer) footer.textContent = details.footer;

  for (let index = 0; index < 3; index++) {
    const image = document.getElementById(`stripPreviewPhoto${index + 1}`);

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

function updateCreateButton() {
  if (createStripButton) {
    createStripButton.disabled = !photoData.every(Boolean);
  }
}

/* =========================
   15. CANVAS DRAWING HELPERS
========================= */

function drawCoverImage(context, image, x, y, width, height) {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;

  const scale = Math.max(width / imageWidth, height / imageHeight);
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  const cropX = (scaledWidth - width) / 2;
  const cropY = (scaledHeight - height) / 2;

  context.drawImage(
    image,
    cropX / scale,
    cropY / scale,
    width / scale,
    height / scale,
    x,
    y,
    width,
    height
  );
}

function drawCenteredText(context, text, x, y, maxWidth, font, color) {
  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";

  let displayText = text;

  while (
    context.measureText(displayText).width > maxWidth &&
    displayText.length > 3
  ) {
    displayText = displayText.slice(0, -1);
  }

  if (displayText !== text) displayText = displayText.trimEnd() + "…";

  context.fillText(displayText, x, y, maxWidth);
  context.restore();
}

function drawMultilineText(context, text, x, y, maxWidth, lineHeight, font, color) {
  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = String(text).split("\n");

  lines.forEach((line, index) => {
    context.fillText(line, x, y + index * lineHeight, maxWidth);
  });

  context.restore();
}

function drawFrameBorder(context, x, y, width, height, color, lineWidth) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.strokeRect(x, y, width, height);
  context.restore();
}

function drawHeartDecoration(context, x, y, size, color, filled = false) {
  context.save();
  context.translate(x, y);
  context.scale(size / 24, size / 24);

  context.beginPath();
  context.moveTo(12, 21);
  context.bezierCurveTo(10, 19, 1, 13, 1, 7);
  context.bezierCurveTo(1, 1, 8, 0, 12, 5);
  context.bezierCurveTo(16, 0, 23, 1, 23, 7);
  context.bezierCurveTo(23, 13, 14, 19, 12, 21);

  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineWidth = 1.7;

  if (filled) context.fill();
  else context.stroke();

  context.restore();
}

function drawStarDecoration(context, x, y, radius, color) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.lineWidth = 2.5;
  context.lineJoin = "round";

  context.beginPath();

  for (let index = 0; index < 8; index++) {
    const angle = Math.PI * index / 4 - Math.PI / 2;
    const length = index % 2 === 0 ? radius : radius * 0.25;
    const px = Math.cos(angle) * length;
    const py = Math.sin(angle) * length;

    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }

  context.closePath();
  context.stroke();
  context.restore();
}

function drawSparkle(context, x, y, size, color) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;

  context.beginPath();
  context.moveTo(x - size, y);
  context.lineTo(x + size, y);
  context.moveTo(x, y - size);
  context.lineTo(x, y + size);
  context.stroke();

  context.restore();
}

function drawDoodleFlower(context, x, y, size, color) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.lineWidth = 2.4;

  for (let index = 0; index < 5; index++) {
    context.save();
    context.rotate(index * Math.PI * 2 / 5);

    context.beginPath();
    context.ellipse(0, -size * 0.55, size * 0.22, size * 0.4, 0, 0, Math.PI * 2);
    context.stroke();

    context.restore();
  }

  context.beginPath();
  context.arc(0, 0, size * 0.17, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawWavyLine(context, x1, y1, x2, y2, color, amplitude = 5) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2.6;
  context.lineCap = "round";

  context.beginPath();
  context.moveTo(x1, y1);

  const segments = 30;

  for (let index = 1; index <= segments; index++) {
    const t = index / segments;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t +
      Math.sin(t * Math.PI * 8) * amplitude;

    context.lineTo(x, y);
  }

  context.stroke();
  context.restore();
}

function drawDoodleDecoration(context, template, width, height, theme) {
  if (template === "doodle") {
    drawHeartDecoration(context, 70, 100, 26, theme.text);
    drawHeartDecoration(context, width - 70, 105, 25, theme.text);
    drawSparkle(context, 120, 145, 9, theme.text);
    drawSparkle(context, width - 120, 145, 9, theme.text);
    drawHeartDecoration(context, 85, height - 80, 24, theme.text);
    drawHeartDecoration(context, width - 85, height - 80, 24, theme.text);
    drawSparkle(context, 145, height - 65, 9, theme.text);
    drawSparkle(context, width - 145, height - 65, 9, theme.text);
  }

  if (template === "colorful") {
    const colors = ["#ff5d91", "#ffb52e", "#278bd5", "#9a62d5"];

    drawHeartDecoration(context, 75, 86, 28, colors[0]);
    drawHeartDecoration(context, width - 75, 110, 25, colors[3]);
    drawStarDecoration(context, 110, 145, 15, colors[1]);
    drawStarDecoration(context, width - 105, 155, 14, colors[2]);
    drawSparkle(context, 55, 260, 8, colors[0]);
    drawSparkle(context, width - 55, 310, 8, colors[1]);
    drawStarDecoration(context, 65, height - 125, 14, colors[2]);
    drawHeartDecoration(context, width - 75, height - 110, 26, colors[0]);
    drawStarDecoration(context, width - 110, height - 70, 13, colors[1]);
    drawSparkle(context, 75, height - 65, 9, colors[3]);
  }

  if (template === "retro") {
    drawWavyLine(context, 65, 95, 180, 60, "#e99b7f", 4);
    drawWavyLine(context, width - 180, 60, width - 65, 95, "#e99b7f", 4);
    drawHeartDecoration(context, width - 75, 110, 24, "#e58c76");
    drawDoodleFlower(context, 80, height - 110, 25, "#e58c76");
    drawHeartDecoration(context, width / 2, height - 65, 22, theme.text);
    drawSparkle(context, width - 80, height - 110, 9, "#e58c76");
  }

  if (template === "chalkboard") {
    drawHeartDecoration(context, 80, 85, 25, theme.text);
    drawSparkle(context, width - 85, 95, 11, theme.text);
    drawSparkle(context, 80, 180, 9, theme.text);
    drawHeartDecoration(context, width - 75, 230, 24, theme.text);
    drawSparkle(context, 70, height - 150, 10, theme.text);
    drawHeartDecoration(context, width - 90, height - 95, 24, theme.text);
    drawWavyLine(context, 65, height - 65, 160, height - 78, theme.text, 2);
    drawWavyLine(context, width - 160, height - 78, width - 65, height - 65, theme.text, 2);
  }
}

/* =========================
   16. DRAW THE SIX STYLES
========================= */

async function renderPhotostrip() {
  if (!photoData.every(Boolean)) {
    throw new Error("Please take or upload all three photos first.");
  }

  const canvas = photostripCanvas;
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    throw new Error("Unable to create the photostrip.");
  }

  const WIDTH = 600;
  const SIDE_PADDING = 65;
  const PHOTO_WIDTH = WIDTH - SIDE_PADDING * 2;
  const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * 3 / 4);
  const PHOTO_GAP = 14;
  const TITLE_HEIGHT = 155;
  const FOOTER_HEIGHT = 105;
  const TOP_PADDING = 24;
  const BOTTOM_PADDING = 28;

  const HEIGHT =
    TOP_PADDING +
    TITLE_HEIGHT +
    PHOTO_HEIGHT * 3 +
    PHOTO_GAP * 2 +
    FOOTER_HEIGHT +
    BOTTOM_PADDING;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const theme = TEMPLATE_COLORS[selectedTemplate];
  const details = TEMPLATE_DETAILS[selectedTemplate];
  const images = await Promise.all(photoData.map(getImageFromDataUrl));

  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = theme.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  /* Outer border */

  if (selectedTemplate === "minimalist") {
    drawFrameBorder(context, 10, 10, WIDTH - 20, HEIGHT - 20, "#e8e3df", 2);
  }

  if (selectedTemplate === "elegant") {
    drawFrameBorder(context, 15, 15, WIDTH - 30, HEIGHT - 30, theme.border, 2);
    drawFrameBorder(context, 24, 24, WIDTH - 48, HEIGHT - 48, "#e1d0c1", 1);
  }

  if (selectedTemplate === "chalkboard") {
    drawFrameBorder(context, 12, 12, WIDTH - 24, HEIGHT - 24, "#d8d0c2", 3);
  }

  if (selectedTemplate === "retro") {
    drawFrameBorder(context, 12, 12, WIDTH - 24, HEIGHT - 24, "#edc7ae", 3);
  }

  /* Title */

  const titleY = TOP_PADDING + 52;

  const titleFont = {
    minimalist: 'bold 25px Georgia, "Times New Roman", serif',
    doodle: 'italic 38px "Comic Sans MS", "Trebuchet MS", cursive',
    chalkboard: 'bold 29px "Comic Sans MS", "Trebuchet MS", cursive',
    colorful: 'italic 37px "Comic Sans MS", "Trebuchet MS", cursive',
    elegant: '27px Georgia, "Times New Roman", serif',
    retro: 'italic 38px "Comic Sans MS", "Trebuchet MS", cursive'
  }[selectedTemplate];

  if (selectedTemplate === "elegant") {
    drawMultilineText(
      context,
      details.title,
      WIDTH / 2,
      TOP_PADDING + 39,
      WIDTH - 90,
      31,
      titleFont,
      theme.text
    );
  } else {
    drawCenteredText(
      context,
      details.title,
      WIDTH / 2,
      titleY,
      WIDTH - 90,
      titleFont,
      theme.text
    );
  }

  /* Style-specific heading decorations */

  if (selectedTemplate === "minimalist") {
    drawHeartDecoration(context, WIDTH / 2, TOP_PADDING + 91, 21, theme.text, true);
  }

  if (selectedTemplate === "doodle") {
    drawHeartDecoration(context, 72, titleY - 8, 22, theme.text);
    drawHeartDecoration(context, WIDTH - 72, titleY + 5, 22, theme.text);
    drawSparkle(context, 120, titleY + 40, 8, theme.text);
    drawSparkle(context, WIDTH - 120, titleY + 35, 8, theme.text);
  }

  if (selectedTemplate === "colorful") {
    drawHeartDecoration(context, 70, titleY - 10, 26, "#ff5d91");
    drawHeartDecoration(context, WIDTH - 75, titleY + 8, 23, "#9a62d5");
    drawStarDecoration(context, 120, titleY + 40, 13, "#ffb52e");
    drawStarDecoration(context, WIDTH - 120, titleY + 35, 13, "#278bd5");
  }

  if (selectedTemplate === "retro") {
    drawWavyLine(context, 65, TOP_PADDING + 100, 165, TOP_PADDING + 85, "#e99b7f", 3);
    drawWavyLine(context, WIDTH - 165, TOP_PADDING + 85, WIDTH - 65, TOP_PADDING + 100, "#e99b7f", 3);
    drawHeartDecoration(context, WIDTH - 80, titleY - 5, 22, "#e58c76");
  }

  /* Photos */

  let photoY = TOP_PADDING + TITLE_HEIGHT;

  images.forEach((image, index) => {
    if (selectedTemplate === "doodle") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 5,
        photoY - 5,
        PHOTO_WIDTH + 10,
        PHOTO_HEIGHT + 10,
        theme.text,
        3
      );

      /* Slightly irregular hand-drawn edge */
      context.save();
      context.strokeStyle = theme.text;
      context.lineWidth = 1.8;

      context.beginPath();
      context.moveTo(SIDE_PADDING - 2, photoY + 3);
      context.lineTo(SIDE_PADDING + PHOTO_WIDTH + 2, photoY - 2);
      context.lineTo(SIDE_PADDING + PHOTO_WIDTH + 4, photoY + PHOTO_HEIGHT + 3);
      context.lineTo(SIDE_PADDING - 3, photoY + PHOTO_HEIGHT + 1);
      context.closePath();
      context.stroke();
      context.restore();
    }

    if (selectedTemplate === "chalkboard") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 3,
        photoY - 3,
        PHOTO_WIDTH + 6,
        PHOTO_HEIGHT + 6,
        "#fffaf0",
        2
      );
    }

    if (selectedTemplate === "elegant") {
      context.save();
      context.fillStyle = "#ffffff";
      context.fillRect(
        SIDE_PADDING - 4,
        photoY - 4,
        PHOTO_WIDTH + 8,
        PHOTO_HEIGHT + 8
      );
      context.restore();
    }

    if (selectedTemplate === "retro") {
      context.save();
      context.fillStyle = "#fffaf3";
      context.fillRect(
        SIDE_PADDING - 5,
        photoY - 5,
        PHOTO_WIDTH + 10,
        PHOTO_HEIGHT + 10
      );
      context.restore();
    }

    drawCoverImage(
      context,
      image,
      SIDE_PADDING,
      photoY,
      PHOTO_WIDTH,
      PHOTO_HEIGHT
    );

    if (selectedTemplate === "minimalist") {
      drawFrameBorder(
        context,
        SIDE_PADDING,
        photoY,
        PHOTO_WIDTH,
        PHOTO_HEIGHT,
        "#ffffff",
        2
      );
    }

    if (selectedTemplate === "colorful") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 3,
        photoY - 3,
        PHOTO_WIDTH + 6,
        PHOTO_HEIGHT + 6,
        "#ffffff",
        5
      );
    }

    if (selectedTemplate === "chalkboard") {
      context.save();
      context.fillStyle = "rgba(255,250,240,.92)";
      context.font = "bold 15px Arial, sans-serif";
      context.textAlign = "right";
      context.fillText(
        String(index + 1).padStart(2, "0"),
        SIDE_PADDING + PHOTO_WIDTH - 12,
        photoY + PHOTO_HEIGHT - 12
      );
      context.restore();
    }

    photoY += PHOTO_HEIGHT + PHOTO_GAP;
  });

  /* Footer and date */

  const footerY = photoY - PHOTO_GAP + 43;

  const footerFont = {
    minimalist: '17px Georgia, "Times New Roman", serif',
    doodle: 'italic 20px "Comic Sans MS", "Trebuchet MS", cursive',
    chalkboard: 'italic 19px Georgia, "Times New Roman", serif',
    colorful: 'bold 17px Georgia, "Times New Roman", serif',
    elegant: '17px Georgia, "Times New Roman", serif',
    retro: 'italic 19px "Comic Sans MS", "Trebuchet MS", cursive'
  }[selectedTemplate];

  drawCenteredText(
    context,
    details.footer,
    WIDTH / 2,
    footerY,
    WIDTH - 100,
    footerFont,
    theme.text
  );

  if (selectedTemplate === "minimalist") {
    drawHeartDecoration(context, WIDTH / 2, footerY + 37, 20, theme.text, true);
  }

  if (selectedTemplate === "doodle") {
    drawHeartDecoration(context, 180, footerY + 3, 19, theme.text);
    drawHeartDecoration(context, WIDTH - 180, footerY + 3, 19, theme.text);
    drawSparkle(context, WIDTH / 2 - 45, footerY + 35, 8, theme.text);
    drawSparkle(context, WIDTH / 2 + 45, footerY + 35, 8, theme.text);
  }

  if (selectedTemplate === "colorful") {
    drawHeartDecoration(context, 170, footerY + 8, 21, "#ff5d91");
    drawHeartDecoration(context, WIDTH - 170, footerY + 8, 21, "#278bd5");
    drawStarDecoration(context, WIDTH / 2 - 60, footerY + 37, 12, "#ffb52e");
    drawStarDecoration(context, WIDTH / 2 + 60, footerY + 37, 12, "#9a62d5");
  }

  if (selectedTemplate === "elegant") {
    drawCenteredText(
      context,
      "A DAY TO REMEMBER",
      WIDTH / 2,
      footerY + 31,
      WIDTH - 100,
      '12px Georgia, "Times New Roman", serif',
      theme.text
    );

    drawSparkle(context, 90, footerY + 30, 7, theme.border);
    drawSparkle(context, WIDTH - 90, footerY + 30, 7, theme.border);
  }

  if (selectedTemplate === "retro") {
    drawHeartDecoration(context, WIDTH / 2, footerY + 35, 20, theme.text);
    drawWavyLine(context, 75, footerY + 39, 180, footerY + 30, "#e58c76", 2);
    drawWavyLine(context, WIDTH - 180, footerY + 30, WIDTH - 75, footerY + 39, "#e58c76", 2);
  }

  drawDoodleDecoration(context, selectedTemplate, WIDTH, HEIGHT, theme);

  completedStripDataUrl = canvas.toDataURL("image/png");

  completedStripBlob = await new Promise(resolve => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!completedStripBlob) {
    throw new Error("Unable to prepare the photostrip image.");
  }

  return completedStripBlob;
}

/* =========================
   17. CREATE PHOTOSTRIP
========================= */

createStripButton?.addEventListener("click", async () => {
  if (createStripButton.disabled) return;

  createStripButton.disabled = true;
  createStripButton.textContent = "Creating your photostrip...";

  try {
    await renderPhotostrip();
    stopCamera();
    showView("result");
    setStatus(resultStatus, `${TEMPLATE_DETAILS[selectedTemplate].name} photostrip is ready!`);
  } catch (error) {
    console.error(error);
    alert(error.message || "Unable to create your photostrip.");
  } finally {
    createStripButton.innerHTML =
      'Create my photostrip <span aria-hidden="true">↗</span>';

    updateCreateButton();
  }
});

/* =========================
   18. DOWNLOAD PHOTOSTRIP
========================= */

downloadStripButton?.addEventListener("click", async () => {
  try {
    if (!completedStripBlob) await renderPhotostrip();

    const url = URL.createObjectURL(completedStripBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `Syahlen-and-Atiqah-${selectedTemplate}-Photostrip.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);

    setStatus(resultStatus, "Your photostrip has been downloaded.");
  } catch (error) {
    console.error(error);

    setStatus(
      resultStatus,
      error.message || "Unable to download your photostrip.",
      true
    );
  }
});

/* =========================
   19. SAVE TO SUPABASE GALLERY
========================= */

saveStripButton?.addEventListener("click", async () => {
  if (isSavingStrip) return;

  if (!supabaseClient) {
    setStatus(resultStatus, "Supabase is not available.", true);
    return;
  }

  isSavingStrip = true;
  saveStripButton.disabled = true;
  saveStripButton.textContent = "Saving...";

  try {
    if (!completedStripBlob) await renderPhotostrip();

    const fileName =
      `photostrip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

    const filePath = `photostrips/${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, completedStripBlob, {
        contentType: "image/png",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: insertError } = await supabaseClient
      .from(PHOTOS_TABLE)
      .insert({
        name: "Wedding Guest",
        image_path: filePath
      });

    if (insertError) {
      console.error("Gallery database insert failed:", insertError);

      setStatus(
        resultStatus,
        "The photo uploaded, but it could not be added to the gallery database. Check your wedding_photos table.",
        true
      );
      return;
    }

    setStatus(resultStatus, "Your photostrip has been saved to the wedding gallery!");
  } catch (error) {
    console.error("Save photostrip error:", error);

    setStatus(
      resultStatus,
      error.message || "Unable to save your photostrip. Please try again.",
      true
    );
  } finally {
    isSavingStrip = false;
    saveStripButton.disabled = false;
    saveStripButton.textContent = "Save to wedding gallery";
  }
});

/* =========================
   20. MAKE ANOTHER STRIP
========================= */

makeAnotherButton?.addEventListener("click", () => {
  clearCurrentStrip();
  setPhotoSource("camera");
  showView("booth");
});

/* =========================
   21. LOAD WEDDING GALLERY
========================= */

async function loadGallery() {
  if (!galleryGrid) return;

  if (!supabaseClient) {
    galleryGrid.innerHTML =
      '<p class="empty-state">Gallery is currently unavailable.</p>';
    return;
  }

  galleryGrid.innerHTML =
    '<p class="empty-state">Loading wedding memories...</p>';

  try {
    const { data, error } = await supabaseClient
      .from(PHOTOS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) throw error;

    if (!data || data.length === 0) {
      galleryGrid.innerHTML =
        '<p class="empty-state">No photostrips have been shared yet. Be the first to create a memory!</p>';
      return;
    }

    galleryGrid.replaceChildren();

    data.forEach(item => {
      const card = document.createElement("article");
      card.className = "gallery-item";

      const image = document.createElement("img");
      image.alt = "Wedding photostrip";
      image.loading = "lazy";

      const path = item.image_path || item.path || item.image_url || "";

      if (/^https?:\/\//i.test(path)) {
        image.src = path;
      } else if (path) {
        const { data: urlData } = supabaseClient.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);

        image.src = urlData.publicUrl;
      }

      const caption = document.createElement("p");
      caption.textContent = item.name
        ? `A memory from ${item.name}`
        : "A memory from our special day";

      card.append(image, caption);
      galleryGrid.appendChild(card);
    });
  } catch (error) {
    console.error("Gallery error:", error);

    galleryGrid.innerHTML =
      '<p class="empty-state">Unable to load the gallery. Please check your Supabase table and storage permissions.</p>';
  }
}

/* =========================
   22. SUBMIT GUESTBOOK MESSAGE
========================= */

guestbookForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSubmittingGuestbook) return;

  if (!supabaseClient) {
    setStatus(guestbookStatus, "Supabase is not available.", true);
    return;
  }

  const name = guestNameInput.value.trim();
  const message = guestMessageInput.value.trim();

  if (!name || !message) {
    setStatus(guestbookStatus, "Please enter your name and message.", true);
    return;
  }

  isSubmittingGuestbook = true;
  submitGuestbookButton.disabled = true;
  submitGuestbookButton.textContent = "Sending...";

  try {
    const { error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .insert({ name, message });

    if (error) throw error;

    guestbookForm.reset();

    setStatus(
      guestbookStatus,
      "Your wishes have been sent. Thank you for sharing your love!"
    );

    await loadGuestbook();
  } catch (error) {
    console.error("Guestbook submission error:", error);

    setStatus(
      guestbookStatus,
      "Unable to send your message. Please check your guestbook table and try again.",
      true
    );
  } finally {
    isSubmittingGuestbook = false;
    submitGuestbookButton.disabled = false;
    submitGuestbookButton.textContent = "Send your wishes";
  }
});

/* =========================
   23. LOAD GUESTBOOK
========================= */

async function loadGuestbook() {
  if (!guestbookMessages) return;

  if (!supabaseClient) {
    guestbookMessages.innerHTML =
      '<p class="empty-state">Guestbook is currently unavailable.</p>';
    return;
  }

  guestbookMessages.innerHTML =
    '<p class="empty-state">Loading lovely messages...</p>';

  try {
    const { data, error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!data || data.length === 0) {
      guestbookMessages.innerHTML =
        '<p class="empty-state">No messages yet. Leave the first lovely wish!</p>';
      return;
    }

    guestbookMessages.replaceChildren();

    data.forEach(item => {
      const card = document.createElement("article");
      card.className = "guestbook-message";

      const heading = document.createElement("h3");
      heading.textContent = item.name || "Wedding Guest";

      const paragraph = document.createElement("p");
      paragraph.textContent = item.message || "";

      card.append(heading, paragraph);
      guestbookMessages.appendChild(card);
    });
  } catch (error) {
    console.error("Guestbook loading error:", error);

    guestbookMessages.innerHTML =
      '<p class="empty-state">Unable to load messages. Please check your Supabase configuration.</p>';
  }
}

/* =========================
   24. INITIALIZE
========================= */

function initializePhotobooth() {
  ensureTemplateOptions();

  updatePhotoSlots();
  updatePhotostripPreview();
  updateCameraCounter();
  updateCreateButton();

  setSelectedTemplate("minimalist");

  if (cameraPlaceholder) cameraPlaceholder.hidden = false;
  if (cameraPreview) cameraPreview.style.transform = "none";
  if (captureButton) captureButton.disabled = true;
  if (switchCameraButton) switchCameraButton.disabled = false;

  if (photostripCanvas) {
    photostripCanvas.width = 600;
    photostripCanvas.height = 1500;
  }
}

initializePhotobooth();