
/* ==========================================
   WEDDING DIGITAL PHOTOBOOTH
   Supabase Storage + Database
   Automatic 3-photo capture
   8 photo strip templates
   Live template preview
========================================== */

// ==========================================
// 1. SUPABASE CONFIGURATION
// ==========================================

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
let previewRenderId = 0;

const AUTO_CAPTURE_COUNT = 3;
const AUTO_COUNTDOWN_SECONDS = 3;
const AUTO_CAPTURE_DELAY = 700;

let autoCaptureStarted = false;
let autoCaptureCancelled = false;
let autoCaptureRunId = 0;

const COUPLE_NAMES = "SYAHLEN ♥ ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

// ==========================================
// 2. PHOTO STRIP TEMPLATES
// ==========================================

const STRIP_TEMPLATES = {
  classic: {
    name: "Classic",
    bg: "#fffdf8",
    ink: "#51413b",
    accent: "#c7a78b",
    photoFrame: "#ffffff",
    border: "#e6d8ca",
    heading: "Playfair Display",
    decoration: "classic"
  },
  minimalist: {
    name: "Minimalist",
    bg: "#ffffff",
    ink: "#292929",
    accent: "#a8a8a8",
    photoFrame: "#ffffff",
    border: "#e5e5e5",
    heading: "DM Sans",
    decoration: "minimalist"
  },
  aesthetic: {
    name: "Aesthetic",
    bg: "#eee7dc",
    ink: "#594b40",
    accent: "#b7a18a",
    photoFrame: "#faf6ef",
    border: "#d5c5b2",
    heading: "Playfair Display",
    decoration: "aesthetic"
  },
  doodle: {
    name: "Doodle",
    bg: "#fffdf4",
    ink: "#343434",
    accent: "#e9a5a5",
    photoFrame: "#ffffff",
    border: "#383838",
    heading: "DM Sans",
    decoration: "doodle"
  },
  floral: {
    name: "Floral",
    bg: "#f8eee9",
    ink: "#78565a",
    accent: "#d5a3ad",
    photoFrame: "#fffaf7",
    border: "#e6c9ce",
    heading: "Playfair Display",
    decoration: "floral"
  },
  film: {
    name: "Film",
    bg: "#252525",
    ink: "#fff7e9",
    accent: "#e4d4b7",
    photoFrame: "#f6efe2",
    border: "#656565",
    heading: "DM Sans",
    decoration: "film"
  },
  retro: {
    name: "Retro",
    bg: "#f2d7a5",
    ink: "#713d32",
    accent: "#d16d50",
    photoFrame: "#fff2d9",
    border: "#b65f49",
    heading: "Playfair Display",
    decoration: "retro"
  },
  sakura: {
    name: "Sakura",
    bg: "#f5dfe5",
    ink: "#98556b",
    accent: "#d99caf",
    photoFrame: "#fff6f8",
    border: "#e5b8c5",
    heading: "Playfair Display",
    decoration: "sakura"
  }
};

// ==========================================
// 3. SUPABASE INITIALISATION
// ==========================================

function initialiseSupabase() {
  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    console.error("Supabase SDK did not load.");
    showServiceError();
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
    showServiceError();
    return false;
  }
}

function showServiceError() {
  const count = $("#photoCount");
  const grid = $("#photoGrid");
  const wishes = $("#wishesList");

  if (count) count.textContent = "Unavailable";

  if (grid) {
    grid.textContent =
      "Gallery service is unavailable. Check your connection and refresh.";
  }

  if (wishes) {
    wishes.textContent =
      "Guestbook service is unavailable. Check your connection and refresh.";
  }
}

// ==========================================
// 4. NAVIGATION
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
  if (menuButton) menuButton.setAttribute("aria-expanded", "false");

  if (name !== "photobooth") stopCamera();
  if (name === "photos") loadGallery();
  if (name === "guestbook") loadGuestbook();

  window.scrollTo({ top: 0, behavior: "smooth" });
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

const menuButton = $("#menuButton");

if (menuButton) {
  menuButton.addEventListener("click", () => {
    const nav = $("#navTabs");
    if (!nav) return;

    const isOpen = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });
}

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  const nav = $("#navTabs");
  if (nav) nav.classList.remove("open");

  if (menuButton) {
    menuButton.setAttribute("aria-expanded", "false");
  }
});

// ==========================================
// 5. CAMERA
// ==========================================

async function startCamera() {
  const video = $("#cameraVideo");
  const startButton = $("#startCamera");
  const status = $("#cameraStatus");
  const help = $("#cameraHelp");
  const placeholder = $("#cameraPlaceholder");

  if (!video || !status || !help || !placeholder) {
    console.error("Camera HTML elements are missing.");
    return;
  }

  if (
    cameraStream &&
    cameraStream.getTracks().some(track => track.readyState === "live")
  ) {
    video.srcObject = cameraStream;

    try {
      await video.play();
      video.classList.add("ready");
      placeholder.style.display = "none";
      startAutomaticCapture();
    } catch (error) {
      console.warn("Could not resume camera:", error);
    }

    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Camera unavailable";
    help.textContent = "Camera access requires HTTPS or localhost.";
    return;
  }

  if (startButton) startButton.disabled = true;

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

    if (!views.photobooth?.classList.contains("active")) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    cameraStream = stream;
    video.srcObject = stream;

    await video.play();

    video.classList.add("ready");
    placeholder.style.display = "none";
    status.textContent = "Camera is ready";
    help.textContent =
      "Get ready! Three photos will be captured automatically.";

    startAutomaticCapture();
  } catch (error) {
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
        "Camera permission denied. Allow camera access in browser settings.";
    } else if (
      error.name === "NotFoundError" ||
      error.name === "DevicesNotFoundError"
    ) {
      help.textContent = "No camera was found. Connect a camera and try again.";
    } else if (
      error.name === "NotReadableError" ||
      error.name === "TrackStartError"
    ) {
      help.textContent =
        "The camera may be in use by another app. Close that app and try again.";
    } else {
      help.textContent =
        "Could not open the camera. Check permissions and HTTPS.";
    }

    console.error("Camera error:", error);
  } finally {
    if (startButton) startButton.disabled = false;
    renderSlots();
  }
}

function stopCamera() {
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

  if (placeholder) placeholder.style.display = "flex";
  if (startButton) startButton.disabled = false;
  if (status) status.textContent = "Camera not started";

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
// 6. COUNTDOWN
// ==========================================

async function countdown(runId) {
  const el = $("#countdown");
  if (el) el.classList.add("show");

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

      if (el) el.textContent = number;

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

    if (el) el.textContent = "♥";
    await delay(250);
  } finally {
    if (el) {
      el.classList.remove("show");
      el.textContent = "";
    }
  }
}

// ==========================================
// 7. TAKE PHOTO
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
    throw new Error("Camera is not ready. Turn on the camera first.");
  }

  if (!canvas) {
    throw new Error("The capture canvas is missing from the HTML.");
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo canvas.");

  // Mirror the photo to match the selfie preview.
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.9);
}

// ==========================================
// 8. AUTOMATIC THREE-PHOTO CAPTURE
// ==========================================

async function startAutomaticCapture() {
  if (autoCaptureStarted || busy || !cameraStream) return;
  if (capturedPhotos.length >= AUTO_CAPTURE_COUNT) return;

  autoCaptureStarted = true;
  autoCaptureCancelled = false;

  const runId = ++autoCaptureRunId;
  busy = true;

  const captureButton = $("#captureButton");
  const startButton = $("#startCamera");
  const help = $("#cameraHelp");

  if (captureButton) captureButton.disabled = true;
  if (startButton) startButton.disabled = true;

  if (help) {
    help.textContent =
      "Smile! The camera will automatically take three photos.";
  }

  try {
    capturedPhotos = [];
    latestStripData = "";

    renderSlots();
    refreshTemplatePreview();

    for (let index = 0; index < AUTO_CAPTURE_COUNT; index++) {
      if (
        autoCaptureCancelled ||
        runId !== autoCaptureRunId ||
        !cameraStream
      ) break;

      await countdown(runId);

      if (
        autoCaptureCancelled ||
        runId !== autoCaptureRunId ||
        !cameraStream
      ) break;

      const photo = await takeSnapshot();

      if (
        autoCaptureCancelled ||
        runId !== autoCaptureRunId ||
        !cameraStream
      ) break;

      capturedPhotos.push(photo);
      renderSlots();
      refreshTemplatePreview();

      if (help) {
        help.textContent =
          index < AUTO_CAPTURE_COUNT - 1
            ? `Photo ${index + 1} captured! Get ready for the next photo.`
            : "All three photos captured! Make your photo strip.";
      }

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
      if (status) status.textContent = "All three snaps captured!";

      if (help) {
        help.textContent = "All done! You can now make your photo strip.";
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
    if (runId === autoCaptureRunId) {
      busy = false;
      autoCaptureStarted = false;

      if (startButton) startButton.disabled = false;

      renderSlots();
      refreshTemplatePreview();
    }
  }
}

function cancelAutomaticCapture() {
  autoCaptureCancelled = true;
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
// 9. PHOTO SLOTS AND RETAKING
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
      !cameraStream || capturedPhotos.length === 0 || busy;
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

function resetPhotos() {
  if (busy) return;

  capturedPhotos = [];
  latestStripData = "";

  renderSlots();
  refreshTemplatePreview();

  const help = $("#cameraHelp");

  if (help) {
    help.textContent = cameraStream
      ? "Your next three photos will start automatically."
      : "Turn on your camera to get started.";
  }

  if (cameraStream) startAutomaticCapture();
}

const retakeButton = $("#retakeButton");

if (retakeButton) {
  retakeButton.addEventListener("click", resetPhotos);
}

// ==========================================
// 10. TEMPLATE SELECTOR + LIVE PREVIEW
// ==========================================

function updateTemplateSelection() {
  $$(".template-option").forEach(button => {
    const selected = button.dataset.template === selectedTemplate;

    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function updatePreviewText() {
  const style = STRIP_TEMPLATES[selectedTemplate];
  const title = $("#previewTitle");
  const caption = $("#previewCaption");
  const status = $("#templateStatus");
  const liveStatus = $("#livePreviewStatus");

  if (title) title.textContent = `${style.name} Preview`;

  if (caption) {
    caption.textContent =
      capturedPhotos.length === AUTO_CAPTURE_COUNT
        ? "Your photos are ready in this design."
        : "Sample preview — your photos will appear here after capture.";
  }

  if (status) status.textContent = `${style.name} style selected.`;

  if (liveStatus) {
    liveStatus.textContent = `Previewing ${style.name} style.`;
  }
}

async function refreshTemplatePreview() {
  const canvas = $("#templatePreviewCanvas");
  if (!canvas) return;

  const renderId = ++previewRenderId;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const style = STRIP_TEMPLATES[selectedTemplate] || STRIP_TEMPLATES.classic;
  const w = canvas.width;
  const h = canvas.height;

  drawTemplateDecorations(ctx, w, h, style);

  // Header
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = style.ink;
  ctx.font = "600 19px 'DM Sans', sans-serif";
  ctx.fillText("OUR WEDDING DAY", w / 2, 78);

  // Couple's names
  let fontSize = 39;
  ctx.font = `600 ${fontSize}px '${style.heading}', serif`;

  while (
    fontSize > 23 &&
    ctx.measureText(COUPLE_NAMES).width > w - 100
  ) {
    fontSize -= 2;
    ctx.font = `600 ${fontSize}px '${style.heading}', serif`;
  }

  ctx.fillText(COUPLE_NAMES, w / 2, 135);

  ctx.font = "17px 'DM Sans', sans-serif";
  ctx.fillText(WEDDING_DATE, w / 2, 171);

  if (style.decoration === "doodle") {
    drawDoodle(ctx, 95, 142, "sparkle", style.accent);
    drawDoodle(ctx, w - 95, 142, "heart", style.accent);
  } else if (
    style.decoration === "sakura" ||
    style.decoration === "floral"
  ) {
    drawFlower(ctx, 78, 143, 12, style.accent);
    drawFlower(ctx, w - 78, 143, 12, style.accent);
  } else if (style.decoration === "aesthetic") {
    drawSparkle(ctx, 80, 140, 8, style.accent);
    drawSparkle(ctx, w - 80, 140, 8, style.accent);
  }

  const margin = style.decoration === "film" ? 66 : 65;
  const photoW = w - margin * 2;
  const photoH = 370;
  const gap = 24;

  let y = 215;

  for (let index = 0; index < AUTO_CAPTURE_COUNT; index++) {
    if (renderId !== previewRenderId) return;

    ctx.fillStyle = style.photoFrame;
    ctx.fillRect(margin - 8, y - 8, photoW + 16, photoH + 16);

    ctx.strokeStyle = style.border;
    ctx.lineWidth = style.decoration === "doodle" ? 3 : 2;
    ctx.strokeRect(margin - 8, y - 8, photoW + 16, photoH + 16);

    if (capturedPhotos[index]) {
      try {
        const img = await loadImage(capturedPhotos[index]);

        if (renderId !== previewRenderId) return;

        drawCrop(ctx, img, margin, y, photoW, photoH);
      } catch (error) {
        drawSamplePhoto(ctx, margin, y, photoW, photoH, index, style);
      }
    } else {
      drawSamplePhoto(ctx, margin, y, photoW, photoH, index, style);
    }

    if (style.decoration === "film") {
      ctx.fillStyle = "#252525";
      ctx.fillRect(margin, y + photoH - 28, 100, 28);

      ctx.fillStyle = "#fff7e9";
      ctx.font = "bold 15px 'DM Sans', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`FRAME 0${index + 1}`, margin + 8, y + photoH - 9);
    }

    if (style.decoration === "doodle") {
      drawDoodle(ctx, 34, y + 65, "sparkle", style.accent);
      drawDoodle(ctx, w - 34, y + photoH - 65, "heart", style.accent);
    }

    y += photoH + gap;
  }

  if (renderId !== previewRenderId) return;

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = style.ink;

  ctx.font = `italic 25px '${style.heading}', serif`;
  ctx.fillText("A memory to keep forever", w / 2, 1495);

  ctx.font = "600 14px 'DM Sans', sans-serif";
  ctx.fillText("THANK YOU FOR CELEBRATING WITH US", w / 2, 1535);

  ctx.font = "16px 'DM Sans', sans-serif";
  ctx.fillText(WEDDING_DATE, w / 2, 1575);

  if (
    style.decoration === "sakura" ||
    style.decoration === "floral"
  ) {
    drawFlower(ctx, 78, 1665, 20, style.accent);
    drawFlower(ctx, w - 78, 1665, 20, style.accent);
  } else if (style.decoration === "doodle") {
    drawDoodle(ctx, 90, 1665, "heart", style.accent);
    drawDoodle(ctx, w - 90, 1665, "heart", style.accent);
  } else if (style.decoration === "aesthetic") {
    drawSparkle(ctx, 95, 1665, 12, style.accent);
    drawSparkle(ctx, w - 95, 1665, 12, style.accent);
  } else {
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 1665);
    ctx.lineTo(w - 100, 1665);
    ctx.stroke();
  }

  updatePreviewText();
}

function drawSamplePhoto(ctx, x, y, w, h, index, style) {
  const palettes = {
    classic: ["#eee0d5", "#d9c5b5"],
    minimalist: ["#eeeeee", "#d9d9d9"],
    aesthetic: ["#d9c9b8", "#b7b39e"],
    doodle: ["#f5e8cb", "#f0c9c9"],
    floral: ["#f2dfe0", "#d9cbb9"],
    film: ["#cfc4b2", "#aaa08f"],
    retro: ["#e8b88d", "#d47d60"],
    sakura: ["#f3d4df", "#dfafc1"]
  };

  const colors = palettes[selectedTemplate] || palettes.classic;
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);

  gradient.addColorStop(0, colors[index % colors.length]);
  gradient.addColorStop(1, colors[(index + 1) % colors.length]);

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  // Simple illustrated placeholder.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = style.ink;

  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.35, 48, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(
    x + w / 2,
    y + h * 0.83,
    95,
    100,
    0,
    Math.PI,
    Math.PI * 2
  );
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = style.ink;
  ctx.textAlign = "center";
  ctx.font = "600 16px 'DM Sans', sans-serif";
  ctx.fillText(`YOUR PHOTO ${index + 1}`, x + w / 2, y + h - 18);
}

$$(".template-option").forEach(button => {
  button.addEventListener("click", () => {
    if (busy) return;

    const template = button.dataset.template;

    if (!STRIP_TEMPLATES[template]) {
      console.warn("Unknown photo strip template:", template);
      return;
    }

    selectedTemplate = template;
    latestStripData = "";

    updateTemplateSelection();
    refreshTemplatePreview();
  });
});

// ==========================================
// 11. CANVAS DRAWING HELPERS
// ==========================================

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error("Could not load one of the captured photos.")
    );

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

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawFlower(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;

  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);

    ctx.beginPath();
    ctx.ellipse(
      0, -radius * 0.65,
      radius * 0.42, radius * 0.7,
      0, 0, Math.PI * 2
    );
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = "#f9e9bd";
  ctx.fill();

  ctx.restore();
}

function drawHeart(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 30, size / 30);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-24, -5, -15, -18, 0, -7);
  ctx.bezierCurveTo(15, -18, 24, -5, 0, 10);
  ctx.fill();

  ctx.restore();
}

function drawStar(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();

  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.4;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSparkle(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
}

function drawDoodle(ctx, x, y, type, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (type === "heart") {
    ctx.beginPath();
    ctx.moveTo(x, y + 9);
    ctx.bezierCurveTo(x - 26, y - 8, x - 12, y - 22, x, y - 8);
    ctx.bezierCurveTo(x + 12, y - 22, x + 26, y - 8, x, y + 9);
    ctx.stroke();
  } else if (type === "flower") {
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5;

      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(a) * 10,
        y + Math.sin(a) * 10,
        7, 11, a, 0, Math.PI * 2
      );
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "sparkle") {
    ctx.beginPath();
    ctx.moveTo(x, y - 14);
    ctx.quadraticCurveTo(x + 2, y - 2, x + 14, y);
    ctx.quadraticCurveTo(x + 2, y + 2, x, y + 14);
    ctx.quadraticCurveTo(x - 2, y + 2, x - 14, y);
    ctx.quadraticCurveTo(x - 2, y - 2, x, y - 14);
    ctx.stroke();
  }

  ctx.restore();
}

// ==========================================
// 12. TEMPLATE DECORATIONS
// ==========================================

function drawTemplateDecorations(ctx, w, h, style) {
  const { bg, ink, accent, border, decoration } = style;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (decoration === "classic") {
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    drawFlower(ctx, 62, 75, 15, accent);
    drawFlower(ctx, w - 62, 75, 15, accent);
    drawFlower(ctx, 62, h - 80, 15, accent);
    drawFlower(ctx, w - 62, h - 80, 15, accent);

  } else if (decoration === "minimalist") {
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, w - 52, h - 52);

    ctx.beginPath();
    ctx.moveTo(185, 185);
    ctx.lineTo(w - 185, 185);
    ctx.stroke();

  } else if (decoration === "aesthetic") {
    ctx.fillStyle = "#e2d5c6";
    ctx.fillRect(0, 0, 22, h);

    ctx.fillStyle = "#d6c2ad";
    ctx.fillRect(w - 22, 0, 22, h);

    drawStar(ctx, 64, 92, 13, accent);
    drawStar(ctx, w - 64, 92, 13, accent);
    drawSparkle(ctx, 75, h - 100, 10, accent);
    drawSparkle(ctx, w - 75, h - 100, 10, accent);

  } else if (decoration === "doodle") {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    drawDoodle(ctx, 64, 72, "heart", accent);
    drawDoodle(ctx, w - 64, 72, "sparkle", ink);
    drawDoodle(ctx, 64, h - 70, "flower", accent);
    drawDoodle(ctx, w - 64, h - 70, "heart", accent);

  } else if (decoration === "floral") {
    drawFlower(ctx, 60, 72, 19, accent);
    drawFlower(ctx, w - 60, 72, 19, accent);
    drawFlower(ctx, 60, h - 70, 19, accent);
    drawFlower(ctx, w - 60, h - 70, 19, accent);

    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.strokeRect(25, 25, w - 50, h - 50);

  } else if (decoration === "film") {
    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, 42, h);
    ctx.fillRect(w - 42, 0, 42, h);

    for (let y = 24; y < h - 20; y += 42) {
      ctx.fillStyle = "#fff7e9";
      ctx.fillRect(10, y, 22, 26);
      ctx.fillRect(w - 32, y, 22, 26);
    }

    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 22, w - 96, h - 44);

  } else if (decoration === "retro") {
    ctx.fillStyle = "#d16d50";
    ctx.fillRect(0, 0, w, 24);
    ctx.fillRect(0, h - 24, w, 24);

    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.strokeRect(26, 28, w - 52, h - 56);

    for (let i = 0; i < 7; i++) {
      drawStar(ctx, 90 + i * 70, 195, 5, accent);
    }

  } else if (decoration === "sakura") {
    for (let i = 0; i < 28; i++) {
      drawFlower(
        ctx,
        (i * 83 + 24) % w,
        (i * 127 + 35) % h,
        7 + (i % 3) * 2,
        accent
      );
    }

    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, w - 48, h - 48);
  }
}

// ==========================================
// 13. RENDER FINAL PHOTO STRIP
// ==========================================

async function renderStrip() {
  if (capturedPhotos.length !== AUTO_CAPTURE_COUNT) {
    throw new Error("Please capture all three photos first.");
  }

  const canvas = $("#stripCanvas");
  if (!canvas) throw new Error("The photo strip canvas is missing.");

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the photo strip.");

  const w = canvas.width;
  const h = canvas.height;
  const style = STRIP_TEMPLATES[selectedTemplate] || STRIP_TEMPLATES.classic;

  drawTemplateDecorations(ctx, w, h, style);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = style.ink;

  ctx.font = "600 19px 'DM Sans', sans-serif";
  ctx.fillText("OUR WEDDING DAY", w / 2, 78);

  let fontSize = 39;
  ctx.font = `600 ${fontSize}px '${style.heading}', serif`;

  while (
    fontSize > 23 &&
    ctx.measureText(COUPLE_NAMES).width > w - 100
  ) {
    fontSize -= 2;
    ctx.font = `600 ${fontSize}px '${style.heading}', serif`;
  }

  ctx.fillText(COUPLE_NAMES, w / 2, 135);

  ctx.font = "17px 'DM Sans', sans-serif";
  ctx.fillText(WEDDING_DATE, w / 2, 171);

  if (style.decoration === "doodle") {
    drawDoodle(ctx, 95, 142, "sparkle", style.accent);
    drawDoodle(ctx, w - 95, 142, "heart", style.accent);
  } else if (
    style.decoration === "sakura" ||
    style.decoration === "floral"
  ) {
    drawFlower(ctx, 78, 143, 12, style.accent);
    drawFlower(ctx, w - 78, 143, 12, style.accent);
  } else if (style.decoration === "aesthetic") {
    drawSparkle(ctx, 80, 140, 8, style.accent);
    drawSparkle(ctx, w - 80, 140, 8, style.accent);
  }

  const margin = style.decoration === "film" ? 66 : 65;
  const photoW = w - margin * 2;
  const photoH = 370;
  const gap = 24;
  let y = 215;

  for (let index = 0; index < capturedPhotos.length; index++) {
    const img = await loadImage(capturedPhotos[index]);

    ctx.fillStyle = style.photoFrame;
    ctx.fillRect(margin - 8, y - 8, photoW + 16, photoH + 16);

    ctx.strokeStyle = style.border;
    ctx.lineWidth = style.decoration === "doodle" ? 3 : 2;
    ctx.strokeRect(margin - 8, y - 8, photoW + 16, photoH + 16);

    drawCrop(ctx, img, margin, y, photoW, photoH);

    if (style.decoration === "film") {
      ctx.fillStyle = "#252525";
      ctx.font = "bold 15px 'DM Sans', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`FRAME 0${index + 1}`, margin, y + photoH + 19);
    }

    if (style.decoration === "doodle") {
      drawDoodle(ctx, 34, y + 65, "sparkle", style.accent);
      drawDoodle(ctx, w - 34, y + photoH - 65, "heart", style.accent);
    }

    y += photoH + gap;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = style.ink;

  ctx.font = `italic 25px '${style.heading}', serif`;
  ctx.fillText("A memory to keep forever", w / 2, 1495);

  ctx.font = "600 14px 'DM Sans', sans-serif";
  ctx.fillText("THANK YOU FOR CELEBRATING WITH US", w / 2, 1535);

  ctx.font = "16px 'DM Sans', sans-serif";
  ctx.fillText(WEDDING_DATE, w / 2, 1575);

  if (
    style.decoration === "sakura" ||
    style.decoration === "floral"
  ) {
    drawFlower(ctx, 78, 1665, 20, style.accent);
    drawFlower(ctx, w - 78, 1665, 20, style.accent);
  } else if (style.decoration === "doodle") {
    drawDoodle(ctx, 90, 1665, "heart", style.accent);
    drawDoodle(ctx, w - 90, 1665, "heart", style.accent);
  } else if (style.decoration === "aesthetic") {
    drawSparkle(ctx, 95, 1665, 12, style.accent);
    drawSparkle(ctx, w - 95, 1665, 12, style.accent);
  } else {
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 1665);
    ctx.lineTo(w - 100, 1665);
    ctx.stroke();
  }

  latestStripData = canvas.toDataURL("image/png");
  return latestStripData;
}

// ==========================================
// 14. MAKE PHOTO STRIP
// ==========================================

const finishButton = $("#finishButton");

if (finishButton) {
  finishButton.addEventListener("click", async () => {
    if (busy || capturedPhotos.length !== AUTO_CAPTURE_COUNT) return;

    busy = true;
    finishButton.disabled = true;
    finishButton.textContent = "Creating strip...";

    try {
      await renderStrip();
      showView("result");
    } catch (error) {
      console.error("Strip rendering error:", error);
      alert(error.message || "Could not create your photo strip.");
    } finally {
      busy = false;
      finishButton.textContent = "Make my photo strip →";
      renderSlots();
    }
  });
}

// ==========================================
// 15. IMAGE CONVERSION
// ==========================================

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(",");
  const match = parts[0].match(/:(.*?);/);

  if (!match || !parts[1]) {
    throw new Error("Invalid image data.");
  }

  const mime = match[1];
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

// ==========================================
// 16. DOWNLOAD PHOTO STRIP
// ==========================================

async function downloadPhotoStrip() {
  const button = $("#downloadButton");
  const message = $("#resultMessage");

  if (button) {
    button.disabled = true;
    button.textContent = "Preparing download...";
  }

  try {
    if (!latestStripData) {
      if (capturedPhotos.length !== AUTO_CAPTURE_COUNT) {
        throw new Error(
          "Please capture all three photos and create your strip first."
        );
      }

      await renderStrip();
    }

    if (!latestStripData.startsWith("data:image/png")) {
      throw new Error("Photo strip unavailable. Please recreate it.");
    }

    const blob = dataURLToBlob(latestStripData);

    if (!blob.size) throw new Error("The generated photo strip is empty.");

    const objectURL = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectURL;
    link.download = `wedding-photo-strip-${selectedTemplate}.png`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(objectURL), 10000);

    if (message) {
      message.textContent =
        "Your photo strip is ready! Check your Downloads folder.";
    }
  } catch (error) {
    console.error("Photo strip download failed:", error);

    if (message) {
      message.replaceChildren();
      message.appendChild(
        document.createTextNode(
          `Download failed: ${error.message || "Please try again."} `
        )
      );

      if (latestStripData) {
        const fallbackLink = document.createElement("a");
        fallbackLink.href = latestStripData;
        fallbackLink.target = "_blank";
        fallbackLink.rel = "noopener";
        fallbackLink.textContent = "Open photo strip to save manually";
        message.appendChild(fallbackLink);
      }
    }
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "↓ Download photo strip";
    }
  }
}

const downloadButton = $("#downloadButton");

if (downloadButton) {
  downloadButton.addEventListener("click", downloadPhotoStrip);
}

// ==========================================
// 17. UPLOAD PHOTO STRIP TO SUPABASE
// ==========================================

function safeFileName() {
  const uuid =
    window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${Date.now()}-${uuid}.png`;
}

async function uploadPhotoStrip() {
  if (!latestStripData || busy) return;

  const button = $("#uploadButton");
  const resultMessage = $("#resultMessage");

  if (!supabaseClient) {
    if (resultMessage) {
      resultMessage.textContent =
        "Gallery service unavailable. Refresh the page and try again.";
    }
    return;
  }

  busy = true;

  if (button) {
    button.disabled = true;
    button.textContent = "Uploading...";
  }

  if (resultMessage) resultMessage.textContent = "Uploading your photo strip...";

  const path = `photostrips/${safeFileName()}`;
  const guestName = $("#guestName");
  const name = guestName
    ? guestName.value.trim().slice(0, 60) || "A wedding guest"
    : "A wedding guest";

  try {
    const blob = dataURLToBlob(latestStripData);

    const { error: uploadError } = await supabaseClient.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: insertError } = await supabaseClient
      .from(PHOTO_TABLE)
      .insert({ name, image_path: path });

    if (insertError) {
      const { error: cleanupError } = await supabaseClient.storage
        .from(BUCKET)
        .remove([path]);

      if (cleanupError) {
        console.warn("Could not remove orphaned upload:", cleanupError);
      }

      throw insertError;
    }

    if (resultMessage) {
      resultMessage.textContent =
        "Your photo strip is uploaded! It is now in the shared gallery.";
    }

    if (button) button.textContent = "✓ Uploaded successfully";

    await loadGallery();
  } catch (error) {
    console.error("Photo upload error:", error);

    if (resultMessage) {
      resultMessage.textContent =
        `Upload failed: ${error.message || "Unknown error"}. Check your Supabase bucket, table, and access policies.`;
    }

    if (button) button.textContent = "☁ Try uploading again";
  } finally {
    busy = false;
    if (button) button.disabled = false;
  }
}

const uploadButton = $("#uploadButton");

if (uploadButton) {
  uploadButton.addEventListener("click", uploadPhotoStrip);
}

// ==========================================
// 18. LOAD SHARED GALLERY
// ==========================================

async function loadGallery() {
  const grid = $("#photoGrid");
  const photoCount = $("#photoCount");
  const requestId = ++galleryRequest;

  if (!grid) return;

  if (!supabaseClient) {
    if (photoCount) photoCount.textContent = "Unavailable";
    grid.textContent = "Gallery service is unavailable. Check Supabase configuration.";
    return;
  }

  grid.textContent = "Loading wedding photos...";

  try {
    const { data, error } = await supabaseClient
      .from(PHOTO_TABLE)
      .select("id, name, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (requestId !== galleryRequest) return;

    if (photoCount) {
      photoCount.textContent =
        `${data.length} ${data.length === 1 ? "photo" : "photos"}`;
    }

    grid.replaceChildren();

    if (!data.length) {
      grid.textContent = "No photos yet. Be the first to share a memory!";
      return;
    }

    for (const photo of data) {
      const { data: urlData } = supabaseClient.storage
        .from(BUCKET)
        .getPublicUrl(photo.image_path);

      const card = document.createElement("article");
      card.className = "photo-card uploaded-card";

      const img = document.createElement("img");
      img.src = urlData.publicUrl;
      img.alt = `Wedding photo shared by ${photo.name || "a guest"}`;
      img.loading = "lazy";
      img.style.cssText =
        "width:100%;height:245px;object-fit:contain;background:#efe6e0;padding:10px;display:block";

      img.addEventListener("error", () => {
        img.alt = "Photo could not be loaded";
        img.classList.add("image-error");
      }, { once: true });

      const caption = document.createElement("p");
      caption.textContent = `Shared by ${photo.name || "A wedding guest"}`;

      card.append(img, caption);
      grid.appendChild(card);
    }
  } catch (error) {
    if (requestId !== galleryRequest) return;

    console.error("Gallery error:", error);

    if (photoCount) photoCount.textContent = "Unavailable";

    grid.textContent =
      "Could not load gallery. Check the Supabase URL, table, bucket, and access policies.";
  }
}

// ==========================================
// 19. GUESTBOOK
// ==========================================

async function loadGuestbook() {
  const list = $("#wishesList");
  const requestId = ++guestbookRequest;

  if (!list) return;

  if (!supabaseClient) {
    list.textContent =
      "Guestbook service is unavailable. Check Supabase configuration.";
    return;
  }

  list.textContent = "Loading wishes...";

  try {
    const { data, error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (requestId !== guestbookRequest) return;

    list.replaceChildren();

    if (!data.length) {
      list.textContent = "No wishes yet. Leave the first message!";
      return;
    }

    data.forEach(wish => {
      const card = document.createElement("article");
      card.className = "wish-card";

      const heart = document.createElement("span");
      heart.className = "wish-heart";
      heart.textContent = "♡";
      heart.setAttribute("aria-hidden", "true");

      const heading = document.createElement("h3");
      heading.textContent = wish.name || "A wedding guest";

      const message = document.createElement("p");
      message.textContent = wish.message || "";

      card.append(heart, heading, message);
      list.appendChild(card);
    });
  } catch (error) {
    if (requestId !== guestbookRequest) return;

    console.error("Guestbook error:", error);

    list.textContent =
      "Could not load messages. Check your Supabase table and access policies.";
  }
}

const guestbookForm = $("#guestbookForm");

if (guestbookForm) {
  guestbookForm.addEventListener("submit", async event => {
    event.preventDefault();

    const nameInput = $("#messageName");
    const messageInput = $("#messageText");
    const button = $("#sendWishButton");
    const status = $("#guestbookStatus");

    const name = nameInput ? nameInput.value.trim() : "";
    const message = messageInput ? messageInput.value.trim() : "";

    if (!name || !message) {
      if (status) status.textContent = "Please enter your name and wishes.";
      return;
    }

    if (name.length > 50 || message.length > 400) {
      if (status) status.textContent = "Please shorten your name or message.";
      return;
    }

    if (!supabaseClient) {
      if (status) {
        status.textContent =
          "Guestbook service unavailable. Refresh and try again.";
      }
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    if (status) status.textContent = "";

    try {
      const { error } = await supabaseClient
        .from(GUESTBOOK_TABLE)
        .insert({ name, message });

      if (error) throw error;

      guestbookForm.reset();

      if (status) {
        status.textContent = "Your wishes have been shared. Thank you!";
      }

      await loadGuestbook();
    } catch (error) {
      console.error("Guestbook submission error:", error);

      if (status) {
        status.textContent =
          `Could not send message: ${error.message || "Unknown error"}. Check your Supabase insert policy.`;
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Send your wishes ♡";
      }
    }
  });
}

// ==========================================
// 20. TAKE ANOTHER SET
// ==========================================

const againButton = $("#againButton");

if (againButton) {
  againButton.addEventListener("click", async () => {
    if (busy) return;

    capturedPhotos = [];
    latestStripData = "";

    if (uploadButton) {
      uploadButton.disabled = false;
      uploadButton.textContent = "☁ Upload to wedding gallery";
    }

    if (downloadButton) {
      downloadButton.disabled = false;
      downloadButton.textContent = "↓ Download photo strip";
    }

    const resultMessage = $("#resultMessage");
    if (resultMessage) resultMessage.textContent = "";

    renderSlots();
    refreshTemplatePreview();

    showView("photobooth");
    await startCamera();
  });
}

// ==========================================
// 21. INITIALISE APP
// ==========================================

function initialiseApp() {
  const ready = initialiseSupabase();

  updateTemplateSelection();
  renderSlots();

  // Draw the default Classic preview immediately.
  refreshTemplatePreview();

  if (ready) {
    loadGallery();
    loadGuestbook();
  }

  console.log("Wedding photobooth initialized.");
}

initialiseApp();
