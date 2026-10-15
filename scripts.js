/* ==========================================
   WEDDING DIGITAL PHOTOBOOTH
   Supabase Storage + Database
========================================== */

// Keep your own Supabase project values here.
const SUPABASE_URL = "PASTE_YOUR_EXISTING_SUPABASE_URL_HERE";
const SUPABASE_KEY = "PASTE_YOUR_EXISTING_SUPABASE_PUBLISHABLE_KEY_HERE";

const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";
const COUPLE_NAMES = "SYAZWAN  ♥  SYILAH";
const WEDDING_DATE = "19 · 12 · 2026";

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

function setMessage(selector, message) {
  const el = $(selector);
  if (el) el.textContent = message;
}

function initSupabase() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("Supabase SDK did not load. Check your internet connection or CDN.");
    setMessage("#photoCount", "Gallery unavailable");
    $("#photoGrid").replaceChildren(makeText("Could not load the gallery service. Check your connection and reload."));
    setMessage("#guestbookStatus", "Guestbook service is unavailable.");
    $("#wishesList").replaceChildren(makeText("Could not load guestbook service."));
    return false;
  }
  if (SUPABASE_URL.includes("PASTE_") || SUPABASE_KEY.includes("PASTE_")) {
    console.warn("Add your Supabase URL and publishable key in scripts.js.");
    setMessage("#photoCount", "Setup required");
    $("#photoGrid").replaceChildren(makeText("Add your Supabase project URL and publishable key in scripts.js."));
    $("#wishesList").replaceChildren(makeText("Add your Supabase project URL and publishable key in scripts.js."));
    return false;
  }
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return true;
  } catch (error) {
    console.error("Supabase initialization failed:", error);
    setMessage("#photoCount", "Gallery unavailable");
    return false;
  }
}

function makeText(text, className = "muted") {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

function showView(name) {
  if (!views[name]) return;
  Object.values(views).forEach(view => view.classList.remove("active"));
  views[name].classList.add("active");
  $$(".nav-tab").forEach(button => {
    const active = button.dataset.page === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("#navTabs").classList.remove("open");
  $("#menuButton").setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (name !== "photobooth") stopCamera();
  if (name === "photos") loadGallery();
  if (name === "guestbook") loadGuestbook();
}

$$("[data-page]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    showView(button.dataset.page);
  });
});

$("#menuButton").addEventListener("click", () => {
  const open = $("#navTabs").classList.toggle("open");
  $("#menuButton").setAttribute("aria-expanded", String(open));
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startCamera() {
  if (cameraStream) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setMessage("#cameraHelp", "Camera requires HTTPS or localhost. Open the secure website and try again.");
    return;
  }

  const startButton = $("#startCamera");
  startButton.disabled = true;
  setMessage("#cameraStatus", "Opening camera...");
  setMessage("#cameraHelp", "Please allow camera access if your browser asks.");

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    const video = $("#cameraVideo");
    video.srcObject = cameraStream;
    await video.play();
    video.classList.add("ready");
    $("#cameraPlaceholder").style.display = "none";
    setMessage("#cameraStatus", "Camera is ready");
    setMessage("#cameraHelp", "Press the shutter when ready.");
    $("#captureButton").disabled = false;
    $("#retakeButton").disabled = false;
  } catch (error) {
    stopCamera();
    setMessage("#cameraStatus", "Camera unavailable");
    const messages = {
      NotAllowedError: "Camera permission was denied. Allow camera access in your browser settings.",
      NotFoundError: "No camera was found on this device.",
      NotReadableError: "The camera may be in use by another app. Close it and try again.",
      OverconstrainedError: "The camera cannot meet the requested settings. Try another camera."
    };
    setMessage("#cameraHelp", messages[error.name] || `Could not open camera: ${error.message || "check browser permissions"}.`);
  } finally {
    startButton.disabled = false;
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
  }
  if ($("#cameraPlaceholder")) $("#cameraPlaceholder").style.display = "flex";
  if ($("#startCamera")) $("#startCamera").disabled = false;
  if ($("#cameraStatus")) $("#cameraStatus").textContent = "Camera not started";
  if ($("#captureButton")) $("#captureButton").disabled = true;
}

$("#startCamera").addEventListener("click", startCamera);
window.addEventListener("beforeunload", stopCamera);

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
  if (!ctx) throw new Error("Could not access the photo canvas.");
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas.toDataURL("image/jpeg", 0.92);
}

function renderSlots() {
  $$("#snapSlots .snap-slot").forEach((slot, index) => {
    slot.replaceChildren();
    if (capturedPhotos[index]) {
      const img = document.createElement("img");
      img.src = capturedPhotos[index];
      img.alt = `Captured photo ${index + 1}`;
      slot.appendChild(img);
    } else slot.textContent = String(index + 1);
  });
  $("#finishButton").disabled = capturedPhotos.length !== 3 || busy;
  $("#captureButton").disabled = !cameraStream || capturedPhotos.length >= 3 || busy;
  $("#retakeButton").disabled = busy || capturedPhotos.length === 0;
  setMessage("#cameraStatus", capturedPhotos.length === 3
    ? "All three snaps captured"
    : cameraStream ? `Snap ${capturedPhotos.length + 1} of 3` : "Camera not started");
}

$("#captureButton").addEventListener("click", async () => {
  if (!cameraStream || busy || capturedPhotos.length >= 3) return;
  busy = true;
  renderSlots();
  try {
    await countdown();
    capturedPhotos.push(await takeSnapshot());
    setMessage("#cameraHelp", capturedPhotos.length === 3
      ? "All done! Create your photo strip."
      : `${3 - capturedPhotos.length} more snap(s) to go.`);
  } catch (error) {
    setMessage("#cameraHelp", error.message || "Could not capture photo.");
  } finally {
    busy = false;
    renderSlots();
  }
});

function resetPhotos() {
  capturedPhotos = [];
  latestStripData = "";
  $("#stripCanvas").getContext("2d").clearRect(0, 0, $("#stripCanvas").width, $("#stripCanvas").height);
  renderSlots();
  setMessage("#cameraHelp", cameraStream ? "Press the shutter when everyone is ready." : "Turn on your camera to get started.");
  $("#uploadButton").disabled = false;
  $("#uploadButton").textContent = "☁ Upload to wedding gallery";
  $("#downloadButton").disabled = false;
  setMessage("#resultMessage", "");
}
$("#retakeButton").addEventListener("click", resetPhotos);

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
    image.onerror = () => reject(new Error("Could not load a captured photo."));
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
    ctx.ellipse(0, -radius * .65, radius * .42, radius * .7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * .25, 0, Math.PI * 2);
  ctx.fillStyle = "#f9e9bd";
  ctx.fill();
  ctx.restore();
}

async function renderStrip() {
  if (capturedPhotos.length !== 3) throw new Error("Please capture three photos first.");
  const canvas = $("#stripCanvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const sakura = selectedTemplate === "sakura";
  const bg = sakura ? "#f5dfe5" : "#fffdf8";
  const ink = sakura ? "#98556b" : "#51413b";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (sakura) {
    for (let i = 0; i < 28; i++) drawFlower(ctx, (i * 83 + 24) % w, (i * 127 + 35) % h, 9 + (i % 3) * 2, "#d99caf");
  } else {
    ctx.strokeStyle = "#e6d8ca"; ctx.lineWidth = 3; ctx.strokeRect(20, 20, w - 40, h - 40);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = "600 19px 'DM Sans', sans-serif";
  ctx.fillText("OUR WEDDING DAY", w / 2, 68);
  ctx.font = "italic 48px 'Playfair Display', serif";
  ctx.fillText("Just Married", w / 2, 128);
  ctx.font = "18px 'DM Sans', sans-serif";
  ctx.fillText(COUPLE_NAMES, w / 2, 165);

  const margin = 65, photoW = w - margin * 2, photoH = 360, gap = 18;
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
    ctx.strokeStyle = "#e6d8ca"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(90, 1695); ctx.lineTo(510, 1695); ctx.stroke();
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
    alert(error.message || "Could not create photo strip.");
  } finally {
    busy = false;
    $("#finishButton").textContent = "Make my photo strip →";
    renderSlots();
  }
});

$("#downloadButton").addEventListener("click", () => {
  if (!latestStripData) {
    setMessage("#resultMessage", "Create your photo strip first.");
    return;
  }
  try {
    const link = document.createElement("a");
    link.href = latestStripData;
    link.download = "wedding-photo-strip.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMessage("#resultMessage", "Your download should begin shortly.");
  } catch (error) {
    setMessage("#resultMessage", "Download failed. Try using another browser.");
  }
});

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(",");
  const match = parts[0].match(/:(.*?);/);
  if (!match) throw new Error("Invalid image data.");
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] });
}

function safeFileName() {
  const id = window.crypto && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${Date.now()}-${id}.png`;
}

$("#uploadButton").addEventListener("click", uploadPhotoStrip);

async function uploadPhotoStrip() {
  if (!latestStripData || busy) {
    if (!latestStripData) setMessage("#resultMessage", "Create your photo strip first.");
    return;
  }
  if (!supabaseClient) {
    setMessage("#resultMessage", "Upload is not configured. Check the Supabase URL and publishable key in scripts.js.");
    return;
  }

  busy = true;
  const button = $("#uploadButton");
  button.disabled = true;
  button.textContent = "Uploading...";
  setMessage("#resultMessage", "Uploading your photo strip...");

  const path = `photostrips/${safeFileName()}`;
  const name = $("#guestName").value.trim().slice(0, 60) || "A wedding guest";
  try {
    const blob = dataURLToBlob(latestStripData);
    const { error: uploadError } = await supabaseClient.storage.from(BUCKET).upload(path, blob, {
      contentType: "image/png", cacheControl: "3600", upsert: false
    });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabaseClient.from(PHOTO_TABLE).insert({
      name,
      image_path: path
    });
    if (insertError) {
      const { error: cleanupError } = await supabaseClient.storage.from(BUCKET).remove([path]);
      if (cleanupError) console.warn("Could not clean up uploaded image:", cleanupError);
      throw insertError;
    }
    setMessage("#resultMessage", "Your photo strip is uploaded! It is now in the shared gallery.");
    button.textContent = "✓ Uploaded successfully";
    await loadGallery();
  } catch (error) {
    console.error("Photo upload error:", error);
    setMessage("#resultMessage", `Upload failed: ${error.message || "Check your Supabase tables and storage policies."}`);
    button.textContent = "☁ Try uploading again";
  } finally {
    busy = false;
    button.disabled = false;
  }
}

async function loadGallery() {
  const grid = $("#photoGrid");
  grid.replaceChildren(makeText("Loading wedding photos..."));
  if (!supabaseClient) {
    setMessage("#photoCount", "Not connected");
    grid.replaceChildren(makeText("Gallery is not connected. Check your Supabase setup in scripts.js."));
    return;
  }
  try {
    const { data, error } = await supabaseClient.from(PHOTO_TABLE)
      .select("id, name, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    setMessage("#photoCount", `${data.length} ${data.length === 1 ? "photo" : "photos"}`);
    grid.replaceChildren();
    if (!data.length) {
      grid.appendChild(makeText("No photos yet. Be the first to share a memory!"));
      return;
    }
    for (const photo of data) {
      const { data: urlData } = supabaseClient.storage.from(BUCKET).getPublicUrl(photo.image_path);
      const card = document.createElement("article");
      card.className = "photo-card uploaded-card";
      const img = document.createElement("img");
      img.className = "uploaded-photo";
      img.src = urlData.publicUrl;
      img.alt = `Wedding photo shared by ${photo.name || "a guest"}`;
      img.loading = "lazy";
      img.onerror = () => { img.alt = "This photo could not be loaded"; img.style.opacity = ".5"; };
      const caption = document.createElement("p");
      caption.textContent = `Shared by ${photo.name || "A wedding guest"}`;
      card.append(img, caption);
      grid.appendChild(card);
    }
  } catch (error) {
    console.error("Gallery error:", error);
    setMessage("#photoCount", "Unavailable");
    grid.replaceChildren(makeText(`Could not load gallery: ${error.message || "check Supabase table permissions"}.`));
  }
}

async function loadGuestbook() {
  const list = $("#wishesList");
  list.replaceChildren(makeText("Loading wishes..."));
  if (!supabaseClient) {
    list.replaceChildren(makeText("Guestbook is not connected. Check your Supabase setup in scripts.js."));
    return;
  }
  try {
    const { data, error } = await supabaseClient.from(GUESTBOOK_TABLE)
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    list.replaceChildren();
    if (!data.length) {
      list.appendChild(makeText("No wishes yet. Leave the first message!"));
      return;
    }
    data.forEach(wish => {
      const card = document.createElement("article"); card.className = "wish-card";
      const heart = document.createElement("span"); heart.className = "wish-heart"; heart.textContent = "♡";
      const heading = document.createElement("h3"); heading.textContent = wish.name || "A wedding guest";
      const message = document.createElement("p"); message.textContent = wish.message || "";
      card.append(heart, heading, message); list.appendChild(card);
    });
  } catch (error) {
    console.error("Guestbook error:", error);
    list.replaceChildren(makeText(`Could not load messages: ${error.message || "check Supabase table permissions"}.`));
  }
}

$("#guestbookForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("#messageName").value.trim();
  const message = $("#messageText").value.trim();
  const button = $("#sendWishButton");
  const status = $("#guestbookStatus");
  if (!name || !message) {
    status.textContent = "Please enter your name and a wish.";
    return;
  }
  if (name.length > 50 || message.length > 400) {
    status.textContent = "Please shorten your name or message.";
    return;
  }
  if (!supabaseClient) {
    status.textContent = "Guestbook is not configured. Check the Supabase URL and publishable key.";
    return;
  }
  button.disabled = true;
  button.textContent = "Sending...";
  status.textContent = "";
  try {
    const { error } = await supabaseClient.from(GUESTBOOK_TABLE).insert({ name, message });
    if (error) throw error;
    $("#guestbookForm").reset();
    status.textContent = "Your wishes have been shared. Thank you!";
    await loadGuestbook();
  } catch (error) {
    console.error("Guestbook submission error:", error);
    status.textContent = `Could not send message: ${error.message || "check guestbook table permissions"}`;
  } finally {
    button.disabled = false;
    button.textContent = "Send your wishes ♡";
  }
});

$("#againButton").addEventListener("click", async () => {
  resetPhotos();
  showView("photobooth");
  await startCamera();
});

async function initialiseApp() {
  const ready = initSupabase();
  if (ready) {
    // Each initial load catches its own errors so one failure doesn't block the other.
    await Promise.allSettled([loadGallery(), loadGuestbook()]);
  }
  renderSlots();
}
initialiseApp();
