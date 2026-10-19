/* =========================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Gallery + Camera + Six Photostrip Styles + Guestbook
========================================================= */

// =========================================================
// 1. SUPABASE CONFIGURATION
// =========================================================

const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

const COUPLE_NAMES = "SYAHLEN & ATIQAH";
const WEDDING_DATE = "08 NOVEMBER 2026";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let supabaseClient = null;
let cameraStream = null;
let facingMode = "user";
let capturedPhotos = [];
let selectedTemplate = "film";
let latestStripData = "";
let busy = false;
let cameraStarting = false;
let previewRenderId = 0;
let galleryRequestId = 0;
let guestbookRequestId = 0;
let countdownActive = false;
let stripAlreadyUploaded = false;


// =========================================================
// 2. PAGE ELEMENTS
// =========================================================

const views = {
  photos: $("#photosView"),
  photobooth: $("#photoboothView"),
  result: $("#resultView"),
  guestbook: $("#guestbookView")
};


// =========================================================
// 3. SIX PHOTO STRIP STYLES
// =========================================================

const TEMPLATES = {
  film: {
    name: "Film Frame",
    background: "#201817",
    ink: "#fff7ed",
    border: "#d8bd9b",
    photoBackground: "#f5e9d9",
    decoration: "film"
  },

  minimalist: {
    name: "Minimalist White",
    background: "#fffdfb",
    ink: "#392b2b",
    border: "#e5d6ce",
    photoBackground: "#f0e5df",
    decoration: "minimalist"
  },

  doodle: {
    name: "Doodle Style",
    background: "#fff7e9",
    ink: "#372824",
    border: "#5a4038",
    photoBackground: "#f0dfd1",
    decoration: "doodle"
  },

  blackwhite: {
    name: "Black & White",
    background: "#fffefa",
    ink: "#191919",
    border: "#262626",
    photoBackground: "#dedede",
    decoration: "blackwhite"
  },

  elegant: {
    name: "Elegant Serif",
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


// =========================================================
// 4. GENERAL HELPERS
// =========================================================

function setMessage(selector, message) {
  const element = $(selector);
  if (element) element.textContent = message;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeText(message, className = "muted") {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = message;
  return element;
}

function setButtonText(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text;
}

function safeFileName() {
  const id = window.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  radius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
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

  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;

    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
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

  for (let i = 0; i < 5; i++) {
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

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load a captured photo."));
    image.src = source;
  });
}


// =========================================================
// 5. SUPABASE INITIALIZATION
// =========================================================

function initializeSupabase() {
  if (!window.supabase?.createClient) {
    console.error("Supabase SDK is not available.");

    setMessage("#photoCount", "Gallery unavailable");

    $("#photoGrid")?.replaceChildren(
      makeText("The gallery service is unavailable. Please refresh the page.")
    );

    $("#wishesList")?.replaceChildren(
      makeText("The guestbook service is unavailable. Please refresh the page.")
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
    console.error("Supabase initialization failed:", error);

    setMessage("#photoCount", "Gallery unavailable");

    $("#photoGrid")?.replaceChildren(
      makeText("Could not initialize the wedding gallery.")
    );

    $("#wishesList")?.replaceChildren(
      makeText("Could not initialize the guestbook.")
    );

    return false;
  }
}


// =========================================================
// 6. NAVIGATION
// =========================================================

function showView(name) {
  const target = views[name];
  if (!target) return;

  Object.values(views).forEach(view => {
    view?.classList.remove("active");
  });

  target.classList.add("active");

  $$(".nav-tab").forEach(button => {
    const active = button.dataset.page === name;

    button.classList.toggle("active", active);

    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  $("#navTabs")?.classList.remove("open");
  $("#menuButton")?.setAttribute("aria-expanded", "false");

  if (name !== "photobooth") {
    stopCamera();
  }

  if (name === "photos") loadGallery();
  if (name === "guestbook") loadGuestbook();

  if (name === "photobooth") {
    updatePhotostripPreview();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button) return;

  event.preventDefault();
  showView(button.dataset.page);
});

$("#menuButton")?.addEventListener("click", () => {
  const nav = $("#navTabs");
  if (!nav) return;

  const isOpen = nav.classList.toggle("open");
  $("#menuButton").setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;

  $("#navTabs")?.classList.remove("open");
  $("#menuButton")?.setAttribute("aria-expanded", "false");
});


// =========================================================
// 7. CAMERA CONTROLS
// =========================================================

function updateCameraSwitchButton() {
  const button = $("#switchCamera");
  if (!button) return;

  button.disabled = !cameraStream || busy || cameraStarting;
}

function applyCameraMirroring() {
  const video = $("#cameraVideo");
  if (!video) return;

  // Mirror the front camera only.
  video.style.transform = facingMode === "user" ? "scaleX(-1)" : "none";
}

async function startCamera() {
  const video = $("#cameraVideo");
  const startButton = $("#startCamera");

  if (!video || cameraStarting) return;

  if (cameraStream) {
    try {
      await video.play();
    } catch (error) {
      console.warn("Camera playback:", error);
    }

    updateCaptureControls();
    updateCameraSwitchButton();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage("#cameraStatus", "Camera unavailable");
    setMessage(
      "#cameraHelp",
      "Camera access requires HTTPS or localhost."
    );
    return;
  }

  cameraStarting = true;

  if (startButton) startButton.disabled = true;

  setMessage("#cameraStatus", "Opening camera...");
  setMessage("#cameraHelp", "Please allow camera access in your browser.");

  let stream = null;

  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });
    } catch (firstError) {
      console.warn("Retrying camera with basic constraints:", firstError);

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });
    }

    cameraStream = stream;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await new Promise((resolve, reject) => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve();
        return;
      }

      const onLoaded = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error("The camera video could not be started."));
      };

      const cleanup = () => {
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("error", onError);
      };

      video.addEventListener("loadeddata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });

    await video.play();

    applyCameraMirroring();
    video.classList.add("ready");

    const placeholder = $("#cameraPlaceholder");
    if (placeholder) placeholder.style.display = "none";

    setMessage("#cameraStatus", "Camera is ready");
    setMessage(
      "#cameraHelp",
      "Press the shutter to capture each of your three photos."
    );

    updateCaptureControls();
    updateCameraSwitchButton();
  } catch (error) {
    console.error("Camera error:", error);

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    cameraStream = null;

    if (video) {
      video.srcObject = null;
      video.classList.remove("ready");
      video.style.transform = "";
    }

    const placeholder = $("#cameraPlaceholder");
    if (placeholder) placeholder.style.display = "flex";

    setMessage("#cameraStatus", "Camera unavailable");

    const messages = {
      NotAllowedError:
        "Camera permission was denied. Allow camera access in your browser settings.",
      NotFoundError:
        "No camera was found on this device.",
      NotReadableError:
        "The camera may be in use by another application.",
      OverconstrainedError:
        "This camera does not support the requested settings.",
      SecurityError:
        "Camera access requires a secure connection. Use HTTPS or localhost."
    };

    setMessage(
      "#cameraHelp",
      messages[error.name] ||
      "Could not open the camera. Check permissions and use HTTPS."
    );
  } finally {
    cameraStarting = false;

    if (startButton) startButton.disabled = false;

    updateCaptureControls();
    updateCameraSwitchButton();
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  const video = $("#cameraVideo");

  if (video) {
    video.srcObject = null;
    video.classList.remove("ready");
    video.style.transform = "";
  }

  const placeholder = $("#cameraPlaceholder");
  if (placeholder) placeholder.style.display = "flex";

  const startButton = $("#startCamera");
  if (startButton) startButton.disabled = false;

  setMessage("#cameraStatus", "Camera not started");

  updateCaptureControls();
  updateCameraSwitchButton();
}

$("#startCamera")?.addEventListener("click", startCamera);

$("#switchCamera")?.addEventListener("click", async () => {
  if (cameraStarting || busy) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage("#cameraHelp", "Camera switching is not supported here.");
    return;
  }

  const oldFacingMode = facingMode;
  const nextFacingMode = facingMode === "user" ? "environment" : "user";
  const oldStream = cameraStream;
  const video = $("#cameraVideo");

  cameraStarting = true;
  updateCaptureControls();

  setMessage(
    "#cameraHelp",
    nextFacingMode === "user"
      ? "Switching to the front camera..."
      : "Switching to the rear camera..."
  );

  let nextStream = null;

  try {
    try {
      nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: nextFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });
    } catch (error) {
      console.warn("Preferred camera unavailable:", error);

      nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacingMode },
        audio: false
      });
    }

    facingMode = nextFacingMode;
    cameraStream = nextStream;

    if (video) {
      video.srcObject = nextStream;
      video.muted = true;
      video.playsInline = true;

      await new Promise((resolve, reject) => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          resolve();
          return;
        }

        const onLoaded = () => {
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error("The selected camera could not start."));
        };

        const cleanup = () => {
          video.removeEventListener("loadeddata", onLoaded);
          video.removeEventListener("error", onError);
        };

        video.addEventListener("loadeddata", onLoaded, { once: true });
        video.addEventListener("error", onError, { once: true });
      });

      await video.play();

      applyCameraMirroring();
      video.classList.add("ready");

      const placeholder = $("#cameraPlaceholder");
      if (placeholder) placeholder.style.display = "none";
    }

    if (oldStream) {
      oldStream.getTracks().forEach(track => track.stop());
    }

    setMessage(
      "#cameraStatus",
      facingMode === "user" ? "Front camera" : "Rear camera"
    );

    setMessage(
      "#cameraHelp",
      "Camera switched. Press the shutter when you're ready."
    );
  } catch (error) {
    console.error("Camera switch failed:", error);

    if (nextStream) {
      nextStream.getTracks().forEach(track => track.stop());
    }

    facingMode = oldFacingMode;
    cameraStream = oldStream;

    if (video && oldStream) {
      video.srcObject = oldStream;

      try {
        await video.play();
        applyCameraMirroring();
      } catch (playError) {
        console.warn("Could not restore previous camera playback:", playError);
      }
    }

    setMessage(
      "#cameraHelp",
      "Could not switch cameras. Your current camera may be the only available camera."
    );
  } finally {
    cameraStarting = false;
    updateCaptureControls();
    updateCameraSwitchButton();
  }
});

window.addEventListener("beforeunload", () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
});


// =========================================================
// 8. CAPTURE THREE PHOTOS
// =========================================================

async function countdown(seconds = 3) {
  const element = $("#countdown");

  if (!element) {
    await wait(seconds * 1000);
    return;
  }

  countdownActive = true;
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
    countdownActive = false;
  }
}

async function takeSnapshot() {
  const video = $("#cameraVideo");
  const canvas = $("#captureCanvas");

  if (!cameraStream || !video?.videoWidth || !video.videoHeight) {
    throw new Error("The camera is not ready.");
  }

  if (!canvas) {
    throw new Error("The capture canvas is missing.");
  }

  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not prepare the photo.");
  }

  ctx.save();

  if (facingMode === "user") {
    ctx.translate(sourceWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.94);
}

function renderSlots() {
  const slots = $$("#snapSlots .snap-slot");

  slots.forEach((slot, index) => {
    slot.replaceChildren();

    if (capturedPhotos[index]) {
      const image = document.createElement("img");
      image.src = capturedPhotos[index];
      image.alt = `Captured photo ${index + 1}`;

      slot.appendChild(image);
      slot.classList.add("captured");
    } else {
      const number = document.createElement("span");
      number.className = "snap-slot-number";
      number.textContent = String(index + 1);

      slot.appendChild(number);
      slot.classList.remove("captured");
    }
  });

  setMessage("#snapCounter", `${capturedPhotos.length} / 3 captured`);

  updateCaptureControls();
  updatePhotostripPreview();
}

function updateCaptureControls() {
  const captureButton = $("#captureButton");
  const finishButton = $("#finishButton");
  const retakeButton = $("#retakeButton");

  if (captureButton) {
    captureButton.disabled =
      !cameraStream ||
      capturedPhotos.length >= 3 ||
      busy ||
      cameraStarting ||
      countdownActive;
  }

  if (finishButton) {
    finishButton.disabled =
      capturedPhotos.length !== 3 ||
      busy ||
      cameraStarting;
  }

  if (retakeButton) {
    retakeButton.disabled =
      capturedPhotos.length === 0 ||
      busy ||
      cameraStarting;
  }

  updateCameraSwitchButton();
}

$("#captureButton")?.addEventListener("click", async () => {
  if (
    busy ||
    cameraStarting ||
    countdownActive ||
    !cameraStream ||
    capturedPhotos.length >= 3
  ) {
    return;
  }

  busy = true;
  updateCaptureControls();

  try {
    const number = capturedPhotos.length + 1;

    setMessage("#cameraHelp", `Get ready for photo ${number} of 3!`);

    await countdown(3);

    if (!cameraStream) {
      throw new Error("The camera was turned off.");
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
        `Photo ${capturedPhotos.length} captured! Get ready for the next one.`
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

$("#retakeButton")?.addEventListener("click", () => {
  if (busy) return;

  capturedPhotos = [];
  latestStripData = "";
  stripAlreadyUploaded = false;

  const uploadButton = $("#uploadButton");

  if (uploadButton) {
    uploadButton.disabled = false;
    uploadButton.textContent = "☁ Upload to wedding gallery";
  }

  setMessage("#cameraHelp", "Your photos have been reset. Start again!");

  renderSlots();
});


// =========================================================
// 9. PHOTO CROPPING AND FACE FRAMING
// =========================================================

function drawCrop(ctx, image, x, y, width, height, monochrome = false) {
  const sourceWidth = image.width;
  const sourceHeight = image.height;

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    // Source image is wider than the photo frame.
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    // Source image is taller than the photo frame.
    sh = sourceWidth / targetRatio;

    /*
      Keep the crop closer to the top of the image.

      A smaller multiplier preserves more of the upper part
      of the original camera image. This helps prevent faces
      from appearing too low in the final photostrip.
    */
    const cropAmount = sourceHeight - sh;
    sy = Math.max(0, cropAmount * 0.08);
  }

  ctx.save();

  if (monochrome) {
    ctx.filter = "grayscale(100%)";
  }

  ctx.drawImage(
    image,
    sx, sy, sw, sh,
    x, y, width, height
  );

  ctx.restore();
}


// =========================================================
// 10. PHOTO STRIP DECORATIONS
// =========================================================

function drawFilmDecoration(ctx, width, height) {
  for (let y = 35; y < height - 30; y += 28) {
    roundedRect(ctx, 22, y, 13, 16, 2, "#e5cfad");
    roundedRect(ctx, width - 35, y, 13, 16, 2, "#e5cfad");
  }
}

function drawDoodleDecoration(ctx, width, height, color) {
  const symbols = ["♡", "✧", "☆", "✿", "♡", "✦"];
  const ys = [250, 460, 670, 880, 1090, 1300];

  ctx.save();
  ctx.font = "24px Georgia, serif";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ys.forEach((y, index) => {
    ctx.fillText(symbols[index % symbols.length], 31, y);
    ctx.fillText(symbols[(index + 2) % symbols.length], width - 31, y + 35);
  });

  ctx.restore();
}

function drawBlackWhiteDecoration(ctx, width) {
  ctx.save();
  ctx.strokeStyle = "#282828";
  ctx.lineWidth = 1.5;

  [245, 625, 1005, 1380].forEach((y, index) => {
    const side = index % 2 === 0 ? 1 : -1;

    ctx.beginPath();
    ctx.moveTo(26, y);
    ctx.lineTo(41, y - 7 * side);
    ctx.lineTo(35, y + 7 * side);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width - 26, y);
    ctx.lineTo(width - 41, y - 7 * side);
    ctx.lineTo(width - 35, y + 7 * side);
    ctx.stroke();
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
  ctx.strokeRect(48, 42, width - 96, height - 84);
  ctx.setLineDash([]);

  ctx.font = "italic 23px 'Caveat', cursive";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("made with love", width / 2, height - 117);

  ctx.restore();

  drawDoodleDecoration(ctx, width, height, color);
}

function drawTemplateDecoration(ctx, width, height, theme) {
  switch (theme.decoration) {
    case "film":
      drawFilmDecoration(ctx, width, height);
      break;

    case "doodle":
      drawDoodleDecoration(ctx, width, height, theme.ink);
      break;

    case "blackwhite":
      drawBlackWhiteDecoration(ctx, width);
      break;

    case "elegant":
      drawElegantDecoration(ctx, width, height, theme.border);
      break;

    case "chalkboard":
      drawChalkDecoration(ctx, width, height, theme.ink);
      break;
  }
}


// =========================================================
// 11. DRAW THE FULL PHOTO STRIP
// =========================================================

async function drawPhotostrip(
  canvas,
  photos = [],
  options = {},
  templateKey = selectedTemplate
) {
  if (!canvas) throw new Error("Photostrip canvas is missing.");

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not access the photostrip canvas.");

  const width = canvas.width;
  const height = canvas.height;
  const theme = TEMPLATES[templateKey] || TEMPLATES.film;

  const isFilm = templateKey === "film";
  const isMinimal = templateKey === "minimalist";
  const isDoodle = templateKey === "doodle";
  const isBW = templateKey === "blackwhite";
  const isElegant = templateKey === "elegant";
  const isChalk = templateKey === "chalkboard";

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  drawTemplateDecoration(ctx, width, height, theme);

  // HEADER
  if (isFilm) {
    centeredText(ctx, COUPLE_NAMES, width / 2, 69,
      "600 20px 'DM Sans', sans-serif", theme.ink);

    centeredText(ctx, "Just Married", width / 2, 123,
      "italic 37px 'Playfair Display', Georgia, serif", theme.ink);

  } else if (isMinimal) {
    centeredText(ctx, "S Y A H L E N  &  A T I Q A H", width / 2, 78,
      "500 20px 'DM Sans', sans-serif", theme.ink);

    centeredText(ctx, WEDDING_DATE, width / 2, 121,
      "11px 'DM Sans', sans-serif", theme.ink);

  } else if (isDoodle) {
    centeredText(ctx, "Syahlen & Atiqah", width / 2, 94,
      "bold 47px 'Caveat', cursive", theme.ink);

    drawHeart(ctx, 93, 93, 24, theme.ink, true);
    drawStar(ctx, width - 92, 90, 14, theme.ink);

  } else if (isBW) {
    centeredText(ctx, "SYAHLEN", width / 2, 66,
      "500 29px 'Playfair Display', Georgia, serif", theme.ink);

    centeredText(ctx, "&", width / 2, 106,
      "italic 26px 'Playfair Display', Georgia, serif", theme.ink);

    centeredText(ctx, "ATIQAH", width / 2, 146,
      "500 29px 'Playfair Display', Georgia, serif", theme.ink);

  } else if (isElegant) {
    centeredText(ctx, "SYAHLEN", width / 2, 66,
      "500 30px 'Playfair Display', Georgia, serif", theme.ink);

    centeredText(ctx, "&", width / 2, 105,
      "italic 25px 'Playfair Display', Georgia, serif", theme.ink);

    centeredText(ctx, "ATIQAH", width / 2, 145,
      "500 30px 'Playfair Display', Georgia, serif", theme.ink);

  } else if (isChalk) {
    centeredText(ctx, "SYAHLEN", width / 2, 74,
      "bold 49px 'Caveat', cursive", theme.ink);

    centeredText(ctx, "& ATIQAH", width / 2, 124,
      "bold 43px 'Caveat', cursive", theme.ink);

    drawHeart(ctx, 94, 82, 25, theme.ink, true);
    drawStar(ctx, width - 92, 82, 14, theme.ink);
  }

  // THREE PHOTO FRAMES
  const photoX = 68;
  const photoWidth = width - photoX * 2;
  const photoHeight = 335;
  const photoGap = 22;
  const firstPhotoY = 200;

  for (let index = 0; index < 3; index++) {
    const x = photoX;
    const y = firstPhotoY + index * (photoHeight + photoGap);

    if (isFilm || isElegant) {
      ctx.fillStyle = isFilm ? "#f5e8d8" : "#fffaf4";
      ctx.fillRect(x - 6, y - 6, photoWidth + 12, photoHeight + 12);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 5, y - 5, photoWidth + 10, photoHeight + 10);
    }

    ctx.strokeStyle = theme.border;
    ctx.lineWidth = isFilm ? 3 : 1.5;
    ctx.strokeRect(x - 4, y - 4, photoWidth + 8, photoHeight + 8);

    if (photos[index]) {
      const image = await loadImage(photos[index]);

      drawCrop(
        ctx,
        image,
        x, y, photoWidth, photoHeight,
        isBW
      );
    } else {
      const gradient = ctx.createLinearGradient(
        x, y, x, y + photoHeight
      );

      gradient.addColorStop(0, theme.photoBackground);
      gradient.addColorStop(1, theme.background);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, photoWidth, photoHeight);

      centeredText(
        ctx,
        options.preview ? `PHOTO ${index + 1}` : "YOUR PHOTO",
        width / 2,
        y + photoHeight / 2 - 12,
        isDoodle || isChalk
          ? "bold 31px 'Caveat', cursive"
          : "italic 23px 'Playfair Display', Georgia, serif",
        theme.ink
      );

      centeredText(
        ctx,
        "A MEMORY TO KEEP",
        width / 2,
        y + photoHeight / 2 + 25,
        "11px 'DM Sans', sans-serif",
        theme.ink
      );
    }
  }

  // FOOTER
  const photosBottom = firstPhotoY + 3 * photoHeight + 2 * photoGap;
  const footerTop = photosBottom + 33;
  const footerBottom = height - 145;
  const footerCenter = (footerTop + footerBottom) / 2;

  ctx.save();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1.5;

  if (isFilm || isChalk) {
    ctx.setLineDash([4, 5]);
  }

  ctx.beginPath();
  ctx.moveTo(100, footerTop);
  ctx.lineTo(width / 2 - 42, footerTop);
  ctx.moveTo(width / 2 + 42, footerTop);
  ctx.lineTo(width - 100, footerTop);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();

  if (isElegant) {
    drawFlower(ctx, width / 2, footerCenter - 43, 22, theme.border);

    centeredText(ctx, "A MEMORY TO KEEP FOREVER", width / 2, footerCenter + 3,
      "11px 'DM Sans', sans-serif", theme.ink);

    centeredText(ctx, WEDDING_DATE, width / 2, footerCenter + 40,
      "italic 19px 'Playfair Display', Georgia, serif", theme.ink);

  } else if (isDoodle) {
    drawHeart(ctx, width / 2 - 22, footerCenter - 32, 28, theme.ink, true);
    drawHeart(ctx, width / 2 + 22, footerCenter - 32, 28, theme.ink, true);

    centeredText(ctx, "A MEMORY TO KEEP FOREVER", width / 2, footerCenter + 7,
      "bold 22px 'Caveat', cursive", theme.ink);

    centeredText(ctx, WEDDING_DATE, width / 2, footerCenter + 45,
      "22px 'Caveat', cursive", theme.ink);

    drawStar(ctx, 104, footerCenter + 18, 11, theme.ink);
    drawStar(ctx, width - 104, footerCenter + 18, 11, theme.ink);

  } else if (isChalk) {
    drawHeart(ctx, width / 2, footerCenter - 32, 33, theme.ink, true);

    centeredText(ctx, "A MEMORY TO KEEP FOREVER", width / 2, footerCenter + 7,
      "bold 26px 'Caveat', cursive", theme.ink);

    centeredText(ctx, WEDDING_DATE, width / 2, footerCenter + 46,
      "bold 23px 'Caveat', cursive", theme.ink);

  } else if (isBW) {
    drawHeart(ctx, width / 2, footerCenter - 30, 32, theme.ink, true);

    centeredText(ctx, "A MEMORY TO KEEP FOREVER", width / 2, footerCenter + 8,
      "11px 'DM Sans', sans-serif", theme.ink);

    centeredText(ctx, WEDDING_DATE, width / 2, footerCenter + 45,
      "italic 18px 'Playfair Display', Georgia, serif", theme.ink);

  } else if (isMinimal) {
    centeredText(ctx, "A MEMORY TO KEEP FOREVER", width / 2, footerCenter - 12,
      "11px 'DM Sans', sans-serif", theme.ink);

    centeredText(ctx, WEDDING_DATE, width / 2, footerCenter + 24,
      "15px 'DM Sans', sans-serif", theme.ink);

    drawHeart(ctx, width / 2, footerCenter + 60, 23, theme.ink);

  } else {
    drawHeart(ctx, width / 2, footerCenter - 30, 32, theme.ink, true);

    centeredText(ctx, "A MEMORY TO KEEP FOREVER", width / 2, footerCenter + 8,
      "12px 'DM Sans', sans-serif", theme.ink);

    centeredText(ctx, WEDDING_DATE, width / 2, footerCenter + 45,
      "18px 'Playfair Display', Georgia, serif", theme.ink);
  }

  // BOTTOM SIGNATURE
  ctx.save();
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(90, height - 87);
  ctx.lineTo(width / 2 - 105, height - 87);
  ctx.moveTo(width / 2 + 105, height - 87);
  ctx.lineTo(width - 90, height - 87);
  ctx.stroke();
  ctx.restore();

  centeredText(
    ctx,
    COUPLE_NAMES,
    width / 2,
    height - 61,
    isElegant || isBW
      ? "13px 'Playfair Display', Georgia, serif"
      : "12px 'DM Sans', sans-serif",
    theme.ink
  );

  centeredText(
    ctx,
    "MADE WITH LOVE",
    width / 2,
    height - 36,
    "10px 'DM Sans', sans-serif",
    theme.ink
  );

  return canvas.toDataURL("image/png");
}


// =========================================================
// 12. LIVE PREVIEW AND TEMPLATE SELECTION
// =========================================================

function getPreviewCanvas() {
  const previewContainer = $("#liveStripPreview");
  if (!previewContainer) return null;

  let canvas = $("#liveStripPreviewCanvas");

  if (!canvas) {
    previewContainer.replaceChildren();

    canvas = document.createElement("canvas");
    canvas.id = "liveStripPreviewCanvas";
    canvas.width = 600;
    canvas.height = 1800;
    canvas.setAttribute("aria-label", "Live photostrip preview");

    previewContainer.appendChild(canvas);
  }

  previewContainer.dataset.template = selectedTemplate;
  previewContainer.classList.add("live-strip");

  return canvas;
}

async function updatePhotostripPreview() {
  const previewContainer = $("#liveStripPreview");
  const visibleCanvas = getPreviewCanvas();

  if (!visibleCanvas) return;

  const renderId = ++previewRenderId;
  const templateAtStart = selectedTemplate;
  const photosAtStart = [...capturedPhotos];

  setMessage(
    "#livePreviewStatus",
    `${currentTemplate().name} · ${capturedPhotos.length} of 3 photos captured`
  );

  try {
    // Render offscreen so an older render cannot overwrite a newer one.
    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = 600;
    renderCanvas.height = 1800;

    await drawPhotostrip(
      renderCanvas,
      photosAtStart,
      { preview: true },
      templateAtStart
    );

    if (
      renderId !== previewRenderId ||
      templateAtStart !== selectedTemplate ||
      !previewContainer
    ) {
      return;
    }

    const ctx = visibleCanvas.getContext("2d");
    if (!ctx) throw new Error("Could not display the photostrip preview.");

    ctx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
    ctx.drawImage(renderCanvas, 0, 0);

    previewContainer.dataset.template = templateAtStart;
    previewContainer.className = `live-strip ${templateAtStart}`;

    setMessage(
      "#livePreviewStatus",
      `${currentTemplate().name} · ${capturedPhotos.length} of 3 photos captured`
    );
  } catch (error) {
    console.error("Preview error:", error);

    if (renderId === previewRenderId) {
      setMessage(
        "#livePreviewStatus",
        "Could not render the preview. Please try again."
      );
    }
  }
}

function selectTemplate(button) {
  if (!button) return;

  const templateName = button.dataset.template;
  if (!TEMPLATES[templateName]) return;

  selectedTemplate = templateName;

  $$(".template-option").forEach(option => {
    const active = option === button;

    option.classList.toggle("selected", active);
    option.classList.toggle("active", active);
    option.setAttribute("aria-pressed", String(active));
  });

  const preview = $("#liveStripPreview");

  if (preview) {
    preview.dataset.template = templateName;
    preview.classList.add("live-strip");
  }

  setMessage(
    "#templateStatus",
    `${currentTemplate().name} style selected.`
  );

  updatePhotostripPreview();
}

$$(".template-option").forEach(button => {
  button.addEventListener("click", () => selectTemplate(button));
});


// =========================================================
// 13. CREATE THE FINAL PHOTO STRIP
// =========================================================

$("#finishButton")?.addEventListener("click", async () => {
  if (busy || capturedPhotos.length !== 3) return;

  const canvas = $("#stripCanvas");
  if (!canvas) return;

  busy = true;
  updateCaptureControls();
  setButtonText("#finishButton", "Creating your strip...");

  try {
    latestStripData = await drawPhotostrip(
      canvas,
      [...capturedPhotos],
      { preview: false },
      selectedTemplate
    );

    stripAlreadyUploaded = false;

    const uploadButton = $("#uploadButton");

    if (uploadButton) {
      uploadButton.disabled = false;
      uploadButton.textContent = "☁ Upload to wedding gallery";
    }

    showView("result");
  } catch (error) {
    console.error("Photo strip creation error:", error);

    setMessage(
      "#resultMessage",
      error.message || "Could not create your photo strip."
    );
  } finally {
    busy = false;
    setButtonText("#finishButton", "Make my photo strip →");
    updateCaptureControls();
  }
});


// =========================================================
// 14. DOWNLOAD PHOTO STRIP
// =========================================================

$("#downloadButton")?.addEventListener("click", async () => {
  const canvas = $("#stripCanvas");

  if (!canvas || !latestStripData) {
    setMessage(
      "#resultMessage",
      "Create your photo strip before downloading."
    );
    return;
  }

  const button = $("#downloadButton");
  if (button) button.disabled = true;

  try {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => {
        if (result) resolve(result);
        else reject(new Error("Could not prepare the PNG file."));
      }, "image/png");
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "Syahlen-and-Atiqah-Wedding-Photo-Strip.png";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1500);

    setMessage(
      "#resultMessage",
      "Your photo strip is ready to save. ♡"
    );
  } catch (error) {
    console.error("Download error:", error);

    setMessage(
      "#resultMessage",
      "Download failed. Please try again."
    );
  } finally {
    if (button) button.disabled = false;
  }
});


// =========================================================
// 15. UPLOAD PHOTO STRIP TO SUPABASE
// =========================================================

$("#uploadButton")?.addEventListener("click", async () => {
  if (busy || stripAlreadyUploaded) return;

  if (!latestStripData) {
    setMessage(
      "#resultMessage",
      "Create your photo strip before uploading."
    );
    return;
  }

  if (!supabaseClient) {
    setMessage(
      "#resultMessage",
      "The gallery service is unavailable. Please refresh the page."
    );
    return;
  }

  busy = true;
  updateCaptureControls();

  const button = $("#uploadButton");

  if (button) {
    button.disabled = true;
    button.textContent = "Uploading...";
  }

  setMessage("#resultMessage", "Sharing your photo strip...");

  const guestName =
    $("#guestName")?.value.trim().slice(0, 60) || "A wedding guest";

  const path = `photostrips/${safeFileName()}`;
  let fileUploaded = false;

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

    if (uploadError) throw uploadError;

    fileUploaded = true;

    const { error: insertError } = await supabaseClient
      .from(PHOTO_TABLE)
      .insert({
        name: guestName,
        image_path: path
      });

    if (insertError) throw insertError;

    stripAlreadyUploaded = true;

    setMessage(
      "#resultMessage",
      "Your photo strip has been shared with the wedding gallery! ♡"
    );

    if (button) {
      button.textContent = "✓ Shared successfully";
      button.disabled = true;
    }

    await loadGallery();
  } catch (error) {
    console.error("Upload error:", error);

    // If the image was uploaded but the database insert failed,
    // remove the unused file to avoid leaving an orphaned image.
    if (fileUploaded) {
      try {
        const { error: cleanupError } = await supabaseClient
          .storage
          .from(BUCKET)
          .remove([path]);

        if (cleanupError) {
          console.warn("Could not clean up incomplete upload:", cleanupError);
        }
      } catch (cleanupError) {
        console.warn("Upload cleanup failed:", cleanupError);
      }
    }

    setMessage(
      "#resultMessage",
      `Upload failed: ${error.message || "Unknown error"}. Check your Supabase bucket, table and access policies.`
    );

    if (button) {
      button.textContent = "Try sharing again";
      button.disabled = false;
    }
  } finally {
    busy = false;
    updateCaptureControls();

    if (button && !stripAlreadyUploaded) {
      button.disabled = false;
    }
  }
});


// =========================================================
// 16. RESET AND TAKE ANOTHER SET
// =========================================================

function resetPhotos() {
  capturedPhotos = [];
  latestStripData = "";
  stripAlreadyUploaded = false;

  const canvas = $("#stripCanvas");

  if (canvas) {
    canvas.getContext("2d")?.clearRect(
      0, 0, canvas.width, canvas.height
    );
  }

  setMessage("#resultMessage", "");

  const downloadButton = $("#downloadButton");
  if (downloadButton) downloadButton.disabled = false;

  const uploadButton = $("#uploadButton");

  if (uploadButton) {
    uploadButton.disabled = false;
    uploadButton.textContent = "☁ Upload to wedding gallery";
  }

  setMessage(
    "#cameraHelp",
    cameraStream
      ? "Press the shutter to capture each of your three photos."
      : "Turn on your camera to begin."
  );

  renderSlots();
}

$("#againButton")?.addEventListener("click", async () => {
  if (busy) return;

  resetPhotos();
  showView("photobooth");
  await startCamera();
});


// =========================================================
// 17. LOAD THE WEDDING PHOTO GALLERY
// =========================================================

async function loadGallery() {
  const grid = $("#photoGrid");
  const requestId = ++galleryRequestId;

  if (!grid) return;

  if (!supabaseClient) {
    setMessage("#photoCount", "Gallery unavailable");

    grid.replaceChildren(
      makeText("Gallery service is unavailable. Please refresh.")
    );

    return;
  }

  grid.replaceChildren(makeText("Loading wedding photos..."));

  try {
    const { data, error } = await supabaseClient
      .from(PHOTO_TABLE)
      .select("id, name, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (requestId !== galleryRequestId) return;

    const photos = data || [];

    setMessage(
      "#photoCount",
      `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`
    );

    grid.replaceChildren();

    if (!photos.length) {
      grid.appendChild(
        makeText("No photos yet. Be the first to share a memory!")
      );
      return;
    }

    photos.forEach(photo => {
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

      image.addEventListener("error", () => {
        image.alt = "Photo could not be loaded";
      });

      const info = document.createElement("div");
      info.className = "photo-card-info";

      const caption = document.createElement("strong");
      caption.textContent = `Shared by ${photo.name || "A wedding guest"}`;

      info.appendChild(caption);
      card.append(image, info);
      grid.appendChild(card);
    });
  } catch (error) {
    if (requestId !== galleryRequestId) return;

    console.error("Gallery error:", error);

    setMessage("#photoCount", "Unavailable");

    grid.replaceChildren(
      makeText(
        "Could not load photos. Check your Supabase table, bucket and access policies."
      )
    );
  }
}


// =========================================================
// 18. LOAD THE GUESTBOOK
// =========================================================

async function loadGuestbook() {
  const list = $("#wishesList");
  const requestId = ++guestbookRequestId;

  if (!list) return;

  if (!supabaseClient) {
    list.replaceChildren(
      makeText("Guestbook service is unavailable.")
    );
    return;
  }

  list.replaceChildren(makeText("Loading guestbook messages..."));

  try {
    const { data, error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (requestId !== guestbookRequestId) return;

    const wishes = data || [];

    list.replaceChildren();

    if (!wishes.length) {
      list.appendChild(
        makeText("No wishes yet. Leave the first message for the couple!")
      );
      return;
    }

    wishes.forEach(wish => {
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
    if (requestId !== guestbookRequestId) return;

    console.error("Guestbook error:", error);

    list.replaceChildren(
      makeText(
        "Could not load messages. Check your Supabase guestbook table and policies."
      )
    );
  }
}


// =========================================================
// 19. SUBMIT A GUESTBOOK MESSAGE
// =========================================================

$("#guestbookForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (busy) return;

  const name = $("#messageName")?.value.trim() || "";
  const message = $("#messageText")?.value.trim() || "";
  const button = $("#sendWishButton");

  if (!name || !message) {
    setMessage(
      "#guestbookStatus",
      "Please enter your name and wishes."
    );
    return;
  }

  if (name.length > 50 || message.length > 400) {
    setMessage(
      "#guestbookStatus",
      "Please shorten your name or message."
    );
    return;
  }

  if (!supabaseClient) {
    setMessage(
      "#guestbookStatus",
      "Guestbook service is unavailable. Please refresh."
    );
    return;
  }

  busy = true;

  if (button) {
    button.disabled = true;
    button.textContent = "Sending...";
  }

  setMessage("#guestbookStatus", "");

  try {
    const { error } = await supabaseClient
      .from(GUESTBOOK_TABLE)
      .insert({ name, message });

    if (error) throw error;

    $("#guestbookForm").reset();

    setMessage(
      "#guestbookStatus",
      "Your wishes have been shared. Thank you! ♡"
    );

    await loadGuestbook();
  } catch (error) {
    console.error("Guestbook submission error:", error);

    setMessage(
      "#guestbookStatus",
      `Could not send your message: ${error.message || "Unknown error"}. Check your Supabase insert policy.`
    );
  } finally {
    busy = false;

    if (button) {
      button.disabled = false;
      button.textContent = "Send your wishes ♡";
    }

    updateCaptureControls();
  }
});


// =========================================================
// 20. INITIALIZE THE WEBSITE
// =========================================================

function initializeApp() {
  const connected = initializeSupabase();

  const initialTemplate = $(
    `.template-option[data-template="${selectedTemplate}"]`
  );

  if (initialTemplate) {
    selectTemplate(initialTemplate);
  } else {
    updatePhotostripPreview();
  }

  renderSlots();

  if (connected) {
    loadGallery();
    loadGuestbook();
  }

  updateCaptureControls();
  updateCameraSwitchButton();

  console.log("Syahlen & Atiqah wedding photobooth is ready.");
}

initializeApp();