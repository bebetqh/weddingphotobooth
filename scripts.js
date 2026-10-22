/* =========================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Matches the supplied index.html and style.css
   Camera + Camera Switching + Upload + Crop Editor
   Six Photostrip Styles + Supabase Gallery + Guestbook
========================================================= */

/* =========================================================
   1. SUPABASE CONFIGURATION
========================================================= */

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


/* =========================================================
   2. HTML ELEMENTS
========================================================= */

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

const homeButton = document.getElementById("homeButton");


/* =========================================================
   3. APPLICATION STATE
========================================================= */

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


/* =========================================================
   4. PHOTOSTRIP TEMPLATE DEFINITIONS

   These six template IDs match index.html:
   film, minimalist, doodle, elegant, chalkboard, blackwhite
========================================================= */

const TEMPLATE_NAMES = [
  "film",
  "minimalist",
  "doodle",
  "elegant",
  "chalkboard",
  "blackwhite"
];

const TEMPLATE_DETAILS = {
  film: {
    name: "Classic Film",
    title: "OUR DAY",
    footer: `${COUPLE_NAMES} ♥`
  },

  minimalist: {
    name: "Minimalist",
    title: "SYAHLEN  ♥  ATIQAH",
    footer: WEDDING_DATE
  },

  doodle: {
    name: "Love Doodle",
    title: "Syahlen & Atiqah",
    footer: "FOREVER & ALWAYS"
  },

  elegant: {
    name: "Elegant",
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
    footer: "S & A  ·  " + WEDDING_DATE
  }
};

const TEMPLATE_COLORS = {
  film: {
    background: "#f8f3ef",
    border: "#4a101c",
    text: "#4a101c",
    photoBorder: "#ffffff"
  },

  minimalist: {
    background: "#fffaf5",
    border: "#e8e3df",
    text: "#4a101c",
    photoBorder: "#ffffff"
  },

  doodle: {
    background: "#fffaf5",
    border: "#278b83",
    text: "#292821",
    photoBorder: "#ffffff"
  },

  elegant: {
    background: "#fffaf5",
    border: "#9d7565",
    text: "#6b4a42",
    photoBorder: "#ffffff"
  },

  chalkboard: {
    background: "#29352f",
    border: "#d8d0c2",
    text: "#f5f1e7",
    photoBorder: "#fffaf0"
  },

  blackwhite: {
    background: "#ffffff",
    border: "#222222",
    text: "#111111",
    photoBorder: "#ffffff"
  }
};


/* =========================================================
   5. GENERAL HELPERS
========================================================= */

function setStatus(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", Boolean(isError));
  element.setAttribute("role", isError ? "alert" : "status");
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function getImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error("Unable to load one of your photos.")
    );

    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(
      new Error("Unable to read one of your selected photos.")
    );

    reader.readAsDataURL(file);
  });
}

function invalidateCompletedStrip() {
  completedStripBlob = null;
  completedStripDataUrl = null;
}


/* =========================================================
   6. PAGE NAVIGATION
========================================================= */

const viewMap = {
  booth: document.getElementById("boothView"),
  result: document.getElementById("resultView"),
  gallery: document.getElementById("galleryView"),
  guestbook: document.getElementById("guestbookView")
};

function showView(viewName) {
  if (!viewMap[viewName]) return;

  Object.entries(viewMap).forEach(([name, view]) => {
    if (!view) return;

    const isActive = name === viewName;

    view.classList.toggle("active", isActive);
    view.hidden = !isActive;
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    const isActive = button.dataset.view === viewName;

    button.classList.toggle("active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });

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
    return availableCameras;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();

    availableCameras = devices.filter(
      device => device.kind === "videoinput"
    );
  } catch (error) {
    console.warn("Unable to list cameras:", error);
    availableCameras = [];
  }

  return availableCameras;
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

async function requestCameraByFacingMode(facingMode) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: {
        exact: facingMode
      },
      width: {
        ideal: 1280
      },
      height: {
        ideal: 960
      }
    }
  });
}

async function requestCameraByDeviceId(deviceId) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: {
        exact: deviceId
      },
      width: {
        ideal: 1280
      },
      height: {
        ideal: 960
      }
    }
  });
}


/* =========================================================
   8. START CAMERA

   Uses a 4:3 preferred resolution for photostrip photos.
   The browser may choose a different resolution depending
   on the device and camera capabilities.
========================================================= */

async function startCamera() {
  if (cameraStarting || currentPhotoIndex >= 3) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    alert(
      "Camera access is unavailable. Please use HTTPS or choose Upload photos."
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

    // First, request the selected front or rear camera.
    try {
      newStream = await requestCameraByFacingMode(currentFacingMode);
    } catch (error) {
      console.warn("Facing-mode request failed:", error);
    }

    // If that fails, try a camera matching the requested mode.
    if (!newStream) {
      await getAvailableCameras();

      const matchingCamera = availableCameras.find(
        device => cameraLabelType(device) === currentFacingMode
      );

      if (matchingCamera) {
        try {
          newStream = await requestCameraByDeviceId(
            matchingCamera.deviceId
          );
        } catch (error) {
          console.warn("Matching camera request failed:", error);
        }
      }
    }

    // Try another camera if the preferred one is unavailable.
    if (!newStream) {
      await getAvailableCameras();

      const alternative = availableCameras.find(
        device => device.deviceId !== previousDeviceId
      );

      if (alternative) {
        try {
          newStream = await requestCameraByDeviceId(
            alternative.deviceId
          );
        } catch (error) {
          console.warn("Alternative camera request failed:", error);
        }
      }
    }

    // Last resort: let the browser choose a camera.
    if (!newStream) {
      newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: {
            ideal: 1280
          },
          height: {
            ideal: 960
          }
        }
      });
    }

    cameraStream = newStream;

    const track = cameraStream.getVideoTracks()[0];
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
        reject(
          new Error("The camera preview could not be loaded.")
        );
      };

      const cleanup = () => {
        cameraPreview.removeEventListener(
          "loadedmetadata",
          onLoaded
        );

        cameraPreview.removeEventListener(
          "error",
          onError
        );
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

    // Mirror only the front-facing camera preview.
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
      switchCameraButton.disabled = availableCameras.length < 2;
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

    if (switchCameraButton) {
      switchCameraButton.disabled =
        availableCameras.length < 2;
    }
  }
}


/* =========================================================
   9. SWITCH CAMERA
========================================================= */

async function switchCamera() {
  if (switchingCamera || cameraStarting) return;

  if (currentPhotoIndex >= 3) {
    alert("You have already taken all three photos. Clear your photos to start again.");
    return;
  }

  switchingCamera = true;

  if (switchCameraButton) {
    switchCameraButton.disabled = true;
  }

  try {
    await getAvailableCameras();

    if (availableCameras.length < 2) {
      alert("Only one camera is available to this browser.");
      return;
    }

    const previousDeviceId = currentCameraDeviceId;

    const targetMode =
      currentFacingMode === "user" ? "environment" : "user";

    const matchingCamera = availableCameras.find(
      device => cameraLabelType(device) === targetMode
    );

    currentFacingMode = targetMode;
    currentCameraDeviceId = matchingCamera?.deviceId || null;

    stopCamera();

    await startCamera();

    // If the requested mode selected the same camera, try a different device.
    if (
      cameraStream &&
      previousDeviceId &&
      currentCameraDeviceId === previousDeviceId
    ) {
      await getAvailableCameras();

      const alternative = availableCameras.find(
        device => device.deviceId !== previousDeviceId
      );

      if (alternative) {
        stopCamera();

        cameraStream = await requestCameraByDeviceId(
          alternative.deviceId
        );

        currentCameraDeviceId = alternative.deviceId;

        const track = cameraStream.getVideoTracks()[0];
        const settings = track?.getSettings?.() || {};

        if (settings.facingMode) {
          currentFacingMode = settings.facingMode;
        }

        cameraPreview.srcObject = cameraStream;
        await cameraPreview.play();

        cameraPreview.style.transform =
          currentFacingMode === "user" ? "scaleX(-1)" : "none";

        if (cameraPlaceholder) {
          cameraPlaceholder.hidden = true;
        }

        if (captureButton && currentPhotoIndex < 3) {
          captureButton.disabled = false;
        }
      }
    }
  } catch (error) {
    console.error("Camera switching failed:", error);

    alert(
      "Unable to switch cameras. Please check your browser permissions."
    );
  } finally {
    switchingCamera = false;

    if (switchCameraButton) {
      switchCameraButton.disabled =
        availableCameras.length < 2;
    }
  }
}

startCameraButton?.addEventListener("click", startCamera);
switchCameraButton?.addEventListener("click", switchCamera);


/* =========================================================
   10. CAMERA / UPLOAD MODES
========================================================= */

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
    if (currentPhotoIndex < 3) {
      startCamera();
    }
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
    countdownNumber.textContent = number;
    await wait(1000);
  }

  countdownNumber.textContent = "♥";

  await wait(350);

  countdownOverlay.hidden = true;
}


/* =========================================================
   12. CAPTURE CAMERA PHOTO
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

  // Save front-camera photos mirrored, matching the selfie preview.
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

    photoData[currentPhotoIndex] = captureCurrentFrame();

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
    console.error("Photo capture error:", error);

    alert(
      error.message || "Unable to capture the photo."
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
  }
});

function updateCameraCounter() {
  if (cameraCounter) {
    cameraCounter.textContent =
      `${photoData.filter(Boolean).length} / 3`;
  }
}


/* =========================================================
   13. PHOTO CROPPER
========================================================= */

let cropperState = null;

function installCropEditor() {
  if (document.getElementById("photoCropperModal")) return;

  const modal = document.createElement("div");

  modal.id = "photoCropperModal";
  modal.hidden = true;

  modal.innerHTML = `
    <div class="cropper-backdrop"></div>
    <div class="cropper-dialog" role="dialog"
         aria-modal="true" aria-labelledby="cropperTitle">
      <div class="cropper-heading">
        <h2 id="cropperTitle">Adjust your photo</h2>
        <p id="cropperDescription">Move and zoom your photo to fit the frame.</p>
      </div>

      <div class="cropper-stage">
        <canvas id="cropperCanvas" width="800" height="600"></canvas>
      </div>

      <label class="cropper-zoom-label" for="cropperZoom">
        Zoom
      </label>
      <input id="cropperZoom" type="range"
             min="1" max="3" step="0.01" value="1">

      <div class="cropper-actions">
        <button type="button" id="cropperCancelButton"
                class="button button-secondary">
          Cancel
        </button>
        <button type="button" id="cropperConfirmButton"
                class="button button-primary">
          Use this photo
        </button>
      </div>
    </div>
  `;

  const style = document.createElement("style");

  style.textContent = `
    #photoCropperModal {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    #photoCropperModal[hidden] {
      display: none !important;
    }

    .cropper-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(25, 12, 15, 0.76);
    }

    .cropper-dialog {
      position: relative;
      z-index: 1;
      width: min(100%, 560px);
      max-height: 92vh;
      overflow-y: auto;
      padding: 22px;
      border-radius: 16px;
      background: #fffaf5;
      color: #4a101c;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.25);
    }

    .cropper-heading {
      margin-bottom: 16px;
    }

    .cropper-heading h2 {
      margin: 0 0 8px;
    }

    .cropper-heading p {
      margin: 0;
    }

    .cropper-stage {
      width: 100%;
      overflow: hidden;
      background: #eee7e1;
      border-radius: 8px;
      touch-action: none;
    }

    #cropperCanvas {
      display: block;
      width: 100%;
      height: auto;
      aspect-ratio: 4 / 3;
      cursor: grab;
      touch-action: none;
    }

    #cropperCanvas:active {
      cursor: grabbing;
    }

    .cropper-zoom-label {
      display: block;
      margin-top: 16px;
      margin-bottom: 8px;
    }

    #cropperZoom {
      display: block;
      width: 100%;
    }

    .cropper-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    @media (max-width: 480px) {
      .cropper-dialog {
        padding: 16px;
      }

      .cropper-actions > button {
        flex: 1;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);

  document
    .getElementById("cropperCancelButton")
    .addEventListener("click", () => {
      if (cropperState?.reject) {
        cropperState.reject(
          new Error("Photo cropping was cancelled.")
        );
      }

      closePhotoCropper();
    });

  document
    .getElementById("cropperConfirmButton")
    .addEventListener("click", confirmCurrentCrop);

  document
    .getElementById("cropperZoom")
    .addEventListener("input", event => {
      if (!cropperState) return;

      cropperState.zoom = Number(event.target.value);

      clampCropPosition();
      drawCropEditor();
    });

  const canvas = document.getElementById("cropperCanvas");

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function pointerDown(event) {
    if (!cropperState) return;

    dragging = true;

    const rect = canvas.getBoundingClientRect();

    lastX = (event.clientX - rect.left) *
      (canvas.width / rect.width);

    lastY = (event.clientY - rect.top) *
      (canvas.height / rect.height);

    canvas.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (!dragging || !cropperState) return;

    const rect = canvas.getBoundingClientRect();

    const currentX = (event.clientX - rect.left) *
      (canvas.width / rect.width);

    const currentY = (event.clientY - rect.top) *
      (canvas.height / rect.height);

    cropperState.offsetX += currentX - lastX;
    cropperState.offsetY += currentY - lastY;

    lastX = currentX;
    lastY = currentY;

    clampCropPosition();
    drawCropEditor();
  }

  function pointerUp() {
    dragging = false;
  }

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("lostpointercapture", pointerUp);
}

function resetCropPosition() {
  if (!cropperState) return;

  const image = cropperState.image;
  const canvas = cropperState.canvas;

  const baseScale = Math.max(
    canvas.width / image.naturalWidth,
    canvas.height / image.naturalHeight
  );

  cropperState.baseScale = baseScale;
  cropperState.zoom = 1;

  cropperState.offsetX =
    (canvas.width - image.naturalWidth * baseScale) / 2;

  cropperState.offsetY =
    (canvas.height - image.naturalHeight * baseScale) / 2;

  const zoomInput = document.getElementById("cropperZoom");

  if (zoomInput) {
    zoomInput.value = "1";
  }

  clampCropPosition();
  drawCropEditor();
}

function clampCropPosition() {
  if (!cropperState) return;

  const { image, canvas, baseScale, zoom } = cropperState;

  const scale = baseScale * zoom;

  const scaledWidth = image.naturalWidth * scale;
  const scaledHeight = image.naturalHeight * scale;

  const minX = canvas.width - scaledWidth;
  const minY = canvas.height - scaledHeight;

  cropperState.offsetX = Math.min(
    0,
    Math.max(minX, cropperState.offsetX)
  );

  cropperState.offsetY = Math.min(
    0,
    Math.max(minY, cropperState.offsetY)
  );
}

function drawCropEditor() {
  if (!cropperState) return;

  const { image, canvas, context, baseScale, zoom } = cropperState;

  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#eee7e1";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const scale = baseScale * zoom;

  context.drawImage(
    image,
    cropperState.offsetX,
    cropperState.offsetY,
    image.naturalWidth * scale,
    image.naturalHeight * scale
  );
}

function openPhotoCropper(dataUrl, photoNumber) {
  installCropEditor();

  return new Promise(async (resolve, reject) => {
    try {
      const image = await getImageFromDataUrl(dataUrl);

      const modal = document.getElementById("photoCropperModal");
      const canvas = document.getElementById("cropperCanvas");
      const context = canvas.getContext("2d");

      const title = document.getElementById("cropperTitle");
      const description = document.getElementById("cropperDescription");

      if (title) {
        title.textContent = `Adjust photo ${photoNumber} of 3`;
      }

      if (description) {
        description.textContent =
          "Drag to position your photo and use the zoom slider to adjust the crop.";
      }

      cropperState = {
        image,
        canvas,
        context,
        baseScale: 1,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        resolve,
        reject
      };

      resetCropPosition();

      modal.hidden = false;
    } catch (error) {
      reject(error);
    }
  });
}

function confirmCurrentCrop() {
  if (!cropperState) return;

  const output = document.createElement("canvas");

  output.width = 1200;
  output.height = 900;

  const context = output.getContext("2d");

  if (!context) {
    cropperState.reject(
      new Error("Unable to process your cropped photo.")
    );

    closePhotoCropper();
    return;
  }

  const scaleX = output.width / cropperState.canvas.width;
  const scaleY = output.height / cropperState.canvas.height;

  context.drawImage(
    cropperState.canvas,
    0,
    0,
    cropperState.canvas.width,
    cropperState.canvas.height,
    0,
    0,
    output.width,
    output.height
  );

  const result = output.toDataURL("image/jpeg", 0.94);

  cropperState.resolve(result);

  closePhotoCropper();
}

function closePhotoCropper() {
  const modal = document.getElementById("photoCropperModal");

  if (modal) {
    modal.hidden = true;
  }

  cropperState = null;
}


/* =========================================================
   14. UPLOAD AND CROP THREE PHOTOS
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

  stopCamera();

  photoUploadInput.disabled = true;

  setStatus(uploadStatus, "Preparing your photos for cropping...");

  try {
    const originals = await Promise.all(
      files.map(async file => {
        const dataUrl = await readFileAsDataUrl(file);

        await getImageFromDataUrl(dataUrl);

        return dataUrl;
      })
    );

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
      "All three cropped photos are ready!"
    );
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


/* =========================================================
   15. PHOTO SLOTS / CLEAR PHOTOS
========================================================= */

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

function clearCurrentStrip() {
  photoData = [null, null, null];
  currentPhotoIndex = 0;

  invalidateCompletedStrip();

  if (photoUploadInput) {
    photoUploadInput.value = "";
  }

  setStatus(uploadStatus, "No photos selected yet.");
  setStatus(resultStatus, "");

  updatePhotoSlots();
  updatePhotostripPreview();
  updateCameraCounter();
  updateCreateButton();

  if (captureButton) {
    captureButton.disabled = true;
    captureButton.textContent = "Take photo";
  }
}

retakeAllButton?.addEventListener("click", () => {
  clearCurrentStrip();

  if (currentPhotoSource === "camera") {
    startCamera();
  }
});


/* =========================================================
   16. TEMPLATE SELECTOR

   Reuses the six template buttons already in index.html.
========================================================= */

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

      const textWrapper = document.createElement("span");
      textWrapper.className = "template-option-text";

      const title = document.createElement("strong");
      title.textContent = TEMPLATE_DETAILS[templateName].name;

      textWrapper.appendChild(title);
      button.appendChild(textWrapper);

      templateSelector.appendChild(button);
    }

    button.dataset.template = templateName;

    button.setAttribute(
      "aria-label",
      `Select ${TEMPLATE_DETAILS[templateName].name} photostrip`
    );
  });

  // Remove only options that do not belong to the six supported styles.
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


/* =========================================================
   17. LIVE PHOTOSTRIP PREVIEW
========================================================= */

function updatePhotostripPreview() {
  if (!photostripPreview) return;

  const details = TEMPLATE_DETAILS[selectedTemplate];

  if (!details) return;

  photostripPreview.className =
    `photostrip-preview template-${selectedTemplate}`;

  const title = photostripPreview.querySelector(
    ".strip-preview-title"
  );

  const footer = photostripPreview.querySelector(
    ".strip-preview-footer"
  );

  if (title) {
    title.textContent = details.title.replace(/\n/g, " ");
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
  if (createStripButton) {
    createStripButton.disabled = !photoData.every(Boolean);
  }
}


/* =========================================================
   18. CANVAS DRAWING HELPERS
========================================================= */

function drawCoverImage(context, image, x, y, width, height) {
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

  let displayText = String(text);

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

function drawMultilineText(
  context,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  font,
  color
) {
  context.save();

  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = String(text).split("\n");
  const totalHeight = (lines.length - 1) * lineHeight;
  const firstY = y - totalHeight / 2;

  lines.forEach((line, index) => {
    context.fillText(
      line,
      x,
      firstY + index * lineHeight,
      maxWidth
    );
  });

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

  context.strokeRect(x, y, width, height);

  context.restore();
}

function drawHeartDecoration(
  context,
  x,
  y,
  size,
  color,
  filled = false
) {
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

  if (filled) {
    context.fill();
  } else {
    context.stroke();
  }

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

    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
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

    context.ellipse(
      0,
      -size * 0.55,
      size * 0.22,
      size * 0.4,
      0,
      0,
      Math.PI * 2
    );

    context.stroke();
    context.restore();
  }

  context.beginPath();
  context.arc(0, 0, size * 0.17, 0, Math.PI * 2);
  context.stroke();

  context.restore();
}

function drawWavyLine(
  context,
  x1,
  y1,
  x2,
  y2,
  color,
  amplitude = 5
) {
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

    const y =
      y1 +
      (y2 - y1) * t +
      Math.sin(t * Math.PI * 8) * amplitude;

    context.lineTo(x, y);
  }

  context.stroke();

  context.restore();
}


/* =========================================================
   19. TEMPLATE DECORATIONS
========================================================= */

function drawTemplateDecorations(
  context,
  template,
  width,
  height,
  theme
) {
  const palettes = {
    film: ["#4a101c", "#b66e7e", "#d9b9a8"],
    minimalist: ["#4a101c", "#b66e7e", "#d9b9a8"],
    doodle: ["#292821", "#278b83", "#e2b341", "#7866b3"],
    elegant: ["#9d7565", "#c9a98f", "#6e8574"],
    chalkboard: ["#f5f1e7", "#e8d48b", "#b9d7cb"],
    blackwhite: ["#111111", "#555555", "#999999"]
  };

  const palette = palettes[template] || [
    theme.text,
    theme.border
  ];

  if (template === "film") {
    drawFrameBorder(
      context,
      14,
      14,
      width - 28,
      height - 28,
      theme.border,
      4
    );

    drawHeartDecoration(
      context,
      width / 2,
      88,
      18,
      theme.text,
      true
    );

    drawSparkle(
      context,
      55,
      105,
      8,
      palette[1]
    );

    drawSparkle(
      context,
      width - 55,
      105,
      8,
      palette[1]
    );

    drawHeartDecoration(
      context,
      width / 2,
      height - 38,
      16,
      theme.text,
      true
    );
  }

  if (template === "minimalist") {
    drawFrameBorder(
      context,
      10,
      10,
      width - 20,
      height - 20,
      "#e8e3df",
      2
    );

    drawHeartDecoration(
      context,
      width / 2,
      78,
      18,
      palette[0],
      true
    );

    drawSparkle(
      context,
      35,
      height / 2,
      7,
      palette[1]
    );

    drawSparkle(
      context,
      width - 35,
      height / 2,
      7,
      palette[1]
    );

    drawHeartDecoration(
      context,
      70,
      height - 42,
      12,
      palette[1]
    );

    drawHeartDecoration(
      context,
      width - 70,
      height - 42,
      12,
      palette[1]
    );
  }

  if (template === "doodle") {
    drawHeartDecoration(
      context,
      40,
      100,
      22,
      palette[0]
    );

    drawHeartDecoration(
      context,
      width - 40,
      100,
      22,
      palette[1]
    );

    drawDoodleFlower(
      context,
      72,
      90,
      15,
      palette[2]
    );

    drawDoodleFlower(
      context,
      width - 72,
      90,
      15,
      palette[3]
    );

    drawSparkle(
      context,
      40,
      height - 65,
      8,
      palette[2]
    );

    drawSparkle(
      context,
      width - 40,
      height - 65,
      8,
      palette[3]
    );

    drawHeartDecoration(
      context,
      width / 2,
      height - 42,
      20,
      palette[0]
    );
  }

  if (template === "elegant") {
    drawFrameBorder(
      context,
      15,
      15,
      width - 30,
      height - 30,
      theme.border,
      2
    );

    drawFrameBorder(
      context,
      24,
      24,
      width - 48,
      height - 48,
      "#e1d0c1",
      1
    );

    drawDoodleFlower(
      context,
      48,
      75,
      14,
      palette[0]
    );

    drawDoodleFlower(
      context,
      width - 48,
      75,
      14,
      palette[2]
    );

    drawWavyLine(
      context,
      85,
      98,
      145,
      93,
      palette[1],
      2
    );

    drawWavyLine(
      context,
      width - 145,
      93,
      width - 85,
      98,
      palette[1],
      2
    );

    drawSparkle(
      context,
      45,
      height - 58,
      7,
      palette[1]
    );

    drawSparkle(
      context,
      width - 45,
      height - 58,
      7,
      palette[1]
    );
  }

  if (template === "chalkboard") {
    drawFrameBorder(
      context,
      12,
      12,
      width - 24,
      height - 24,
      "#d8d0c2",
      3
    );

    drawHeartDecoration(
      context,
      50,
      80,
      20,
      palette[0]
    );

    drawSparkle(
      context,
      width - 50,
      85,
      10,
      palette[1]
    );

    drawStarDecoration(
      context,
      50,
      height - 65,
      11,
      palette[2]
    );

    drawHeartDecoration(
      context,
      width - 50,
      height - 65,
      20,
      palette[0]
    );
  }

  if (template === "blackwhite") {
    drawFrameBorder(
      context,
      12,
      12,
      width - 24,
      height - 24,
      "#111111",
      3
    );

    drawFrameBorder(
      context,
      22,
      22,
      width - 44,
      height - 44,
      "#777777",
      1
    );

    drawHeartDecoration(
      context,
      48,
      85,
      18,
      "#111111"
    );

    drawHeartDecoration(
      context,
      width - 48,
      85,
      18,
      "#111111"
    );

    drawSparkle(
      context,
      48,
      height - 55,
      8,
      "#555555"
    );

    drawSparkle(
      context,
      width - 48,
      height - 55,
      8,
      "#555555"
    );
  }
}


/* =========================================================
   20. RENDER THE PHOTOSTRIP
========================================================= */

async function renderPhotostrip() {
  if (!photoData.every(Boolean)) {
    throw new Error(
      "Please take or upload all three photos first."
    );
  }

  const canvas = photostripCanvas;
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    throw new Error("Unable to create the photostrip.");
  }

  const WIDTH = 600;
  const SIDE_PADDING = 65;
  const PHOTO_WIDTH = WIDTH - SIDE_PADDING * 2;

  // Keep the photo frames at 4:3 to match the crop editor.
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

  if (!theme || !details) {
    throw new Error("The selected photostrip style is unavailable.");
  }

  const images = await Promise.all(
    photoData.map(getImageFromDataUrl)
  );

  context.clearRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = theme.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  /* -----------------------------------------
     TITLE
  ----------------------------------------- */

  const titleY = TOP_PADDING + 52;

  const titleFonts = {
    film: 'bold 37px Georgia, "Times New Roman", serif',
    minimalist: 'bold 25px Georgia, "Times New Roman", serif',
    doodle: 'bold 38px "Comic Sans MS", "Trebuchet MS", cursive',
    elegant: '27px Georgia, "Times New Roman", serif',
    chalkboard: 'bold 29px "Comic Sans MS", "Trebuchet MS", cursive',
    blackwhite: 'bold 30px Georgia, "Times New Roman", serif'
  };

  if (selectedTemplate === "elegant") {
    drawMultilineText(
      context,
      details.title,
      WIDTH / 2,
      TOP_PADDING + 49,
      WIDTH - 90,
      31,
      titleFonts.elegant,
      theme.text
    );
  } else {
    drawCenteredText(
      context,
      details.title,
      WIDTH / 2,
      titleY,
      WIDTH - 90,
      titleFonts[selectedTemplate],
      theme.text
    );
  }

  /* -----------------------------------------
     STYLE-SPECIFIC TITLE DECORATIONS
  ----------------------------------------- */

  if (selectedTemplate === "film") {
    drawHeartDecoration(
      context,
      WIDTH / 2,
      TOP_PADDING + 100,
      20,
      theme.text,
      true
    );

    drawSparkle(
      context,
      115,
      TOP_PADDING + 100,
      8,
      theme.border
    );

    drawSparkle(
      context,
      WIDTH - 115,
      TOP_PADDING + 100,
      8,
      theme.border
    );
  }

  if (selectedTemplate === "minimalist") {
    drawHeartDecoration(
      context,
      WIDTH / 2,
      TOP_PADDING + 91,
      20,
      theme.text,
      true
    );
  }

  if (selectedTemplate === "doodle") {
    drawHeartDecoration(
      context,
      72,
      titleY - 8,
      22,
      "#292821"
    );

    drawHeartDecoration(
      context,
      WIDTH - 72,
      titleY + 5,
      22,
      "#278b83"
    );

    drawSparkle(
      context,
      120,
      titleY + 40,
      8,
      "#e2b341"
    );

    drawSparkle(
      context,
      WIDTH - 120,
      titleY + 35,
      8,
      "#7866b3"
    );
  }

  if (selectedTemplate === "chalkboard") {
    drawHeartDecoration(
      context,
      65,
      titleY - 5,
      20,
      "#f5f1e7"
    );

    drawSparkle(
      context,
      WIDTH - 65,
      titleY + 8,
      9,
      "#e8d48b"
    );
  }

  if (selectedTemplate === "blackwhite") {
    drawWavyLine(
      context,
      75,
      TOP_PADDING + 105,
      180,
      TOP_PADDING + 100,
      "#777777",
      2
    );

    drawWavyLine(
      context,
      WIDTH - 180,
      TOP_PADDING + 100,
      WIDTH - 75,
      TOP_PADDING + 105,
      "#777777",
      2
    );
  }

  /* -----------------------------------------
     PHOTOS
  ----------------------------------------- */

  let photoY = TOP_PADDING + TITLE_HEIGHT;

  images.forEach((image, index) => {
    // Frames behind the photo.
    if (
      selectedTemplate === "doodle" ||
      selectedTemplate === "chalkboard" ||
      selectedTemplate === "elegant" ||
      selectedTemplate === "blackwhite" ||
      selectedTemplate === "film"
    ) {
      context.save();

      context.fillStyle =
        selectedTemplate === "chalkboard"
          ? "#fffaf0"
          : "#ffffff";

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

    // Border for the minimalist style.
    if (selectedTemplate === "minimalist") {
      drawFrameBorder(
        context,
        SIDE_PADDING,
        photoY,
        PHOTO_WIDTH,
        PHOTO_HEIGHT,
        "#ffffff",
        3
      );
    }

    // Film frame.
    if (selectedTemplate === "film") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 5,
        photoY - 5,
        PHOTO_WIDTH + 10,
        PHOTO_HEIGHT + 10,
        "#4a101c",
        2
      );
    }

    // Doodle-style hand-drawn border.
    if (selectedTemplate === "doodle") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 4,
        photoY - 4,
        PHOTO_WIDTH + 8,
        PHOTO_HEIGHT + 8,
        "#278b83",
        2
      );

      context.save();

      context.strokeStyle = "#292821";
      context.lineWidth = 1.5;

      context.beginPath();
      context.moveTo(SIDE_PADDING - 2, photoY + 3);
      context.lineTo(
        SIDE_PADDING + PHOTO_WIDTH + 2,
        photoY - 2
      );
      context.lineTo(
        SIDE_PADDING + PHOTO_WIDTH + 4,
        photoY + PHOTO_HEIGHT + 3
      );
      context.lineTo(
        SIDE_PADDING - 3,
        photoY + PHOTO_HEIGHT + 1
      );

      context.closePath();
      context.stroke();
      context.restore();
    }

    // Elegant photo frame.
    if (selectedTemplate === "elegant") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 4,
        photoY - 4,
        PHOTO_WIDTH + 8,
        PHOTO_HEIGHT + 8,
        "#c9a98f",
        2
      );
    }

    // Chalkboard photo frame and number.
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

      context.save();

      context.fillStyle = "#29352f";
      context.fillRect(
        SIDE_PADDING + PHOTO_WIDTH - 42,
        photoY + PHOTO_HEIGHT - 31,
        31,
        22
      );

      context.fillStyle = "#fffaf0";
      context.font = "bold 14px Arial, sans-serif";
      context.textAlign = "center";

      context.fillText(
        String(index + 1).padStart(2, "0"),
        SIDE_PADDING + PHOTO_WIDTH - 26,
        photoY + PHOTO_HEIGHT - 16
      );

      context.restore();
    }

    // Black-and-white style frame.
    if (selectedTemplate === "blackwhite") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 4,
        photoY - 4,
        PHOTO_WIDTH + 8,
        PHOTO_HEIGHT + 8,
        "#111111",
        3
      );

      context.save();

      context.fillStyle = "rgba(255,255,255,0.92)";
      context.font = "bold 14px Arial, sans-serif";
      context.textAlign = "right";

      context.fillText(
        String(index + 1).padStart(2, "0"),
        SIDE_PADDING + PHOTO_WIDTH - 12,
        photoY + PHOTO_HEIGHT - 12
      );

      context.restore();
    }

    /* Small decorations outside the photos. */
    const doodleY = photoY + 24;

    if (selectedTemplate === "minimalist") {
      drawSparkle(
        context,
        35,
        doodleY,
        7,
        "#b66e7e"
      );

      drawHeartDecoration(
        context,
        WIDTH - 35,
        photoY + PHOTO_HEIGHT - 24,
        12,
        "#4a101c"
      );
    }

    if (selectedTemplate === "doodle") {
      const doodleColors = [
        "#292821",
        "#278b83",
        "#e2b341",
        "#7866b3"
      ];

      drawDoodleFlower(
        context,
        32,
        doodleY + 5,
        13,
        doodleColors[index % doodleColors.length]
      );

      drawHeartDecoration(
        context,
        WIDTH - 33,
        photoY + PHOTO_HEIGHT - 24,
        14,
        doodleColors[(index + 1) % doodleColors.length]
      );
    }

    if (selectedTemplate === "chalkboard") {
      drawStarDecoration(
        context,
        33,
        doodleY + 4,
        9,
        "#e8d48b"
      );

      drawSparkle(
        context,
        WIDTH - 33,
        photoY + PHOTO_HEIGHT - 23,
        7,
        "#fffaf0"
      );
    }

    if (selectedTemplate === "elegant") {
      drawDoodleFlower(
        context,
        33,
        doodleY + 4,
        12,
        index % 2 ? "#6e8574" : "#9d7565"
      );

      drawSparkle(
        context,
        WIDTH - 33,
        photoY + PHOTO_HEIGHT - 23,
        7,
        "#c9a98f"
      );
    }

    if (selectedTemplate === "film") {
      drawHeartDecoration(
        context,
        34,
        doodleY + 2,
        12,
        "#4a101c"
      );

      drawHeartDecoration(
        context,
        WIDTH - 34,
        photoY + PHOTO_HEIGHT - 24,
        12,
        "#4a101c"
      );
    }

    if (selectedTemplate === "blackwhite") {
      drawSparkle(
        context,
        34,
        doodleY + 4,
        7,
        "#555555"
      );

      drawHeartDecoration(
        context,
        WIDTH - 34,
        photoY + PHOTO_HEIGHT - 24,
        12,
        "#111111"
      );
    }

    photoY += PHOTO_HEIGHT + PHOTO_GAP;
  });

  /* -----------------------------------------
     FOOTER
  ----------------------------------------- */

  const footerY = photoY - PHOTO_GAP + 43;

  const footerFonts = {
    film: '17px Georgia, "Times New Roman", serif',
    minimalist: '17px Georgia, "Times New Roman", serif',
    doodle: 'italic 20px "Comic Sans MS", "Trebuchet MS", cursive',
    elegant: '17px Georgia, "Times New Roman", serif',
    chalkboard: 'italic 19px Georgia, "Times New Roman", serif',
    blackwhite: '16px Georgia, "Times New Roman", serif'
  };

  drawCenteredText(
    context,
    details.footer,
    WIDTH / 2,
    footerY,
    WIDTH - 100,
    footerFonts[selectedTemplate],
    theme.text
  );

  if (selectedTemplate === "minimalist") {
    drawHeartDecoration(
      context,
      WIDTH / 2,
      footerY + 37,
      18,
      theme.text,
      true
    );
  }

  if (selectedTemplate === "doodle") {
    drawHeartDecoration(
      context,
      180,
      footerY + 3,
      18,
      "#278b83"
    );

    drawHeartDecoration(
      context,
      WIDTH - 180,
      footerY + 3,
      18,
      "#292821"
    );

    drawSparkle(
      context,
      WIDTH / 2 - 45,
      footerY + 35,
      8,
      "#e2b341"
    );

    drawSparkle(
      context,
      WIDTH / 2 + 45,
      footerY + 35,
      8,
      "#7866b3"
    );
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
  }

  if (selectedTemplate === "film") {
    drawCenteredText(
      context,
      WEDDING_DATE,
      WIDTH / 2,
      footerY + 34,
      WIDTH - 100,
      '12px Georgia, "Times New Roman", serif',
      theme.text
    );
  }

  drawTemplateDecorations(
    context,
    selectedTemplate,
    WIDTH,
    HEIGHT,
    theme
  );

  completedStripDataUrl = canvas.toDataURL("image/png");

  completedStripBlob = await new Promise(resolve => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!completedStripBlob) {
    throw new Error("Unable to prepare the photostrip image.");
  }

  return completedStripBlob;
}


/* =========================================================
   21. CREATE PHOTOSTRIP
========================================================= */

createStripButton?.addEventListener("click", async () => {
  if (
    createStripButton.disabled ||
    !photoData.every(Boolean)
  ) {
    return;
  }

  createStripButton.disabled = true;
  createStripButton.textContent = "Creating your photostrip...";

  try {
    await renderPhotostrip();

    stopCamera();

    showView("result");

    setStatus(
      resultStatus,
      `${TEMPLATE_DETAILS[selectedTemplate].name} photostrip is ready!`
    );
  } catch (error) {
    console.error("Photostrip creation error:", error);

    alert(
      error.message || "Unable to create your photostrip."
    );
  } finally {
    createStripButton.innerHTML =
      'Create my photostrip <span aria-hidden="true">↗</span>';

    updateCreateButton();
  }
});


/* =========================================================
   22. DOWNLOAD PHOTOSTRIP
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

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);

    setStatus(
      resultStatus,
      "Your photostrip has been downloaded."
    );
  } catch (error) {
    console.error("Download error:", error);

    setStatus(
      resultStatus,
      error.message || "Unable to download your photostrip.",
      true
    );
  }
});


/* =========================================================
   23. SAVE PHOTOSTRIP TO SUPABASE GALLERY
========================================================= */

saveStripButton?.addEventListener("click", async () => {
  if (isSavingStrip) return;

  if (!supabaseClient) {
    setStatus(
      resultStatus,
      "Supabase is not available. Please check your configuration.",
      true
    );

    return;
  }

  if (!photoData.every(Boolean)) {
    setStatus(
      resultStatus,
      "Please create a photostrip before saving it.",
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
      `photostrip-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.png`;

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


/* =========================================================
   24. MAKE ANOTHER PHOTOSTRIP
========================================================= */

makeAnotherButton?.addEventListener("click", () => {
  clearCurrentStrip();

  setPhotoSource("camera");

  showView("booth");
});


/* =========================================================
   25. LOAD WEDDING GALLERY
========================================================= */

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

    if (error) {
      throw error;
    }

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


/* =========================================================
   26. SUBMIT GUESTBOOK MESSAGE
========================================================= */

guestbookForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSubmittingGuestbook) return;

  if (!supabaseClient) {
    setStatus(
      guestbookStatus,
      "Supabase is not available. Please check your configuration.",
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

    if (error) {
      throw error;
    }

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


/* =========================================================
   27. LOAD GUESTBOOK
========================================================= */

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

    if (error) {
      throw error;
    }

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


/* =========================================================
   28. INITIALIZE THE PHOTOBOOTH
========================================================= */

function initializePhotobooth() {
  ensureTemplateOptions();

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

  setStatus(uploadStatus, "No photos selected yet.");

  // Load these sections when the visitor opens their pages.
  // Do not automatically request camera permission on page load.
}

initializePhotobooth();