// ============================================================
// WEDDING DIGITAL PHOTOBOOTH
// Syazwan & Syilah
// Automatic 3-photo capture with a 3-second countdown each
// ============================================================

// Supabase configuration
const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";

// Keep your existing Supabase publishable/anon key here.
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

let supabaseClient = null;

// ============================================================
// STATE
// ============================================================

let cameraStream = null;
let capturedPhotos = [];
let isCapturing = false;
let countdownTimer = null;

const TOTAL_PHOTOS = 3;
const COUNTDOWN_SECONDS = 3;
const PHOTO_DELAY_MS = 700;

// ============================================================
// DOM ELEMENTS
// ============================================================

const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");

const captureButton = document.getElementById("captureButton");
const startCameraButton = document.getElementById("startCameraButton");
const stopCameraButton = document.getElementById("stopCameraButton");

const countdownElement = document.getElementById("countdown");
const statusElement = document.getElementById("status");

const photoPreview = document.getElementById("photoPreview");
const photoStrip = document.getElementById("photoStrip");

const makeStripButton = document.getElementById("makeStripButton");
const downloadButton = document.getElementById("downloadButton");
const retakeButton = document.getElementById("retakeButton");

const galleryElement = document.getElementById("gallery");
const guestbookForm = document.getElementById("guestbookForm");

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function setStatus(message) {
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getElement(...ids) {
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) return element;
  }

  return null;
}

function showElement(element) {
  if (element) element.hidden = false;
}

function hideElement(element) {
  if (element) element.hidden = true;
}

function setButtonDisabled(button, disabled) {
  if (button) button.disabled = disabled;
}

// ============================================================
// SUPABASE INITIALIZATION
// ============================================================

function initialiseSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    console.warn(
      "Supabase SDK is missing. Check that the Supabase CDN script loads before scripts.js."
    );

    setStatus("Supabase could not load. Please refresh the page.");
    return false;
  }

  if (
    !SUPABASE_KEY ||
    SUPABASE_KEY === "YOUR_EXISTING_SUPABASE_PUBLISHABLE_KEY"
  ) {
    console.warn("Please insert your existing Supabase publishable key.");
    setStatus("Please configure your Supabase key.");
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
    setStatus("Could not connect to Supabase.");
    return false;
  }
}

// ============================================================
// NAVIGATION
// ============================================================

function showView(viewName) {
  const views = document.querySelectorAll(
    "[data-view], .page, .view, section[id]"
  );

  let matchedView = false;

  views.forEach((view) => {
    const matches =
      view.dataset.view === viewName ||
      view.id === viewName ||
      view.id === `${viewName}Page` ||
      view.id === `${viewName}-page`;

    if (matches) {
      view.hidden = false;
      view.classList.add("active");
      matchedView = true;
    } else if (
      view.hasAttribute("data-view") ||
      view.classList.contains("page") ||
      view.classList.contains("view")
    ) {
      view.hidden = true;
      view.classList.remove("active");
    }
  });

  if (!matchedView) {
    console.warn("Could not find view:", viewName);
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.addEventListener("click", (event) => {
  const navigationButton = event.target.closest("[data-page]");

  if (!navigationButton) return;

  const target = navigationButton.dataset.page;

  if (target) {
    showView(target);

    if (
      target.toLowerCase().includes("gallery")
    ) {
      loadGallery();
    }
  }
});

// ============================================================
// CAMERA
// ============================================================

async function startCamera() {
  if (!video) {
    setStatus("Camera video element was not found.");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus(
      "Camera access is unavailable. Open this website using HTTPS."
    );
    return;
  }

  try {
    stopCamera();

    setStatus("Starting camera...");

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = cameraStream;
    video.muted = true;
    video.playsInline = true;

    await video.play();

    if (captureButton) {
      captureButton.disabled = false;
    }

    if (startCameraButton) {
      startCameraButton.disabled = true;
    }

    showElement(stopCameraButton);

    setStatus("Camera ready! Press the shutter once to capture 3 photos.");

  } catch (error) {
    console.error("Camera error:", error);

    if (error.name === "NotAllowedError") {
      setStatus("Please allow camera access in your browser settings.");
    } else if (error.name === "NotFoundError") {
      setStatus("No camera was found on this device.");
    } else {
      setStatus("Unable to start camera. Please try again.");
    }
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => {
      track.stop();
    });

    cameraStream = null;
  }

  if (video) {
    video.srcObject = null;
  }

  if (startCameraButton) {
    startCameraButton.disabled = false;
  }

  if (captureButton) {
    captureButton.disabled = true;
  }

  hideElement(stopCameraButton);
}

// ============================================================
// COUNTDOWN
// ============================================================

async function countdown(seconds) {
  if (countdownElement) {
    countdownElement.hidden = false;
  }

  for (let number = seconds; number >= 1; number--) {
    if (countdownElement) {
      countdownElement.textContent = number;
    }

    setStatus(`Get ready! Photo ${capturedPhotos.length + 1} of ${TOTAL_PHOTOS}`);

    await delay(1000);
  }

  if (countdownElement) {
    countdownElement.textContent = "SMILE!";
  }

  await delay(250);

  if (countdownElement) {
    countdownElement.hidden = true;
    countdownElement.textContent = "";
  }
}

// ============================================================
// CAPTURE ONE PHOTO
// ============================================================

function captureOnePhoto() {
  if (!video || !canvas) {
    throw new Error("Camera video or canvas element is missing.");
  }

  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera is not ready yet.");
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not access canvas.");
  }

  // Mirror the photo to match the selfie preview.
  context.save();
  context.translate(canvas.width, 0);
  context.scale(-1, 1);

  context.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.restore();

  const photoData = canvas.toDataURL("image/jpeg", 0.92);

  const photo = {
    data: photoData,
    createdAt: new Date().toISOString()
  };

  capturedPhotos.push(photo);

  renderCapturedPhotos();

  return photo;
}

// ============================================================
// AUTOMATIC 3-PHOTO CAPTURE
// ============================================================

async function capturePhotosAutomatically() {
  if (isCapturing) return;

  if (!cameraStream || !video || !video.videoWidth) {
    setStatus("Please start the camera before taking photos.");
    return;
  }

  isCapturing = true;
  capturedPhotos = [];

  setButtonDisabled(captureButton, true);
  setButtonDisabled(makeStripButton, true);
  setButtonDisabled(retakeButton, true);

  try {
    for (let index = 0; index < TOTAL_PHOTOS; index++) {
      setStatus(
        `Preparing photo ${index + 1} of ${TOTAL_PHOTOS}...`
      );

      // Three-second countdown before EACH photo.
      await countdown(COUNTDOWN_SECONDS);

      // Automatically take the picture.
      captureOnePhoto();

      setStatus(
        `Photo ${index + 1} of ${TOTAL_PHOTOS} captured!`
      );

      // Short pause before starting the next countdown.
      if (index < TOTAL_PHOTOS - 1) {
        await delay(PHOTO_DELAY_MS);
      }
    }

    setStatus(
      "All 3 photos captured! Now make your photo strip."
    );

    showElement(makeStripButton);

    if (makeStripButton) {
      makeStripButton.disabled = false;
    }

    showElement(retakeButton);

    if (retakeButton) {
      retakeButton.disabled = false;
    }

  } catch (error) {
    console.error("Automatic capture failed:", error);
    setStatus("Photo capture failed. Please try again.");
  } finally {
    isCapturing = false;

    if (captureButton) {
      captureButton.disabled = !cameraStream;
    }
  }
}

// ============================================================
// DISPLAY CAPTURED PHOTOS
// ============================================================

function renderCapturedPhotos() {
  if (!photoPreview) return;

  photoPreview.innerHTML = "";

  capturedPhotos.forEach((photo, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "captured-photo";

    const image = document.createElement("img");
    image.src = photo.data;
    image.alt = `Captured photo ${index + 1}`;

    const label = document.createElement("p");
    label.textContent = `Photo ${index + 1}`;

    wrapper.appendChild(image);
    wrapper.appendChild(label);

    photoPreview.appendChild(wrapper);
  });

  if (capturedPhotos.length > 0) {
    showElement(photoPreview);
  }
}

// ============================================================
// PHOTO STRIP
// ============================================================

function createPhotoStripCanvas() {
  if (capturedPhotos.length !== TOTAL_PHOTOS) {
    setStatus("Please capture all 3 photos first.");
    return null;
  }

  const stripCanvas = document.createElement("canvas");
  const context = stripCanvas.getContext("2d");

  const photoWidth = 600;
  const photoHeight = 450;
  const margin = 32;
  const spacing = 20;
  const headerHeight = 180;
  const footerHeight = 120;

  stripCanvas.width = photoWidth + margin * 2;

  stripCanvas.height =
    headerHeight +
    TOTAL_PHOTOS * photoHeight +
    (TOTAL_PHOTOS - 1) * spacing +
    footerHeight +
    margin * 2;

  // Background.
  context.fillStyle = "#f8f2ed";
  context.fillRect(
    0,
    0,
    stripCanvas.width,
    stripCanvas.height
  );

  // Header.
  context.fillStyle = "#754f48";
  context.textAlign = "center";

  context.font = "bold 36px Georgia";
  context.fillText(
    "Our Wedding",
    stripCanvas.width / 2,
    margin + 45
  );

  context.font = "24px Georgia";
  context.fillText(
    "Syazwan & Syilah",
    stripCanvas.width / 2,
    margin + 90
  );

  context.font = "18px Arial";
  context.fillText(
    new Date().toLocaleDateString(),
    stripCanvas.width / 2,
    margin + 130
  );

  const photoPromises = capturedPhotos.map((photo) => {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = photo.data;
    });
  });

  return Promise.all(photoPromises).then((images) => {
    images.forEach((image, index) => {
      const x = margin;
      const y =
        margin +
        headerHeight +
        index * (photoHeight + spacing);

      // Photo border.
      context.fillStyle = "#ffffff";
      context.fillRect(
        x - 5,
        y - 5,
        photoWidth + 10,
        photoHeight + 10
      );

      // Crop image to fit.
      const sourceRatio = image.width / image.height;
      const targetRatio = photoWidth / photoHeight;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.width;
      let sourceHeight = image.height;

      if (sourceRatio > targetRatio) {
        sourceWidth = image.height * targetRatio;
        sourceX = (image.width - sourceWidth) / 2;
      } else {
        sourceHeight = image.width / targetRatio;
        sourceY = (image.height - sourceHeight) / 2;
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x,
        y,
        photoWidth,
        photoHeight
      );
    });

    // Footer.
    context.fillStyle = "#754f48";
    context.textAlign = "center";
    context.font = "italic 24px Georgia";

    context.fillText(
      "Thank you for celebrating with us!",
      stripCanvas.width / 2,
      stripCanvas.height - margin - 45
    );

    return stripCanvas;
  });
}

async function makePhotoStrip() {
  if (capturedPhotos.length !== TOTAL_PHOTOS) {
    setStatus("Please take all 3 photos first.");
    return;
  }

  setButtonDisabled(makeStripButton, true);
  setStatus("Creating your photo strip...");

  try {
    const stripCanvas = await createPhotoStripCanvas();

    if (!stripCanvas) return;

    if (photoStrip) {
      photoStrip.innerHTML = "";

      const image = document.createElement("img");
      image.src = stripCanvas.toDataURL("image/jpeg", 0.95);
      image.alt = "Your wedding photo strip";
      image.className = "photo-strip-result";

      photoStrip.appendChild(image);
      showElement(photoStrip);
    }

    showElement(downloadButton);

    if (downloadButton) {
      downloadButton.disabled = false;
    }

    setStatus("Your photo strip is ready to download!");

  } catch (error) {
    console.error("Photo strip error:", error);
    setStatus("Unable to create photo strip. Please try again.");
  } finally {
    setButtonDisabled(makeStripButton, false);
  }
}

// ============================================================
// DOWNLOAD PHOTO STRIP
// ============================================================

async function downloadPhotoStrip() {
  try {
    const stripCanvas = await createPhotoStripCanvas();

    if (!stripCanvas) return;

    const link = document.createElement("a");

    link.download = "syazwan-and-syilah-photo-strip.jpg";
    link.href = stripCanvas.toDataURL("image/jpeg", 0.95);

    document.body.appendChild(link);
    link.click();
    link.remove();

    setStatus("Photo strip downloaded!");

  } catch (error) {
    console.error("Download error:", error);
    setStatus("Unable to download photo strip.");
  }
}

// ============================================================
// RETAKE / START AGAIN
// ============================================================

function startAgain() {
  if (isCapturing) return;

  capturedPhotos = [];

  if (photoPreview) {
    photoPreview.innerHTML = "";
    hideElement(photoPreview);
  }

  if (photoStrip) {
    photoStrip.innerHTML = "";
    hideElement(photoStrip);
  }

  hideElement(downloadButton);
  hideElement(makeStripButton);
  hideElement(retakeButton);

  if (captureButton) {
    captureButton.disabled = !cameraStream;
  }

  setStatus(
    cameraStream
      ? "Ready! Press the shutter to capture 3 photos."
      : "Start the camera to begin."
  );
}

// ============================================================
// SUPABASE PHOTO UPLOAD
// ============================================================

// Update these names if your Supabase database uses different
// bucket or table names.
const STORAGE_BUCKET = "photos";
const GALLERY_TABLE = "photos";

async function uploadPhotoStrip() {
  if (!supabaseClient) {
    console.warn("Supabase is not configured.");
    return null;
  }

  try {
    const stripCanvas = await createPhotoStripCanvas();

    if (!stripCanvas) return null;

    const blob = await new Promise((resolve) => {
      stripCanvas.toBlob(resolve, "image/jpeg", 0.95);
    });

    if (!blob) {
      throw new Error("Could not convert strip to an image.");
    }

    const fileName =
      `wedding-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.jpg`;

    const { data: uploadData, error: uploadError } =
      await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: false
        });

    if (uploadError) throw uploadError;

    const { data: publicData } =
      supabaseClient.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(uploadData.path);

    const imageUrl = publicData.publicUrl;

    const { error: insertError } = await supabaseClient
      .from(GALLERY_TABLE)
      .insert({
        image_url: imageUrl,
        created_at: new Date().toISOString()
      });

    if (insertError) throw insertError;

    setStatus("Your photo strip was shared with the gallery!");

    return imageUrl;

  } catch (error) {
    console.error("Upload error:", error);
    setStatus(
      "Photo strip created, but sharing failed. Check your Supabase settings."
    );

    return null;
  }
}

// ============================================================
// LOAD SHARED GALLERY
// ============================================================

async function loadGallery() {
  if (!galleryElement) return;

  if (!supabaseClient) {
    galleryElement.textContent =
      "The shared gallery is currently unavailable.";
    return;
  }

  galleryElement.textContent = "Loading gallery...";

  try {
    const { data, error } = await supabaseClient
      .from(GALLERY_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    galleryElement.innerHTML = "";

    if (!data || data.length === 0) {
      galleryElement.textContent =
        "No photos have been shared yet. Be the first!";
      return;
    }

    data.forEach((photo) => {
      if (!photo.image_url) return;

      const image = document.createElement("img");
      image.src = photo.image_url;
      image.alt = "Wedding guest photo";
      image.loading = "lazy";
      image.className = "gallery-photo";

      galleryElement.appendChild(image);
    });

  } catch (error) {
    console.error("Gallery loading error:", error);
    galleryElement.textContent =
      "Unable to load the gallery right now.";
  }
}

// ============================================================
// GUESTBOOK
// ============================================================

async function submitGuestbookMessage(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setStatus("Guestbook is currently unavailable.");
    return;
  }

  const nameInput = getElement(
    "guestName",
    "guestbookName",
    "name"
  );

  const messageInput = getElement(
    "guestMessage",
    "guestbookMessage",
    "message"
  );

  const name = nameInput?.value.trim() || "";
  const message = messageInput?.value.trim() || "";

  if (!name || !message) {
    setStatus("Please enter your name and a message.");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("guestbook")
      .insert({
        name,
        message,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    if (nameInput) nameInput.value = "";
    if (messageInput) messageInput.value = "";

    setStatus("Thank you! Your message has been saved.");

  } catch (error) {
    console.error("Guestbook error:", error);
    setStatus(
      "Unable to save your message. Please try again."
    );
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

if (startCameraButton) {
  startCameraButton.addEventListener("click", startCamera);
}

if (stopCameraButton) {
  stopCameraButton.addEventListener("click", stopCamera);
}

if (captureButton) {
  // One click starts the complete 3-photo sequence.
  captureButton.addEventListener(
    "click",
    capturePhotosAutomatically
  );
}

if (makeStripButton) {
  makeStripButton.addEventListener("click", makePhotoStrip);
}

if (downloadButton) {
  downloadButton.addEventListener("click", downloadPhotoStrip);
}

if (retakeButton) {
  retakeButton.addEventListener("click", startAgain);
}

if (guestbookForm) {
  guestbookForm.addEventListener(
    "submit",
    submitGuestbookMessage
  );
}

// Also support buttons that use IDs instead of form buttons.
const uploadButton = getElement("uploadButton", "shareButton");

if (uploadButton) {
  uploadButton.addEventListener("click", uploadPhotoStrip);
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initialiseSupabase();

  if (captureButton) {
    captureButton.disabled = true;
  }

  hideElement(countdownElement);
  hideElement(photoPreview);
  hideElement(photoStrip);
  hideElement(downloadButton);
  hideElement(makeStripButton);
  hideElement(retakeButton);
  hideElement(stopCameraButton);

  setStatus("Welcome! Start the camera when you're ready.");
});

// Stop the camera when the page is closed or refreshed.
window.addEventListener("beforeunload", stopCamera);