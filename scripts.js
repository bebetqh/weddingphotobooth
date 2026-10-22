/* =========================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Stable JavaScript
   Camera + Camera Switch + 3 Photos + Upload/Crop
   Six CSS-matched Templates + Download + Supabase
   Gallery + Guestbook
========================================================= */

/* =========================================================
   1. SUPABASE
========================================================= */

const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const STORAGE_BUCKET = "wedding-media";
const PHOTOS_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

const COUPLE_NAMES = "SYAHLEN & ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

const supabaseClient =
  window.supabase && typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

/* =========================================================
   2. HTML ELEMENTS
========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const boothView = $("#boothView");
const resultView = $("#resultView");
const galleryView = $("#galleryView");
const guestbookView = $("#guestbookView");

const homeButton = $("#homeButton");

const cameraPreview = $("#cameraPreview");
const cameraPlaceholder = $("#cameraPlaceholder");
const startCameraButton = $("#startCameraButton");
const switchCameraButton = $("#switchCameraButton");
const captureButton = $("#captureButton");
const cameraCounter = $("#cameraCounter");
const countdownOverlay = $("#countdownOverlay");
const countdownNumber = $("#countdownNumber");

const cameraModeButton = $("#cameraModeButton");
const uploadModeButton = $("#uploadModeButton");
const cameraPanel = $("#cameraPanel");
const uploadPanel = $("#uploadPanel");
const photoUploadInput = $("#photoUploadInput");
const uploadStatus = $("#uploadStatus");

const retakeAllButton = $("#retakeAllButton");
const createStripButton = $("#createStripButton");
const templateSelector = $("#templateSelector");

const photostripPreview = $("#photostripPreview");
const photostripCanvas = $("#photostripCanvas");

const downloadStripButton = $("#downloadStripButton");
const saveStripButton = $("#saveStripButton");
const makeAnotherButton = $("#makeAnotherButton");
const resultStatus = $("#resultStatus");

const galleryGrid = $("#galleryGrid");

const guestbookForm = $("#guestbookForm");
const guestNameInput = $("#guestName");
const guestMessageInput = $("#guestMessage");
const submitGuestbookButton = $("#submitGuestbookButton");
const guestbookStatus = $("#guestbookStatus");
const guestbookMessages = $("#guestbookMessages");

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
let isSavingStrip = false;
let isSubmittingGuestbook = false;

let selectedTemplate = "film";
let currentPhotoSource = "camera";
let currentPhotoIndex = 0;

let photoData = [null, null, null];

let completedStripBlob = null;
let completedStripDataUrl = null;

/* =========================================================
   4. SIX TEMPLATES — MATCH THE HTML AND CSS
========================================================= */

const TEMPLATE_DETAILS = {
  film: {
    name: "Classic Film",
    title: "Just Married",
    footer: "OUR WEDDING DAY"
  },

  minimalist: {
    name: "Minimalist White",
    title: "SYAHLEN ♥ ATIQAH",
    footer: WEDDING_DATE
  },

  doodle: {
    name: "Doodle Style",
    title: "Syahlen & Atiqah",
    footer: "FOREVER & ALWAYS"
  },

  elegant: {
    name: "Elegant Serif",
    title: "S Y A H L E N\n&  A T I Q A H",
    footer: WEDDING_DATE
  },

  chalkboard: {
    name: "Chalkboard",
    title: "BEST DAY EVER",
    footer: "♥ S & A ♥"
  },

  blackwhite: {
    name: "Black & White",
    title: "LOVE IN B&W",
    footer: "S & A"
  }
};

/* =========================================================
   5. GENERAL HELPERS
========================================================= */

function setStatus(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
  element.setAttribute("role", "status");

  if (isError) {
    element.style.color = "#a12e42";
  } else {
    element.style.removeProperty("color");
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function getImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error("This image could not be loaded. Please try another photo.")
    );

    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(
      new Error("Unable to read the selected photo.")
    );

    reader.readAsDataURL(file);
  });
}

function blobFromCanvas(canvas, type = "image/png", quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to prepare the image for download."));
    }, type, quality);
  });
}

function safeText(element, value) {
  if (element) element.textContent = value;
}

function getTemplateName() {
  return TEMPLATE_DETAILS[selectedTemplate]?.name || "Photostrip";
}

/* =========================================================
   6. NAVIGATION
========================================================= */

function showView(viewName) {
  const views = {
    booth: boothView,
    result: resultView,
    gallery: galleryView,
    guestbook: guestbookView
  };

  if (!views[viewName]) {
    console.warn("Unknown page:", viewName);
    return;
  }

  Object.entries(views).forEach(([name, element]) => {
    if (!element) return;

    const isActive = name === viewName;
    element.classList.toggle("active", isActive);
    element.hidden = !isActive;
  });

  $$(".nav-link").forEach(link => {
    const active = link.dataset.view === viewName;

    link.classList.toggle("active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  if (viewName !== "booth") {
    stopCamera();
  }

  if (viewName === "gallery") loadGallery();
  if (viewName === "guestbook") loadGuestbook();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$(".nav-link").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    showView(link.dataset.view);
  });
});

homeButton?.addEventListener("click", event => {
  event.preventDefault();
  showView("booth");
});

/* =========================================================
   7. CAMERA
========================================================= */

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (cameraPreview) {
    cameraPreview.pause();
    cameraPreview.srcObject = null;
    cameraPreview.style.transform = "";
  }

  if (captureButton) {
    captureButton.disabled = true;
  }
}

async function getAvailableCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    availableCameras = [];
    return [];
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

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

  if (/front|user|facetime|selfie/.test(label)) return "user";
  if (/back|rear|environment|world/.test(label)) return "environment";

  return "unknown";
}

async function requestCamera(facingMode) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
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

async function attachCamera(stream) {
  if (!cameraPreview) {
    stream.getTracks().forEach(track => track.stop());
    throw new Error("The camera preview element is missing from the HTML.");
  }

  cameraStream = stream;

  const track = stream.getVideoTracks()[0];
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

  cameraPreview.srcObject = stream;
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

  // Mirror the preview only for the front camera.
  cameraPreview.style.transform =
    currentFacingMode === "user" ? "scaleX(-1)" : "";

  if (cameraPlaceholder) cameraPlaceholder.hidden = true;

  if (captureButton && currentPhotoIndex < 3) {
    captureButton.disabled = false;
  }

  await getAvailableCameras();

  if (switchCameraButton) {
    switchCameraButton.disabled = availableCameras.length < 2;
  }
}

async function startCamera() {
  if (cameraStarting || switchingCamera) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    alert(
      "Camera access is unavailable. Open the website using HTTPS, or choose Upload photos."
    );
    return;
  }

  cameraStarting = true;

  if (startCameraButton) {
    startCameraButton.disabled = true;
    startCameraButton.textContent = "Starting camera...";
  }

  if (switchCameraButton) switchCameraButton.disabled = true;

  try {
    stopCamera();

    let stream = null;

    // First try the requested front/back camera.
    try {
      stream = await requestCamera(currentFacingMode);
    } catch (error) {
      console.warn("Facing mode unavailable; checking camera devices.", error);
    }

    // If the browser ignores the facing mode, try a labelled device.
    if (!stream) {
      const cameras = await getAvailableCameras();

      const match = cameras.find(
        device => cameraLabelType(device) === currentFacingMode
      );

      if (match) {
        stream = await requestCameraByDeviceId(match.deviceId);
        currentCameraDeviceId = match.deviceId;
      }
    }

    // Final fallback: use the browser's default camera.
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
    }

    await attachCamera(stream);
  } catch (error) {
    console.error("Camera start failed:", error);
    stopCamera();

    if (cameraPlaceholder) cameraPlaceholder.hidden = false;

    let message = "Unable to start the camera. ";

    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      message += "Please allow camera access in your browser settings.";
    } else if (error.name === "NotFoundError") {
      message += "No camera was found. You can upload photos instead.";
    } else if (error.name === "NotReadableError") {
      message += "The camera may be in use by another application.";
    } else {
      message += "Check your camera permissions and try again.";
    }

    alert(message);
  } finally {
    cameraStarting = false;

    if (startCameraButton) {
      startCameraButton.disabled = false;
      startCameraButton.textContent = "Start camera";
    }

    if (
      switchCameraButton &&
      availableCameras.length > 1
    ) {
      switchCameraButton.disabled = false;
    }
  }
}

async function switchCamera() {
  if (switchingCamera || cameraStarting) return;

  switchingCamera = true;

  if (switchCameraButton) switchCameraButton.disabled = true;

  try {
    const cameras = await getAvailableCameras();

    if (cameras.length < 2) {
      alert(
        "Only one camera is available. On some devices, camera labels appear after camera permission is granted."
      );
      return;
    }

    const oldDeviceId = currentCameraDeviceId;
    const targetMode =
      currentFacingMode === "user" ? "environment" : "user";

    const targetDevice = cameras.find(
      device =>
        cameraLabelType(device) === targetMode &&
        device.deviceId !== oldDeviceId
    );

    const otherDevice = cameras.find(
      device => device.deviceId !== oldDeviceId
    );

    const deviceToUse = targetDevice || otherDevice;

    // Try to switch to the opposite camera.
    if (deviceToUse) {
      try {
        const stream = await requestCameraByDeviceId(
          deviceToUse.deviceId
        );

        stopCamera();

        currentFacingMode = targetMode;
        currentCameraDeviceId = deviceToUse.deviceId;

        await attachCamera(stream);
        return;
      } catch (error) {
        console.warn("Device-specific switch failed:", error);
      }
    }

    // Fallback: ask the browser for the opposite facing mode.
    stopCamera();
    currentFacingMode = targetMode;

    const stream = await requestCamera(targetMode);
    await attachCamera(stream);
  } catch (error) {
    console.error("Camera switch failed:", error);

    alert(
      "Unable to switch cameras. Your current device or browser may not expose a second camera."
    );

    // Try to restore the original camera if switching failed.
    if (!cameraStream) {
      currentFacingMode =
        currentFacingMode === "user" ? "environment" : "user";

      await startCamera();
    }
  } finally {
    switchingCamera = false;

    if (switchCameraButton) {
      switchCameraButton.disabled = availableCameras.length < 2;
    }
  }
}

startCameraButton?.addEventListener("click", startCamera);
switchCameraButton?.addEventListener("click", switchCamera);

/* =========================================================
   8. CAMERA / UPLOAD MODE
========================================================= */

function setPhotoSource(source) {
  currentPhotoSource = source;

  const useCamera = source === "camera";

  cameraModeButton?.classList.toggle("active", useCamera);
  uploadModeButton?.classList.toggle("active", !useCamera);

  if (cameraPanel) cameraPanel.hidden = !useCamera;
  if (uploadPanel) uploadPanel.hidden = useCamera;

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
   9. COUNTDOWN AND CAPTURE
========================================================= */

async function runCountdown(seconds = 3) {
  if (!countdownOverlay || !countdownNumber) return;

  countdownOverlay.hidden = false;

  for (let number = seconds; number > 0; number--) {
    countdownNumber.textContent = String(number);
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

  if (!context) {
    throw new Error("Unable to capture the photo.");
  }

  // Save front-camera selfies mirrored, matching the preview.
  if (currentFacingMode === "user") {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  context.drawImage(
    cameraPreview,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL("image/jpeg", 0.94);
}

captureButton?.addEventListener("click", async () => {
  if (captureInProgress || currentPhotoIndex >= 3) return;

  if (!cameraStream) {
    setStatus(uploadStatus, "Start the camera before taking a photo.", true);
    return;
  }

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

    if (currentPhotoIndex === 3) {
      captureButton.textContent = "All photos captured";
      stopCamera();
    } else {
      captureButton.textContent = "Take photo";
    }
  } catch (error) {
    console.error("Photo capture failed:", error);
    alert(error.message || "Unable to take the photo.");
  } finally {
    captureInProgress = false;

    if (captureButton) {
      captureButton.disabled =
        currentPhotoIndex >= 3 || !cameraStream;
    }
  }
});

function updateCameraCounter() {
  if (!cameraCounter) return;

  const count = photoData.filter(Boolean).length;
  cameraCounter.textContent = `${count} / 3`;
}

/* =========================================================
   10. UPLOAD PHOTO CROP EDITOR
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
  if ($("#photoCropModal")) return;

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
    #photoCropModal[hidden] { display: none !important; }
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

  const canvas = $("#photoCropCanvas");

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

  $("#photoCropZoom").addEventListener("input", event => {
    cropZoom = Number(event.target.value) || 1;
    safeText($("#photoCropZoomValue"), `${Math.round(cropZoom * 100)}%`);

    clampCropPosition();
    drawCropEditor();
  });

  $("#photoCropReset").addEventListener("click", resetCropPosition);
  $("#photoCropConfirm").addEventListener("click", confirmCurrentCrop);
}

function resetCropPosition() {
  cropZoom = 1;
  cropOffsetX = 0;
  cropOffsetY = 0;

  if ($("#photoCropZoom")) $("#photoCropZoom").value = "1";
  safeText($("#photoCropZoomValue"), "100%");

  drawCropEditor();
}

function getCropDimensions() {
  const canvas = $("#photoCropCanvas");

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

async function openPhotoCropper(dataUrl, photoNumber) {
  installCropEditor();

  cropImage = await getImageFromDataUrl(dataUrl);

  cropZoom = 1;
  cropOffsetX = 0;
  cropOffsetY = 0;

  return new Promise(resolve => {
    cropResolver = resolve;

    safeText($("#photoCropProgress"), `PHOTO ${photoNumber} OF 3`);

    $("#photoCropZoom").value = "1";
    safeText($("#photoCropZoomValue"), "100%");

    $("#photoCropModal").hidden = false;

    drawCropEditor();
    $("#photoCropConfirm").focus();
  });
}

function closePhotoCropper() {
  const modal = $("#photoCropModal");
  if (modal) modal.hidden = true;

  cropImage = null;
  cropDragging = false;
}

/* =========================================================
   11. UPLOAD AND CROP THREE PHOTOS
========================================================= */

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

  setStatus(uploadStatus, "Preparing your photos...");

  try {
    const originals = [];

    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      await getImageFromDataUrl(dataUrl);
      originals.push(dataUrl);
    }

    const croppedPhotos = [];

    for (let index = 0; index < originals.length; index++) {
      setStatus(uploadStatus, `Adjusting photo ${index + 1} of 3...`);

      const cropped = await openPhotoCropper(
        originals[index],
        index + 1
      );

      croppedPhotos.push(cropped);
      closePhotoCropper();
    }

    photoData = croppedPhotos;
    currentPhotoIndex = 3;

    updatePhotoSlots();
    updatePhotostripPreview();
    updateCameraCounter();
    updateCreateButton();

    setStatus(uploadStatus, "All three photos are ready!");
  } catch (error) {
    console.error("Upload/crop error:", error);
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

/* =========================================================
   12. PHOTO SLOTS AND RETAKE
========================================================= */

function updatePhotoSlots() {
  for (let index = 0; index < 3; index++) {
    const image = $(`#photoSlot${index + 1}`);
    const slot = $(`.photo-slot[data-slot="${index}"]`);
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
  clearCurrentStrip();

  if (currentPhotoSource === "camera") {
    startCamera();
  } else {
    setStatus(uploadStatus, "Select three photos to begin again.");
  }
});

/* =========================================================
   13. TEMPLATE SELECTOR
   Keep existing HTML buttons and their CSS intact.
========================================================= */

function setSelectedTemplate(templateName) {
  if (!TEMPLATE_DETAILS[templateName]) return;

  selectedTemplate = templateName;

  $$(".template-option").forEach(button => {
    const selected = button.dataset.template === templateName;

    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  updatePhotostripPreview();

  // Changing the style invalidates the previously rendered strip.
  completedStripBlob = null;
  completedStripDataUrl = null;
}

templateSelector?.addEventListener("click", event => {
  const button = event.target.closest(".template-option");

  if (!button || !templateSelector.contains(button)) return;

  event.preventDefault();
  setSelectedTemplate(button.dataset.template);
});

/* =========================================================
   14. LIVE PREVIEW
========================================================= */

function updatePhotostripPreview() {
  if (!photostripPreview) return;

  const details = TEMPLATE_DETAILS[selectedTemplate];

  // Match the class names already used by the CSS.
  photostripPreview.className =
    `photostrip-preview template-${selectedTemplate}`;

  const title = photostripPreview.querySelector(".strip-preview-title");
  const footer = photostripPreview.querySelector(".strip-preview-footer");

  if (title) title.textContent = details.title.replace(/\n/g, " ");
  if (footer) footer.textContent = details.footer;

  for (let index = 0; index < 3; index++) {
    const image = $(`#stripPreviewPhoto${index + 1}`);
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
  if (!createStripButton) return;

  createStripButton.disabled = !photoData.every(Boolean);
}

/* =========================================================
   15. PHOTOSTRIP CANVAS HELPERS
========================================================= */

function drawCoverImage(context, image, x, y, width, height) {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;

  const scale = Math.max(
    width / imageWidth,
    height / imageHeight
  );

  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (imageWidth - sourceWidth) / 2;
  const sourceY = (imageHeight - sourceHeight) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
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

  context.fillText(text, x, y, maxWidth);

  context.restore();
}

function drawHeart(context, x, y, size, color, filled = true) {
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

  if (filled) context.fill();
  else context.stroke();

  context.restore();
}

function drawPhotostripDecoration(context, template, width, height) {
  const ink = template === "chalkboard" ? "#fffaf0" : "#4a101c";
  const accent = template === "blackwhite" ? "#222222" : "#b66e7e";

  if (template === "film") {
    context.fillStyle = "#242424";

    for (let y = 24; y < height - 24; y += 28) {
      context.fillRect(16, y, 12, 15);
      context.fillRect(width - 28, y, 12, 15);
    }
  }

  if (template === "doodle") {
    drawHeart(context, 40, 45, 20, accent);
    drawHeart(context, width - 40, height - 45, 20, accent);
    drawHeart(context, width - 40, 45, 14, ink, false);
    drawHeart(context, 40, height - 45, 14, ink, false);
  }

  if (template === "chalkboard") {
    drawHeart(context, 45, 45, 22, "#f4c95d", false);
    drawHeart(context, width - 45, height - 45, 22, "#f4c95d", false);
  }

  if (template === "elegant") {
    context.strokeStyle = "#b9a08b";
    context.lineWidth = 1;

    context.strokeRect(18, 18, width - 36, height - 36);
    context.strokeRect(25, 25, width - 50, height - 50);
  }

  if (template === "blackwhite") {
    context.strokeStyle = "#222222";
    context.lineWidth = 2;
    context.strokeRect(16, 16, width - 32, height - 32);
  }
}

/* =========================================================
   16. RENDER COMPLETE PHOTOSTRIP
========================================================= */

async function renderPhotostrip() {
  if (!photoData.every(Boolean)) {
    throw new Error("Please take or upload all three photos first.");
  }

  if (!photostripCanvas) {
    throw new Error("The photostrip canvas is missing from the HTML.");
  }

  const canvas = photostripCanvas;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare the photostrip.");
  }

  const WIDTH = 600;
  const SIDE = selectedTemplate === "film" ? 78 : 54;
  const PHOTO_WIDTH = WIDTH - SIDE * 2;
  const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * 3 / 4);
  const GAP = 16;
  const HEADER_HEIGHT = 150;
  const FOOTER_HEIGHT = 115;
  const OUTER = 32;

  const HEIGHT =
    OUTER +
    HEADER_HEIGHT +
    PHOTO_HEIGHT * 3 +
    GAP * 2 +
    FOOTER_HEIGHT +
    OUTER;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const images = await Promise.all(photoData.map(getImageFromDataUrl));

  const themes = {
    film: {
      background: "#242424",
      text: "#fffaf0",
      border: "#e4d4b7"
    },
    minimalist: {
      background: "#fffefa",
      text: "#34302e",
      border: "#ded6ce"
    },
    doodle: {
      background: "#fffdf4",
      text: "#282421",
      border: "#343434"
    },
    elegant: {
      background: "#f7eee6",
      text: "#342a26",
      border: "#c9b39c"
    },
    chalkboard: {
      background: "#171716",
      text: "#fffaf0",
      border: "#e9e1d2"
    },
    blackwhite: {
      background: "#fffefa",
      text: "#171717",
      border: "#272727"
    }
  };

  const theme = themes[selectedTemplate];

  context.clearRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = theme.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  drawPhotostripDecoration(context, selectedTemplate, WIDTH, HEIGHT);

  // Header
  const headerTitle = {
    film: "Just Married",
    minimalist: "SYAHLEN ♥ ATIQAH",
    doodle: "Syahlen & Atiqah",
    elegant: "S Y A H L E N",
    chalkboard: "BEST DAY EVER",
    blackwhite: "LOVE IN B&W"
  }[selectedTemplate];

  const headerSubtext = {
    film: COUPLE_NAMES,
    minimalist: "OUR WEDDING DAY",
    doodle: "♡ OUR SPECIAL DAY ♡",
    elegant: "&  A T I Q A H",
    chalkboard: COUPLE_NAMES,
    blackwhite: COUPLE_NAMES
  }[selectedTemplate];

  const headingFont = {
    film: 'italic 39px Georgia, "Times New Roman", serif',
    minimalist: 'bold 25px Georgia, "Times New Roman", serif',
    doodle: 'italic 37px "Trebuchet MS", cursive',
    elegant: '25px Georgia, "Times New Roman", serif',
    chalkboard: 'bold 28px "Trebuchet MS", sans-serif',
    blackwhite: 'bold 27px Georgia, "Times New Roman", serif'
  }[selectedTemplate];

  if (selectedTemplate === "elegant") {
    drawCenteredText(
      context,
      headerTitle,
      WIDTH / 2,
      OUTER + 38,
      WIDTH - 90,
      headingFont,
      theme.text
    );

    drawCenteredText(
      context,
      headerSubtext,
      WIDTH / 2,
      OUTER + 78,
      WIDTH - 90,
      '21px Georgia, "Times New Roman", serif',
      theme.text
    );
  } else {
    drawCenteredText(
      context,
      headerTitle,
      WIDTH / 2,
      OUTER + 52,
      WIDTH - 90,
      headingFont,
      theme.text
    );

    drawCenteredText(
      context,
      headerSubtext,
      WIDTH / 2,
      OUTER + 98,
      WIDTH - 90,
      '15px Arial, sans-serif',
      theme.text
    );
  }

  if (selectedTemplate === "film") {
    context.strokeStyle = theme.border;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(SIDE, OUTER + 126);
    context.lineTo(WIDTH - SIDE, OUTER + 126);
    context.stroke();
  }

  // Three photos, all using the same 4:3 frame.
  let photoY = OUTER + HEADER_HEIGHT;

  images.forEach((image, index) => {
    context.fillStyle = selectedTemplate === "chalkboard"
      ? "#fffaf0"
      : "#ffffff";

    const border = selectedTemplate === "film" ? 5 : 3;

    context.fillRect(
      SIDE - border,
      photoY - border,
      PHOTO_WIDTH + border * 2,
      PHOTO_HEIGHT + border * 2
    );

    drawCoverImage(
      context,
      image,
      SIDE,
      photoY,
      PHOTO_WIDTH,
      PHOTO_HEIGHT
    );

    if (selectedTemplate === "blackwhite") {
      const imageData = context.getImageData(
        SIDE,
        photoY,
        PHOTO_WIDTH,
        PHOTO_HEIGHT
      );

      const pixels = imageData.data;

      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        const gray = Math.round(
          0.299 * pixels[pixel] +
          0.587 * pixels[pixel + 1] +
          0.114 * pixels[pixel + 2]
        );

        pixels[pixel] = gray;
        pixels[pixel + 1] = gray;
        pixels[pixel + 2] = gray;
      }

      context.putImageData(imageData, SIDE, photoY);
    }

    if (selectedTemplate === "chalkboard") {
      drawCenteredText(
        context,
        String(index + 1).padStart(2, "0"),
        WIDTH - SIDE + 15,
        photoY + PHOTO_HEIGHT - 15,
        30,
        "bold 13px Arial, sans-serif",
        theme.text
      );
    }

    photoY += PHOTO_HEIGHT + GAP;
  });

  // Footer
  const footerY = photoY - GAP + 40;

  drawCenteredText(
    context,
    WEDDING_DATE,
    WIDTH / 2,
    footerY,
    WIDTH - 90,
    'bold 17px Arial, sans-serif',
    theme.text
  );

  drawCenteredText(
    context,
    TEMPLATE_DETAILS[selectedTemplate].footer,
    WIDTH / 2,
    footerY + 32,
    WIDTH - 90,
    'italic 17px Georgia, "Times New Roman", serif',
    theme.text
  );

  if (selectedTemplate === "minimalist" || selectedTemplate === "doodle") {
    drawHeart(context, WIDTH / 2, footerY + 64, 17, theme.text);
  }

  completedStripDataUrl = canvas.toDataURL("image/png");
  completedStripBlob = await blobFromCanvas(canvas, "image/png");

  return completedStripBlob;
}

/* =========================================================
   17. CREATE PHOTO STRIP
========================================================= */

createStripButton?.addEventListener("click", async () => {
  if (createStripButton.disabled) return;

  createStripButton.disabled = true;
  const originalText = createStripButton.textContent;
  createStripButton.textContent = "Creating your photostrip...";

  try {
    await renderPhotostrip();
    stopCamera();
    showView("result");

    setStatus(
      resultStatus,
      `${getTemplateName()} photostrip is ready!`
    );
  } catch (error) {
    console.error("Photostrip creation failed:", error);

    setStatus(
      resultStatus,
      error.message || "Unable to create the photostrip.",
      true
    );

    alert(error.message || "Unable to create the photostrip.");
  } finally {
    createStripButton.textContent =
      originalText || "Create my photostrip";

    updateCreateButton();
  }
});

/* =========================================================
   18. DOWNLOAD PHOTO STRIP
========================================================= */

downloadStripButton?.addEventListener("click", async () => {
  try {
    if (!completedStripBlob) {
      await renderPhotostrip();
    }

    const url = URL.createObjectURL(completedStripBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download =
      `Syahlen-and-Atiqah-${selectedTemplate}-Photostrip.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 2000);

    setStatus(resultStatus, "Your photostrip has been downloaded.");
  } catch (error) {
    console.error("Download failed:", error);

    setStatus(
      resultStatus,
      error.message || "Unable to download the photostrip.",
      true
    );
  }
});

/* =========================================================
   19. SAVE PHOTO STRIP TO SUPABASE
========================================================= */

saveStripButton?.addEventListener("click", async () => {
  if (isSavingStrip) return;

  if (!supabaseClient) {
    setStatus(
      resultStatus,
      "Supabase could not be initialized. Check the Supabase script and key.",
      true
    );
    return;
  }

  isSavingStrip = true;
  saveStripButton.disabled = true;

  const originalText = saveStripButton.textContent;
  saveStripButton.textContent = "Saving...";

  try {
    if (!completedStripBlob) {
      await renderPhotostrip();
    }

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
        "The image uploaded, but the gallery record could not be saved. Check the wedding_photos table permissions.",
        true
      );

      return;
    }

    setStatus(
      resultStatus,
      "Your photostrip has been saved to the wedding gallery!"
    );
  } catch (error) {
    console.error("Save failed:", error);

    setStatus(
      resultStatus,
      error.message || "Unable to save the photostrip. Please try again.",
      true
    );
  } finally {
    isSavingStrip = false;
    saveStripButton.disabled = false;
    saveStripButton.textContent =
      originalText || "Save to wedding gallery";
  }
});

/* =========================================================
   20. MAKE ANOTHER PHOTO STRIP
========================================================= */

makeAnotherButton?.addEventListener("click", () => {
  clearCurrentStrip();
  showView("booth");
  setPhotoSource("camera");
});

/* =========================================================
   21. LOAD WEDDING GALLERY
========================================================= */

async function loadGallery() {
  if (!galleryGrid) return;

  if (!supabaseClient) {
    galleryGrid.textContent =
      "Gallery unavailable. Please check the Supabase connection.";
    return;
  }

  galleryGrid.textContent = "Loading wedding memories...";

  try {
    const { data, error } = await supabaseClient
      .from(PHOTOS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) throw error;

    if (!data?.length) {
      galleryGrid.textContent =
        "No photostrips have been shared yet. Be the first to create a memory!";
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
        const { data: publicUrlData } = supabaseClient.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);

        image.src = publicUrlData.publicUrl;
      }

      const caption = document.createElement("p");
      caption.textContent = item.name
        ? `A memory from ${item.name}`
        : "A memory from our special day";

      card.append(image, caption);
      galleryGrid.appendChild(card);
    });
  } catch (error) {
    console.error("Gallery loading failed:", error);

    galleryGrid.textContent =
      "Unable to load the gallery. Check your Supabase table and storage permissions.";
  }
}

/* =========================================================
   22. SUBMIT GUESTBOOK MESSAGE
========================================================= */

guestbookForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSubmittingGuestbook) return;

  if (!supabaseClient) {
    setStatus(guestbookStatus, "Supabase is unavailable.", true);
    return;
  }

  const name = guestNameInput?.value.trim() || "";
  const message = guestMessageInput?.value.trim() || "";

  if (!name || !message) {
    setStatus(
      guestbookStatus,
      "Please enter your name and your wishes.",
      true
    );
    return;
  }

  isSubmittingGuestbook = true;

  if (submitGuestbookButton) {
    submitGuestbookButton.disabled = true;
    submitGuestbookButton.textContent = "Sending...";
  }

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
    console.error("Guestbook submission failed:", error);

    setStatus(
      guestbookStatus,
      "Unable to send your message. Check the wedding_guestbook table and permissions.",
      true
    );
  } finally {
    isSubmittingGuestbook = false;

    if (submitGuestbookButton) {
      submitGuestbookButton.disabled = false;
      submitGuestbookButton.textContent = "Send your wishes";
    }
  }
});

/* =========================================================
   23. LOAD GUESTBOOK
========================================================= */

async function loadGuestbook() {
  if (!guestbookMessages) return;

  if (!supabaseClient) {
    guestbookMessages.textContent =
      "Guestbook unavailable. Please check the Supabase connection.";
    return;
  }

  guestbookMessages.textContent = "Loading lovely messages...";

  try {
    const { data, error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!data?.length) {
      guestbookMessages.textContent =
        "No messages yet. Leave the first lovely wish!";
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
    console.error("Guestbook loading failed:", error);

    guestbookMessages.textContent =
      "Unable to load messages. Check your Supabase table and permissions.";
  }
}

/* =========================================================
   24. INITIALIZE
========================================================= */

function initializePhotobooth() {
  // Keep the six template buttons already present in the HTML.
  const availableTemplateButton = $(
    `.template-option[data-template="${selectedTemplate}"]`
  );

  if (!availableTemplateButton) {
    const firstValidButton = $$(".template-option").find(button =>
      Boolean(TEMPLATE_DETAILS[button.dataset.template])
    );

    if (firstValidButton) {
      selectedTemplate = firstValidButton.dataset.template;
    }
  }

  setSelectedTemplate(selectedTemplate);

  updatePhotoSlots();
  updatePhotostripPreview();
  updateCameraCounter();
  updateCreateButton();

  if (cameraPlaceholder) cameraPlaceholder.hidden = false;

  if (captureButton) {
    captureButton.disabled = true;
  }

  if (switchCameraButton) {
    switchCameraButton.disabled = true;
  }

  if (photostripCanvas) {
    photostripCanvas.width = 600;
    photostripCanvas.height = 1500;
  }

  if (cameraPanel) cameraPanel.hidden = false;
  if (uploadPanel) uploadPanel.hidden = true;

  cameraModeButton?.classList.add("active");
  uploadModeButton?.classList.remove("active");

  // Don't request camera access until the guest chooses to start it.
  console.log("Syahlen & Atiqah photobooth initialized.");
}

initializePhotobooth();