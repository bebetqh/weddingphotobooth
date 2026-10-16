/* =====================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Six Templates | Live Preview | Supabase Gallery
   Camera Capture | PNG Download | Guestbook
===================================================== */

// =====================================================
// 1. CONFIGURATION
// =====================================================

const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

const COUPLE_NAMES = "SYAHLEN ♥ ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let supabaseClient = null;
let cameraStream = null;
let capturedPhotos = [];
let selectedTemplate = "film";
let latestStripData = null;
let busy = false;
let cameraStarting = false;
let previewCanvas = null;
let previewRenderId = 0;
let galleryRequest = 0;
let guestbookRequest = 0;

const views = {
    photos: $("#photosView"),
    photobooth: $("#photoboothView"),
    result: $("#resultView"),
    guestbook: $("#guestbookView")
};

// =====================================================
// 2. HELPERS
// =====================================================

function setMessage(selector, message) {
    const element = $(selector);
    if (element) element.textContent = message;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeText(text, className = "muted") {
    const element = document.createElement("p");
    element.className = className;
    element.textContent = text;
    return element;
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

function centerText(ctx, text, x, y, font, color) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawHeart(ctx, x, y, size, color, outline = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 30, size / 30);
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-25, -7, -15, -20, 0, -8);
    ctx.bezierCurveTo(15, -20, 25, -7, 0, 10);

    if (outline) {
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
        const r = i % 2 === 0 ? radius : radius * 0.42;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
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
        const angle = i * Math.PI * 2 / 5;
        ctx.beginPath();
        ctx.ellipse(
            Math.cos(angle) * radius * 0.5,
            Math.sin(angle) * radius * 0.5,
            radius * 0.35,
            radius * 0.62,
            angle,
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

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Could not load photo."));
        image.src = src;
    });
}

// =====================================================
// 3. SIX PHOTO STRIP TEMPLATES
// =====================================================

const STRIP_TEMPLATES = {
    film: {
        name: "Film Frame",
        background: "#101010",
        ink: "#fffaf0",
        border: "#d9bd94"
    },
    minimalist: {
        name: "Minimalist White",
        background: "#fffefe",
        ink: "#292522",
        border: "#e6e1dc"
    },
    doodle: {
        name: "Doodle Style",
        background: "#fff9ee",
        ink: "#292522",
        border: "#292522"
    },
    blackwhite: {
        name: "Black & White",
        background: "#fffefa",
        ink: "#171717",
        border: "#272727"
    },
    elegant: {
        name: "Elegant Serif",
        background: "#f7eee7",
        ink: "#28201d",
        border: "#ddcabe"
    },
    chalkboard: {
        name: "Chalkboard",
        background: "#171717",
        ink: "#fffdf6",
        border: "#f4f0e6"
    }
};

function getTemplate() {
    return STRIP_TEMPLATES[selectedTemplate] || STRIP_TEMPLATES.film;
}

// =====================================================
// 4. SUPABASE
// =====================================================

function initialiseSupabase() {
    if (!window.supabase?.createClient) {
        console.error("Supabase SDK did not load.");
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

// =====================================================
// 5. NAVIGATION
// =====================================================

function showView(name) {
    if (!views[name]) return;

    Object.values(views).forEach(view => view?.classList.remove("active"));
    views[name].classList.add("active");

    $$(".nav-tab").forEach(button => {
        const active = button.dataset.page === name;
        button.classList.toggle("active", active);

        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
    });

    $("#navTabs")?.classList.remove("open");
    $("#menuButton")?.setAttribute("aria-expanded", "false");

    if (name !== "photobooth") stopCamera();
    if (name === "photos") loadGallery();
    if (name === "guestbook") loadGuestbook();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (!button) return;

    event.preventDefault();
    showView(button.dataset.page);

    if (
        button.dataset.page === "photobooth" &&
        button.classList.contains("primary-button")
    ) {
        startCamera();
    }
});

$("#menuButton")?.addEventListener("click", () => {
    const nav = $("#navTabs");
    if (!nav) return;

    const open = nav.classList.toggle("open");
    $("#menuButton").setAttribute("aria-expanded", String(open));
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        $("#navTabs")?.classList.remove("open");
        $("#menuButton")?.setAttribute("aria-expanded", "false");
    }
});

// =====================================================
// 6. CAMERA
// =====================================================

async function startCamera() {
    const video = $("#cameraVideo");
    const startButton = $("#startCamera");

    if (!video || cameraStarting || cameraStream) return;

    if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("#cameraStatus", "Camera unavailable");
        setMessage("#cameraHelp", "Use HTTPS or localhost to access the camera.");
        return;
    }

    cameraStarting = true;
    if (startButton) startButton.disabled = true;

    setMessage("#cameraStatus", "Opening camera...");

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 960 }
            },
            audio: false
        });

        video.srcObject = cameraStream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        video.classList.add("ready");

        const placeholder = $("#cameraPlaceholder");
        if (placeholder) placeholder.style.display = "none";

        setMessage("#cameraStatus", "Camera is ready");
        setMessage("#cameraHelp", "Press the shutter to take three photos.");

    } catch (error) {
        console.error("Camera error:", error);
        stopCamera();

        setMessage("#cameraStatus", "Camera unavailable");

        const errors = {
            NotAllowedError: "Allow camera access in your browser settings.",
            NotFoundError: "No camera was found on this device.",
            NotReadableError: "Your camera may be in use by another application."
        };

        setMessage(
            "#cameraHelp",
            errors[error.name] || "Could not open camera. Check permissions and HTTPS."
        );
    } finally {
        cameraStarting = false;
        if (startButton) startButton.disabled = false;
        renderSlots();
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

    const placeholder = $("#cameraPlaceholder");
    if (placeholder) placeholder.style.display = "flex";

    const captureButton = $("#captureButton");
    if (captureButton) captureButton.disabled = true;

    setMessage("#cameraStatus", "Camera not started");
}

$("#startCamera")?.addEventListener("click", startCamera);
window.addEventListener("beforeunload", stopCamera);

// =====================================================
// 7. TAKE THREE PHOTOS
// =====================================================

async function countdown(seconds = 3) {
    const element = $("#countdown");
    if (!element) return delay(seconds * 1000);

    element.classList.add("show");

    try {
        for (let i = seconds; i >= 1; i--) {
            element.textContent = String(i);
            await delay(1000);
        }

        element.textContent = "♥";
        await delay(300);
    } finally {
        element.classList.remove("show");
        element.textContent = "";
    }
}

async function takeSnapshot() {
    const video = $("#cameraVideo");
    const canvas = $("#captureCanvas");

    if (!cameraStream || !video?.videoWidth || !canvas) {
        throw new Error("Camera is not ready.");
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not access the capture canvas.");

    // Mirror the photo to match the selfie preview.
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.93);
}

function renderSlots() {
    $$("#snapSlots .snap-slot").forEach((slot, index) => {
        slot.replaceChildren();

        if (capturedPhotos[index]) {
            const image = document.createElement("img");
            image.src = capturedPhotos[index];
            image.alt = `Captured photo ${index + 1}`;
            slot.appendChild(image);
        } else {
            slot.textContent = String(index + 1);
        }
    });

    const captureButton = $("#captureButton");
    const retakeButton = $("#retakeButton");
    const finishButton = $("#finishButton");

    if (captureButton) {
        captureButton.disabled =
            !cameraStream || capturedPhotos.length >= 3 || busy;
    }

    if (retakeButton) {
        retakeButton.disabled = capturedPhotos.length === 0 || busy;
    }

    if (finishButton) {
        finishButton.disabled = capturedPhotos.length !== 3 || busy;
    }

    if (capturedPhotos.length === 3) {
        setMessage("#cameraStatus", "All three photos captured");
        setMessage("#cameraHelp", "Your photos are ready! Make your strip.");
    } else if (cameraStream) {
        setMessage(
            "#cameraStatus",
            `Ready · ${capturedPhotos.length} of 3 photos`
        );
    }

    updatePhotostripPreview();
}

$("#captureButton")?.addEventListener("click", async () => {
    if (!cameraStream || busy || capturedPhotos.length >= 3) return;

    busy = true;
    renderSlots();

    try {
        while (capturedPhotos.length < 3 && cameraStream) {
            const number = capturedPhotos.length + 1;

            setMessage("#cameraHelp", `Get ready for photo ${number} of 3!`);
            await countdown(3);

            if (!cameraStream) break;

            capturedPhotos.push(await takeSnapshot());
            renderSlots();

            if (capturedPhotos.length < 3) await delay(700);
        }
    } catch (error) {
        console.error(error);
        setMessage("#cameraHelp", error.message || "Could not capture photos.");
    } finally {
        busy = false;
        renderSlots();
    }
});

// =====================================================
// 8. DRAWING HELPERS
// =====================================================

function drawCrop(ctx, image, x, y, width, height, monochrome = false) {
    const sourceRatio = image.width / image.height;
    const targetRatio = width / height;

    let sx = 0, sy = 0, sw = image.width, sh = image.height;

    if (sourceRatio > targetRatio) {
        sw = image.height * targetRatio;
        sx = (image.width - sw) / 2;
    } else {
        sh = image.width / targetRatio;
        sy = (image.height - sh) / 2;
    }

    ctx.save();
    ctx.filter = monochrome ? "grayscale(100%) contrast(1.04)" : "none";
    ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
    ctx.restore();
}

function drawDecorations(ctx, width, height, template) {
    const color = template.ink;

    if (selectedTemplate === "film") {
        for (let y = 36; y < height - 30; y += 30) {
            roundedRect(ctx, 22, y, 13, 17, 2, "#e5d0ad");
            roundedRect(ctx, width - 35, y, 13, 17, 2, "#e5d0ad");
        }
    }

    if (selectedTemplate === "doodle") {
        const symbols = ["♡", "✧", "☆", "✿", "✦"];

        ctx.save();
        ctx.fillStyle = color;
        ctx.font = "28px serif";
        ctx.textAlign = "center";

        for (let i = 0; i < 12; i++) {
            const x = 32 + (i * 79) % (width - 64);
            const y = 210 + (i * 127) % (height - 350);
            ctx.fillText(symbols[i % symbols.length], x, y);
        }

        ctx.restore();
    }

    if (selectedTemplate === "elegant") {
        drawFlower(ctx, 52, 48, 16, "#a98e7d");
        drawFlower(ctx, width - 52, 48, 16, "#a98e7d");
        drawFlower(ctx, 52, height - 100, 16, "#a98e7d");
        drawFlower(ctx, width - 52, height - 100, 16, "#a98e7d");
    }

    if (selectedTemplate === "blackwhite") {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(80, height - 145);
        ctx.lineTo(width / 2 - 30, height - 145);
        ctx.moveTo(width / 2 + 30, height - 145);
        ctx.lineTo(width - 80, height - 145);
        ctx.stroke();
        drawHeart(ctx, width / 2, height - 145, 30, color, true);
        ctx.restore();
    }

    if (selectedTemplate === "chalkboard") {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(49, 43, width - 98, height - 86);
        ctx.setLineDash([]);
        ctx.restore();
    }
}

// =====================================================
// 9. COMPLETE PHOTO STRIP RENDERER
// Used for both live preview and final output.
// =====================================================

async function drawPhotostrip(canvas, photos = [], options = {}) {
    if (!canvas) throw new Error("Photostrip canvas is missing.");

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the photostrip.");

    const width = canvas.width;
    const height = canvas.height;
    const theme = getTemplate();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    drawDecorations(ctx, width, height, theme);

    const isFilm = selectedTemplate === "film";
    const isDoodle = selectedTemplate === "doodle";
    const isBW = selectedTemplate === "blackwhite";
    const isElegant = selectedTemplate === "elegant";
    const isChalk = selectedTemplate === "chalkboard";
    const isMinimal = selectedTemplate === "minimalist";

    // Header
    if (isFilm) {
        centerText(ctx, COUPLE_NAMES, width / 2, 72,
            "600 20px 'DM Sans', sans-serif", theme.ink);
        centerText(ctx, "Just Married", width / 2, 123,
            "italic 35px 'Playfair Display', Georgia, serif", theme.ink);
    } else if (isMinimal) {
        centerText(ctx, "S Y A H L E N  ♥  A T I Q A H", width / 2, 80,
            "500 21px 'DM Sans', sans-serif", theme.ink);
        centerText(ctx, "OUR WEDDING DAY", width / 2, 126,
            "14px 'DM Sans', sans-serif", theme.ink);
    } else if (isDoodle) {
        centerText(ctx, "Syahlen & Atiqah", width / 2, 95,
            "bold 48px 'Caveat', cursive", theme.ink);
        drawHeart(ctx, width - 105, 92, 27, theme.ink, true);
        drawStar(ctx, 95, 90, 14, theme.ink);
    } else if (isBW || isElegant) {
        const font = "500 28px 'Playfair Display', Georgia, serif";
        centerText(ctx, "S Y A H L E N", width / 2, 75, font, theme.ink);
        centerText(ctx, "&", width / 2, 112,
            "italic 28px 'Playfair Display', Georgia, serif", theme.ink);
        centerText(ctx, "A T I Q A H", width / 2, 149, font, theme.ink);
    } else if (isChalk) {
        centerText(ctx, "SYAHLEN", width / 2, 75,
            "bold 49px 'Caveat', cursive", theme.ink);
        centerText(ctx, "& ATIQAH", width / 2, 126,
            "bold 43px 'Caveat', cursive", theme.ink);
        drawHeart(ctx, 95, 84, 27, theme.ink, true);
        drawStar(ctx, width - 92, 82, 15, theme.ink);
    }

    // Three photos
    const margin = 68;
    const photoWidth = width - margin * 2;
    const photoHeight = 365;
    const gap = 22;
    const firstY = 195;

    for (let i = 0; i < 3; i++) {
        const x = margin;
        const y = firstY + i * (photoHeight + gap);

        if (isFilm) {
            ctx.fillStyle = "#f8f3ea";
            ctx.fillRect(x - 7, y - 7, photoWidth + 14, photoHeight + 14);
        } else {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x - 5, y - 5, photoWidth + 10, photoHeight + 10);
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = isElegant ? 1 : 2;
            ctx.strokeRect(x - 5, y - 5, photoWidth + 10, photoHeight + 10);
        }

        if (photos[i]) {
            const image = await loadImage(photos[i]);
            drawCrop(ctx, image, x, y, photoWidth, photoHeight, isBW);
        } else {
            let start = "#e8d9ce";
            let end = "#cbb8ab";

            if (isFilm) {
                start = "#625957";
                end = "#302b2a";
            } else if (isDoodle) {
                start = "#f1e7da";
                end = "#d9c6b6";
            } else if (isChalk) {
                start = "#444444";
                end = "#242424";
            } else if (isBW) {
                start = "#e5e5e5";
                end = "#bcbcbc";
            } else if (isElegant) {
                start = "#e9dcd1";
                end = "#cdb8a8";
            }

            const gradient = ctx.createLinearGradient(x, y, x, y + photoHeight);
            gradient.addColorStop(0, start);
            gradient.addColorStop(1, end);
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, photoWidth, photoHeight);

            centerText(ctx, `PHOTO ${i + 1}`, width / 2, y + photoHeight / 2 - 8,
                isDoodle || isChalk
                    ? "bold 32px 'Caveat', cursive"
                    : "italic 25px 'Playfair Display', Georgia, serif",
                isFilm || isChalk ? "#fffaf0" : theme.ink);

            centerText(ctx, "YOUR MEMORY HERE", width / 2,
                y + photoHeight / 2 + 27,
                "12px 'DM Sans', sans-serif",
                isFilm || isChalk ? "#fffaf0" : theme.ink);
        }

        if (isFilm) {
            ctx.strokeStyle = "#d9bd94";
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, photoWidth, photoHeight);
        }
    }

    // Footer positioned close to the third photo to avoid excess blank space.
    const lastPhotoBottom = firstY + 3 * photoHeight + 2 * gap;
    const footerY = lastPhotoBottom + 38;

    if (isFilm) {
        drawHeart(ctx, width / 2, footerY + 3, 32, theme.ink, true);
        centerText(ctx, WEDDING_DATE, width / 2, footerY + 50,
            "italic 20px 'DM Sans', sans-serif", theme.ink);
    } else if (isMinimal) {
        centerText(ctx, WEDDING_DATE, width / 2, footerY + 10,
            "16px 'DM Sans', sans-serif", theme.ink);
        drawHeart(ctx, width / 2, footerY + 50, 25, theme.ink);
    } else if (isDoodle) {
        drawHeart(ctx, width / 2 - 18, footerY + 5, 34, theme.ink, true);
        drawHeart(ctx, width / 2 + 18, footerY + 5, 34, theme.ink, true);
        centerText(ctx, WEDDING_DATE, width / 2, footerY + 55,
            "20px 'Caveat', cursive", theme.ink);
    } else if (isBW) {
        drawHeart(ctx, width / 2, footerY + 4, 37, theme.ink, true);
        centerText(ctx, WEDDING_DATE, width / 2, footerY + 53,
            "italic 18px 'DM Sans', sans-serif", theme.ink);
    } else if (isElegant) {
        centerText(ctx, WEDDING_DATE, width / 2, footerY + 8,
            "italic 18px 'Playfair Display', Georgia, serif", theme.ink);
        drawFlower(ctx, width / 2, footerY + 60, 13, "#8f7b6b");
    } else if (isChalk) {
        drawHeart(ctx, width / 2, footerY + 3, 36, theme.ink, true);
        centerText(ctx, WEDDING_DATE, width / 2, footerY + 53,
            "bold 24px 'Caveat', cursive", theme.ink);
    }

    // Decorative bottom area fills the empty space.
    ctx.save();
    ctx.strokeStyle = theme.border;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(105, height - 75);
    ctx.lineTo(width / 2 - 80, height - 75);
    ctx.moveTo(width / 2 + 80, height - 75);
    ctx.lineTo(width - 105, height - 75);
    ctx.stroke();
    ctx.restore();

    drawHeart(ctx, width / 2, height - 75, 22, theme.ink, true);

    centerText(ctx, "MADE WITH LOVE · 2026", width / 2, height - 40,
        isElegant
            ? "14px 'Playfair Display', Georgia, serif"
            : "12px 'DM Sans', sans-serif",
        theme.ink);

    return canvas.toDataURL("image/png");
}

// =====================================================
// 10. LIVE PREVIEW
// =====================================================

function createPreviewArea() {
    const stage = $(".live-preview-stage");
    if (!stage) return;

    let canvas = $("#liveStripPreviewCanvas");

    if (!canvas) {
        const oldPreview = $("#liveStripPreview");

        canvas = document.createElement("canvas");
        canvas.id = "liveStripPreviewCanvas";
        canvas.width = 600;
        canvas.height = 1800;
        canvas.setAttribute(
            "aria-label",
            "Live preview of the selected wedding photostrip"
        );

        canvas.style.display = "block";
        canvas.style.width = "100%";
        canvas.style.maxWidth = "270px";
        canvas.style.height = "auto";
        canvas.style.margin = "0 auto";
        canvas.style.boxShadow = "0 6px 20px rgba(0,0,0,0.13)";

        if (oldPreview) oldPreview.replaceWith(canvas);
        else stage.appendChild(canvas);
    }

    previewCanvas = canvas;
}

async function updatePhotostripPreview() {
    if (!previewCanvas) return;

    const renderId = ++previewRenderId;
    const theme = getTemplate();

    setMessage(
        "#livePreviewStatus",
        `Previewing ${theme.name} style · ${capturedPhotos.length} of 3 photos captured.`
    );

    try {
        await drawPhotostrip(previewCanvas, capturedPhotos, { preview: true });

        if (renderId !== previewRenderId) return;
    } catch (error) {
        console.error("Preview error:", error);
        setMessage("#livePreviewStatus", "Could not render the preview.");
    }
}

// =====================================================
// 11. TEMPLATE SELECTION
// =====================================================

function selectTemplate(button) {
    if (!button?.dataset.template) return;

    const template = button.dataset.template;
    if (!STRIP_TEMPLATES[template]) return;

    selectedTemplate = template;

    $$(".template-option").forEach(option => {
        const active = option === button;
        option.classList.toggle("selected", active);
        option.setAttribute("aria-pressed", String(active));
    });

    const name = getTemplate().name;
    setMessage("#templateStatus", `${name} style selected.`);
    updatePhotostripPreview();
}

$$(".template-option").forEach(button => {
    button.addEventListener("click", () => selectTemplate(button));
});

// =====================================================
// 12. RESET PHOTOS
// =====================================================

function resetPhotos() {
    capturedPhotos = [];
    latestStripData = null;

    const canvas = $("#stripCanvas");
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);

    setMessage("#resultMessage", "");
    setMessage("#cameraHelp", cameraStream
        ? "Press the shutter to take three photos."
        : "Turn on your camera to get started.");

    const downloadButton = $("#downloadButton");
    if (downloadButton) downloadButton.disabled = false;

    const uploadButton = $("#uploadButton");
    if (uploadButton) {
        uploadButton.disabled = false;
        uploadButton.textContent = "☁ Upload to wedding gallery";
    }

    renderSlots();
}

$("#retakeButton")?.addEventListener("click", resetPhotos);

// =====================================================
// 13. CREATE FINAL PHOTO STRIP
// =====================================================

$("#finishButton")?.addEventListener("click", async () => {
    if (busy || capturedPhotos.length !== 3) return;

    busy = true;

    const button = $("#finishButton");
    if (button) {
        button.disabled = true;
        button.textContent = "Creating strip...";
    }

    try {
        const canvas = $("#stripCanvas");
        if (!canvas) throw new Error("Final photostrip canvas is missing.");

        latestStripData = await drawPhotostrip(canvas, capturedPhotos);
        showView("result");
    } catch (error) {
        console.error("Photostrip error:", error);
        alert(error.message || "Could not create your photo strip.");
    } finally {
        busy = false;
        if (button) button.textContent = "Make my photo strip →";
        renderSlots();
    }
});

// =====================================================
// 14. DOWNLOAD PHOTO STRIP AS PNG
// =====================================================

$("#downloadButton")?.addEventListener("click", async () => {
    const canvas = $("#stripCanvas");
    const button = $("#downloadButton");

    if (!canvas || !latestStripData) {
        setMessage("#resultMessage", "Create your photo strip before downloading.");
        return;
    }

    try {
        if (button) button.disabled = true;

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(result => {
                if (result) resolve(result);
                else reject(new Error("Could not prepare PNG file."));
            }, "image/png");
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "syahlen-atiqah-wedding-photo-strip.png";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1500);

        setMessage("#resultMessage", "Your photo strip is ready to save!");
    } catch (error) {
        console.error("Download error:", error);
        setMessage("#resultMessage", "Download failed. Please try again.");
    } finally {
        if (button) button.disabled = false;
    }
});

// =====================================================
// 15. IMAGE UPLOAD HELPERS
// =====================================================

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(",");
    const match = parts[0].match(/:(.*?);/);

    if (!match) throw new Error("Invalid image data.");

    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: match[1] });
}

function safeFileName() {
    const uuid = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${Date.now()}-${uuid}.png`;
}

// =====================================================
// 16. UPLOAD PHOTO STRIP TO SUPABASE
// =====================================================

async function uploadPhotoStrip() {
    if (!latestStripData || busy) return;

    if (!supabaseClient) {
        setMessage("#resultMessage", "Gallery service is unavailable.");
        return;
    }

    busy = true;

    const button = $("#uploadButton");
    if (button) {
        button.disabled = true;
        button.textContent = "Uploading...";
    }

    setMessage("#resultMessage", "Uploading your photo strip...");

    const name = $("#guestName")?.value.trim().slice(0, 60) || "A wedding guest";
    const path = `photostrips/${safeFileName()}`;

    try {
        const blob = dataURLToBlob(latestStripData);

        const { error: uploadError } = await supabaseClient
            .storage.from(BUCKET)
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
            await supabaseClient.storage.from(BUCKET).remove([path]);
            throw insertError;
        }

        setMessage("#resultMessage", "Your photo strip has been uploaded!");
        if (button) button.textContent = "✓ Uploaded successfully";

        await loadGallery();
    } catch (error) {
        console.error("Upload error:", error);
        setMessage(
            "#resultMessage",
            `Upload failed: ${error.message || "Unknown error"}. Check Supabase settings.`
        );
        if (button) button.textContent = "Try uploading again";
    } finally {
        busy = false;
        if (button) button.disabled = false;
    }
}

$("#uploadButton")?.addEventListener("click", uploadPhotoStrip);

// =====================================================
// 17. WEDDING GALLERY
// =====================================================

async function loadGallery() {
    const grid = $("#photoGrid");
    const count = $("#photoCount");
    const requestId = ++galleryRequest;

    if (!grid) return;

    if (!supabaseClient) {
        if (count) count.textContent = "Unavailable";
        grid.replaceChildren(makeText("Gallery service is unavailable."));
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
        if (requestId !== galleryRequest) return;

        if (count) {
            count.textContent = `${data.length} ${data.length === 1 ? "photo" : "photos"}`;
        }

        grid.replaceChildren();

        if (!data.length) {
            grid.appendChild(makeText("No photos yet. Be the first to share a memory!"));
            return;
        }

        data.forEach(photo => {
            const { data: urlData } = supabaseClient
                .storage.from(BUCKET)
                .getPublicUrl(photo.image_path);

            const card = document.createElement("article");
            card.className = "photo-card uploaded-card";

            const image = document.createElement("img");
            image.src = urlData.publicUrl;
            image.alt = `Wedding photo shared by ${photo.name || "a guest"}`;
            image.loading = "lazy";
            image.style.cssText =
                "display:block;width:100%;height:245px;object-fit:contain;background:#efe6e0;padding:10px";

            const caption = document.createElement("p");
            caption.textContent = `Shared by ${photo.name || "A wedding guest"}`;

            card.append(image, caption);
            grid.appendChild(card);
        });
    } catch (error) {
        if (requestId !== galleryRequest) return;

        console.error("Gallery error:", error);
        if (count) count.textContent = "Unavailable";

        grid.replaceChildren(makeText(
            "Could not load gallery. Check your Supabase table, bucket and access policies."
        ));
    }
}

// =====================================================
// 18. GUESTBOOK
// =====================================================

async function loadGuestbook() {
    const list = $("#wishesList");
    const requestId = ++guestbookRequest;

    if (!list) return;

    if (!supabaseClient) {
        list.replaceChildren(makeText("Guestbook service is unavailable."));
        return;
    }

    list.replaceChildren(makeText("Loading wishes..."));

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
            list.appendChild(makeText("No wishes yet. Leave the first message!"));
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

        console.error("Guestbook loading error:", error);
        list.replaceChildren(makeText(
            "Could not load messages. Check the Supabase guestbook table and policies."
        ));
    }
}

$("#guestbookForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("#messageName")?.value.trim() || "";
    const message = $("#messageText")?.value.trim() || "";
    const button = $("#sendWishButton");

    if (!name || !message) {
        setMessage("#guestbookStatus", "Please enter your name and wishes.");
        return;
    }

    if (name.length > 50 || message.length > 400) {
        setMessage("#guestbookStatus", "Please shorten your name or message.");
        return;
    }

    if (!supabaseClient) {
        setMessage("#guestbookStatus", "Guestbook service is unavailable.");
        return;
    }

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
        setMessage("#guestbookStatus", "Your wishes have been shared. Thank you!");

        await loadGuestbook();
    } catch (error) {
        console.error("Guestbook submission error:", error);
        setMessage(
            "#guestbookStatus",
            `Could not send your message: ${error.message || "Unknown error"}.`
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Send your wishes ♡";
        }
    }
});

// =====================================================
// 19. TAKE ANOTHER SET
// =====================================================

$("#againButton")?.addEventListener("click", async () => {
    resetPhotos();

    const uploadButton = $("#uploadButton");
    if (uploadButton) {
        uploadButton.disabled = false;
        uploadButton.textContent = "☁ Upload to wedding gallery";
    }

    showView("photobooth");
    await startCamera();
});

// =====================================================
// 20. INITIALIZE
// =====================================================

function initialiseApp() {
    const ready = initialiseSupabase();

    createPreviewArea();

    const initialButton =
        $(`.template-option[data-template="${selectedTemplate}"]`);

    if (initialButton) {
        selectTemplate(initialButton);
    } else {
        const filmButton = $('.template-option[data-template="film"]');
        if (filmButton) selectTemplate(filmButton);
    }

    renderSlots();

    if (ready) {
        loadGallery();
        loadGuestbook();
    } else {
        $("#photoGrid")?.replaceChildren(
            makeText("Gallery service is unavailable. Please refresh.")
        );
        $("#wishesList")?.replaceChildren(
            makeText("Guestbook service is unavailable. Please refresh.")
        );
    }

    console.log("Wedding photobooth initialized successfully.");
}

initialiseApp();