const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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
let wallPhotos = 0;

function showView(name) {
  Object.values(views).forEach(view => view.classList.remove("active"));
  const target = views[name] || views.photos;
  target.classList.add("active");
  $$(".nav-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === name));
  $("#navTabs").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name !== "photobooth") stopCamera();
}

$$(".nav-tab").forEach(tab => tab.addEventListener("click", () => showView(tab.dataset.view)));
$$("[data-go]").forEach(button => button.addEventListener("click", () => showView(button.dataset.go)));
$("#menuButton").addEventListener("click", () => $("#navTabs").classList.toggle("open"));

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $("#cameraHelp").textContent = "Camera access needs HTTPS or localhost. Open this site on localhost or a secure website.";
    return;
  }
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
    $("#cameraStatus").textContent = "Camera is ready";
    $("#cameraHelp").textContent = "Press the shutter when everyone is ready.";
    $("#captureButton").disabled = false;
    $("#retakeButton").disabled = false;
  } catch (error) {
    $("#cameraStatus").textContent = "Camera unavailable";
    $("#cameraHelp").textContent = error.name === "NotAllowedError"
      ? "Camera permission was blocked. Allow camera access in your browser settings, then try again."
      : "Could not open the camera. Check that it is connected and not being used by another app.";
  }
}
$("#startCamera").addEventListener("click", startCamera);

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
}
window.addEventListener("beforeunload", stopCamera);

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function takeSnapshot() {
  const video = $("#cameraVideo");
  if (!cameraStream || !video.videoWidth) return null;
  const canvas = $("#captureCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  // Mirror the captured image so it matches the mirrored camera preview.
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
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

function renderSlots() {
  $$("#snapSlots .snap-slot").forEach((slot, index) => {
    slot.innerHTML = "";
    if (capturedPhotos[index]) {
      const img = document.createElement("img");
      img.src = capturedPhotos[index];
      img.alt = `Captured photo ${index + 1}`;
      slot.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.textContent = index + 1;
      slot.appendChild(span);
    }
  });
  $("#finishButton").disabled = capturedPhotos.length !== 3;
  $("#captureButton").disabled = !cameraStream || capturedPhotos.length >= 3;
  $("#cameraStatus").textContent = capturedPhotos.length === 3 ? "All three snaps captured" : `Snap ${capturedPhotos.length + 1} of 3`;
}

$("#captureButton").addEventListener("click", async () => {
  if (!cameraStream || capturedPhotos.length >= 3) return;
  $("#captureButton").disabled = true;
  await countdown();
  const photo = await takeSnapshot();
  if (photo) capturedPhotos.push(photo);
  renderSlots();
  if (capturedPhotos.length < 3) {
    $("#cameraHelp").textContent = `Lovely! ${3 - capturedPhotos.length} more ${capturedPhotos.length === 2 ? "snap" : "snaps"} to go.`;
  } else {
    $("#cameraHelp").textContent = "All done! Choose your template, then make your strip.";
  }
});

function resetPhotos() {
  capturedPhotos = [];
  renderSlots();
  $("#cameraHelp").textContent = cameraStream ? "Press the shutter when everyone is ready." : "Turn on your camera to get started.";
  $("#cameraStatus").textContent = cameraStream ? "Camera is ready" : "Camera not started";
}
$("#retakeButton").addEventListener("click", resetPhotos);

$$(".template-option").forEach(button => button.addEventListener("click", () => {
  selectedTemplate = button.dataset.template;
  $$(".template-option").forEach(item => item.classList.toggle("selected", item === button));
}));

$("#finishButton").addEventListener("click", () => {
  if (capturedPhotos.length !== 3) return;
  renderStrip();
  showView("result");
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function renderStrip() {
  const canvas = $("#stripCanvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const sakura = selectedTemplate === "sakura";
  const bg = sakura ? "#f5dfe5" : "#fffdf8";
  const ink = sakura ? "#98556b" : "#51413b";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (sakura) {
    ctx.fillStyle = "#d99caf";
    for (let i = 0; i < 28; i++) {
      const x = (i * 83 + 24) % w, y = (i * 127 + 35) % h;
      drawFlower(ctx, x, y, 8 + (i % 3) * 2, "#d99caf");
    }
  } else {
    ctx.strokeStyle = "#e6d8ca";
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, w - 40, h - 40);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = "600 19px 'DM Sans', sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("OUR WEDDING DAY", w / 2, 68);
  ctx.font = "italic 48px 'Playfair Display', serif";
  ctx.fillText("Just Married", w / 2, 128);
  ctx.font = "18px 'DM Sans', sans-serif";
  ctx.fillText("SYAZWAN  ♥  SYILAH", w / 2, 165);

  const margin = 65, photoW = w - margin * 2, photoH = 405, gap = 22;
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
  ctx.fillText("A memory to keep forever", w / 2, 1540);
  ctx.font = "16px 'DM Sans', sans-serif";
  ctx.fillText("THANK YOU FOR CELEBRATING WITH US", w / 2, 1580);
  ctx.font = "16px 'DM Sans', sans-serif";
  ctx.fillText("19 · 12 · 2026", w / 2, 1630);
  if (sakura) {
    drawFlower(ctx, 78, 1700, 23, "#d99caf");
    drawFlower(ctx, 522, 1700, 23, "#d99caf");
  } else {
    ctx.strokeStyle = "#e6d8ca"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(90, 1700); ctx.lineTo(510, 1700); ctx.stroke();
  }
  latestStripData = canvas.toDataURL("image/png");
}

function drawCrop(ctx, img, x, y, w, h) {
  const sourceRatio = img.width / img.height, targetRatio = w / h;
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
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    ctx.rotate(Math.PI * 2 / 5);
    ctx.beginPath(); ctx.ellipse(0, -radius * .65, radius * .42, radius * .7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(0, 0, radius * .25, 0, Math.PI * 2); ctx.fillStyle = "#f9e9bd"; ctx.fill();
  ctx.restore();
}

$("#downloadButton").addEventListener("click", () => {
  if (!latestStripData) return;
  const link = document.createElement("a");
  link.href = latestStripData;
  link.download = "our-wedding-photo-strip.png";
  document.body.appendChild(link); link.click(); link.remove();
  $("#resultMessage").textContent = "Your photo strip has been downloaded.";
});

$("#postButton").addEventListener("click", () => {
  if (!latestStripData) return;
  const name = $("#guestName").value.trim() || "A wedding guest";
  const card = document.createElement("article");
  card.className = "photo-card wall-card";
  const image = document.createElement("img");
  image.src = latestStripData;
  image.alt = `Photo strip posted by ${name}`;
  image.style.cssText = "display:block;width:100%;height:245px;object-fit:contain;background:#f0e4df;padding:12px";
  const caption = document.createElement("p");
  caption.textContent = `Shared by ${name}`;
  card.append(image, caption);
  $("#photoGrid").prepend(card);
  wallPhotos++;
  $("#photoCount").textContent = `${6 + wallPhotos} photos`;
  $("#resultMessage").textContent = "Posted to the gallery wall on this device.";
  $("#postButton").disabled = true;
  $("#postButton").textContent = "✓ Posted to the wall";
});

$("#againButton").addEventListener("click", () => {
  resetPhotos();
  $("#postButton").disabled = false;
  $("#postButton").textContent = "✦ Post to the wall";
  showView("photobooth");
  if (!cameraStream) startCamera();
});

$("#guestbookForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("#messageName").value.trim();
  const message = $("#messageText").value.trim();
  if (!name || !message) return;
  const card = document.createElement("article");
  card.className = "wish-card";
  const heart = document.createElement("span"); heart.className = "wish-heart"; heart.textContent = "♡";
  const heading = document.createElement("h3"); heading.textContent = name;
  const paragraph = document.createElement("p"); paragraph.textContent = message;
  card.append(heart, heading, paragraph);
  $("#wishesList").prepend(card);
  $("#guestbookForm").reset();
});

// Open the camera automatically when the photobooth tab is first selected.
$$(".nav-tab").find(tab => tab.dataset.view === "photobooth").addEventListener("click", () => {
  if (!cameraStream) startCamera();
});
