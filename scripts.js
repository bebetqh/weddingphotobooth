/* =========================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Camera + Switch Camera + Upload + Crop
   Six Photostrip Styles + Supabase Gallery + Guestbook
   UPDATED: Consistent footer spacing for ALL strip styles
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
    title: "OUR DAY",
    footer: `${COUPLE_NAMES} ♥`,
    background: "#222222",
    border: "#222222",
    text: "#ffffff",
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
    text: "#8f5265",
    photoBorder: "#efd3dc",
    accent: "#d87991",
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
    title: "BEST DAY EVER",
    footer: "♥ S & A ♥",
    background: "#080808",
    border: "#292929",
    text: "#f7f0e5",
    photoBorder: "#e9e2d6",
    accent: "#f7f0e5",
    font: "700 31px Arial, sans-serif",
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
    cameraPreview