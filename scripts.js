/* =========================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Camera + Upload Photos + Photostrip Templates
   Supabase Gallery + Guestbook
========================================================= */


/* =========================================================
   1. SUPABASE CONFIGURATION
========================================================= */

const SUPABASE_URL =
  "https://hxaudbnyagbfhhwuawua.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

const COUPLE_NAMES = "SYAHLEN & ATIQAH";
const WEDDING_DATE = "08 NOVEMBER 2026";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let supabaseClient = null;
let cameraStream = null;
let capturedPhotos = [];
let selectedTemplate = "film";
let latestStripData = "";
let busy = false;
let cameraStarting = false;
let photoSource = "camera";
let previewRenderId = 0;
let galleryRequestId = 0;
let guestbookRequestId = 0;

const views = {
  home: $("#homeView"),
  gallery: $("#galleryView"),
  photobooth: $("#photoboothView"),
  result: $("#resultView"),
  guestbook: $("#guestbookView")
};


/* =========================================================
   2. TEMPLATE CONFIGURATION
========================================================= */

const TEMPLATES = {
  film: {
    name: "Vintage Film",
    background: "#201817",
    ink: "#fff7ed",
    border: "#d8bd9b",
    photoBackground: "#f5e9d9",
    decoration: "film"
  },

  minimalist: {
    name: "Minimalist",
    background: "#fffdfb",
    ink: "#392b2b",
    border: "#e5d6ce",
    photoBackground: "#f0e5df",
    decoration: "minimalist"
  },

  doodle: {
    name: "Love Doodles",
    background: "#fff7e9",
    ink: "#372824",
    border: "#5a4038",
    photoBackground: "#f0dfd1",
    decoration: "doodle"
  },

  elegant: {
    name: "Floral Elegance",
    background: "#f7eae1",
    ink: "#50382f",
    border: "#c6a18e",
    photoBackground: "#e9d6ca",
    decoration: "elegant"
  },

  chalkboard: {
    name: "Chalkboard",
    background: "#202522",
    ink: "#fff9ec",
    border: "#e9e0ce",
    photoBackground: "#454946",
    decoration: "chalkboard"
  }
};

function currentTemplate() {
  return TEMPLATES[selectedTemplate] || TEMPLATES.film;
}


/* =========================================================
   3. GENERAL HELPERS
========================================================= */

function setMessage(selector, message) {
  const element = $(selector);

  if (element) {
    element.textContent = message;
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function makeText(message, className = "empty-message") {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = message;

  return element;
}

function setButtonText(selector, text) {
  const element = $(selector);

  if (element) {
    element.textContent = text;
  }
}

function safeFileName() {
  const id =
    window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${Date.now()}-${id}.png`;
}

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1];

  if (!mime || !parts[1]) {
    throw new Error("Invalid image data.");
  }

  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

function roundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius,
  fill,
  stroke
) {
  radius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);

  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    radius
  );

  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    radius
  );

  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    radius
  );

  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    radius
  );

  ctx.closePath();

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function centeredText(ctx, text, x, y, font, color) {
  ctx.save();

  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(text, x, y);

  ctx.restore();
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(new Error("Could not load one of your photos."));
    };

    image.src = source;
  });
}


/* =========================================================
   4. SUPABASE INITIALIZATION
========================================================= */

function initializeSupabase() {
  if (!window.supabase?.createClient) {
    console.error("Supabase SDK is unavailable.");

    $("#photoGrid")?.replaceChildren(
      makeText(
        "The gallery service is unavailable. Please refresh the page."
      )
    );

    $("#guestbookList")?.replaceChildren(
      makeText(
        "The guestbook service is unavailable. Please refresh the page."
      )
    );

    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    return true;
  } catch (error) {
    console.error("Supabase initialization error:", error);
    return false;
  }
}


/* =========================================================
   5. PAGE NAVIGATION
========================================================= */

function showView(name) {
  const target = views[name];

  if (!target) return;

  Object.values(views).forEach(view => {
    if (view) {
      view.hidden = view !== target;
      view.classList.toggle("active", view === target);
    }
  });

  $$(".nav-link").forEach(button => {
    const active = button.dataset.view === name;

    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });

  if (name !== "photobooth") {
    stopCamera();
  }

  if (name === "gallery") {
    loadGallery();
  }

  if (name === "guestbook") {
    loadGuestbook();
  }

  if (name === "photobooth") {
    updatePhotostripPreview();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-view]");

  if (!button) return;

  event.preventDefault();

  const destination = button.dataset.view;

  showView(destination);
});


/* =========================================================
   6. CAMERA CONTROLS
========================================================= */

async function startCamera() {
  const video = $("#cameraVideo");
  const button = $("#startCamera");

  if (!video || cameraStarting) return;

  if (photoSource !== "camera") {
    return;
  }

  if (cameraStream) {
    try {
      await video.play();
    } catch (error) {
      console.warn("Camera playback:", error);
    }

    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage(
      "#cameraHelp",
      "Camera access requires HTTPS or localhost. Open the secure website and try again."
    );

    return;
  }

  cameraStarting = true;

  if (button) {
    button.disabled = true;
    button.textContent = "Opening Camera...";
  }

  setMessage(
    "#cameraHelp",
    "Please allow camera access in your browser."
  );

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 1280 },
        height: { ideal: 960 }
      },
      audio: false
    });

    cameraStream = stream;

    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await video.play();

    video.classList.add("ready");

    const placeholder = $("#cameraPlaceholder");

    if (placeholder) {
      placeholder.style.display = "none";
    }

    setMessage(
      "#cameraHelp",
      "Camera ready! Take three photos to create your photostrip."
    );
  } catch (error) {
    console.error("Camera error:", error);

    stopCamera();

    const errors = {
      NotAllowedError:
        "Camera permission was denied. Please allow camera access in your browser settings.",

      NotFoundError:
        "No camera was found on this device.",

      NotReadableError:
        "The camera may be in use by another application.",

      OverconstrainedError:
        "The camera does not support the requested settings."
    };

    setMessage(
      "#cameraHelp",
      errors[error.name] ||
      "Could not open the camera. Check your permissions and try again."
    );
  } finally {
    cameraStarting = false;

    if (button) {
      button.disabled = false;
      button.textContent = "Start Camera";
    }

    updateCaptureControls();
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  const video = $("#cameraVideo");

  if (video) {
    video.pause();
    video.srcObject = null;
    video.classList.remove("ready");
  }

  const placeholder = $("#cameraPlaceholder");

  if (placeholder) {
    placeholder.style.display = "";
  }

  const button = $("#startCamera");

  if (button) {
    button.disabled = false;
    button.textContent = "Start Camera";
  }

  updateCaptureControls();
}

$("#startCamera")?.addEventListener("click", startCamera);

window.addEventListener("beforeunload", stopCamera);


/* =========================================================
   7. SWITCH CAMERA / UPLOAD MODE
========================================================= */

function updateSourceButtons() {
  const cameraButton = $("#cameraModeButton");
  const uploadButton = $("#uploadModeButton");

  if (cameraButton) {
    const active = photoSource === "camera";

    cameraButton.classList.toggle("active", active);
    cameraButton.setAttribute("aria-pressed", String(active));
  }

  if (uploadButton) {
    const active = photoSource === "upload";

    uploadButton.classList.toggle("active", active);
    uploadButton.setAttribute("aria-pressed", String(active));
  }
}

function switchPhotoSource(source) {
  if (busy) return;

  if (source !== "camera" && source !== "upload") {
    return;
  }

  if (photoSource === source) return;

  photoSource = source;

  // Do not carry photos from one method into the other.
  capturedPhotos = [];
  latestStripData = "";

  const stripCanvas = $("#stripCanvas");

  if (stripCanvas) {
    stripCanvas
      .getContext("2d")
      ?.clearRect(0, 0, stripCanvas.width, stripCanvas.height);
  }

  const cameraPanel = $("#cameraModePanel");
  const uploadPanel = $("#uploadModePanel");
  const uploadInput = $("#photoUploadInput");

  stopCamera();

  if (cameraPanel) {
    cameraPanel.hidden = source !== "camera";
  }

  if (uploadPanel) {
    uploadPanel.hidden = source !== "upload";
  }

  if (uploadInput) {
    uploadInput.value = "";
  }

  setMessage("#photoUploadStatus", "No photos selected yet.");

  const clearButton = $("#clearUploadedPhotos");

  if (clearButton) {
    clearButton.disabled = true;
  }

  if (source === "camera") {
    setMessage(
      "#cameraHelp",
      "Start your camera, then take three photos."
    );
  } else {
    setMessage(
      "#photoUploadStatus",
      "Choose exactly three photos from your device."
    );
  }

  updateSourceButtons();
  renderSlots();
}

$("#cameraModeButton")?.addEventListener("click", () => {
  switchPhotoSource("camera");
});

$("#uploadModeButton")?.addEventListener("click", () => {
  switchPhotoSource("upload");
});


/* =========================================================
   8. CAMERA COUNTDOWN AND CAPTURE
========================================================= */

async function countdown(seconds = 3) {
  const element = $("#countdown");

  if (!element) {
    await wait(seconds * 1000);
    return;
  }

  element.classList.add("show");

  try {
    for (let number = seconds; number >= 1; number--) {
      element.textContent = String(number);
      await wait(1000);
    }

    element.textContent = "♡";

    await wait(250);
  } finally {
    element.classList.remove("show");
    element.textContent = "";
  }
}

async function takeSnapshot() {
  const video = $("#cameraVideo");
  const canvas = $("#captureCanvas");

  if (!cameraStream || !video?.videoWidth) {
    throw new Error("The camera is not ready.");
  }

  if (!canvas) {
    throw new Error("The capture canvas is missing.");
  }

  const width = video.videoWidth;
  const height = video.videoHeight;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not prepare the photo.");
  }

  ctx.save();

  // Mirror the saved photo to match the front-camera preview.
  ctx.translate(width, 0);
  ctx.scale(-1, 1);

  ctx.drawImage(video, 0, 0, width, height);

  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.94);
}

$("#captureButton")?.addEventListener("click", async () => {
  if (
    busy ||
    !cameraStream ||
    photoSource !== "camera" ||
    capturedPhotos.length >= 3
  ) {
    return;
  }

  busy = true;
  updateCaptureControls();

  try {
    const nextNumber = capturedPhotos.length + 1;

    setMessage(
      "#cameraHelp",
      `Get ready for photo ${nextNumber} of 3!`
    );

    await countdown(3);

    if (!cameraStream || photoSource !== "camera") {
      throw new Error("Camera capture was stopped.");
    }

    const photo = await takeSnapshot();

    capturedPhotos.push(photo);

    renderSlots();

    if (capturedPhotos.length === 3) {
      setMessage(
        "#cameraHelp",
        "All three photos are ready! Choose your design and create your strip."
      );
    } else {
      setMessage(
        "#cameraHelp",
        `Photo ${capturedPhotos.length} captured. Get ready for the next one!`
      );
    }
  } catch (error) {
    console.error("Photo capture error:", error);

    setMessage(
      "#cameraHelp",
      error.message || "Could not capture the photo."
    );
  } finally {
    busy = false;
    updateCaptureControls();
  }
});


/* =========================================================
   9. UPLOAD THREE PHOTOS FROM YOUR DEVICE
========================================================= */

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error(`Could not read ${file.name}.`));
    };

    reader.readAsDataURL(file);
  });
}

async function normalizeUploadedPhoto(file) {
  const source = await readFileAsDataURL(file);
  const image = await loadImage(source);

  const canvas = document.createElement("canvas");

  // Limit image dimensions to keep memory use manageable.
  const maximumDimension = 1800;

  const scale = Math.min(
    1,
    maximumDimension / Math.max(image.width, image.height)
  );

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error(`Could not prepare ${file.name}.`);
  }

  ctx.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}

$("#photoUploadInput")?.addEventListener("change", async event => {
  if (busy) return;

  const input = event.currentTarget;
  const files = Array.from(input.files || []);

  capturedPhotos = [];
  latestStripData = "";

  if (files.length === 0) {
    setMessage("#photoUploadStatus", "No photos selected.");
    renderSlots();
    return;
  }

  if (files.length !== 3) {
    input.value = "";

    setMessage(
      "#photoUploadStatus",
      "Please select exactly 3 photos. Select all three together."
    );

    renderSlots();
    return;
  }

  const invalidFile = files.find(file => !file.type.startsWith("image/"));

  if (invalidFile) {
    input.value = "";

    setMessage(
      "#photoUploadStatus",
      "One of your selected files is not an image. Please select three image files."
    );

    renderSlots();
    return;
  }

  const oversizedFile = files.find(file => file.size > 15 * 1024 * 1024);

  if (oversizedFile) {
    input.value = "";

    setMessage(
      "#photoUploadStatus",
      `${oversizedFile.name} is larger than 15 MB. Please choose a smaller image.`
    );

    renderSlots();
    return;
  }

  busy = true;

  updateCaptureControls();

  const clearButton = $("#clearUploadedPhotos");

  if (clearButton) {
    clearButton.disabled = true;
  }

  setMessage(
    "#photoUploadStatus",
    "Preparing your three photos..."
  );

  try {
    const processedPhotos = [];

    // Keep the same order in which the user selected the files.
    for (let index = 0; index < files.length; index++) {
      setMessage(
        "#photoUploadStatus",
        `Preparing photo ${index + 1} of 3...`
      );

      const photo = await normalizeUploadedPhoto(files[index]);

      processedPhotos.push(photo);
    }

    capturedPhotos = processedPhotos;

    renderSlots();

    setMessage(
      "#photoUploadStatus",
      "All 3 photos uploaded successfully! You can now create your photostrip. ♡"
    );

    if (clearButton) {
      clearButton.disabled = false;
    }
  } catch (error) {
    console.error("Photo selection error:", error);

    capturedPhotos = [];
    input.value = "";

    setMessage(
      "#photoUploadStatus",
      error.message || "Could not process your photos. Please try again."
    );

    renderSlots();
  } finally {
    busy = false;

    if (clearButton) {
      clearButton.disabled = capturedPhotos.length === 0;
    }

    updateCaptureControls();
  }
});

$("#clearUploadedPhotos")?.addEventListener("click", () => {
  if (busy) return;

  capturedPhotos = [];
  latestStripData = "";

  const input = $("#photoUploadInput");

  if (input) {
    input.value = "";
  }

  setMessage(
    "#photoUploadStatus",
    "Photos cleared. Select three new photos."
  );

  renderSlots();
});


/* =========================================================
   10. PHOTO SLOTS AND BUTTON STATES
========================================================= */

function renderSlots() {
  const slots = $$("#snapSlots .snap-slot");

  slots.forEach((slot, index) => {
    slot.replaceChildren();

    if (capturedPhotos[index]) {
      const image = document.createElement("img");

      image.src = capturedPhotos[index];
      image.alt = `Photo ${index + 1}`;

      slot.appendChild(image);
      slot.classList.add("has-photo");
    } else {
      const number = document.createElement("span");

      number.className = "slot-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const label = document.createElement("span");

      label.className = "slot-label";
      label.textContent = `Photo ${index + 1}`;

      slot.append(number, label);
      slot.classList.remove("has-photo");
    }
  });

  updateCaptureControls();
  updatePhotostripPreview();
}

function updateCaptureControls() {
  const captureButton = $("#captureButton");
  const finishButton = $("#finishButton");
  const retakeButton = $("#retakeButton");
  const clearButton = $("#clearUploadedPhotos");

  if (captureButton) {
    captureButton.disabled =
      !cameraStream ||
      photoSource !== "camera" ||
      capturedPhotos.length >= 3 ||
      busy;
  }

  if (finishButton) {
    finishButton.disabled =
      capturedPhotos.length !== 3 || busy;
  }

  if (retakeButton) {
    retakeButton.disabled =
      capturedPhotos.length === 0 || busy;
  }

  if (clearButton && busy) {
    clearButton.disabled = true;
  }
}

$("#retakeButton")?.addEventListener("click", () => {
  if (busy) return;

  capturedPhotos = [];
  latestStripData = "";

  const input = $("#photoUploadInput");

  if (input) {
    input.value = "";
  }

  setMessage("#photoUploadStatus", "No photos selected yet.");

  if (photoSource === "camera") {
    setMessage(
      "#cameraHelp",
      cameraStream
        ? "Your photos have been cleared. Take three new photos."
        : "Start your camera to begin again."
    );
  }

  renderSlots();
});


/* =========================================================
   11. PHOTOSTRIP DECORATIONS
========================================================= */

function drawHeart(ctx, x, y, size, color, outlined = false) {
  ctx.save();

  ctx.translate(x, y);
  ctx.scale(size / 30, size / 30);

  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-25, -7, -15, -20, 0, -8);
  ctx.bezierCurveTo(15, -20, 25, -7, 0, 10);
  ctx.closePath();

  if (outlined) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.restore();
}

function drawStar(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();

  for (let index = 0; index < 10; index++) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const pointRadius = index % 2 === 0 ? radius : radius * 0.42;

    const px = Math.cos(angle) * pointRadius;
    const py = Math.sin(angle) * pointRadius;

    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }

  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawFlower(ctx, x, y, radius, color) {
  ctx.save();

  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  for (let index = 0; index < 5; index++) {
    ctx.rotate((Math.PI * 2) / 5);

    ctx.beginPath();

    ctx.ellipse(
      0,
      -radius * 0.55,
      radius * 0.34,
      radius * 0.62,
      0,
      0,
      Math.PI * 2
    );

    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawLeaf(ctx, x, y, size, color, flip = false) {
  ctx.save();

  ctx.translate(x, y);
  ctx.scale(flip ? -1 : 1, 1);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size, -size, size * 1.4, -size * 1.6);
  ctx.quadraticCurveTo(size * 0.3, -size * 1.4, 0, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size * 1.2, -size * 1.35);
  ctx.stroke();

  ctx.restore();
}

function drawFilmDecoration(ctx, width, height) {
  for (let y = 35; y < height - 30; y += 28) {
    roundedRect(ctx, 22, y, 13, 16, 2, "#e5cfad");
    roundedRect(ctx, width - 35, y, 13, 16, 2, "#e5cfad");
  }
}

function drawDoodleDecoration(ctx, width, height, color) {
  const symbols = ["♡", "✧", "☆", "✿", "♡", "✦"];
  const positions = [250, 460, 670, 880, 1090, 1300];

  ctx.save();

  ctx.font = "24px Georgia, serif";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  positions.forEach((y, index) => {
    ctx.fillText(symbols[index % symbols.length], 31, y);

    ctx.fillText(
      symbols[(index + 2) % symbols.length],
      width - 31,
      y + 35
    );
  });

  ctx.restore();
}

function drawElegantDecoration(ctx, width, height, color) {
  drawFlower(ctx, 53, 48, 16, color);
  drawFlower(ctx, width - 53, 48, 16, color);

  drawLeaf(ctx, 30, 220, 28, color);
  drawLeaf(ctx, width - 30, 220, 28, color, true);

  drawLeaf(ctx, 30, height - 145, 28, color);
  drawLeaf(ctx, width - 30, height - 145, 28, color, true);
}

function drawChalkDecoration(ctx, width, height, color) {
  ctx.save();

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);

  ctx.strokeRect(
    48,
    42,
    width - 96,
    height - 84
  );

  ctx.setLineDash([]);

  ctx.restore();

  drawDoodleDecoration(ctx, width, height, color);
}


/* =========================================================
   12. PHOTO CROPPING
========================================================= */

function drawCrop(
  ctx,
  image,
  x,
  y,
  width,
  height,
  monochrome = false
) {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;

    // Keep the crop slightly above the vertical centre.
    sy = Math.max(0, (image.height - sh) * 0.12);
  }

  ctx.save();

  if (monochrome) {
    ctx.filter = "grayscale(100%)";
  }

  ctx.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    x,
    y,
    width,
    height
  );

  ctx.restore();
}


/* =========================================================
   13. CREATE THE PHOTOSTRIP
========================================================= */

async function drawPhotostrip(canvas, photos, options = {}) {
  if (!canvas) {
    throw new Error("Photostrip canvas is missing.");
  }

  if (!Array.isArray(photos) || photos.length !== 3) {
    throw new Error("Please add exactly three photos first.");
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not access the photostrip canvas.");
  }

  const width = canvas.width;
  const height = canvas.height;
  const theme = currentTemplate();

  const isFilm = selectedTemplate === "film";
  const isMinimal = selectedTemplate === "minimalist";
  const isDoodle = selectedTemplate === "doodle";
  const isElegant = selectedTemplate === "elegant";
  const isChalk = selectedTemplate === "chalkboard";

  const images = await Promise.all(photos.map(loadImage));

  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;

  ctx.strokeRect(
    20,
    20,
    width - 40,
    height - 40
  );

  // Template decorations
  if (isFilm) {
    drawFilmDecoration(ctx, width, height);
  }

  if (isDoodle) {
    drawDoodleDecoration(ctx, width, height, theme.ink);
  }

  if (isElegant) {
    drawElegantDecoration(ctx, width, height, theme.border);
  }

  if (isChalk) {
    drawChalkDecoration(ctx, width, height, theme.ink);
  }

  // Header
  if (isFilm) {
    centeredText(
      ctx,
      COUPLE_NAMES,
      width / 2,
      69,
      "600 20px Arial, sans-serif",
      theme.ink
    );

    centeredText(
      ctx,
      "Just Married",
      width / 2,
      123,
      "italic 37px Georgia, serif",
      theme.ink
    );
  } else if (isMinimal) {
    centeredText(
      ctx,
      "S Y A H L E N  &  A T I Q A H",
      width / 2,
      78,
      "500 20px Arial, sans-serif",
      theme.ink
    );

    centeredText(
      ctx,
      WEDDING_DATE,
      width / 2,
      121,
      "11px Arial, sans-serif",
      theme.ink
    );
  } else if (isDoodle) {
    centeredText(
      ctx,
      "Syahlen & Atiqah",
      width / 2,
      94,
      "bold 47px cursive",
      theme.ink
    );

    drawHeart(ctx, 93, 93, 24, theme.ink, true);
    drawStar(ctx, width - 92, 90, 14, theme.ink);
  } else if (isElegant) {
    centeredText(
      ctx,
      "SYAHLEN",
      width / 2,
      66,
      "500 30px Georgia, serif",
      theme.ink
    );

    centeredText(
      ctx,
      "&",
      width / 2,
      105,
      "italic 25px Georgia, serif",
      theme.ink
    );

    centeredText(
      ctx,
      "ATIQAH",
      width / 2,
      145,
      "500 30px Georgia, serif",
      theme.ink
    );
  } else if (isChalk) {
    centeredText(
      ctx,
      "SYAHLEN",
      width / 2,
      74,
      "bold 49px cursive",
      theme.ink
    );

    centeredText(
      ctx,
      "& ATIQAH",
      width / 2,
      124,
      "bold 43px cursive",
      theme.ink
    );

    drawHeart(ctx, 94, 82, 25, theme.ink, true);
    drawStar(ctx, width - 92, 82, 14, theme.ink);
  }

  // Three photo frames
  const photoX = 68;
  const photoWidth = width - photoX * 2;
  const photoHeight = 335;
  const photoGap = 22;
  const firstPhotoY = 200;

  for (let index = 0; index < 3; index++) {
    const x = photoX;
    const y = firstPhotoY + index * (photoHeight + photoGap);

    ctx.fillStyle = isFilm || isElegant
      ? "#f5e8d8"
      : "#ffffff";

    ctx.fillRect(
      x - 6,
      y - 6,
      photoWidth + 12,
      photoHeight + 12
    );

    drawCrop(
      ctx,
      images[index],
      x,
      y,
      photoWidth,
      photoHeight,
      false
    );

    if (selectedTemplate === "blackwhite") {
      drawCrop(
        ctx,
        images[index],
        x,
        y,
        photoWidth,
        photoHeight,
        true
      );
    }
  }

  // Footer
  const footerY = 1310;

  if (isFilm) {
    centeredText(
      ctx,
      "A LITTLE MOMENT, A FOREVER MEMORY",
      width / 2,
      footerY,
      "bold 13px Arial, sans-serif",
      theme.ink
    );

    centeredText(
      ctx,
      WEDDING_DATE,
      width / 2,
      footerY + 28,
      "12px Arial, sans-serif",
      theme.ink
    );
  } else if (isMinimal) {
    centeredText(
      ctx,
      "A DAY TO REMEMBER",
      width / 2,
      footerY,
      "12px Arial, sans-serif",
      theme.ink
    );

    centeredText(
      ctx,
      "♡",
      width / 2,
      footerY + 28,
      "26px Georgia, serif",
      theme.ink
    );
  } else if (isDoodle) {
    centeredText(
      ctx,
      "made with love ♡",
      width / 2,
      footerY,
      "bold 30px cursive",
      theme.ink
    );

    centeredText(
      ctx,
      WEDDING_DATE,
      width / 2,
      footerY + 35,
      "14px Arial, sans-serif",
      theme.ink
    );
  } else if (isElegant) {
    centeredText(
      ctx,
      "Together is a beautiful place to be",
      width / 2,
      footerY,
      "italic 18px Georgia, serif",
      theme.ink
    );

    centeredText(
      ctx,
      WEDDING_DATE,
      width / 2,
      footerY + 31,
      "12px Arial, sans-serif",
      theme.ink
    );
  } else if (isChalk) {
    centeredText(
      ctx,
      "made with love",
      width / 2,
      footerY,
      "italic 26px cursive",
      theme.ink
    );

    centeredText(
      ctx,
      WEDDING_DATE,
      width / 2,
      footerY + 31,
      "13px Arial, sans-serif",
      theme.ink
    );
  }

  if (options.preview) {
    return canvas.toDataURL("image/png");
  }

  return canvas.toDataURL("image/png");
}


/* =========================================================
   14. LIVE PHOTOSTRIP PREVIEW
========================================================= */

async function updatePhotostripPreview() {
  const preview = $("#liveStripPreview");

  if (!preview) return;

  const renderId = ++previewRenderId;

  if (capturedPhotos.length !== 3) {
    preview.replaceChildren();

    const placeholder = document.createElement("div");
    placeholder.className = "preview-placeholder";

    const heart = document.createElement("span");
    heart.textContent = "♡";

    const message = document.createElement("p");

    message.textContent =
      capturedPhotos.length === 0
        ? "Your photostrip will appear here."
        : `${capturedPhotos.length} of 3 photos added.`;

    placeholder.append(heart, message);
    preview.appendChild(placeholder);

    setMessage(
      "#livePreviewStatus",
      `${capturedPhotos.length} of 3 photos added`
    );

    return;
  }

  setMessage(
    "#livePreviewStatus",
    `Preparing ${currentTemplate().name} preview...`
  );

  try {
    const previewCanvas = document.createElement("canvas");

    previewCanvas.width = 600;
    previewCanvas.height = 1760;

    await drawPhotostrip(
      previewCanvas,
      capturedPhotos,
      { preview: true }
    );

    if (renderId !== previewRenderId) return;

    const image = document.createElement("img");

    image.src = previewCanvas.toDataURL("image/png");
    image.alt = "Preview of your wedding photostrip";
    image.className = "live-strip-image";

    preview.replaceChildren(image);

    setMessage(
      "#livePreviewStatus",
      `${currentTemplate().name} preview`
    );
  } catch (error) {
    console.error("Photostrip preview error:", error);

    if (renderId !== previewRenderId) return;

    setMessage(
      "#livePreviewStatus",
      "Could not prepare the preview. Please try again."
    );
  }
}


/* =========================================================
   15. TEMPLATE SELECTION
========================================================= */

function selectTemplate(button) {
  if (!button) return;

  const name = button.dataset.template;

  if (!TEMPLATES[name]) return;

  selectedTemplate = name;

  $$(".template-button").forEach(option => {
    const active = option === button;

    option.classList.toggle("active", active);
    option.setAttribute("aria-pressed", String(active));
  });

  updatePhotostripPreview();
}

$$(".template-button").forEach(button => {
  button.addEventListener("click", () => {
    selectTemplate(button);
  });
});


/* =========================================================
   16. CREATE THE FINAL PHOTOSTRIP
========================================================= */

$("#finishButton")?.addEventListener("click", async () => {
  if (busy || capturedPhotos.length !== 3) {
    return;
  }

  const canvas = $("#stripCanvas");

  if (!canvas) {
    setMessage(
      "#resultMessage",
      "The photostrip canvas is missing."
    );

    return;
  }

  busy = true;
  updateCaptureControls();

  setButtonText(
    "#finishButton",
    "Creating your photostrip..."
  );

  try {
    canvas.width = 600;
    canvas.height = 1760;

    latestStripData = await drawPhotostrip(
      canvas,
      capturedPhotos,
      { preview: false }
    );

    showView("result");
  } catch (error) {
    console.error("Photostrip creation error:", error);

    setMessage(
      "#resultMessage",
      error.message || "Could not create your photostrip."
    );
  } finally {
    busy = false;

    setButtonText(
      "#finishButton",
      "Create Photostrip"
    );

    updateCaptureControls();
  }
});


/* =========================================================
   17. DOWNLOAD PHOTOSTRIP
========================================================= */

$("#downloadButton")?.addEventListener("click", async () => {
  const canvas = $("#stripCanvas");

  if (!canvas || !latestStripData) {
    setMessage(
      "#resultMessage",
      "Please create your photostrip before downloading."
    );

    return;
  }

  const button = $("#downloadButton");

  if (button) {
    button.disabled = true;
  }

  try {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Could not prepare the PNG file."));
        }
      }, "image/png");
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "Syahlen-and-Atiqah-Wedding-Photo-Strip.png";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);

    setMessage(
      "#resultMessage",
      "Your photostrip is ready to save. ♡"
    );
  } catch (error) {
    console.error("Download error:", error);

    setMessage(
      "#resultMessage",
      "Download failed. Please try again."
    );
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
});


/* =========================================================
   18. SHARE PHOTOSTRIP TO SUPABASE
========================================================= */

async function uploadPhotoStrip() {
  if (busy || !latestStripData) return;

  if (!supabaseClient) {
    setMessage(
      "#resultMessage",
      "The gallery service is unavailable. Please refresh and try again."
    );

    return;
  }

  const button = $("#uploadButton");

  busy = true;

  if (button) {
    button.disabled = true;
    button.textContent = "Uploading...";
  }

  setMessage(
    "#resultMessage",
    "Uploading your photostrip to the wedding gallery..."
  );

  const guestName = $("#guestName")?.value.trim().slice(0, 60)
    || "A wedding guest";

  const path = `photostrips/${safeFileName()}`;

  try {
    const blob = dataURLToBlob(latestStripData);

    const { error: uploadError } = await supabaseClient
      .storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { error: insertError } = await supabaseClient
      .from(PHOTO_TABLE)
      .insert({
        name: guestName,
        image_path: path
      });

    if (insertError) {
      const { error: cleanupError } = await supabaseClient
        .storage
        .from(BUCKET)
        .remove([path]);

      if (cleanupError) {
        console.warn(
          "Could not remove incomplete upload:",
          cleanupError
        );
      }

      throw insertError;
    }

    setMessage(
      "#resultMessage",
      "Your photostrip has been shared with the wedding gallery! ♡"
    );

    if (button) {
      button.textContent = "Shared Successfully";
    }

    await loadGallery();
  } catch (error) {
    console.error("Photostrip upload error:", error);

    setMessage(
      "#resultMessage",
      `Upload failed: ${error.message || "Unknown error"}. Check your Supabase bucket, table and access policies.`
    );

    if (button) {
      button.textContent = "Try Sharing Again";
    }
  } finally {
    busy = false;

    if (button) {
      button.disabled = false;
    }
  }
}

$("#uploadButton")?.addEventListener("click", uploadPhotoStrip);


/* =========================================================
   19. RESET AND CREATE ANOTHER PHOTOSTRIP
========================================================= */

function resetPhotos() {
  capturedPhotos = [];
  latestStripData = "";

  const canvas = $("#stripCanvas");

  if (canvas) {
    canvas
      .getContext("2d")
      ?.clearRect(0, 0, canvas.width, canvas.height);
  }

  const uploadInput = $("#photoUploadInput");

  if (uploadInput) {
    uploadInput.value = "";
  }

  const clearButton = $("#clearUploadedPhotos");

  if (clearButton) {
    clearButton.disabled = true;
  }

  const uploadButton = $("#uploadButton");

  if (uploadButton) {
    uploadButton.disabled = false;
    uploadButton.textContent = "Share to Wedding Gallery";
  }

  const downloadButton = $("#downloadButton");

  if (downloadButton) {
    downloadButton.disabled = false;
  }

  setMessage("#resultMessage", "");
  setMessage("#photoUploadStatus", "No photos selected yet.");

  renderSlots();
}

$("#againButton")?.addEventListener("click", () => {
  if (busy) return;

  resetPhotos();

  switchPhotoSource(photoSource);

  showView("photobooth");

  if (photoSource === "camera") {
    startCamera();
  }
});


/* =========================================================
   20. LOAD THE WEDDING PHOTO GALLERY
========================================================= */

async function loadGallery() {
  const grid = $("#photoGrid");
  const requestId = ++galleryRequestId;

  if (!grid) return;

  if (!supabaseClient) {
    grid.replaceChildren(
      makeText("The gallery service is unavailable.")
    );

    return;
  }

  grid.replaceChildren(
    makeText("Loading wedding photos...")
  );

  try {
    const { data, error } = await supabaseClient
      .from(PHOTO_TABLE)
      .select("id, name, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    if (requestId !== galleryRequestId) return;

    grid.replaceChildren();

    if (!data || data.length === 0) {
      grid.appendChild(
        makeText("No photos yet. Be the first to share a memory! ♡")
      );

      return;
    }

    data.forEach(photo => {
      const { data: urlData } = supabaseClient
        .storage
        .from(BUCKET)
        .getPublicUrl(photo.image_path);

      const card = document.createElement("article");
      card.className = "photo-card";

      const image = document.createElement("img");

      image.src = urlData.publicUrl;
      image.alt = `Photo shared by ${photo.name || "a wedding guest"}`;
      image.loading = "lazy";

      const caption = document.createElement("p");

      caption.textContent =
        `Shared by ${photo.name || "A wedding guest"}`;

      card.append(image, caption);
      grid.appendChild(card);
    });
  } catch (error) {
    if (requestId !== galleryRequestId) return;

    console.error("Gallery loading error:", error);

    grid.replaceChildren(
      makeText(
        "Could not load wedding photos. Check your Supabase table, bucket and access policies."
      )
    );
  }
}


/* =========================================================
   21. GUESTBOOK
========================================================= */

async function loadGuestbook() {
  const list = $("#guestbookList");
  const requestId = ++guestbookRequestId;

  if (!list) return;

  if (!supabaseClient) {
    list.replaceChildren(
      makeText("The guestbook service is unavailable.")
    );

    return;
  }

  list.replaceChildren(
    makeText("Loading guestbook messages...")
  );

  try {
    const { data, error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    if (requestId !== guestbookRequestId) return;

    list.replaceChildren();

    if (!data || data.length === 0) {
      list.appendChild(
        makeText("No messages yet. Leave the couple your first wish! ♡")
      );

      return;
    }

    data.forEach(entry => {
      const card = document.createElement("article");
      card.className = "guestbook-entry";

      const name = document.createElement("h3");
      name.textContent = entry.name || "A wedding guest";

      const message = document.createElement("p");
      message.textContent = entry.message || "";

      const date = document.createElement("small");

      if (entry.created_at) {
        const parsedDate = new Date(entry.created_at);

        if (!Number.isNaN(parsedDate.getTime())) {
          date.textContent = parsedDate.toLocaleDateString();
        }
      }

      card.append(name, message, date);
      list.appendChild(card);
    });
  } catch (error) {
    if (requestId !== guestbookRequestId) return;

    console.error("Guestbook loading error:", error);

    list.replaceChildren(
      makeText(
        "Could not load guestbook messages. Check your Supabase table and access policies."
      )
    );
  }
}

$("#guestbookForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (busy) return;

  if (!supabaseClient) {
    setMessage(
      "#guestbookStatus",
      "The guestbook service is unavailable. Please refresh the page."
    );

    return;
  }

  const nameInput = $("#guestbookName");
  const messageInput = $("#guestbookMessage");
  const submitButton = $("#guestbookSubmit");

  const name = nameInput?.value.trim();
  const message = messageInput?.value.trim();

  if (!name || !message) {
    setMessage(
      "#guestbookStatus",
      "Please enter your name and message."
    );

    return;
  }

  busy = true;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
  }

  setMessage(
    "#guestbookStatus",
    "Sending your wishes..."
  );

  try {
    const { error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .insert({
        name: name.slice(0, 60),
        message: message.slice(0, 1000)
      });

    if (error) {
      throw error;
    }

    $("#guestbookForm").reset();

    setMessage(
      "#guestbookStatus",
      "Your wishes have been sent successfully. Thank you! ♡"
    );

    await loadGuestbook();
  } catch (error) {
    console.error("Guestbook submission error:", error);

    setMessage(
      "#guestbookStatus",
      `Could not send your message: ${error.message || "Please try again."}`
    );
  } finally {
    busy = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Send Your Wishes";
    }
  }
});


/* =========================================================
   22. INITIALIZE THE WEBSITE
========================================================= */

function initializePhotobooth() {
  const canvas = $("#stripCanvas");

  if (canvas) {
    canvas.width = 600;
    canvas.height = 1760;
  }

  updateSourceButtons();

  // Select the default template.
  const defaultTemplate = $(
    '.template-button[data-template="film"]'
  );

  if (defaultTemplate) {
    selectTemplate(defaultTemplate);
  }

  renderSlots();

  if (initializeSupabase()) {
    loadGallery();
    loadGuestbook();
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializePhotobooth
  );
} else {
  initializePhotobooth();
}