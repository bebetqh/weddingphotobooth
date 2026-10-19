
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
  }
};

const TEMPLATE_COLORS = {
  film: {
    background: "#fff8ec",
    border: "#e6d9c7",
    text: "#704b3e",
    photoBorder: "#e5d7c6"
  },
  minimalist: {
    background: "#ffffff",
    border: "#ded8d0",
    text: "#5b4a46",
    photoBorder: "#ffffff"
  },
  doodle: {
    background: "#fff0f2",
    border: "#d99ca9",
    text: "#913e59",
    photoBorder: "#edc2ca"
  },
  elegant: {
    background: "#fffaf0",
    border: "#b79a69",
    text: "#85663b",
    photoBorder: "#e2cfaa"
  },
  chalkboard: {
    background: "#28352f",
    border: "#d8c69b",
    text: "#f8efd5",
    photoBorder: "#657267"
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
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

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load an image."));

    image.src = url;
  });
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

    const isActive = name === viewName;

    element.classList.toggle("active", isActive);
    element.hidden = !isActive;
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === viewName
    );
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

document.getElementById("homeButton")?.addEventListener("click", event => {
  event.preventDefault();
  showView("booth");
});

/* =========================
   6. CAMERA FUNCTIONS
========================= */

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (cameraPreview) {
    cameraPreview.srcObject = null;
    cameraPreview.style.transform = "none";
  }

  if (captureButton) captureButton.disabled = true;

  if (cameraPlaceholder) {
    cameraPlaceholder.hidden = false;
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

async function startCamera() {
  if (cameraStarting) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    alert(
      "Camera access is not available in this browser. Please use HTTPS or localhost, or select Upload photos."
    );
    return;
  }

  cameraStarting = true;

  if (startCameraButton) {
    startCameraButton.disabled = true;
    startCameraButton.textContent = "Starting camera...";
  }

  try {
    stopCamera();

    const videoConstraints = currentCameraDeviceId
      ? {
          deviceId: { exact: currentCameraDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      : {
          facingMode: { ideal: currentFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        };

    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: videoConstraints
    });

    cameraPreview.srcObject = cameraStream;
    cameraPreview.autoplay = true;
    cameraPreview.playsInline = true;
    cameraPreview.muted = true;

    await new Promise(resolve => {
      if (cameraPreview.readyState >= 1) {
        resolve();
      } else {
        cameraPreview.onloadedmetadata = () => resolve();
      }
    });

    await cameraPreview.play();

    const track = cameraStream.getVideoTracks()[0];
    const settings = track?.getSettings?.() || {};

    if (settings.deviceId) {
      currentCameraDeviceId = settings.deviceId;
    }

    if (settings.facingMode) {
      currentFacingMode = settings.facingMode;
    }

    /*
      Mirror the preview for the front-facing camera only.
      The captured photo is mirrored separately below.
    */
    cameraPreview.style.transform =
      currentFacingMode === "user" ? "scaleX(-1)" : "none";

    if (cameraPlaceholder) {
      cameraPlaceholder.hidden = true;
    }

    if (captureButton) {
      captureButton.disabled = false;
    }

    await getAvailableCameras();
  } catch (error) {
    console.error("Camera error:", error);

    stopCamera();

    let message = "Unable to start the camera. ";

    if (error.name === "NotAllowedError") {
      message += "Please allow camera access in your browser settings.";
    } else if (error.name === "NotFoundError") {
      message += "No camera was found. Please use Upload photos.";
    } else if (error.name === "NotReadableError") {
      message += "Your camera may be in use by another application.";
    } else {
      message += "Please check your camera permissions and try again.";
    }

    alert(message);
  } finally {
    cameraStarting = false;

    if (startCameraButton) {
      startCameraButton.disabled = false;
      startCameraButton.textContent = "Start camera";
    }
  }
}

async function switchCamera() {
  const cameras = await getAvailableCameras();

  if (cameras.length > 1 && currentCameraDeviceId) {
    const currentIndex = cameras.findIndex(camera => {
      return camera.deviceId === currentCameraDeviceId;
    });

    const nextCamera = cameras[(currentIndex + 1) % cameras.length];

    currentCameraDeviceId = nextCamera.deviceId;

    if (nextCamera.label.toLowerCase().includes("front")) {
      currentFacingMode = "user";
    } else if (nextCamera.label.toLowerCase().includes("back")) {
      currentFacingMode = "environment";
    } else {
      currentFacingMode =
        currentFacingMode === "user" ? "environment" : "user";
    }
  } else {
    currentFacingMode =
      currentFacingMode === "user" ? "environment" : "user";

    currentCameraDeviceId = null;
  }

  await startCamera();
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
    throw new Error("The camera is not ready yet. Please try again.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to capture this photo.");
  }

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
   9. UPLOAD EXACTLY THREE
========================= */

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

  const maxSize = 15 * 1024 * 1024;
  const oversizedFile = files.find(file => file.size > maxSize);

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
  setStatus(uploadStatus, "Loading your photos...");

  try {
    const loadedPhotos = await Promise.all(
      files.map(async file => {
        const dataUrl = await readFileAsDataUrl(file);
        const image = await getImageFromDataUrl(dataUrl);

        /*
          Normalize uploaded images to JPEG.
          This helps with formats such as PNG and WebP.
        */
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Unable to process an uploaded photo.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL("image/jpeg", 0.92);
      })
    );

    photoData = loadedPhotos;
    currentPhotoIndex = 3;

    updatePhotoSlots();
    updatePhotostripPreview();
    updateCameraCounter();
    updateCreateButton();

    setStatus(uploadStatus, "All three photos are ready!");
  } catch (error) {
    console.error(error);

    setStatus(
      uploadStatus,
      error.message || "Unable to load your photos.",
      true
    );
  }
});

/* =========================
   10. UPDATE PHOTO SLOTS
========================= */

function updatePhotoSlots() {
  for (let index = 0; index < 3; index++) {
    const image = document.getElementById(`photoSlot${index + 1}`);
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

retakeAllButton?.addEventListener("click", () => {
  photoData = [null, null, null];
  currentPhotoIndex = 0;
  completedStripBlob = null;
  completedStripDataUrl = null;

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
    const isSelected = button.dataset.template === templateName;

    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

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

  /*
    Apply the selected design class to the large preview.
  */
  photostripPreview.className =
    `photostrip-preview template-${selectedTemplate}`;

  const title = photostripPreview.querySelector(".strip-preview-title");
  const footer = photostripPreview.querySelector(".strip-preview-footer");

  if (title) title.textContent = details.title;
  if (footer) footer.textContent = details.footer;

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

function updateCreateButton() {
  if (!createStripButton) return;

  const hasThreePhotos = photoData.every(Boolean);

  createStripButton.disabled = !hasThreePhotos;
}

/* =========================
   14. CANVAS DRAWING HELPERS
========================= */

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

function drawHeartDecoration(context, x, y, size, color) {
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

function drawFrameBorder(context, x, y, width, height, color, lineWidth) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.strokeRect(x, y, width, height);
  context.restore();
}

/* =========================
   15. RENDER COMPLETE STRIP
========================= */

async function renderPhotostrip() {
  if (!photoData.every(Boolean)) {
    throw new Error("Please take or upload all three photos first.");
  }

  const canvas = photostripCanvas;

  if (!canvas) {
    throw new Error("The photostrip canvas could not be found.");
  }

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create the photostrip.");
  }

  const WIDTH = 600;
  const SIDE_PADDING = 38;
  const PHOTO_WIDTH = WIDTH - SIDE_PADDING * 2;
  const PHOTO_HEIGHT = Math.round(PHOTO_WIDTH * 3 / 4);
  const PHOTO_GAP = 22;
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

  /* Outer frame */
  const outerBorder = selectedTemplate === "film" ? 18 : 8;

  drawFrameBorder(
    context,
    outerBorder / 2,
    outerBorder / 2,
    WIDTH - outerBorder,
    HEIGHT - outerBorder,
    theme.border,
    outerBorder
  );

  if (selectedTemplate === "elegant") {
    drawFrameBorder(
      context,
      24,
      24,
      WIDTH - 48,
      HEIGHT - 48,
      theme.border,
      2
    );
  }

  /* Title */
  const titleY = TOP_PADDING + 38;

  if (selectedTemplate === "doodle") {
    drawHeartDecoration(context, 68, titleY - 8, 20, theme.text);
    drawHeartDecoration(context, WIDTH - 68, titleY - 8, 20, theme.text);
  }

  let titleFont = 'bold 35px Georgia, "Times New Roman", serif';

  if (selectedTemplate === "minimalist") {
    titleFont = '30px Arial, sans-serif';
  } else if (selectedTemplate === "doodle") {
    titleFont = 'italic 34px Georgia, "Times New Roman", serif';
  } else if (selectedTemplate === "elegant") {
    titleFont = 'italic 29px Georgia, "Times New Roman", serif';
  } else if (selectedTemplate === "chalkboard") {
    titleFont = 'bold 31px Georgia, "Times New Roman", serif';
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

  /* Decorative title divider */
  context.save();
  context.strokeStyle = theme.border;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(WIDTH / 2 - 48, TOP_PADDING + 72);
  context.lineTo(WIDTH / 2 + 48, TOP_PADDING + 72);
  context.stroke();
  context.restore();

  /* Three photos */
  let photoY = TOP_PADDING + TITLE_HEIGHT;

  images.forEach((image, index) => {
    const frameBorder =
      selectedTemplate === "minimalist" ? 0 : 5;

    drawCoverImage(
      context,
      image,
      SIDE_PADDING,
      photoY,
      PHOTO_WIDTH,
      PHOTO_HEIGHT
    );

    if (selectedTemplate === "doodle") {
      drawFrameBorder(
        context,
        SIDE_PADDING - 2,
        photoY - 2,
        PHOTO_WIDTH + 4,
        PHOTO_HEIGHT + 4,
        theme.border,
        4
      );
    } else if (frameBorder > 0) {
      drawFrameBorder(
        context,
        SIDE_PADDING,
        photoY,
        PHOTO_WIDTH,
        PHOTO_HEIGHT,
        theme.photoBorder,
        frameBorder
      );
    }

    if (selectedTemplate === "chalkboard") {
      context.save();
      context.fillStyle = "rgba(248, 239, 213, 0.9)";
      context.font = 'bold 18px Arial, sans-serif';
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

  /* Footer */
  const footerY = photoY - PHOTO_GAP + 44;

  if (selectedTemplate === "doodle") {
    drawHeartDecoration(context, 190, footerY, 15, theme.text);
    drawHeartDecoration(context, WIDTH - 190, footerY, 15, theme.text);
  }

  let footerFont = 'bold 20px Arial, sans-serif';

  if (selectedTemplate === "minimalist") {
    footerFont = '15px Arial, sans-serif';
  } else if (selectedTemplate === "doodle") {
    footerFont = 'italic 19px Georgia, "Times New Roman", serif';
  } else if (selectedTemplate === "elegant") {
    footerFont = 'italic 22px Georgia, "Times New Roman", serif';
  } else if (selectedTemplate === "chalkboard") {
    footerFont = 'bold 20px Georgia, "Times New Roman", serif';
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
      footerY + 30,
      WIDTH - 100,
      '12px Arial, sans-serif',
      theme.text
    );
  } else if (selectedTemplate === "elegant") {
    drawCenteredText(
      context,
      "A DAY TO REMEMBER",
      WIDTH / 2,
      footerY + 30,
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
    setStatus(resultStatus, "Your photostrip is ready!");
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
   18. SAVE TO SUPABASE GALLERY
========================= */

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read the photostrip."));

    reader.readAsDataURL(blob);
  });
}

saveStripButton?.addEventListener("click", async () => {
  if (isSavingStrip) return;

  if (!supabaseClient) {
    setStatus(
      resultStatus,
      "Supabase is not available. Please check your connection configuration.",
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

    const { data: publicUrlData } = supabaseClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      throw new Error(
        "The photo was uploaded, but its public URL could not be created."
      );
    }

    /*
      This insert expects wedding_photos to have
      the columns: name and image_path.
      If your table uses different column names,
      update this insert to match your Supabase schema.
    */
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
        "The photostrip uploaded, but it could not be added to the gallery database. Please check your wedding_photos table.",
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
   19. MAKE ANOTHER STRIP
========================= */

makeAnotherButton?.addEventListener("click", () => {
  photoData = [null, null, null];
  currentPhotoIndex = 0;
  completedStripBlob = null;
  completedStripDataUrl = null;

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

      const path = item.image_path || item.path || item.image_url || "";

      if (path.startsWith("https://") || path.startsWith("http://")) {
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
    setStatus(guestbookStatus, "Supabase is not available.", true);
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
    console.error("Guestbook loading error:", error);

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

  /*
    Select the classic film design initially.
  */
  setSelectedTemplate("film");

  /*
    The camera is not started automatically.
    Guests can tap Start camera or Upload photos.
  */
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
