/* =====================================================
   SYAHLEN & ATIQAH — WEDDING DIGITAL PHOTOBOOTH
   Six Photostrip Designs + Live Preview
   Supabase Gallery + Guestbook + PNG Download
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

const views = {
    photos: $("#photosView"),
    photobooth: $("#photoboothView"),
    result: $("#resultView"),
    guestbook: $("#guestbookView")
};

let supabaseClient = null;
let cameraStream = null;
let capturedPhotos = [];
let selectedTemplate = "film";
let latestStripData = "";

let busy = false;
let cameraStarting = false;
let captureSequence = false;
let galleryRequest = 0;
let guestbookRequest = 0;
let previewRenderId = 0;
let previewCanvas = null;


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
    const paragraph = document.createElement("p");
    paragraph.className = className;
    paragraph.textContent = text;
    return paragraph;
}

function roundedRect(ctx, x, y, w, h, radius, fill, stroke) {
    radius = Math.min(radius, w / 2, h / 2);

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
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

function drawCenteredText(ctx, text, x, y, font, color) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawHeart(ctx, x, y, size, color, stroke = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 30, size / 30);

    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-25, -7, -15, -20, 0, -8);
    ctx.bezierCurveTo(15, -20, 25, -7, 0, 10);

    if (stroke) {
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
        ctx.rotate(Math.PI * 2 / 5);
        ctx.beginPath();
        ctx.ellipse(
            0,
            -radius * 0.55,
            radius * 0.35,
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

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(
            new Error("Could not load a captured photo.")
        );

        image.src = src;
    });
}


// =====================================================
// 3. SIX PHOTO STRIP DESIGNS
// =====================================================

const STRIP_TEMPLATES = {
    film: {
        name: "Film Frame",
        background: "#101010",
        ink: "#fffaf0",
        border: "#e0c7a0",
        photoFrame: "#ffffff",
        decoration: "film"
    },

    minimalist: {
        name: "Minimalist White",
        background: "#fffefe",
        ink: "#222222",
        border: "#e6e1dc",
        photoFrame: "#ffffff",
        decoration: "minimalist"
    },

    doodle: {
        name: "Doodle Style",
        background: "#fff9ee",
        ink: "#202020",
        border: "#202020",
        photoFrame: "#ffffff",
        decoration: "doodle"
    },

    blackwhite: {
        name: "Black & White",
        background: "#fffefa",
        ink: "#171717",
        border: "#272727",
        photoFrame: "#ffffff",
        decoration: "blackwhite"
    },

    elegant: {
        name: "Elegant Serif",
        background: "#f7eee7",
        ink: "#28201d",
        border: "#ddcabe",
        photoFrame: "#ffffff",
        decoration: "elegant"
    },

    chalkboard: {
        name: "Chalkboard",
        background: "#171717",
        ink: "#fffdf6",
        border: "#f4f0e6",
        photoFrame: "#ffffff",
        decoration: "chalkboard"
    }
};

function getTemplate() {
    return STRIP_TEMPLATES[selectedTemplate] || STRIP_TEMPLATES.film;
}


// =====================================================
// 4. SUPABASE INITIALIZATION
// =====================================================

function initialiseSupabase() {
    if (!window.supabase?.createClient) {
        console.error("Supabase SDK did not load.");

        $("#photoGrid")?.replaceChildren(
            makeText("Gallery service is unavailable. Please refresh.")
        );

        $("#wishesList")?.replaceChildren(
            makeText("Guestbook service is unavailable. Please refresh.")
        );

        setMessage("#photoCount", "Unavailable");
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
    const targetView = views[name];
    if (!targetView) return;

    Object.values(views).forEach(view => {
        view?.classList.remove("active");
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

    $("#navTabs")?.classList.remove("open");
    $("#menuButton")?.setAttribute("aria-expanded", "false");

    if (name !== "photobooth") stopCamera();
    if (name === "photos") loadGallery();
    if (name === "guestbook") loadGuestbook();

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

$("#menuButton")?.addEventListener("click", () => {
    const nav = $("#navTabs");
    if (!nav) return;

    const open = nav.classList.toggle("open");

    $("#menuButton").setAttribute("aria-expanded", String(open));
});

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    $("#navTabs")?.classList.remove("open");
    $("#menuButton")?.setAttribute("aria-expanded", "false");
});


// =====================================================
// 6. CAMERA
// =====================================================

async function startCamera() {
    const video = $("#cameraVideo");
    const startButton = $("#startCamera");
    const placeholder = $("#cameraPlaceholder");

    if (!video || !startButton) return;

    if (cameraStream || cameraStarting) {
        if (cameraStream) {
            try {
                await video.play();
            } catch (error) {
                console.warn(error);
            }
        }

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
    startButton.disabled = true;

    setMessage("#cameraStatus", "Opening camera...");
    setMessage(
        "#cameraHelp",
        "Please allow camera access in your browser."
    );

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

        if (placeholder) placeholder.style.display = "none";

        setMessage("#cameraStatus", "Camera is ready");
        setMessage(
            "#cameraHelp",
            "Press the shutter to take three photos automatically."
        );
    } catch (error) {
        console.error("Camera error:", error);
        stopCamera();

        setMessage("#cameraStatus", "Camera unavailable");

        const messages = {
            NotAllowedError:
                "Camera permission was denied. Allow camera access in browser settings.",

            NotFoundError:
                "No camera was found on this device.",

            NotReadableError:
                "The camera may be in use by another application."
        };

        setMessage(
            "#cameraHelp",
            messages[error.name] ||
            "Could not open the camera. Check permissions and use HTTPS."
        );
    } finally {
        cameraStarting = false;
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

    if (video) {
        video.srcObject = null;
        video.classList.remove("ready");
    }

    const placeholder = $("#cameraPlaceholder");

    if (placeholder) placeholder.style.display = "flex";

    const startButton = $("#startCamera");

    if (startButton) startButton.disabled = false;

    setMessage("#cameraStatus", "Camera not started");

    const captureButton = $("#captureButton");

    if (captureButton) captureButton.disabled = true;

    captureSequence = false;
}

$("#startCamera")?.addEventListener("click", startCamera);

window.addEventListener("beforeunload", stopCamera);


// =====================================================
// 7. PHOTO CAPTURE
// =====================================================

async function countdown(seconds = 3) {
    const element = $("#countdown");

    if (!element) {
        await delay(seconds * 1000);
        return;
    }

    element.classList.add("show");

    try {
        for (let number = seconds; number >= 1; number--) {
            element.textContent = String(number);
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

    if (!cameraStream || !video?.videoWidth) {
        throw new Error("The camera is not ready.");
    }

    if (!canvas) {
        throw new Error("Capture canvas is missing.");
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Could not access the photo canvas.");
    }

    // Mirror the captured photo like a selfie preview.
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();

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

    const finishButton = $("#finishButton");
    const captureButton = $("#captureButton");
    const retakeButton = $("#retakeButton");

    if (finishButton) {
        finishButton.disabled = capturedPhotos.length !== 3 || busy;
    }

    if (captureButton) {
        captureButton.disabled =
            !cameraStream || capturedPhotos.length >= 3 || busy;
    }

    if (retakeButton) {
        retakeButton.disabled = capturedPhotos.length === 0 || busy;
    }

    if (capturedPhotos.length === 3) {
        setMessage("#cameraStatus", "All three photos captured");

        setMessage(
            "#cameraHelp",
            "Your photos are ready! Review your style and make your strip."
        );
    } else if (cameraStream) {
        setMessage(
            "#cameraStatus",
            `Ready · ${capturedPhotos.length} of 3 photos`
        );
    }

    updatePhotostripPreview();
}

$("#captureButton")?.addEventListener("click", async () => {
    if (
        !cameraStream ||
        busy ||
        captureSequence ||
        capturedPhotos.length >= 3
    ) {
        return;
    }

    busy = true;
    captureSequence = true;

    renderSlots();

    try {
        while (capturedPhotos.length < 3 && cameraStream) {
            const number = capturedPhotos.length + 1;

            setMessage(
                "#cameraHelp",
                `Get ready for photo ${number} of 3!`
            );

            await countdown(3);

            if (!cameraStream) break;

            const photo = await takeSnapshot();

            capturedPhotos.push(photo);
            renderSlots();

            if (capturedPhotos.length < 3) {
                await delay(700);
            }
        }
    } catch (error) {
        console.error("Capture error:", error);

        setMessage(
            "#cameraHelp",
            error.message || "Could not capture photos."
        );
    } finally {
        busy = false;
        captureSequence = false;
        renderSlots();
    }
});


// =====================================================
// 8. PHOTO DRAWING HELPERS
// =====================================================

function drawCrop(ctx, image, x, y, width, height, monochrome = false) {
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
        sy = (image.height - sh) / 2;
    }

    ctx.save();

    // Use a temporary canvas for dependable grayscale rendering.
    // This avoids relying on ctx.filter support in the output canvas.
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = Math.max(1, Math.round(width));
    cropCanvas.height = Math.max(1, Math.round(height));

    const cropCtx = cropCanvas.getContext("2d", {
        willReadFrequently: monochrome
    });

    if (!cropCtx) {
        ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
        ctx.restore();
        return;
    }

    cropCtx.drawImage(
        image,
        sx, sy, sw, sh,
        0, 0, cropCanvas.width, cropCanvas.height
    );

    if (monochrome) {
        const imageData = cropCtx.getImageData(
            0, 0, cropCanvas.width, cropCanvas.height
        );

        const pixels = imageData.data;

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            // Perceptual grayscale, with a slight contrast boost.
            let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            gray = (gray - 128) * 1.04 + 128;
            gray = Math.max(0, Math.min(255, gray));

            pixels[i] = gray;
            pixels[i + 1] = gray;
            pixels[i + 2] = gray;
        }

        cropCtx.putImageData(imageData, 0, 0);
    }

    ctx.drawImage(cropCanvas, x, y, width, height);
    ctx.restore();
}

function drawFilmSprockets(ctx, width, height) {
    ctx.fillStyle = "#e5d0ad";

    for (let y = 36; y < height - 30; y += 30) {
        roundedRect(ctx, 22, y, 13, 17, 2, "#e5d0ad");
        roundedRect(ctx, width - 35, y, 13, 17, 2, "#e5d0ad");
    }
}

function drawDoodleDecoration(ctx, width, height, color, chalk = false) {
    // Keep doodles in the narrow side gutters so they never cross a photo,
    // frame edge, divider, or footer text.
    const symbols = ["♡", "✧", "☆", "♡", "✿", "✦"];
    const sideX = [27, width - 27];
    const sideY = [270, 490, 710, 930, 1150];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = chalk ? "23px 'Caveat', cursive" : "24px serif";

    sideY.forEach((y, index) => {
        sideX.forEach((x, sideIndex) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(((index + sideIndex) % 3 - 1) * 0.08);
            ctx.fillText(
                symbols[(index * 2 + sideIndex) % symbols.length],
                0,
                0
            );
            ctx.restore();
        });
    });

    ctx.restore();
}

function drawChalkDecorations(ctx, width, height) {
    const color = "#f5f0e5";

    drawDoodleDecoration(ctx, width, height, color, true);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);

    // Inset the outer frame so it stays clear of the photo frames.
    ctx.strokeRect(49, 43, width - 98, height - 86);
    ctx.setLineDash([]);

    // Keep the small chalk signature clear of the bottom signature line.
    ctx.font = "italic 23px 'Caveat', cursive";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("made with love", width / 2, height - 118);
    ctx.restore();
}

function drawBotanicalDecoration(ctx, width, height, color) {
    drawFlower(ctx, 52, 48, 16, color);
    drawFlower(ctx, width - 52, 48, 16, color);
    drawLeaf(ctx, 32, 205, 30, color, false);
    drawLeaf(ctx, width - 32, 205, 30, color, true);
    drawLeaf(ctx, 35, height - 110, 30, color, false);
    drawLeaf(ctx, width - 35, height - 110, 30, color, true);
}

function drawBlackWhiteDecoration(ctx, width, height) {
    // The footer already contains a heart and divider. Keep extra decoration
    // in the side gutters instead of drawing through footer details.
    ctx.save();
    ctx.strokeStyle = "#282828";
    ctx.lineWidth = 1.5;

    [250, 620, 990, 1260].forEach((y, index) => {
        const side = index % 2 === 0 ? 1 : -1;

        ctx.beginPath();
        ctx.moveTo(28, y);
        ctx.lineTo(42, y - 8 * side);
        ctx.lineTo(35, y + 8 * side);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width - 28, y);
        ctx.lineTo(width - 42, y - 8 * side);
        ctx.lineTo(width - 35, y + 8 * side);
        ctx.stroke();
    });

    ctx.restore();
}

function drawTemplateDecorations(ctx, width, height, theme) {
    switch (theme.decoration) {
        case "film":
            drawFilmSprockets(ctx, width, height);
            break;
        case "minimalist":
            break;
        case "doodle":
            drawDoodleDecoration(ctx, width, height, "#292929");
            break;
        case "blackwhite":
            drawBlackWhiteDecoration(ctx, width, height);
            break;
        case "elegant":
            drawBotanicalDecoration(ctx, width, height, "#a98e7d");
            break;
        case "chalkboard":
            drawChalkDecorations(ctx, width, height);
            break;
    }
}


// =====================================================
// 9. DRAW THE COMPLETE PHOTOSTRIP
// =====================================================

async function drawPhotostrip(canvas, photos = [], options = {}) {
    if (!canvas) {
        throw new Error("Photostrip canvas is missing.");
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("Could not prepare the photostrip canvas.");
    }

    const width = canvas.width;
    const height = canvas.height;
    const theme = getTemplate();

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = selectedTemplate === "film" ? 3 : 2;
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    drawTemplateDecorations(ctx, width, height, theme);

    const isFilm = selectedTemplate === "film";
    const isChalk = selectedTemplate === "chalkboard";
    const isDoodle = selectedTemplate === "doodle";
    const isElegant = selectedTemplate === "elegant";
    const isBW = selectedTemplate === "blackwhite";
    const isMinimal = selectedTemplate === "minimalist";
    const ink = theme.ink;

    // Header
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;

    if (isFilm) {
        ctx.font = "600 20px 'DM Sans', sans-serif";
        ctx.fillText(COUPLE_NAMES, width / 2, 72);

        ctx.font = "italic 35px 'Playfair Display', Georgia, serif";
        ctx.fillText("Just Married", width / 2, 123);
    } else if (isMinimal) {
        ctx.font = "500 21px 'DM Sans', sans-serif";
        ctx.fillText("S Y A H L E N  ♥  A T I Q A H", width / 2, 80);

        ctx.font = "14px 'DM Sans', sans-serif";
        ctx.fillText("OUR WEDDING DAY", width / 2, 126);
    } else if (isDoodle) {
        ctx.font = "bold 48px 'Caveat', cursive";
        ctx.fillText("Syahlen & Atiqah", width / 2, 90);

        drawHeart(ctx, width - 105, 92, 27, ink, true);
        drawStar(ctx, 95, 90, 14, ink);
    } else if (isBW) {
        ctx.font = "500 28px 'Playfair Display', Georgia, serif";
        ctx.fillText("SY A H L E N", width / 2, 75);

        ctx.font = "italic 30px 'Playfair Display', Georgia, serif";
        ctx.fillText("&", width / 2, 112);

        ctx.font = "500 28px 'Playfair Display', Georgia, serif";
        ctx.fillText("A T I Q A H", width / 2, 149);
    } else if (isElegant) {
        ctx.font = "500 28px 'Playfair Display', Georgia, serif";
        ctx.fillText("SY A H L E N", width / 2, 75);

        ctx.font = "italic 25px 'Playfair Display', Georgia, serif";
        ctx.fillText("&", width / 2, 109);

        ctx.font = "500 28px 'Playfair Display', Georgia, serif";
        ctx.fillText("A T I Q A H", width / 2, 143);
    } else if (isChalk) {
        ctx.font = "bold 49px 'Caveat', cursive";
        ctx.fillText("SYAHLEN", width / 2, 75);

        ctx.font = "bold 43px 'Caveat', cursive";
        ctx.fillText("& ATIQAH", width / 2, 126);

        drawHeart(ctx, 95, 84, 27, ink, true);
        drawStar(ctx, width - 92, 82, 15, ink);
    }

    // Three photo frames
    const margin = 68;
    const photoWidth = width - margin * 2;
    const photoHeight = 365;
    const gap = 22;
    const firstY = 195;

    for (let index = 0; index < 3; index++) {
        const x = margin;
        const y = firstY + index * (photoHeight + gap);

        if (isFilm) {
            ctx.fillStyle = "#f8f3ea";
            ctx.fillRect(x - 7, y - 7, photoWidth + 14, photoHeight + 14);
        } else if (isDoodle || isChalk) {
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 3;
            ctx.strokeRect(x - 5, y - 5, photoWidth + 10, photoHeight + 10);
        } else if (isElegant) {
            ctx.fillStyle = "#fffdf9";
            ctx.fillRect(x - 6, y - 6, photoWidth + 12, photoHeight + 12);

            ctx.strokeStyle = "#d8c5b9";
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 6, y - 6, photoWidth + 12, photoHeight + 12);
        } else if (isBW) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x - 5, y - 5, photoWidth + 10, photoHeight + 10);

            ctx.strokeStyle = "#222222";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x - 5, y - 5, photoWidth + 10, photoHeight + 10);
        } else {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x - 4, y - 4, photoWidth + 8, photoHeight + 8);
        }

        if (photos[index]) {
            const image = await loadImage(photos[index]);

            // The Black & White template applies grayscale to every photo.
            drawCrop(
                ctx,
                image,
                x,
                y,
                photoWidth,
                photoHeight,
                isBW
            );
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

            const gradient = ctx.createLinearGradient(
                x, y, x, y + photoHeight
            );

            gradient.addColorStop(0, start);
            gradient.addColorStop(1, end);

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, photoWidth, photoHeight);

            drawCenteredText(
                ctx,
                options.preview ? `PHOTO ${index + 1}` : "PHOTO",
                width / 2,
                y + photoHeight / 2 - 8,
                isDoodle || isChalk
                    ? "bold 32px 'Caveat', cursive"
                    : "italic 25px 'Playfair Display', Georgia, serif",
                isFilm || isChalk ? "#fffaf0" : ink
            );

            drawCenteredText(
                ctx,
                "YOUR MEMORY HERE",
                width / 2,
                y + photoHeight / 2 + 27,
                "12px 'DM Sans', sans-serif",
                isFilm || isChalk ? "#fffaf0" : ink
            );
        }

        if (isFilm) {
            ctx.strokeStyle = "#d9bd94";
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, photoWidth, photoHeight);
        }
    }

    // Footer: adjusted spacing to separate footer details from the photos.
    const photosBottom = firstY + 3 * photoHeight + 2 * gap;
    const footerTop = photosBottom + 34;
    const footerBottom = height - 132;
    const footerCenter = (footerTop + footerBottom) / 2;

    ctx.save();
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;

    if (isFilm || isChalk) ctx.setLineDash([5, 7]);

    ctx.beginPath();
    ctx.moveTo(100, footerTop + 10);
    ctx.lineTo(width / 2 - 45, footerTop + 10);
    ctx.moveTo(width / 2 + 45, footerTop + 10);
    ctx.lineTo(width - 100, footerTop + 10);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();

    if (isElegant) {
        drawFlower(ctx, width / 2, footerCenter - 38, 24, "#a98e7d");

        drawCenteredText(
            ctx, "A MEMORY TO KEEP FOREVER",
            width / 2, footerCenter + 10,
            "12px 'DM Sans', sans-serif", ink
        );

        drawCenteredText(
            ctx, WEDDING_DATE,
            width / 2, footerCenter + 48,
            "italic 20px 'Playfair Display', Georgia, serif", ink
        );

        drawLeaf(ctx, width / 2 - 12, footerCenter + 88, 24, "#a98e7d");
        drawLeaf(ctx, width / 2 + 12, footerCenter + 88, 24, "#a98e7d", true);
    } else if (isDoodle) {
        drawHeart(ctx, width / 2 - 25, footerCenter - 30, 32, ink, true);
        drawHeart(ctx, width / 2 + 25, footerCenter - 30, 32, ink, true);

        drawCenteredText(
            ctx, "A MEMORY TO KEEP FOREVER",
            width / 2, footerCenter + 10,
            "bold 22px 'Caveat', cursive", ink
        );

        drawCenteredText(
            ctx, WEDDING_DATE,
            width / 2, footerCenter + 48,
            "24px 'Caveat', cursive", ink
        );

        drawStar(ctx, 105, footerCenter + 20, 12, ink);
        drawStar(ctx, width - 105, footerCenter + 20, 12, ink);
    } else if (isChalk) {
        drawHeart(ctx, width / 2, footerCenter - 30, 38, ink, true);

        drawCenteredText(
            ctx, "A MEMORY TO KEEP FOREVER",
            width / 2, footerCenter + 12,
            "bold 28px 'Caveat', cursive", ink
        );

        drawCenteredText(
            ctx, WEDDING_DATE,
            width / 2, footerCenter + 52,
            "bold 25px 'Caveat', cursive", ink
        );

        drawStar(ctx, 105, footerCenter + 20, 14, ink);
        drawStar(ctx, width - 105, footerCenter + 20, 14, ink);
    } else if (isBW) {
        drawHeart(ctx, width / 2, footerCenter - 30, 36, ink, true);

        drawCenteredText(
            ctx, "A MEMORY TO KEEP FOREVER",
            width / 2, footerCenter + 10,
            "12px 'DM Sans', sans-serif", ink
        );

        drawCenteredText(
            ctx, WEDDING_DATE,
            width / 2, footerCenter + 48,
            "italic 20px 'Playfair Display', Georgia, serif", ink
        );
    } else if (isMinimal) {
        drawCenteredText(
            ctx, "A MEMORY TO KEEP FOREVER",
            width / 2, footerCenter - 18,
            "12px 'DM Sans', sans-serif", ink
        );

        drawCenteredText(
            ctx, WEDDING_DATE,
            width / 2, footerCenter + 20,
            "16px 'DM Sans', sans-serif", ink
        );

        drawHeart(ctx, width / 2, footerCenter + 60, 25, ink, false);
    } else {
        drawHeart(ctx, width / 2, footerCenter - 30, 34, ink, true);

        drawCenteredText(
            ctx, "A MEMORY TO KEEP FOREVER",
            width / 2, footerCenter + 10,
            "13px 'DM Sans', sans-serif", ink
        );

        drawCenteredText(
            ctx, WEDDING_DATE,
            width / 2, footerCenter + 48,
            "20px 'Playfair Display', Georgia, serif", ink
        );
    }

    // Bottom signature
    ctx.save();
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(90, height - 88);
    ctx.lineTo(width / 2 - 115, height - 88);
    ctx.moveTo(width / 2 + 115, height - 88);
    ctx.lineTo(width - 90, height - 88);
    ctx.stroke();

    ctx.restore();

    drawCenteredText(
        ctx,
        COUPLE_NAMES,
        width / 2,
        height - 62,
        isElegant || isBW
            ? "14px 'Playfair Display', Georgia, serif"
            : "12px 'DM Sans', sans-serif",
        ink
    );

    drawCenteredText(
        ctx,
        "MADE WITH LOVE · 2026",
        width / 2,
        height - 37,
        "10px 'DM Sans', sans-serif",
        ink
    );

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
        canvas.style.borderRadius = "3px";

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
        await drawPhotostrip(
            previewCanvas,
            capturedPhotos,
            { preview: true }
        );

        if (renderId !== previewRenderId) return;
    } catch (error) {
        console.error("Preview rendering error:", error);

        setMessage(
            "#livePreviewStatus",
            "Could not render the preview. Please try again."
        );
    }
}


// =====================================================
// 11. TEMPLATE SELECTION
// =====================================================

function selectTemplate(button) {
    if (!button?.dataset.template) return;

    const template = button.dataset.template;

    if (!STRIP_TEMPLATES[template]) {
        console.warn(`Unknown template "${template}".`);
        return;
    }

    selectedTemplate = template;

    $$(".template-option").forEach(option => {
        const active = option === button;

        option.classList.toggle("selected", active);
        option.setAttribute("aria-pressed", String(active));
    });

    const theme = getTemplate();

    setMessage("#templateStatus", `${theme.name} style selected.`);
    updatePhotostripPreview();
}

$$(".template-option").forEach(button => {
    button.addEventListener("click", () => selectTemplate(button));
});


// =====================================================
// 12. RESET / RETAKE PHOTOS
// =====================================================

function resetPhotos() {
    capturedPhotos = [];
    latestStripData = "";

    const canvas = $("#stripCanvas");

    if (canvas) {
        canvas.getContext("2d")?.clearRect(
            0, 0, canvas.width, canvas.height
        );
    }

    const downloadButton = $("#downloadButton");

    if (downloadButton) downloadButton.disabled = false;

    const uploadButton = $("#uploadButton");

    if (uploadButton) {
        uploadButton.disabled = false;
        uploadButton.textContent = "☁ Upload to wedding gallery";
    }

    setMessage("#resultMessage", "");

    setMessage(
        "#cameraHelp",
        cameraStream
            ? "Press the shutter to take three photos automatically."
            : "Turn on your camera to get started."
    );

    renderSlots();
}

$("#retakeButton")?.addEventListener("click", resetPhotos);


// =====================================================
// 13. MAKE THE FINAL PHOTO STRIP
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

        if (!canvas) {
            throw new Error("The final photo strip canvas is missing.");
        }

        latestStripData = await drawPhotostrip(
            canvas,
            capturedPhotos,
            { preview: false }
        );

        showView("result");
    } catch (error) {
        console.error("Strip rendering error:", error);

        alert(error.message || "Could not create your photo strip.");
    } finally {
        busy = false;

        if (button) {
            button.textContent = "Make my photo strip →";
        }

        renderSlots();
    }
});


// =====================================================
// 14. DOWNLOAD PHOTO STRIP
// =====================================================

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

    try {
        if (button) button.disabled = true;

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
        link.download = "syahlen-atiqah-wedding-photo-strip.png";

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(() => URL.revokeObjectURL(url), 1500);

        setMessage(
            "#resultMessage",
            "Your photo strip is ready to save!"
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


// =====================================================
// 15. CONVERT IMAGE DATA TO BLOB
// =====================================================

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(",");
    const match = parts[0].match(/:(.*?);/);

    if (!match) {
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

function safeFileName() {
    const uuid =
        window.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${Date.now()}-${uuid}.png`;
}


// =====================================================
// 16. UPLOAD PHOTO STRIP TO SUPABASE
// =====================================================

async function uploadPhotoStrip() {
    if (!latestStripData || busy) return;

    const button = $("#uploadButton");

    if (!supabaseClient) {
        setMessage(
            "#resultMessage",
            "Gallery service is unavailable. Please refresh and try again."
        );
        return;
    }

    busy = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Uploading...";
    }

    setMessage("#resultMessage", "Uploading your photo strip...");

    const path = `photostrips/${safeFileName()}`;
    const guestNameInput = $("#guestName");
    const name = guestNameInput?.value.trim().slice(0, 60) || "A wedding guest";

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

        const { error: insertError } = await supabaseClient
            .from(PHOTO_TABLE)
            .insert({ name, image_path: path });

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
            "Your photo strip has been uploaded to the wedding gallery!"
        );

        if (button) button.textContent = "✓ Uploaded successfully";

        await loadGallery();
    } catch (error) {
        console.error("Upload error:", error);

        setMessage(
            "#resultMessage",
            `Upload failed: ${error.message || "Unknown error"}. Check your Supabase bucket, table and access policies.`
        );

        if (button) button.textContent = "Try uploading again";
    } finally {
        busy = false;

        if (button) button.disabled = false;
    }
}

$("#uploadButton")?.addEventListener("click", uploadPhotoStrip);


// =====================================================
// 17. SHARED WEDDING PHOTO GALLERY
// =====================================================

async function loadGallery() {
    const grid = $("#photoGrid");
    const count = $("#photoCount");
    const requestId = ++galleryRequest;

    if (!grid) return;

    if (!supabaseClient) {
        if (count) count.textContent = "Unavailable";

        grid.replaceChildren(
            makeText("Gallery service is unavailable.")
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
        if (requestId !== galleryRequest) return;

        if (count) {
            count.textContent =
                `${data.length} ${data.length === 1 ? "photo" : "photos"}`;
        }

        grid.replaceChildren();

        if (!data.length) {
            grid.appendChild(
                makeText("No photos yet. Be the first to share a memory!")
            );
            return;
        }

        data.forEach(photo => {
            const { data: urlData } = supabaseClient
                .storage
                .from(BUCKET)
                .getPublicUrl(photo.image_path);

            const card = document.createElement("article");
            card.className = "photo-card uploaded-card";

            const image = document.createElement("img");

            image.src = urlData.publicUrl;
            image.alt =
                `Wedding photo shared by ${photo.name || "a guest"}`;
            image.loading = "lazy";

            image.style.cssText = `
                display: block;
                width: 100%;
                height: 245px;
                object-fit: contain;
                background: #efe6e0;
                padding: 10px;
            `;

            const caption = document.createElement("p");
            caption.textContent =
                `Shared by ${photo.name || "A wedding guest"}`;

            card.append(image, caption);
            grid.appendChild(card);
        });
    } catch (error) {
        if (requestId !== galleryRequest) return;

        console.error("Gallery error:", error);

        if (count) count.textContent = "Unavailable";

        grid.replaceChildren(
            makeText(
                "Could not load gallery. Check your Supabase table, bucket and access policies."
            )
        );
    }
}


// =====================================================
// 18. WEDDING GUESTBOOK
// =====================================================

async function loadGuestbook() {
    const list = $("#wishesList");
    const requestId = ++guestbookRequest;

    if (!list) return;

    if (!supabaseClient) {
        list.replaceChildren(
            makeText("Guestbook service is unavailable.")
        );
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
            list.appendChild(
                makeText("No wishes yet. Leave the first message!")
            );
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

        list.replaceChildren(
            makeText(
                "Could not load messages. Check the Supabase guestbook table and policies."
            )
        );
    }
}

$("#guestbookForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const nameInput = $("#messageName");
    const messageInput = $("#messageText");
    const button = $("#sendWishButton");

    const name = nameInput?.value.trim() || "";
    const message = messageInput?.value.trim() || "";

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
            "Guestbook service is unavailable. Refresh and try again."
        );
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

        setMessage(
            "#guestbookStatus",
            "Your wishes have been shared. Thank you!"
        );

        await loadGuestbook();
    } catch (error) {
        console.error("Guestbook submission error:", error);

        setMessage(
            "#guestbookStatus",
            `Could not send your message: ${error.message || "Unknown error"}. Check your Supabase insert policy.`
        );
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Send your wishes ♡";
        }
    }
});


// =====================================================
// 19. TAKE ANOTHER SET OF PHOTOS
// =====================================================

$("#againButton")?.addEventListener("click", async () => {
    resetPhotos();

    const uploadButton = $("#uploadButton");

    if (uploadButton) {
        uploadButton.disabled = false;
        uploadButton.textContent = "☁ Upload to wedding gallery";
    }

    setMessage("#resultMessage", "");

    showView("photobooth");

    await startCamera();
});


// =====================================================
// 20. INITIALIZE APPLICATION
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

        if (filmButton) {
            selectTemplate(filmButton);
        }
    }

    renderSlots();

    if (ready) {
        loadGallery();
        loadGuestbook();
    }

    console.log("Wedding photobooth initialized successfully.");
}

initialiseApp();