/* =========================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Camera + Upload + 5 Photostrip Styles
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

let selectedTemplate = "film";
let currentPhotoIndex = 0;
let photoData = [null, null, null];

let completedStripBlob = null;
let completedStripDataUrl = null;

let currentPhotoSource = "camera";
let isSavingStrip = false;
let isSubmittingGuestbook = false;


const TEMPLATE_DETAILS = {
  film: {
    title: "OUR DAY",
    footer: "SYAHLEN & ATIQAH ♥"
  },

  minimalist: {
    title: "S + A",
    footer: "THE WEDDING"
  },

  doodle: {
    title: "♡ LOVE ♡",
    footer: "FOREVER & ALWAYS"
  },

  elegant: {
    title: "Syahlen & Atiqah",
    footer: "WITH LOVE"
  },

  chalkboard: {
    title: "BEST DAY EVER",
    footer: "♥ S & A ♥"
  },

  burgundy: {
    title: "SYAHLEN & ATIQAH",
    footer: "OUR FOREVER BEGINS ♥"
  }
};

const TEMPLATE_COLORS = {
  film: {
    background: "#11100f",
    border: "#625746",
    text: "#f7e8d3",
    photoBorder: "#e4d2b5"
  },

  minimalist: {
    background: "#fffefa",
    border: "#ded6ce",
    text: "#34302e",
    photoBorder: "#ffffff"
  },

  doodle: {
    background: "#fff8ed",
    border: "#dfb8c5",
    text: "#795266",
    photoBorder: "#d2a7b5"
  },

  elegant: {
    background: "#f8efe3",
    border: "#c8ad8c",
    text: "#715440",
    photoBorder: "#e7d7c1"
  },

  chalkboard: {
    background: "#26312c",
    border: "#d4d2c6",
    text: "#f5f0e4",
    photoBorder: "#d4d2c6"
  },

  burgundy: {
    background: "#4a101c",
    border: "#c99a8d",
    text: "#fff1e8",
    photoBorder: "#e8c9bd"
  }
};


/* =========================
   4. GENERAL HELPERS
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
    image.onerror = () => {
      reject(new Error("Unable to load this photo."));
    };

    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => {
      reject(new Error("Unable to read the selected photo."));
    };

    reader.readAsDataURL(file);
  });
}

function clearCompletedStrip() {
  completedStripBlob = null;
  completedStripDataUrl = null;
}

/* =========================================================
   4A. UPLOAD PHOTO 4:3 CROP EDITOR
========================================================= */

let cropQueue = [];
let cropQueueIndex = 0;
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
      box-shadow: 0 20px 60px rgba(0, 0, 0, .25);
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
      aspect-ratio: 4 / 3;
      height: auto;
      background: #eadfd9;
      border: 3px solid #d8b9b6;
      border-radius: 10px;
      touch-action: none;
      cursor: grab;
      object-fit: contain;
    }

    #photoCropCanvas:active {
      cursor: grabbing;
    }

    .crop-zoom-label {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin: 18px 0 8px;
      font-size: 14px;
      font-weight: 600;
    }

    #photoCropZoom {
      width: 100%;
      accent-color: #4a101c;
      cursor: pointer;
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
        Move your photo inside the 4:3 frame.
        Zoom in or out until you are happy with the result.
      </p>

      <canvas id="photoCropCanvas" width="800" height="600"></canvas>

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
      />

      <p class="crop-editor-hint">
        Drag the picture to adjust its position.
      </p>

      <div class="crop-editor-actions">
        <button type="button" id="photoCropReset">
          Reset crop
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
    cropDragStartX = event.clientX;
    cropDragStartY = event.clientY;
    cropStartOffsetX = cropOffsetX;
    cropStartOffsetY = cropOffsetY;

    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", event => {
    if (!cropDragging || !cropImage) return;

    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    cropOffsetX =
      cropStartOffsetX +
      (event.clientX - cropDragStartX) * scaleX;

    cropOffsetY =
      cropStartOffsetY +
      (event.clientY - cropDragStartY) * scaleY;

    clampCropPosition();
    drawCropEditor();
  });

  const stopDragging = () => {
    cropDragging = false;
  };

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);

  document.getElementById("photoCropZoom")
    .addEventListener("input", event => {
      cropZoom = Number(event.target.value) || 1;

      document.getElementById("photoCropZoomValue").textContent =
        `${Math.round(cropZoom * 100)}%`;

      clampCropPosition();
      drawCropEditor();
    });

  document.getElementById("photoCropReset")
    .addEventListener("click", resetCropPosition);

  document.getElementById("photoCropConfirm")
    .addEventListener("click", confirmCurrentCrop);
}

function resetCropPosition() {
  if (!cropImage) return;

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

  const baseScale = Math.max(
    canvas.width / cropImage.naturalWidth,
    canvas.height / cropImage.naturalHeight
  );

  const scale = baseScale * cropZoom;

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

  const maxOffsetX = Math.max(0, (width - canvas.width) / 2);
  const maxOffsetY = Math.max(0, (height - canvas.height) / 2);

  cropOffsetX = Math.max(
    -maxOffsetX,
    Math.min(maxOffsetX, cropOffsetX)
  );

  cropOffsetY = Math.max(
    -maxOffsetY,
    Math.min(maxOffsetY, cropOffsetY)
  );
}

function drawCropEditor() {
  const dimensions = getCropDimensions();

  if (!dimensions) return;

  const { canvas, scale, width, height } = dimensions;
  const context = canvas.getContext("2d");

  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);

  const x = (canvas.width - width) / 2 + cropOffsetX;
  const y = (canvas.height - height) / 2 + cropOffsetY;

  context.save();

  context.beginPath();
  context.rect(0, 0, canvas.width, canvas.height);
  context.clip();

  context.drawImage(
    cropImage,
    x,
    y,
    cropImage.naturalWidth * scale,
    cropImage.naturalHeight * scale
  );

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

  if (!context) {
    alert("Unable to save this crop. Please try again.");
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

  const croppedDataUrl = output.toDataURL("image/jpeg", 0.94);

  const resolve = cropResolver;
  cropResolver = null;

  resolve(croppedDataUrl);
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

      const modal = document.getElementById("photoCropModal");
      const progress = document.getElementById("photoCropProgress");
      const zoomInput = document.getElementById("photoCropZoom");
      const zoomValue = document.getElementById("photoCropZoomValue");

      progress.textContent = `PHOTO ${photoNumber} OF 3`;
      zoomInput.value = "1";
      zoomValue.textContent = "100%";

      modal.hidden = false;

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
   5. NAVIGATION
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

    const active = name === viewName;

    element.classList.toggle("active", active);
    element.hidden = !active;
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === viewName
    );
  });

  if (viewName === "gallery") loadGallery();
  if (viewName === "guestbook") loadGuestbook();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach(button => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

document.getElementById("homeButton")?.addEventListener("click", event => {
  event.preventDefault();
  showView("booth");
});

/* =========================================================
   6. CAMERA
   - Prefer the requested facing mode.
   - Use device IDs as a fallback.
   - Avoid reusing the old device when switching.
========================================================= */

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

    availableCameras = devices.filter(device => {
      return device.kind === "videoinput";
    });

    return availableCameras;
  } catch (error) {
    console.warn("Unable to list cameras:", error);

    availableCameras = [];
    return [];
  }
}

function cameraLabelType(device) {
  const label = (device.label || "").toLowerCase();

  if (
    label.includes("front") ||
    label.includes("user") ||
    label.includes("facetime") ||
    label.includes("selfie")
  ) {
    return "user";
  }

  if (
    label.includes("back") ||
    label.includes("rear") ||
    label.includes("environment") ||
    label.includes("world")
  ) {
    return "environment";
  }

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
    alert(
      "Camera access is unavailable. Please use HTTPS or localhost, allow camera access, or choose Upload photos."
    );
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
    const previousDeviceId = currentCameraDeviceId;

    stopCamera();

    let newStream = null;

    /*
      First: ask for the requested front/rear camera.
    */
    try {
      newStream = await requestCameraByFacingMode(currentFacingMode);
    } catch (facingError) {
      console.warn(
        `Could not open ${currentFacingMode} camera using facingMode:`,
        facingError
      );
    }

    /*
      Second: try a camera whose label matches the requested side.
    */
    if (!newStream) {
      const cameras = await getAvailableCameras();

      const matchingCamera = cameras.find(device => {
        return cameraLabelType(device) === currentFacingMode;
      });

      if (matchingCamera) {
        try {
          newStream = await requestCameraByDeviceId(
            matchingCamera.deviceId
          );

          currentCameraDeviceId = matchingCamera.deviceId;
        } catch (deviceError) {
          console.warn(
            "Matching camera could not be opened:",
            deviceError
          );
        }
      }
    }

    /*
      Third: try a different camera from the previous one.
    */
    if (!newStream) {
      const cameras = await getAvailableCameras();

      const alternativeCamera = cameras.find(device => {
        return device.deviceId !== previousDeviceId;
      });

      if (alternativeCamera) {
        newStream = await requestCameraByDeviceId(
          alternativeCamera.deviceId
        );

        currentCameraDeviceId = alternativeCamera.deviceId;
      }
    }

    /*
      Final fallback: let the browser choose a camera.
    */
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

    const videoTrack = cameraStream.getVideoTracks()[0];
    const settings = videoTrack?.getSettings?.() || {};

    if (settings.deviceId) {
      currentCameraDeviceId = settings.deviceId;
    }

    if (
      settings.facingMode === "user" ||
      settings.facingMode === "environment"
    ) {
      currentFacingMode = settings.facingMode;
    }

    cameraPreview.srcObject = cameraStream;
    cameraPreview.autoplay = true;
    cameraPreview.playsInline = true;
    cameraPreview.muted = true;

    await new Promise((resolve, reject) => {
      if (
        cameraPreview.readyState >= 1 &&
        cameraPreview.videoWidth > 0
      ) {
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

    cameraPreview.style.transform =
      currentFacingMode === "user" ? "scaleX(-1)" : "none";

    if (cameraPlaceholder) {
      cameraPlaceholder.hidden = true;
    }

    if (captureButton && currentPhotoIndex < 3) {
      captureButton.disabled = false;
      captureButton.textContent = "Take photo";
    }

    await getAvailableCameras();

    if (switchCameraButton) {
      switchCameraButton.disabled = false;
    }
  } catch (error) {
    console.error("Camera error:", error);

    stopCamera();

    if (cameraPlaceholder) {
      cameraPlaceholder.hidden = false;
    }

    let message = "Unable to start the camera. ";

    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      message += "Please allow camera access in your browser settings.";
    } else if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      message += "No compatible camera was found. You can upload photos instead.";
    } else if (
      error.name === "NotReadableError" ||
      error.name === "TrackStartError"
    ) {
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

    if (switchCameraButton) {
      switchCameraButton.disabled = false;
    }
  }
}

async function switchCamera() {
  if (switchingCamera || cameraStarting) return;

  switchingCamera = true;

  if (switchCameraButton) {
    switchCameraButton.disabled = true;
  }

  try {
    await getAvailableCameras();

    if (availableCameras.length < 2) {
      alert(
        "Only one camera is available to this browser. If you are using a phone, check that the browser has permission to access both cameras."
      );
      return;
    }

    const previousDeviceId = currentCameraDeviceId;

    const desiredFacingMode =
      currentFacingMode === "user" ? "environment" : "user";

    const matchingCamera = availableCameras.find(device => {
      return (
        cameraLabelType(device) === desiredFacingMode &&
        device.deviceId !== previousDeviceId
      );
    });

    const otherCamera = availableCameras.find(device => {
      return device.deviceId !== previousDeviceId;
    });

    /*
      If a front/back-labelled camera exists, try it first.
      Otherwise choose another device.
    */
    const targetCamera = matchingCamera || otherCamera;

    if (!targetCamera) {
      alert("No alternative camera was found.");
      return;
    }

    stopCamera();

    currentCameraDeviceId = targetCamera.deviceId;

    try {
      cameraStream = await requestCameraByDeviceId(
        targetCamera.deviceId
      );
    } catch (deviceError) {
      console.warn(
        "Could not open the selected camera by device ID:",
        deviceError
      );

      currentCameraDeviceId = null;
      currentFacingMode = desiredFacingMode;

      await startCamera();
      return;
    }

    const track = cameraStream.getVideoTracks()[0];
    const settings = track?.getSettings?.() || {};

    currentCameraDeviceId =
      settings.deviceId || targetCamera.deviceId;

    if (
      settings.facingMode === "user" ||
      settings.facingMode === "environment"
    ) {
      currentFacingMode = settings.facingMode;
    } else {
      currentFacingMode =
        cameraLabelType(targetCamera) !== "unknown"
          ? cameraLabelType(targetCamera)
          : desiredFacingMode;
    }

    cameraPreview.srcObject = cameraStream;
    cameraPreview.autoplay = true;
    cameraPreview.playsInline = true;
    cameraPreview.muted = true;

    await new Promise((resolve, reject) => {
      if (
        cameraPreview.readyState >= 1 &&
        cameraPreview.videoWidth > 0
      ) {
        resolve();
        return;
      }

      const onLoaded = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error("The selected camera preview could not be loaded."));
      };

      const cleanup = () => {
        cameraPreview.removeEventListener("loadedmetadata", onLoaded);
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

    cameraPreview.style.transform =
      currentFacingMode === "user" ? "scaleX(-1)" : "none";

    if (cameraPlaceholder) {
      cameraPlaceholder.hidden = true;
    }

    if (captureButton && currentPhotoIndex < 3) {
      captureButton.disabled = false;
      captureButton.textContent = "Take photo";
    }

    await getAvailableCameras();
  } catch (error) {
    console.error("Camera switching failed:", error);

    stopCamera();

    if (cameraPlaceholder) {
      cameraPlaceholder.hidden = false;
    }

    alert(
      "Unable to switch cameras. Please check browser camera permissions and try again."
    );
  } finally {
    switchingCamera = false;

    if (switchCameraButton) {
      switchCameraButton.disabled = false;
    }
  }
}

startCameraButton?.addEventListener("click", startCamera);
switchCameraButton?.addEventListener("click", switchCamera);

/* =========================
   7. CAMERA / UPLOAD MODES
========================= */

function setPhotoSource(source) {
  currentPhotoSource = source;

  const useCamera = source === "camera";

  cameraModeButton?.classList.toggle("active", useCamera);
  uploadModeButton?.classList.toggle("active", !useCamera);

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

/* =========================
   8. COUNTDOWN AND CAPTURE
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
    throw new Error(
      "The camera is not ready yet. Please try again."
    );
  }

  const canvas = document.createElement("canvas");

  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to capture this photo.");
  }

  /*
    Mirror front-camera photos so they match the mirrored preview.
  */
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

  return canvas.toDataURL("image/jpeg", 0.92);
}

captureButton?.addEventListener("click", async () => {
  if (captureInProgress || currentPhotoIndex >= 3) return;

  captureInProgress = true;
  captureButton.disabled = true;

  try {
    await runCountdown(3);

    const photo = captureCurrentFrame();

    photoData[currentPhotoIndex] = photo;
    currentPhotoIndex++;

    clearCompletedStrip();

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

    if (
      captureButton &&
      currentPhotoIndex < 3 &&
      cameraStream
    ) {
      captureButton.disabled = false;
    }
  }
});

function updateCameraCounter() {
  if (cameraCounter) {
    cameraCounter.textContent =
      `${photoData.filter(Boolean).length} / 3`;
  }
}

/* =========================================================
   9. UPLOAD EXACTLY THREE + EDITABLE 4:3 CROPPING
========================================================= */

photoUploadInput?.addEventListener("change", async event => {
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

  const invalidFile = files.find(file => {
    return !file.type.startsWith("image/");
  });

  if (invalidFile) {
    setStatus(
      uploadStatus,
      "Please select image files only.",
      true
    );

    photoUploadInput.value = "";
    return;
  }

  const oversizedFile = files.find(file => {
    return file.size > 15 * 1024 * 1024;
  });

  if (oversizedFile) {
    setStatus(
      uploadStatus,
      "Each photo must be smaller than 15 MB.",
      true
    );

    photoUploadInput.value = "";
    return;
  }

  stopCamera();

  if (photoUploadInput) {
    photoUploadInput.disabled = true;
  }

  setStatus(
    uploadStatus,
    "Preparing your photos for cropping..."
  );

  try {
    const originalPhotos = await Promise.all(
      files.map(async file => {
        const dataUrl = await readFileAsDataUrl(file);

        await getImageFromDataUrl(dataUrl);

        return dataUrl;
      })
    );

    const croppedPhotos = [];

    for (
      let index = 0;
      index < originalPhotos.length;
      index++
    ) {
      setStatus(
        uploadStatus,
        `Adjusting photo ${index + 1} of 3...`
      );

      const croppedPhoto = await openPhotoCropper(
        originalPhotos[index],
        index + 1
      );

      croppedPhotos.push(croppedPhoto);

      closePhotoCropper();
    }

    photoData = croppedPhotos;
    currentPhotoIndex = 3;

    clearCompletedStrip();

    updatePhotoSlots();
    updatePhotostripPreview();
    updateCameraCounter();
    updateCreateButton();

    setStatus(
      uploadStatus,
      "All three cropped photos are ready! You can create your photostrip."
    );
  } catch (error) {
    console.error("Photo upload/cropping error:", error);

    closePhotoCropper();

    setStatus(
      uploadStatus,
      error.message ||
        "Unable to prepare your photos. Please try again.",
      true
    );
  } finally {
    if (photoUploadInput) {
      photoUploadInput.disabled = false;
      photoUploadInput.value = "";
    }
  }
});

/* =========================
   10. UPDATE PHOTO SLOTS
========================= */

function updatePhotoSlots() {
  for (let index = 0; index < 3; index++) {
    const image = document.getElementById(
      `photoSlot${index + 1}`
    );

    const slot = document.querySelector(
      `.photo-slot[data-slot="${index}"]`
    );

    const placeholder = slot?.querySelector(".slot-placeholder");

    if (!image) continue;

    if (photoData[index]) {
      image.src = photoData[index];
      image.hidden = false;

      if (placeholder) {
        placeholder.hidden = true;
      }
    } else {
      image.removeAttribute("src");
      image.hidden = true;

      if (placeholder) {
        placeholder.hidden = false;
      }
    }
  }
}

/* =========================
   11. CLEAR / RETAKE PHOTOS
========================= */

function resetPhotoboothPhotos() {
  photoData = [null, null, null];
  currentPhotoIndex = 0;

  clearCompletedStrip();

  if (photoUploadInput) {
    photoUploadInput.value = "";
  }

  if (captureButton) {
    captureButton.textContent = "Take photo";
  }

  setStatus(uploadStatus, "No photos selected yet.");
  setStatus(resultStatus, "");

  updatePhotoSlots();
  updatePhotostripPreview();
  updateCameraCounter();
  updateCreateButton();
}

retakeAllButton?.addEventListener("click", () => {
  resetPhotoboothPhotos();

  if (currentPhotoSource === "camera") {
    startCamera();
  }
});

/* =========================
   12. SELECT PHOTOSTRIP STYLE
========================= */

function setSelectedTemplate(templateName) {
  if (!TEMPLATE_DETAILS[templateName]) return;

  selectedTemplate = templateName;

  document.querySelectorAll(".template-option").forEach(button => {
    const selected =
      button.dataset.template === templateName;

    button.classList.toggle("active", selected);

    button.setAttribute(
      "aria-pressed",
      String(selected)
    );
  });

  clearCompletedStrip();
  updatePhotostripPreview();
}

templateSelector?.addEventListener("click", event => {
  const button = event.target.closest(".template-option");

  if (!button) return;

  setSelectedTemplate(button.dataset.template);
});

/* =========================
   13. LIVE PHOTOSTRIP PREVIEW
========================= */

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

      if (placeholder) {
        placeholder.hidden = true;
      }
    } else {
      image.removeAttribute("src");
      image.hidden = true;

      if (placeholder) {
        placeholder.hidden = false;
      }
    }
  }
}

function updateCreateButton() {
  if (!createStripButton) return;

  createStripButton.disabled =
    !photoData.every(Boolean);
}

/* =========================
   14. CANVAS DRAWING HELPERS
========================= */

function drawCoverImage(
  context,
  image,
  x,
  y,
  width,
  height
) {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;

  const scale = Math.max(
    width / imageWidth,
    height / imageHeight
  );

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

  let displayText = text;

  while (
    context.measureText(displayText).width > maxWidth &&
    displayText.length > 3
  ) {
    displayText = displayText.slice(0, -1);
  }

  if (displayText !== text) {
    displayText = displayText.trimEnd() + "…";
  }

  context.fillText(displayText, x, y, maxWidth);

  context.restore();
}

function drawHeartDecoration(
  context,
  x,
  y,
  size,
  color
) {
  context.save();

  context.translate(x, y);
  context.scale(size / 24, size / 24);
  context.fillStyle = color;

  context.beginPath();

  context.moveTo(12, 21);
  context.bezierCurveTo(10, 19, 1, 13, 1, 7);
  context.bezierCurveTo(1, 1, 8, 0, 12, 5);
  context.bezierCurveTo(16, 0, 23, 1, 23, 7);
  context.bezierCurveTo(23, 13, 14, 19, 12, 21);

  context.fill();
  context.restore();
}

function drawFrameBorder(
  context,
  x,
  y,
  width,
  height,
  color,
  lineWidth
) {
  context.save();

  context.strokeStyle = color;
  context.lineWidth = lineWidth;

  context.strokeRect(
    x,
    y,
    width,
    height
  );

  context.restore();
}

function drawDashedFrameBorder(
  context,
  x,
  y,
  width,
  height,
  color,
  lineWidth = 3
) {
  context.save();

  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.setLineDash([9, 7]);

  context.strokeRect(
    x,
    y,
    width,
    height
  );

  context.setLineDash([]);
  context.restore();
}

/* =========================
   15. RENDER COMPLETE STRIP
========================= */

async function renderPhotostrip() {
  if (!photoData.every(Boolean)) {
    throw new Error(
      "Please take or upload all three photos first."
    );
  }

  const canvas = photostripCanvas;
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    throw new Error(
      "Unable to create the photostrip."
    );
  }

  const WIDTH = 600;
  const SIDE_PADDING = 42;
  const PHOTO_WIDTH = WIDTH - SIDE_PADDING * 2;
  const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * 3 / 4);
  const PHOTO_GAP = 18;
  const TITLE_HEIGHT = 112;
  const FOOTER_HEIGHT = 100;
  const TOP_PADDING = 30;
  const BOTTOM_PADDING = 30;

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

  const images = await Promise.all(
    photoData.map(getImageFromDataUrl)
  );

  context.clearRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = theme.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  /*
    Outer borders differ according to the selected style.
  */
  
if (selectedTemplate === "film") {
  drawFrameBorder(
    context, 10, 10,
    WIDTH - 20, HEIGHT - 20,
    "#262522", 4
  );

} else if (selectedTemplate === "minimalist") {
  drawFrameBorder(
    context, 10, 10,
    WIDTH - 20, HEIGHT - 20,
    "#dedede", 2
  );

  drawFrameBorder(
    context, 20, 20,
    WIDTH - 40, HEIGHT - 40,
    "#eee8e1", 1
  );

} else if (selectedTemplate === "doodle") {
  drawFrameBorder(
    context, 9, 9,
    WIDTH - 18, HEIGHT - 18,
    theme.border, 3
  );

} else if (selectedTemplate === "elegant") {
  drawFrameBorder(
    context, 12, 12,
    WIDTH - 24, HEIGHT - 24,
    theme.border, 2
  );

  drawFrameBorder(
    context, 24, 24,
    WIDTH - 48, HEIGHT - 48,
    theme.border, 1
  );

} else if (selectedTemplate === "chalkboard") {
  drawDashedFrameBorder(
    context, 12, 12,
    WIDTH - 24, HEIGHT - 24,
    theme.border, 3
  );

} else if (selectedTemplate === "burgundy") {
  drawFrameBorder(
    context, 10, 10,
    WIDTH - 20, HEIGHT - 20,
    "#c99a8d", 4
  );

  drawFrameBorder(
    context, 21, 21,
    WIDTH - 42, HEIGHT - 42,
    "#8e4654", 2
  );
}


  const titleY = TOP_PADDING + 38;

  if (selectedTemplate === "doodle") {
    drawHeartDecoration(
      context,
      68,
      titleY - 8,
      20,
      theme.text
    );

    drawHeartDecoration(
      context,
      WIDTH - 68,
      titleY - 8,
      20,
      theme.text
    );
  }

  
let titleFont =
  'bold 35px Georgia, "Times New Roman", serif';

if (selectedTemplate === "film") {
  titleFont = 'bold 32px Georgia, "Times New Roman", serif';

} else if (selectedTemplate === "minimalist") {
  titleFont = "30px Arial, sans-serif";

} else if (selectedTemplate === "doodle") {
  titleFont = 'italic 34px Georgia, "Times New Roman", serif';

} else if (selectedTemplate === "elegant") {
  titleFont = 'italic 29px Georgia, "Times New Roman", serif';

} else if (selectedTemplate === "chalkboard") {
  titleFont = 'bold 31px Georgia, "Times New Roman", serif';

} else if (selectedTemplate === "burgundy") {
  titleFont = 'bold 29px Georgia, "Times New Roman", serif';
}


  drawCenteredText(
    context,
    details.title,
    WIDTH / 2,
    titleY,
    WIDTH - 100,
    titleFont,
    theme.text
  );

  /*
    Decorative separator under the title.
  */
  if (selectedTemplate === "film") {
    context.save();

    context.strokeStyle = "#625746";
    context.lineWidth = 2;

    context.beginPath();
    context.moveTo(40, TOP_PADDING + 78);
    context.lineTo(WIDTH - 40, TOP_PADDING + 78);
    context.stroke();

    context.restore();
  } else if (selectedTemplate === "doodle") {
    drawCenteredText(
      context,
      "♡  ✧  ☆  ✧  ♡",
      WIDTH / 2,
      TOP_PADDING + 78,
      WIDTH - 100,
      "22px Georgia, serif",
      theme.text
    );
  } else if (selectedTemplate === "chalkboard") {
    drawCenteredText(
      context,
      "✧  ♡  ✧",
      WIDTH / 2,
      TOP_PADDING + 78,
      WIDTH - 100,
      "22px Georgia, serif",
      theme.text
    );

} else if (selectedTemplate === "burgundy") {
  drawCenteredText(
    context,
    "♡  ✧  ♡  ✧  ♡",
    WIDTH / 2,
    TOP_PADDING + 78,
    WIDTH - 100,
    '22px Georgia, "Times New Roman", serif',
    theme.text
  );

  } else {
    context.save();

    context.strokeStyle = theme.border;
    context.lineWidth = 2;

    context.beginPath();
    context.moveTo(WIDTH / 2 - 48, TOP_PADDING + 76);
    context.lineTo(WIDTH / 2 + 48, TOP_PADDING + 76);
    context.stroke();

    context.restore();
  }

  let photoY = TOP_PADDING + TITLE_HEIGHT;

  images.forEach((image, index) => {
    /*
      Photo frame and border depend on the selected template.
    */
    drawCoverImage(
      context,
      image,
      SIDE_PADDING,
      photoY,
      PHOTO_WIDTH,
      PHOTO_HEIGHT
    );

    if (selectedTemplate === "film") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 5,
        photoY - 5,
        PHOTO_WIDTH + 10,
        PHOTO_HEIGHT + 10,
        theme.photoBorder,
        5
      );

      drawFrameBorder(
        context,
        SIDE_PADDING - 8,
        photoY - 8,
        PHOTO_WIDTH + 16,
        PHOTO_HEIGHT + 16,
        "#776c5b",
        1
      );
    } else if (selectedTemplate === "minimalist") {
      drawFrameBorder(
        context,
        SIDE_PADDING,
        photoY,
        PHOTO_WIDTH,
        PHOTO_HEIGHT,
        "#ded6ce",
        1
      );
    } else if (selectedTemplate === "doodle") {
      drawDashedFrameBorder(
        context,
        SIDE_PADDING - 3,
        photoY - 3,
        PHOTO_WIDTH + 6,
        PHOTO_HEIGHT + 6,
        theme.photoBorder,
        3
      );
    } else if (selectedTemplate === "elegant") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 4,
        photoY - 4,
        PHOTO_WIDTH + 8,
        PHOTO_HEIGHT + 8,
        theme.photoBorder,
        4
      );
    } else if (selectedTemplate === "chalkboard") {
      drawDashedFrameBorder(
        context,
        SIDE_PADDING - 3,
        photoY - 3,
        PHOTO_WIDTH + 6,
        PHOTO_HEIGHT + 6,
        theme.photoBorder,
        3
      );

} else if (selectedTemplate === "burgundy") {
  drawFrameBorder(
    context,
    SIDE_PADDING - 5,
    photoY - 5,
    PHOTO_WIDTH + 10,
    PHOTO_HEIGHT + 10,
    theme.photoBorder,
    4
  );

  drawFrameBorder(
    context,
    SIDE_PADDING - 8,
    photoY - 8,
    PHOTO_WIDTH + 16,
    PHOTO_HEIGHT + 16,
    "#8e4654",
    1
  );


      context.save();

      context.fillStyle = "rgba(248, 239, 213, 0.9)";
      context.font = "bold 18px Arial, sans-serif";
      context.textAlign = "right";

      context.fillText(
        String(index + 1).padStart(2, "0"),
        SIDE_PADDING + PHOTO_WIDTH - 16,
        photoY + PHOTO_HEIGHT - 16
      );

      context.restore();
    }

    photoY += PHOTO_HEIGHT + PHOTO_GAP;
  });

  const footerY = photoY - PHOTO_GAP + 38;

  if (selectedTemplate === "doodle") {
    drawHeartDecoration(
      context,
      190,
      footerY,
      15,
      theme.text
    );

    drawHeartDecoration(
      context,
      WIDTH - 190,
      footerY,
      15,
      theme.text
    );
  }

  
let footerFont = "bold 20px Arial, sans-serif";

if (selectedTemplate === "film") {
  footerFont = "bold 19px Arial, sans-serif";

} else if (selectedTemplate === "minimalist") {
  footerFont = "15px Arial, sans-serif";

} else if (selectedTemplate === "doodle") {
  footerFont = 'italic 19px Georgia, "Times New Roman", serif';

} else if (selectedTemplate === "elegant") {
  footerFont = 'italic 22px Georgia, "Times New Roman", serif';

} else if (selectedTemplate === "chalkboard") {
  footerFont = 'bold 20px Georgia, "Times New Roman", serif';

} else if (selectedTemplate === "burgundy") {
  footerFont = 'bold 19px Georgia, "Times New Roman", serif';
}


  drawCenteredText(
    context,
    details.footer,
    WIDTH / 2,
    footerY,
    WIDTH - 110,
    footerFont,
    theme.text
  );

  if (selectedTemplate === "film") {
    drawCenteredText(
      context,
      "A LITTLE MEMORY TO KEEP",
      WIDTH / 2,
      footerY + 29,
      WIDTH - 100,
      "12px Arial, sans-serif",
      "#d7b98d"
    );
  } else if (selectedTemplate === "elegant") {
    drawCenteredText(
      context,
      "A DAY TO REMEMBER",
      WIDTH / 2,
      footerY + 29,
      WIDTH - 100,
      '12px Georgia, "Times New Roman", serif',
      theme.text
    );
  }

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
   16. CREATE PHOTOSTRIP
========================= */

createStripButton?.addEventListener("click", async () => {
  if (createStripButton.disabled) return;

  createStripButton.disabled = true;
  createStripButton.textContent = "Creating your photostrip...";

  try {
    await renderPhotostrip();

    stopCamera();
    showView("result");

    setStatus(
      resultStatus,
      "Your photostrip is ready!"
    );
  } catch (error) {
    console.error(error);

    alert(
      error.message || "Unable to create your photostrip."
    );
  } finally {
    createStripButton.innerHTML =
      'Create my photostrip <span aria-hidden="true">↗</span>';

    updateCreateButton();
  }
});

/* =========================
   17. DOWNLOAD PHOTOSTRIP
========================= */

downloadStripButton?.addEventListener("click", async () => {
  try {
    if (!completedStripBlob) {
      await renderPhotostrip();
    }

    const url = URL.createObjectURL(completedStripBlob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "Syahlen-and-Atiqah-Photostrip.png";

    document.body.appendChild(link);

    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);

    setStatus(
      resultStatus,
      "Your photostrip has been downloaded."
    );
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
   18. SAVE TO SUPABASE GALLERY
========================= */

saveStripButton?.addEventListener("click", async () => {
  if (isSavingStrip) return;

  if (!supabaseClient) {
    setStatus(
      resultStatus,
      "Supabase is not available.",
      true
    );
    return;
  }

  isSavingStrip = true;
  saveStripButton.disabled = true;
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

    if (uploadError) {
      throw uploadError;
    }

    const { error: insertError } = await supabaseClient
      .from(PHOTOS_TABLE)
      .insert({
        name: "Wedding Guest",
        image_path: filePath
      });

    if (insertError) {
      console.error(
        "Gallery database insert failed:",
        insertError
      );

      setStatus(
        resultStatus,
        "The photo uploaded, but it could not be added to the gallery database. Check your wedding_photos table.",
        true
      );

      return;
    }

    setStatus(
      resultStatus,
      "Your photostrip has been saved to the wedding gallery!"
    );
  } catch (error) {
    console.error("Save photostrip error:", error);

    setStatus(
      resultStatus,
      error.message ||
        "Unable to save your photostrip. Please try again.",
      true
    );
  } finally {
    isSavingStrip = false;
    saveStripButton.disabled = false;
    saveStripButton.textContent = "Save to wedding gallery";
  }
});

/* =========================
   19. MAKE ANOTHER STRIP
========================= */

makeAnotherButton?.addEventListener("click", () => {
  resetPhotoboothPhotos();

  setPhotoSource("camera");
  showView("booth");
});

/* =========================
   20. LOAD WEDDING GALLERY
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

      const path =
        item.image_path ||
        item.path ||
        item.image_url ||
        "";

      if (
        path.startsWith("https://") ||
        path.startsWith("http://")
      ) {
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
   21. SUBMIT GUESTBOOK MESSAGE
========================= */

guestbookForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSubmittingGuestbook) return;

  if (!supabaseClient) {
    setStatus(
      guestbookStatus,
      "Supabase is not available.",
      true
    );

    return;
  }

  const name = guestNameInput.value.trim();
  const message = guestMessageInput.value.trim();

  if (!name || !message) {
    setStatus(
      guestbookStatus,
      "Please enter your name and message.",
      true
    );

    return;
  }

  isSubmittingGuestbook = true;
  submitGuestbookButton.disabled = true;
  submitGuestbookButton.textContent = "Sending...";

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
      "Your wishes have been sent. Thank you for sharing your love!"
    );

    await loadGuestbook();
  } catch (error) {
    console.error(
      "Guestbook submission error:",
      error
    );

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
   22. LOAD GUESTBOOK
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
    console.error(
      "Guestbook loading error:",
      error
    );

    guestbookMessages.innerHTML =
      '<p class="empty-state">Unable to load messages. Please check your Supabase configuration.</p>';
  }
}

/* =========================
   23. INITIALIZE
========================= */

function initializePhotobooth() {
  updatePhotoSlots();
  updatePhotostripPreview();
  updateCameraCounter();
  updateCreateButton();

  setSelectedTemplate("film");

  if (cameraPlaceholder) {
    cameraPlaceholder.hidden = false;
  }

  if (cameraPreview) {
    cameraPreview.style.transform = "none";
  }

  if (captureButton) {
    captureButton.disabled = true;
  }

  if (switchCameraButton) {
    switchCameraButton.disabled = false;
  }

  if (photostripCanvas) {
    photostripCanvas.width = 600;
    photostripCanvas.height = 1500;
  }
}

initializePhotobooth();