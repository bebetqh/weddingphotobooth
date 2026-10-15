/* ==========================================
   WEDDING DIGITAL PHOTOBOOTH
   Supabase Storage + Database
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

let supabase = null;
let cameraStream = null;
let capturedPhotos = [];
let selectedTemplate = "classic";
let latestStripData = "";
let busy = false;
let galleryRequest = 0;
let guestbookRequest = 0;

const COUPLE_NAMES = "SYAHLEN  ♥  ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

// ==========================================
// 1A. SUPABASE INITIALISATION
// ==========================================

function initialiseSupabase() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase SDK did not load.");
    $("#photoCount").textContent = "Unavailable";
    $("#photoGrid").innerHTML =
      '<p class="muted">The gallery service could not load. Check your internet connection and refresh.</p>';
    $("#wishesList").innerHTML =
      '<p class="muted">The guestbook service could not load. Check your internet connection and refresh.</p>';
    return false;
  }

  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return true;
  } catch (error) {
    console.error("Supabase initialisation error:", error);
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
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  const nav = $("#navTabs");
  const menuButton = $("#menuButton");
  nav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");

  if (name !== "photobooth") stopCamera();
  if (name === "photos") loadGallery();
  if (name === "guestbook") loadGuestbook();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Event delegation means nav buttons and the gallery CTA all use the same handler.
document.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button) return;
  event.preventDefault();

  const destination = button.dataset.page;
  showView(destination);

  // The main "Take a selfie" CTA should also request camera access.
  if (destination === "photobooth" && button.classList.contains("primary-button")) {
    startCamera();
  }
});

$("#menuButton").addEventListener("click", () => {
  const nav = $("#navTabs");
  const isOpen = nav.classList.toggle("open");
  $("#menuButton").setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    $("#navTabs").classList.remove("open");
    $("#menuButton").setAttribute("aria-expanded", "false");
  }
});

// ==========================================
// 3. CAMERA
// ==========================================

async function startCamera() {
  if (cameraStream) {
    // Reuse the active stream if it is already running.
    if ($("#cameraVideo").srcObject !== cameraStream) {
      $("#cameraVideo").srcObject = cameraStream;
    }
    return;
  }

  const startButton = $("#startCamera");
  const video = $("#cameraVideo");
  const status = $("#cameraStatus");
  const help = $("#cameraHelp");
  const placeholder = $("#cameraPlaceholder");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.textContent = "Camera unavailable";
    help.textContent = "Camera access requires HTTPS or localhost. Open this site through a secure connection.";
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

    cameraStream = stream;
    video.srcObject = stream;
    await video.play();

    video.classList.add("ready");
    placeholder.style.display = "none";
    status.textContent = "Camera is ready";
    help.textContent = "Press the shutter when everyone is ready.";
    renderSlots();
  } catch (error) {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    video.srcObject = null;
    video.classList.remove("ready");
    placeholder.style.display = "flex";

    status.textContent = "Camera unavailable";

    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      help.textContent = "Camera permission was denied. Allow camera access in your browser/site settings, then try again.";
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      help.textContent = "No camera was found. Connect a camera and try again.";
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      help.textContent = "The camera may be in use by another app. Close that app and try again.";
    } else {
      help.textContent = "Could not open the camera. Check browser permissions and make sure the site uses HTTPS or localhost.";
    }

    console.error("Camera error:", error);
  } finally {
    startButton.disabled = false;
    renderSlots();
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  const video = $("#cameraVideo");
  video.srcObject = null;
  video.classList.remove("ready");

  $("#cameraPlaceholder").style.display = "flex";
  $("#startCamera").disabled = false;
  $("#cameraStatus").textContent = "Camera not started";
  $("#captureButton").disabled = true;
}

$("#startCamera").addEventListener("click", startCamera);
window.addEventListener("beforeunload", stopCamera);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function countdown() {
  const el = $("#countdown");
  el.classList.add("show");

  try {
    for (let number = 3; number >= 1; number--) {
      el.textContent = number;
      await delay(700);
    }
    el.textContent = "♥";
    await delay(250);
  } finally {
    el.classList.remove("show");
    el.textContent = "";
  }
}

async function takeSnapshot() {
  const video = $("#cameraVideo");
  if (!cameraStream || !video.videoWidth || !video.videoHeight) {
    throw new Error("Camera is not ready. Turn on the camera and try again.");
  }

  const canvas = $("#captureCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the photo canvas.");

  // Mirror the captured image to match the selfie preview.
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.9);
}

function renderSlots() {
  $$("#snapSlots .snap-slot").forEach((slot, index) => {
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

  $("#finishButton").disabled = capturedPhotos.length !== 3 || busy;
  $("#captureButton").disabled = !cameraStream || capturedPhotos.length >= 3 || busy;
  $("#retakeButton").disabled = !cameraStream || capturedPhotos.length === 0 || busy;

  if (capturedPhotos.length === 3) {
    $("#cameraStatus").textContent = "All three snaps captured";
  } else if (cameraStream) {
    $("#cameraStatus").textContent = `Snap ${capturedPhotos.length + 1} of 3`;
  } else {
    $("#cameraStatus").textContent = "Camera not started";
  }
}

$("#captureButton").addEventListener("click", async () => {
  if (!cameraStream || busy || capturedPhotos.length >= 3) return;

  busy = true;
  renderSlots();

  try {
    await countdown();
    capturedPhotos.push(await takeSnapshot());
    $("#cameraHelp").textContent = capturedPhotos.length === 3
      ? "All done! Create your photo strip."
      : `${3 - capturedPhotos.length} more snap(s) to go.`;
  } catch (error) {
    $("#cameraHelp").textContent = error.message || "Could not capture photo.";
    console.error("Capture error:", error);
  } finally {
    busy = false;
    renderSlots();
  }
});

function resetPhotos() {
  capturedPhotos = [];
  latestStripData = "";
  renderSlots();
  $("#cameraHelp").textContent = cameraStream
    ? "Press the shutter when everyone is ready."
    : "Turn on your camera to get started.";
}

$("#retakeButton").addEventListener("click", resetPhotos);

// ==========================================
// 4. PHOTO TEMPLATE AND STRIP RENDERING
// ==========================================

$$(".template-option").forEach(button => {
  button.addEventListener("click", () => {
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
    image.onerror = () => reject(new Error("Could not load one of the captured photos."));
    image.src = src;
  });
}

function drawCrop(ctx, img, x, y, w, h) {
  const sourceRatio = img.width / img.height;
  const targetRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;

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
    ctx.rotate(Math.PI * 2 / 5);
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.65, radius * 0.42, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = "#f9e9bd";
  ctx.fill();
  ctx.restore();
}

async function renderStrip() {
  if (capturedPhotos.length !== 3) throw new Error("Please capture three photos first.");

  const canvas = $("#stripCanvas");
  const ctx = canvas.getContext("2d");
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
      drawFlower(ctx, (i * 83 + 24) % w, (i * 127 + 35) % h, 9 + (i % 3) * 2, "#d99caf");
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
    ctx.fillRect(margin - 8, y - 8, photoW + 16, photoH + 16);
    drawCrop(ctx, img, margin, y, photoW, photoH);
    y += photoH + gap;
  }

  ctx.font = "italic 29px 'Playfair Display', serif";
  ctx.fillStyle = ink;
  ctx.fillText("A memory to keep forever", w / 2, 1500);
  ctx.font = "16px 'DM Sans', sans-serif";
  ctx.fillText("THANK YOU FOR CELEBRATING WITH US", w / 2, 1540);
  ctx.fillText(WEDDING_DATE, w / 2, 1580);

  if (sakura) {
    drawFlower(ctx, 78, 1695, 23, "#d99caf");
    drawFlower(ctx, 522, 1695, 23, "#d99caf");
  } else {
    ctx.strokeStyle = "#e6d8ca";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 1695);
    ctx.lineTo(510, 1695);
    ctx.stroke();
  }

  latestStripData = canvas.toDataURL("image/png");
}

$("#finishButton").addEventListener("click", async () => {
  if (busy || capturedPhotos.length !== 3) return;

  busy = true;
  $("#finishButton").disabled = true;
  $("#finishButton").textContent = "Creating strip...";

  try {
    await renderStrip();
    showView("result");
  } catch (error) {
    console.error("Strip rendering error:", error);
    alert(error.message || "Could not create your photo strip.");
  } finally {
    busy = false;
    $("#finishButton").textContent = "Make my photo strip →";
    renderSlots();
  }
});

// ==========================================
// 5. DOWNLOAD PHOTO STRIP
// ==========================================

$("#downloadButton").addEventListener("click", () => {
  if (!latestStripData) {
    $("#resultMessage").textContent = "Create your photo strip before downloading.";
    return;
  }

  const link = document.createElement("a");
  link.href = latestStripData;
  link.download = "wedding-photo-strip.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
});

// ==========================================
// 6. UPLOAD PHOTO STRIP TO SUPABASE
// ==========================================

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(",");
  const match = parts[0].match(/:(.*?);/);
  if (!match) throw new Error("Invalid image data.");

  const mime = match[1];
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function safeFileName() {
  const uuid = window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${Date.now()}-${uuid}.png`;
}

$("#uploadButton").addEventListener("click", uploadPhotoStrip);

async function uploadPhotoStrip() {
  if (!latestStripData || busy) return;

  if (!supabase) {
    $("#resultMessage").textContent = "Gallery service is unavailable. Refresh the page and try again.";
    return;
  }

  busy = true;
  const button = $("#uploadButton");
  button.disabled = true;
  button.textContent = "Uploading...";
  $("#resultMessage").textContent = "Uploading your photo strip...";

  const path = `photostrips/${safeFileName()}`;
  const name = $("#guestName").value.trim().slice(0, 60) || "A wedding guest";

  try {
    const blob = dataURLToBlob(latestStripData);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { error: insertError } = await supabase
      .from(PHOTO_TABLE)
      .insert({ name, image_path: path });

    if (insertError) {
      const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([path]);
      if (cleanupError) console.warn("Could not remove orphaned upload:", cleanupError);
      throw insertError;
    }

    $("#resultMessage").textContent = "Your photo strip is uploaded! It is now in the shared gallery.";
    button.textContent = "✓ Uploaded successfully";
    await loadGallery();
  } catch (error) {
    console.error("Photo upload error:", error);
    $("#resultMessage").textContent = `Upload failed: ${error.message || "Unknown error"}. Check your Supabase bucket, table, and access policies.`;
    button.textContent = "☁ Try uploading again";
  } finally {
    busy = false;
    button.disabled = false;
  }
}

// ==========================================
// 7. LOAD SHARED GALLERY FROM SUPABASE
// ==========================================

async function loadGallery() {
  const grid = $("#photoGrid");
  const requestId = ++galleryRequest;

  if (!supabase) {
    $("#photoCount").textContent = "Unavailable";
    grid.innerHTML = '<p class="muted">Gallery service is unavailable. Check the Supabase configuration.</p>';
    return;
  }

  grid.innerHTML = '<p class="muted">Loading wedding photos...</p>';

  try {
    const { data, error } = await supabase
      .from(PHOTO_TABLE)
      .select("id, name, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (requestId !== galleryRequest) return;

    $("#photoCount").textContent = `${data.length} ${data.length === 1 ? "photo" : "photos"}`;
    grid.replaceChildren();

    if (!data.length) {
      grid.innerHTML = '<p class="muted">No photos yet. Be the first to share a memory!</p>';
      return;
    }

    for (const photo of data) {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(photo.image_path);
      const card = document.createElement("article");
      card.className = "photo-card uploaded-card";

      const img = document.createElement("img");
      img.src = urlData.publicUrl;
      img.alt = `Wedding photo shared by ${photo.name || "a guest"}`;
      img.loading = "lazy";
      img.style.cssText = "width:100%;height:245px;object-fit:contain;background:#efe6e0;padding:10px;display:block";

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
    $("#photoCount").textContent = "Unavailable";
    grid.innerHTML = '<p class="muted">Could not load gallery. Check the Supabase URL, table name, bucket, and access policies.</p>';
  }
}

// ==========================================
// 8. GUESTBOOK
// ==========================================

async function loadGuestbook() {
  const list = $("#wishesList");
  const requestId = ++guestbookRequest;

  if (!supabase) {
    list.innerHTML = '<p class="muted">Guestbook service is unavailable. Check the Supabase configuration.</p>';
    return;
  }

  list.innerHTML = '<p class="muted">Loading wishes...</p>';

  try {
    const { data, error } = await supabase
      .from(GUESTBOOK_TABLE)
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    if (requestId !== guestbookRequest) return;

    list.replaceChildren();

    if (!data.length) {
      list.innerHTML = '<p class="muted">No wishes yet. Leave the first message!</p>';
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
    list.innerHTML = '<p class="muted">Could not load messages. Check your Supabase table and access policies.</p>';
  }
}

$("#guestbookForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("#messageName").value.trim();
  const message = $("#messageText").value.trim();
  const button = $("#sendWishButton");
  const status = $("#guestbookStatus");

  if (!name || !message) {
    status.textContent = "Please enter your name and wishes.";
    return;
  }

  if (name.length > 50 || message.length > 400) {
    status.textContent = "Please shorten your name or message.";
    return;
  }

  if (!supabase) {
    status.textContent = "Guestbook service is unavailable. Refresh the page and try again.";
    return;
  }

  button.disabled = true;
  button.textContent = "Sending...";
  status.textContent = "";

  try {
    const { error } = await supabase
      .from(GUESTBOOK_TABLE)
      .insert({ name, message });

    if (error) throw error;

    $("#guestbookForm").reset();
    status.textContent = "Your wishes have been shared. Thank you!";
    await loadGuestbook();
  } catch (error) {
    console.error("Guestbook submission error:", error);
    status.textContent = `Could not send message: ${error.message || "Unknown error"}. Check your Supabase insert policy.`;
  } finally {
    button.disabled = false;
    button.textContent = "Send your wishes ♡";
  }
});

// ==========================================
// 9. TAKE ANOTHER SET
// ==========================================

$("#againButton").addEventListener("click", async () => {
  resetPhotos();

  $("#uploadButton").disabled = false;
  $("#uploadButton").textContent = "☁ Upload to wedding gallery";
  $("#resultMessage").textContent = "";

  showView("photobooth");
  await startCamera();
});

// ==========================================
// 10. INITIALISE
// ==========================================

function initialiseApp() {
  const ready = initialiseSupabase();
  renderSlots();

  if (ready) {
    loadGallery();
    loadGuestbook();
  }
}

initialiseApp();
