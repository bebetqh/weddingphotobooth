
/* ==========================================
   WEDDING DIGITAL PHOTOBOOTH
   Supabase Storage + Database
   Automatic 3-photo capture
========================================== */

// 1. SUPABASE CONFIGURATION
const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const views = {
  photos: $("#photosView"),
  photobooth: $("#photoboothView"),
  result: $("#resultView"),
  guestbook: $("#guestbookView")
};

let supabaseClient = null;

let cameraStream = null;
let capturedPhotos = [];
let selectedTemplate = "classic";
let latestStripData = "";
let busy = false;
let galleryRequest = 0;
let guestbookRequest = 0;

// Automatic capture state
const AUTO_CAPTURE_COUNT = 3;
const AUTO_COUNTDOWN_SECONDS = 3;
const AUTO_CAPTURE_DELAY = 700;

let autoCaptureStarted = false;
let autoCaptureCancelled = false;
let autoCaptureRunId = 0;

const COUPLE_NAMES = "SYAHLEN  ♥  ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

// ==========================================
// 1A. SUPABASE INITIALISATION
// ==========================================

function initialiseSupabase() {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    console.error("Supabase SDK did not load.");

    const photoCount = $("#photoCount");
    const photoGrid = $("#photoGrid");
    const wishesList = $("#wishesList");

    if (photoCount) photoCount.textContent = "Unavailable";

    if (photoGrid) {
      photoGrid.innerHTML =
        '<p class="muted">The gallery service could not load. Check your internet connection and refresh.</p>';
    }

    if (wishesList) {
      wishesList.innerHTML =
        '<p class="muted">The guestbook service could not load. Check your internet connection and refresh.</p>';
    }

    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    console.log("Supabase initialized successfully.");
    return true;
  } catch (error) {
    console.error("Supabase initialization error:", error);
    return false;
  }
}

// ==========================================
// 2. NAVIGATION
// ==========================================

function showView(name) {
  const targetView = views[name];

  if (!targetView) {
    console.error("Page not found:", name);
    return;
  }

  Object.values(views).forEach(view => {
    if (view) view.classList.remove("active");
  });

  targetView.classList.add("active");

  $$(".nav-tab").forEach(button => {
    const active = button.dataset.page === name;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  const nav = $("#navTabs");
  const menuButton = $("#menuButton");

  if (nav) nav.classList.remove("open");

  if (menuButton) {
    menuButton.setAttribute("aria-expanded", "false");
  }

  if (name !== "photobooth") {
    stopCamera();
  }

  if (name === "photos") {
    loadGallery();
  }

  if (name === "guestbook") {
    loadGuestbook();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");

  if (!button) return;

  event.preventDefault();

  const destination = button.dataset.page;

  showView(destination);

  if (
    destination === "photobooth" &&
    button.classList.contains("primary-button")
  ) {
    startCamera();
  }
});

// Mobile navigation menu
const menuButton = $("#menuButton");

if (menuButton) {
  menuButton.addEventListener("click", () => {
    const nav = $("#navTabs");

    if (!nav) return;

    const isOpen = nav.classList.toggle("open");

    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

// Close mobile navigation with Escape
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    const nav = $("#navTabs");
    const button = $("#menuButton");

    if (nav) nav.classList.remove("open");

    if (button) {
      button.setAttribute("aria-expanded", "false");
    }
  }
});

// ==========================================
// 3. CAMERA
// ==========================================

async function startCamera() {
  const video = $("#cameraVideo");
  const startButton = $("#startCamera");
  const status = $("#cameraStatus");
  const help = $("#cameraHelp");
  const placeholder = $("#cameraPlaceholder");

  if (!video || !startButton || !status || !help || !placeholder) {
    console.error("Camera HTML elements are missing.");
    return;
  }

  // Avoid starting a second camera session.
  if (cameraStream) {
    if (video.srcObject !== cameraStream) {
      video.srcObject = cameraStream;
    }

    try {
      await video.play();
      startAutomaticCapture();
    } catch (error) {
      console.warn("Could not resume camera preview:", error);
    }

    return;
  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    status.textContent = "Camera unavailable";
    help.textContent =
      "Camera access requires HTTPS or localhost. Open this site through a secure connection.";
    return;
  }

  startButton.disabled = true;
  status.textContent = "Opening camera...";
  help.textContent = "Please allow camera access in your browser.";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 960 }
      },
      audio: false
    });

    // If the user left the photobooth while permission was pending,
    // stop the newly opened stream instead of leaving the camera on.
    if (!views.photobooth?.classList.contains("active")) {
      stream.getTracks().forEach(track => track.stop());
      startButton.disabled = false;
      return;
    }

    cameraStream = stream;
    video.srcObject = stream;

    await video.play();

    video.classList.add("ready");
    placeholder.style.display = "none";

    status.textContent = "Camera is ready";
    help.textContent =
      "Get ready! Your three photos will be captured automatically.";

    // IMPORTANT: begin the three-photo sequence automatically.
    startAutomaticCapture();

  } catch (error) {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }

    cameraStream = null;
    video.srcObject = null;
    video.classList.remove("ready");
    placeholder.style.display = "flex";

    status.textContent = "Camera unavailable";

    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      help.textContent =
        "Camera permission was denied. Allow camera access in your browser or site settings, then try again.";
    } else if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      help.textContent =
        "No camera was found. Connect a camera and try again.";
    } else if (
      error.name === "NotReadableError" ||
      error.name === "TrackStartError"
    ) {
      help.textContent =
        "The camera may be in use by another app. Close that app and try again.";
    } else {
      help.textContent =
        "Could not open the camera. Check browser permissions and make sure the site uses HTTPS or localhost.";
    }

    console.error("Camera error:", error);

  } finally {
    startButton.disabled = false;
    renderSlots();
  }
}

function stopCamera() {
  // Cancel any countdown or automatic capture in progress.
  cancelAutomaticCapture();

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  const video = $("#cameraVideo");
  const placeholder = $("#cameraPlaceholder");
  const startButton = $("#startCamera");
  const status = $("#cameraStatus");

  if (video) {
    video.srcObject = null;
    video.classList.remove("ready");
  }

  if (placeholder) {
    placeholder.style.display = "flex";
  }

  if (startButton) {
    startButton.disabled = false;
  }

  if (status) {
    status.textContent = "Camera not started";
  }

  renderSlots();
}

const startCameraButton = $("#startCamera");

if (startCameraButton) {
  startCameraButton.addEventListener("click", startCamera);
}

window.addEventListener("beforeunload", stopCamera);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// 3A. AUTOMATIC COUNTDOWN
// ==========================================

async function countdown(runId) {
  const el = $("#countdown");

  if (el) {
    el.classList.add("show");
  }

  try {
    for (
      let number = AUTO_COUNTDOWN_SECONDS;
      number >= 1;
      number--
    ) {
      if (
        autoCaptureCancelled ||
        runId !== autoCaptureRunId ||
        !cameraStream
      ) {
        throw new Error("Photo session cancelled.");
      }

      if (el) {
        el.textContent = number;
      }

      const status = $("#cameraStatus");

      if (status) {
        status.textContent =
          `Photo ${capturedPhotos.length + 1} of ${AUTO_CAPTURE_COUNT} — get ready!`;
      }

      await delay(1000);
    }

    if (
      autoCaptureCancelled ||
      runId !== autoCaptureRunId ||
      !cameraStream
    ) {
      throw new Error("Photo session cancelled.");
    }

    if (el) {
      el.textContent = "♥";
    }

    await delay(250);

  } finally {
    if (el) {
      el.classList.remove("show");
      el.textContent = "";
    }
  }
}

// ==========================================
// 3B. TAKE SNAPSHOT
// ==========================================

async function takeSnapshot() {
  const video = $("#cameraVideo");
  const canvas = $("#captureCanvas");

  if (
    !cameraStream ||
    !video ||
    !video.videoWidth ||
    !video.videoHeight
  ) {
    throw new Error(
      "Camera is not ready. Turn on the camera and try again."
    );
  }

  if (!canvas) {
    throw new Error("The capture canvas is missing from the HTML.");
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not prepare the photo canvas.");
  }

  // Mirror the photo to match the selfie preview.
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.9);
}

// ==========================================
// 3C. START AUTOMATIC 3-PHOTO SEQUENCE
// ==========================================

async function startAutomaticCapture() {
  if (
    autoCaptureStarted ||
    busy ||
    !cameraStream
  ) {
    return;
  }

  // Do not repeat automatically if all three photos are already taken.
  if (capturedPhotos.length >= AUTO_CAPTURE_COUNT) {
    return;
  }

  autoCaptureStarted = true;
  autoCaptureCancelled = false;

  const runId = ++autoCaptureRunId;

  // Lock other photobooth actions during the sequence.
  busy = true;

  const captureButton = $("#captureButton");
  const startButton = $("#startCamera");
  const help = $("#cameraHelp");

  if (captureButton) {
    captureButton.disabled = true;
  }

  if (startButton) {
    startButton.disabled = true;
  }

  if (help) {
    help.textContent =
      "Smile! The camera will automatically take three photos.";
  }

  try {
    // Start a fresh photo session.
    capturedPhotos = [];
    latestStripData = "";

    renderSlots();

    for (
      let index = 0;
      index < AUTO_CAPTURE_COUNT;
      index++
    ) {
      if (
        autoCaptureCancelled ||
        runId !== autoCaptureRunId ||
        !cameraStream
      ) {
        break;
      }

      // Three-second countdown before each photo.
      await countdown(runId);

      if (
        autoCaptureCancelled ||
        runId !== autoCaptureRunId ||
        !cameraStream
      ) {
        break;
      }

      // Take the photo without a button press.
      const photo = await takeSnapshot();

      if (
        autoCaptureCancelled ||
        runId !== autoCaptureRunId ||
        !cameraStream
      ) {
        break;
      }

      capturedPhotos.push(photo);
      renderSlots();

      if (help) {
        help.textContent =
          index < AUTO_CAPTURE_COUNT - 1
            ? `Photo ${index + 1} captured! Get ready for the next photo.`
            : "All three photos captured! Make your photo strip.";
      }

      // Brief pause before the next countdown.
      if (index < AUTO_CAPTURE_COUNT - 1) {
        await delay(AUTO_CAPTURE_DELAY);
      }
    }

    if (
      !autoCaptureCancelled &&
      runId === autoCaptureRunId &&
      capturedPhotos.length === AUTO_CAPTURE_COUNT
    ) {
      const status = $("#cameraStatus");

      if (status) {
        status.textContent = "All three snaps captured!";
      }

      if (help) {
        help.textContent =
          "All done! You can now make your photo strip.";
      }
    }

  } catch (error) {
    if (!autoCaptureCancelled) {
      console.error("Automatic capture error:", error);

      if (help) {
        help.textContent =
          "Automatic capture failed. Please restart the camera and try again.";
      }
    }

  } finally {
    // Only the current capture session may reset the controls.
    if (runId === autoCaptureRunId) {
      busy = false;
      autoCaptureStarted = false;

      if (startButton) {
        startButton.disabled = false;
      }

      renderSlots();
    }
  }
}

// Cancel countdown and capture when leaving the photobooth.
function cancelAutomaticCapture() {
  autoCaptureCancelled = true;

  // Invalidate the current capture session.
  autoCaptureRunId++;

  autoCaptureStarted = false;
  busy = false;

  const el = $("#countdown");

  if (el) {
    el.classList.remove("show");
    el.textContent = "";
  }
}

// ==========================================
// 3D. PHOTO SLOTS
// ==========================================

function renderSlots() {
  const slots = $$("#snapSlots .snap-slot");
  const finishButton = $("#finishButton");
  const captureButton = $("#captureButton");
  const retakeButton = $("#retakeButton");
  const status = $("#cameraStatus");

  slots.forEach((slot, index) => {
    slot.replaceChildren();

    if (capturedPhotos[index]) {
      const img = document.createElement("img");

      img.src = capturedPhotos[index];
      img.alt = `Photo ${index + 1}`;

      slot.appendChild(img);
    } else {
      slot.textContent = String(index + 1);
    }
  });

  // Shutter is intentionally disabled: capture is automatic.
  if (captureButton) {
    captureButton.disabled = true;
    captureButton.setAttribute("aria-disabled", "true");
    captureButton.title = "Photos are captured automatically";
  }

  if (finishButton) {
    finishButton.disabled =
      capturedPhotos.length !== AUTO_CAPTURE_COUNT || busy;
  }

  if (retakeButton) {
    retakeButton.disabled =
      !cameraStream ||
      capturedPhotos.length === 0 ||
      busy;
  }

  if (status && !autoCaptureStarted) {
    if (capturedPhotos.length === AUTO_CAPTURE_COUNT) {
      status.textContent = "All three snaps captured";
    } else if (cameraStream) {
      status.textContent = "Camera is ready";
    } else {
      status.textContent = "Camera not started";
    }
  }
}

// ==========================================
// 3E. RETAKE PHOTOS
// ==========================================

function resetPhotos() {
  if (busy) return;

  capturedPhotos = [];
  latestStripData = "";

  renderSlots();

  const help = $("#cameraHelp");

  if (help) {
    help.textContent = cameraStream
      ? "Your next three photos will start automatically."
      : "Turn on your camera to get started.";
  }

  // If the camera is still on, automatically start a new set.
  if (cameraStream) {
    startAutomaticCapture();
  }
}

const retakeButton = $("#retakeButton");

if (retakeButton) {
  retakeButton.addEventListener("click", resetPhotos);
}

// ==========================================
// 4. PHOTO TEMPLATE AND STRIP RENDERING
// ==========================================

$$(".template-option").forEach(button => {
  button.addEventListener("click", () => {
    if (busy) return;

    selectedTemplate = button.dataset.template;

    $$(".template-option").forEach(item => {
      const selected = item === button;

      item.classList.toggle("selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
  });
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(
        new Error("Could not load one of the captured photos.")
      );
    };

    image.src = src;
  });
}

function drawCrop(ctx, img, x, y, w, h) {
  const sourceRatio = img.width / img.height;
  const targetRatio = w / h;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (sourceRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(
    img,
    sx, sy, sw, sh,
    x, y, w, h
  );
}

function drawFlower(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;

  for (let i = 0; i < 5; i++) {
    ctx.rotate(Math.PI * 2 / 5);

    ctx.beginPath();

    ctx.ellipse(
      0,
      -radius * 0.65,
      radius * 0.42,
      radius * 0.7,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);

  ctx.fillStyle = "#f9e9bd";
  ctx.fill();

  ctx.restore();
}

async function renderStrip() {
  if (capturedPhotos.length !== AUTO_CAPTURE_COUNT) {
    throw new Error("Please capture three photos first.");
  }

  const canvas = $("#stripCanvas");

  if (!canvas) {
    throw new Error("The photo strip canvas is missing from the HTML.");
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create the photo strip.");
  }

  const w = canvas.width;
  const h = canvas.height;

  const sakura = selectedTemplate === "sakura";
  const bg = sakura ? "#f5dfe5" : "#fffdf8";
  const ink = sakura ? "#98556b" : "#51413b";

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (sakura) {
    for (let i = 0; i < 28; i++) {
      drawFlower(
        ctx,
        (i * 83 + 24) % w,
        (i * 127 + 35) % h,
        9 + (i % 3) * 2,
        "#d99caf"
      );
    }
  } else {
    ctx.strokeStyle = "#e6d8ca";
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, h - 40);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = ink;

  ctx.font = "600 19px 'DM Sans', sans-serif";
  ctx.fillText("OUR WEDDING DAY", w / 2, 68);

  ctx.font = "italic 48px 'Playfair Display', serif";
  ctx.fillText("Just Married", w / 2, 128);

  ctx.font = "18px 'DM Sans', sans-serif";
  ctx.fillText(COUPLE_NAMES, w / 2, 165);

  const margin = 65;
  const photoW = w - margin * 2;
  const photoH = 390;
  const gap = 22;

  let y = 205;

  for (const src of capturedPhotos) {
    const img = await loadImage(src);

    ctx.fillStyle = sakura ? "#fff6f8" : "#ffffff";

    ctx.fillRect(
      margin - 8,
      y - 8,
      photoW + 16,
      photoH + 16
    );

    drawCrop(ctx, img, margin, y, photoW, photoH);

    y += photoH + gap;
  }

  ctx.font = "italic 29px 'Playfair Display', serif";
  ctx.fillStyle = ink;
  ctx.fillText("A memory to keep forever", w / 2, 1500);

