
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

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// Wedding details — customise these.
const COUPLE_NAMES = "SYAHLEN  ♥  ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const views = {
  photos: $("#photosView"),
  photobooth: $("#photoboothView"),
  result: $("#resultView"),
  guestbook: $("#guestbookView")
};

let cameraStream = null;
let capturedPhotos = [];
let selectedTemplate = "classic";
let latestStripData = "";
let busy = false;


// ==========================================
// 2. NAVIGATION
// ==========================================

function showView(name) {
  Object.values(views).forEach(view => view.classList.remove("active"));

  if (views[name]) views[name].classList.add("active");

  $$(".nav-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.page === name);
  });

  $("#navTabs").classList.remove("open");
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
  $("#navTabs").classList.toggle("open");
});


// ==========================================
// 3. CAMERA
// ==========================================

async function startCamera() {
  if (cameraStream) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    $("#cameraHelp").textContent =
      "Camera access requires HTTPS or localhost.";
    return;
  }

  $("#startCamera").disabled = true;
  $("#cameraStatus").textContent = "Opening camera...";

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 960 }
      },
      audio: false
    });

    const video = $("#cameraVideo");
    video.srcObject = cameraStream;
    await video.play();

    video.classList.add("ready");
    $("#cameraPlaceholder").style.display = "none";
    $("#cameraStatus").textContent = "Camera is ready";
    $("#cameraHelp").textContent = "Press the shutter when ready.";
    $("#captureButton").disabled = false;
    $("#retakeButton").disabled = false;

  } catch (error) {
    cameraStream = null;
    $("#cameraStatus").textContent = "Camera unavailable";
    $("#cameraHelp").textContent =
      error.name === "NotAllowedError"
        ? "Allow camera access in your browser settings and try again."
        : "Could not open camera. Check your camera and browser permissions.";
  } finally {
    $("#startCamera").disabled = false;
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

  for (let number = 3; number >= 1; number--) {
    el.textContent = number;
    await delay(700);
  }

  el.textContent = "♥";
  await delay(250);
  el.classList.remove("show");
  el.textContent = "";
}

async function takeSnapshot() {
  const video = $("#cameraVideo");

  if (!cameraStream || !video.videoWidth) {
    throw new Error("Camera is not ready.");
  }

  const canvas = $("#captureCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");

  // Mirror the image to match the selfie preview.
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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
      slot.textContent = index + 1;
    }
  });

  $("#finishButton").disabled =
    capturedPhotos.length !== 3 || busy;

  $("#captureButton").disabled =
    !cameraStream || capturedPhotos.length >= 3 || busy;

  $("#cameraStatus").textContent =
    capturedPhotos.length === 3
      ? "All three snaps captured"
      : `Snap ${capturedPhotos.length + 1} of 3`;
}

$("#captureButton").addEventListener("click", async () => {
  if (!cameraStream || busy || capturedPhotos.length >= 3) return;

  busy = true;
  $("#captureButton").disabled = true;

  try {
    await countdown();
    capturedPhotos.push(await takeSnapshot());
    renderSlots();

    $("#cameraHelp").textContent =
      capturedPhotos.length === 3
        ? "All done! Create your photo strip."
        : `${3 - capturedPhotos.length} more snap(s) to go.`;

  } catch (error) {
    $("#cameraHelp").textContent = error.message;
  } finally {
    busy = false;
    renderSlots();
  }
});

function resetPhotos() {
  capturedPhotos = [];
  latestStripData = "";
  renderSlots();

  $("#cameraHelp").textContent =
    cameraStream
      ? "Press the shutter when everyone is ready."
      : "Turn on your camera to get started.";
}

$("#retakeButton").addEventListener("click", resetPhotos);


// ==========================================
// 4. PHOTO TEMPLATE
// ==========================================

$$(".template-option").forEach(button => {
  button.addEventListener("click", () => {
    selectedTemplate = button.dataset.template;

    $$(".template-option").forEach(item => {
      item.classList.toggle("selected", item === button);
    });
  });
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load captured photo."));
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

async function renderStrip() {
  if (capturedPhotos.length !== 3) {
    throw new Error("Please capture three photos first.");
  }

  const canvas = $("#stripCanvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const sakura = selectedTemplate === "sakura";

  const bg = sakura ? "#f5dfe5" : "#fffdf8";
  const ink = sakura ? "#98556b" : "#51413b";

  ctx.clearRect(0, 0, w, canvas.height);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, canvas.height);

  if (sakura) {
    for (let i = 0; i < 28; i++) {
      drawFlower(
        ctx,
        (i * 83 + 24) % w,
        (i * 127 + 35) % canvas.height,
        9 + (i % 3) * 2,
        "#d99caf"
      );
    }
  } else {
    ctx.strokeStyle = "#e6d8ca";
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, canvas.height - 40);
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
    alert(error.message);
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
  if (!latestStripData) return;

  const link = document.createElement("a");
  link.href = latestStripData;
  link.download = "wedding-photo-strip.png";
  link.click();
});


// ==========================================
// 6. UPLOAD PHOTO STRIP TO SUPABASE
// ==========================================

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(",");
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

function safeFileName() {
  return `${Date.now()}-${crypto.randomUUID()}.png`;
}

$("#uploadButton").addEventListener("click", uploadPhotoStrip);

async function uploadPhotoStrip() {
  if (!latestStripData || busy) return;

  busy = true;
  const button = $("#uploadButton");
  button.disabled = true;
  button.textContent = "Uploading...";

  $("#resultMessage").textContent = "Uploading your photo strip...";

  const path = `photostrips/${safeFileName()}`;
  const name = $("#guestName").value.trim().slice(0, 60) || "A wedding guest";

  try {
    const blob = dataURLToBlob(latestStripData);

    // Upload image file to Supabase Storage.
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Save metadata in the shared gallery database.
    const { error: insertError } = await supabase
      .from(PHOTO_TABLE)
      .insert({
        name,
        image_path: path
      });

    if (insertError) {
      // Clean up the uploaded file if the database insert fails.
      await supabase.storage.from(BUCKET).remove([path]);
      throw insertError;
    }

    $("#resultMessage").textContent =
      "Your photo strip is uploaded! It is now in the shared gallery.";

    button.textContent = "✓ Uploaded successfully";
    await loadGallery();

  } catch (error) {
    console.error("Photo upload error:", error);
    $("#resultMessage").textContent =
      `Upload failed: ${error.message}. Check your Supabase settings and policies.`;

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
  grid.innerHTML = '<p class="muted">Loading wedding photos...</p>';

  try {
    const { data, error } = await supabase
      .from(PHOTO_TABLE)
      .select("id, name, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    $("#photoCount").textContent =
      `${data.length} ${data.length === 1 ? "photo" : "photos"}`;

    grid.replaceChildren();

    if (!data.length) {
      grid.innerHTML =
        '<p class="muted">No photos yet. Be the first to share a memory!</p>';
      return;
    }

    for (const photo of data) {
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(photo.image_path);

      const card = document.createElement("article");
      card.className = "photo-card uploaded-card";

      const img = document.createElement("img");
      img.src = urlData.publicUrl;
      img.alt = `Wedding photo shared by ${photo.name}`;
      img.loading = "lazy";
      img.style.cssText =
        "width:100%;height:245px;object-fit:contain;background:#efe6e0;padding:10px;display:block";

      const caption = document.createElement("p");
      caption.textContent = `Shared by ${photo.name}`;

      card.append(img, caption);
      grid.appendChild(card);
    }

  } catch (error) {
    console.error("Gallery error:", error);
    $("#photoCount").textContent = "Unavailable";
    grid.innerHTML =
      '<p class="muted">Could not load gallery. Check your Supabase URL, key, table, and policies.</p>';
  }
}


// ==========================================
// 8. GUESTBOOK: SAVE AND LOAD MESSAGES
// ==========================================

async function loadGuestbook() {
  const list = $("#wishesList");
  list.innerHTML = '<p class="muted">Loading wishes...</p>';

  try {
    const { data, error } = await supabase
      .from(GUESTBOOK_TABLE)
      .select("id, name, message, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    list.replaceChildren();

    if (!data.length) {
      list.innerHTML =
        '<p class="muted">No wishes yet. Leave the first message!</p>';
      return;
    }

    data.forEach(wish => {
      const card = document.createElement("article");
      card.className = "wish-card";

      const heart = document.createElement("span");
      heart.className = "wish-heart";
      heart.textContent = "♡";

      const heading = document.createElement("h3");
      heading.textContent = wish.name;

      const message = document.createElement("p");
      message.textContent = wish.message;

      card.append(heart, heading, message);
      list.appendChild(card);
    });

  } catch (error) {
    console.error("Guestbook error:", error);
    list.innerHTML =
      '<p class="muted">Could not load messages. Check your Supabase settings.</p>';
  }
}

$("#guestbookForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = $("#messageName").value.trim();
  const message = $("#messageText").value.trim();
  const button = $("#sendWishButton");
  const status = $("#guestbookStatus");

  if (!name || !message) return;

  if (name.length > 50 || message.length > 400) {
    status.textContent = "Please shorten your name or message.";
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
    status.textContent =
      `Could not send message: ${error.message}`;

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

async function initialiseApp() {
  await Promise.all([
    loadGallery(),
    loadGuestbook()
  ]);
}

initialiseApp();
