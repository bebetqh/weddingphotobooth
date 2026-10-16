/* =====================================================
   WEDDING DIGITAL PHOTOBOOTH
   Supabase + Live Photostrip Preview + Download
===================================================== */

// =====================================================
// 1. CONFIGURATION
// =====================================================

const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

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

let supabaseClient = null;
let cameraStream = null;
let capturedPhotos = [];
let selectedTemplate = "classic";
let latestStripData = "";

let busy = false;
let cameraStarting = false;
let captureSequence = false;
let galleryRequest = 0;
let guestbookRequest = 0;


// =====================================================
// 2. HELPERS
// =====================================================

function setMessage(selector, message) {
    const element = $(selector);

    if (element) {
        element.textContent = message;
    }
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

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


// =====================================================
// 3. TEMPLATE DESIGNS
// =====================================================

const STRIP_TEMPLATES = {
    classic: {
        name: "Classic",
        background: "#fffdf8",
        ink: "#51413b",
        border: "#e6d8ca",
        photoFrame: "#ffffff",
        decoration: "classic"
    },

    minimalist: {
        name: "Minimalist",
        background: "#ffffff",
        ink: "#292929",
        border: "#dedede",
        photoFrame: "#ffffff",
        decoration: "minimalist"
    },

    minimal: {
        name: "Minimalist",
        background: "#ffffff",
        ink: "#292929",
        border: "#dedede",
        photoFrame: "#ffffff",
        decoration: "minimalist"
    },

    aesthetic: {
        name: "Aesthetic",
        background: "#f4e9df",
        ink: "#78594f",
        border: "#d9bba9",
        photoFrame: "#fffaf4",
        decoration: "aesthetic"
    },

    doodle: {
        name: "Doodle",
        background: "#fff8ec",
        ink: "#61475a",
        border: "#d9b7c5",
        photoFrame: "#ffffff",
        decoration: "doodle"
    },

    floral: {
        name: "Floral",
        background: "#f8e8eb",
        ink: "#965a6d",
        border: "#e5b9c7",
        photoFrame: "#fff9fa",
        decoration: "floral"
    },

    film: {
        name: "Film",
        background: "#252323",
        ink: "#f8ead8",
        border: "#bca48b",
        photoFrame: "#403b39",
        decoration: "film"
    },

    retro: {
        name: "Retro",
        background: "#f3dfbd",
        ink: "#714b35",
        border: "#c99565",
        photoFrame: "#fff5e6",
        decoration: "retro"
    },

    sakura: {
        name: "Sakura",
        background: "#f8e4e9",
        ink: "#98556b",
        border: "#e6b5c5",
        photoFrame: "#fff6f8",
        decoration: "sakura"
    },

    botanical: {
        name: "Botanical",
        background: "#eef2e8",
        ink: "#425c47",
        border: "#b5c5ae",
        photoFrame: "#fbfcf7",
        decoration: "botanical"
    },

    night: {
        name: "Night Sky",
        background: "#24243a",
        ink: "#f7e7bd",
        border: "#8d83a8",
        photoFrame: "#32324a",
        decoration: "night"
    },

    colorful: {
        name: "Colorful",
        background: "#fff0d8",
        ink: "#663c65",
        border: "#ee9a86",
        photoFrame: "#ffffff",
        decoration: "colorful"
    }
};

function getTemplate() {
    return STRIP_TEMPLATES[selectedTemplate] ||
        STRIP_TEMPLATES.classic;
}


// =====================================================
// 4. SUPABASE INITIALIZATION
// =====================================================

function initialiseSupabase() {
    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {
        console.error("Supabase SDK did not load.");

        const grid = $("#photoGrid");
        const count = $("#photoCount");
        const wishes = $("#wishesList");

        if (count) count.textContent = "Unavailable";

        if (grid) {
            grid.replaceChildren(
                makeText("Gallery service is unavailable. Please refresh.")
            );
        }

        if (wishes) {
            wishes.replaceChildren(
                makeText("Guestbook service is unavailable. Please refresh.")
            );
        }

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

const menuButton = $("#menuButton");

if (menuButton) {
    menuButton.addEventListener("click", () => {
        const nav = $("#navTabs");

        if (!nav) return;

        const open = nav.classList.toggle("open");

        menuButton.setAttribute("aria-expanded", String(open));
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


// =====================================================
// 6. CAMERA
// =====================================================

async function startCamera() {
    const video = $("#cameraVideo");
    const startButton = $("#startCamera");
    const status = $("#cameraStatus");
    const help = $("#cameraHelp");
    const placeholder = $("#cameraPlaceholder");

    if (!video || !startButton) {
        console.error("Camera elements are missing from the HTML.");
        return;
    }

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

        if (status) status.textContent = "Camera is ready";

        if (help) {
            help.textContent =
                "Press the shutter once to take three photos automatically.";
        }

        video.classList.add("ready");

        if (placeholder) {
            placeholder.style.display = "none";
        }

    } catch (error) {
        console.error("Camera error:", error);

        stopCamera();

        if (status) status.textContent = "Camera unavailable";

        if (help) {
            if (error.name === "NotAllowedError") {
                help.textContent =
                    "Camera permission was denied. Allow camera access in your browser settings.";
            } else if (error.name === "NotFoundError") {
                help.textContent =
                    "No camera was found on this device.";
            } else if (error.name === "NotReadableError") {
                help.textContent =
                    "The camera may be in use by another application.";
            } else {
                help.textContent =
                    "Could not open the camera. Check permissions and use HTTPS.";
            }
        }

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
    const placeholder = $("#cameraPlaceholder");

    if (video) {
        video.srcObject = null;
        video.classList.remove("ready");
    }

    if (placeholder) {
        placeholder.style.display = "flex";
    }

    const startButton = $("#startCamera");
    if (startButton) startButton.disabled = false;

    const status = $("#cameraStatus");
    if (status) status.textContent = "Camera not started";

    const captureButton = $("#captureButton");
    if (captureButton) captureButton.disabled = true;

    captureSequence = false;
}

const startCameraButton = $("#startCamera");

if (startCameraButton) {
    startCameraButton.addEventListener("click", startCamera);
}

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

    if (
        !cameraStream ||
        !video ||
        !video.videoWidth ||
        !video.videoHeight
    ) {
        throw new Error("The camera is not ready.");
    }

    if (!canvas) {
        throw new Error("Capture canvas is missing from the HTML.");
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Could not access the photo canvas.");
    }

    // Mirror the photo to match the selfie camera preview.
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

    return canvas.toDataURL("image/jpeg", 0.92);
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
        finishButton.disabled =
            capturedPhotos.length !== 3 || busy;
    }

    if (captureButton) {
        captureButton.disabled =
            !cameraStream ||
            capturedPhotos.length >= 3 ||
            busy;
    }

    if (retakeButton) {
        retakeButton.disabled =
            capturedPhotos.length === 0 || busy;
    }

    if (capturedPhotos.length === 3) {
        setMessage("#cameraStatus", "All three photos captured");
        setMessage(
            "#cameraHelp",
            "Your photos are ready! Review your chosen photostrip style."
        );
    } else if (cameraStream) {
        setMessage(
            "#cameraStatus",
            `Ready · ${capturedPhotos.length} of 3 photos`
        );
    } else {
        setMessage("#cameraStatus", "Camera not started");
    }

    // Update the large preview whenever a photo changes.
    updatePhotostripPreview();
}

const captureButton = $("#captureButton");

if (captureButton) {
    captureButton.addEventListener("click", async () => {
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
            while (
                capturedPhotos.length < 3 &&
                cameraStream
            ) {
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

            setMessage(
                "#cameraHelp",
                capturedPhotos.length === 3
                    ? "All photos captured! Review the design, then make your photo strip."
                    : "Capture stopped."
            );

        } catch (error) {
            console.error("Capture error:", error);

            setMessage(
                "#cameraHelp",
                error.message || "Could not capture the photos."
            );

        } finally {
            busy = false;
            captureSequence = false;
            renderSlots();
        }
    });
}


// =====================================================
// 8. PHOTO STRIP DRAWING HELPERS
// =====================================================

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);

        image.onerror = () => {
            reject(new Error("Could not load a captured photo."));
        };

        image.src = src;
    });
}

function drawCrop(context, image, x, y, width, height) {
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

    context.drawImage(
        image,
        sx,
        sy,
        sw,
        sh,
        x,
        y,
        width,
        height
    );
}

function drawFlower(context, x, y, radius, color) {
    context.save();
    context.translate(x, y);
    context.fillStyle = color;

    for (let i = 0; i < 5; i++) {
        context.rotate((Math.PI * 2) / 5);

        context.beginPath();

        context.ellipse(
            0,
            -radius * 0.65,
            radius * 0.42,
            radius * 0.7,
            0,
            0,
            Math.PI * 2
        );

        context.fill();
    }

    context.beginPath();
    context.arc(0, 0, radius * 0.25, 0, Math.PI * 2);

    context.fillStyle = "#f9e9bd";
    context.fill();

    context.restore();
}

function drawDoodles(context, width, height, color) {
    const symbols = ["♡", "✧", "☆", "♡", "✿"];

    context.fillStyle = color;
    context.font = "30px serif";

    for (let i = 0; i < 14; i++) {
        context.fillText(
            symbols[i % symbols.length],
            25 + ((i * 73) % (width - 50)),
            230 + ((i * 137) % (height - 300))
        );
    }
}

function drawTemplateDecorations(context, width, height, theme) {
    const style = theme.decoration;

    if (style === "sakura" || style === "floral") {
        for (let i = 0; i < 26; i++) {
            drawFlower(
                context,
                (i * 83 + 24) % width,
                (i * 127 + 35) % height,
                8 + (i % 3) * 2,
                theme.border
            );
        }
    }

    if (style === "doodle") {
        drawDoodles(context, width, height, theme.border);
    }

    if (style === "botanical") {
        context.save();
        context.fillStyle = theme.border;
        context.font = "60px serif";

        context.fillText("❧", 38, 190);
        context.fillText("❧", width - 90, height - 60);

        context.restore();
    }

    if (style === "night") {
        context.save();

        for (let i = 0; i < 36; i++) {
            context.fillStyle = "#d3b56e";
            context.font = `${10 + (i % 3) * 4}px serif`;

            context.fillText(
                "✦",
                (i * 71 + 20) % width,
                (i * 97 + 50) % height
            );
        }

        context.restore();
    }

    if (style === "colorful") {
        const colors = [
            "#ef9d91",
            "#e7c45f",
            "#8cb8a2",
            "#b3a1d5",
            "#e77d9b"
        ];

        for (let i = 0; i < 18; i++) {
            context.fillStyle = colors[i % colors.length];

            context.beginPath();

            context.arc(
                (i * 91 + 30) % width,
                (i * 113 + 50) % height,
                7 + (i % 4) * 2,
                0,
                Math.PI * 2
            );

            context.fill();
        }
    }

    if (style === "retro") {
        context.save();

        context.strokeStyle = theme.border;
        context.lineWidth = 5;

        context.strokeRect(32, 32, width - 64, height - 64);

        context.font = "22px serif";
        context.fillStyle = theme.ink;
        context.fillText("✦  ✧  ✦", width / 2, 195);

        context.restore();
    }

    if (style === "film") {
        context.fillStyle = theme.border;

        for (let y = 34; y < height - 30; y += 26) {
            context.fillRect(28, y, 12, 13);
            context.fillRect(width - 40, y, 12, 13);
        }
    }
}


// =====================================================
// 9. THE MAIN STRIP RENDERER
// Both preview and final download use this same function.
// =====================================================

async function drawPhotostrip(canvas, photos = [], options = {}) {
    if (!canvas) {
        throw new Error("Photostrip canvas is missing.");
    }

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Could not prepare the photostrip canvas.");
    }

    const width = canvas.width;
    const height = canvas.height;
    const theme = getTemplate();
    const isPreview = Boolean(options.preview);

    context.clearRect(0, 0, width, height);

    // Background.
    context.fillStyle = theme.background;
    context.fillRect(0, 0, width, height);

    // Template border.
    context.strokeStyle = theme.border;
    context.lineWidth =
        theme.decoration === "minimalist" ? 2 : 3;

    context.strokeRect(
        20,
        20,
        width - 40,
        height - 40
    );

    // Decorative artwork behind the photos.
    drawTemplateDecorations(context, width, height, theme);

    // Header.
    context.textAlign = "center";
    context.fillStyle = theme.ink;

    context.font = "600 19px 'DM Sans', sans-serif";
    context.fillText("OUR WEDDING DAY", width / 2, 68);

    if (
        theme.decoration === "retro" ||
        theme.decoration === "film"
    ) {
        context.font = "bold 43px Georgia, serif";
    } else {
        context.font = "italic 48px 'Playfair Display', Georgia, serif";
    }

    context.fillText("Just Married", width / 2, 128);

    context.font = "18px 'DM Sans', sans-serif";
    context.fillText(COUPLE_NAMES, width / 2, 165);

    // Three identical-sized photo frames.
    const margin = 65;
    const photoWidth = width - margin * 2;
    const photoHeight = 390;
    const gap = 22;

    let y = 205;

    for (let index = 0; index < 3; index++) {
        context.fillStyle = theme.photoFrame;

        context.fillRect(
            margin - 8,
            y - 8,
            photoWidth + 16,
            photoHeight + 16
        );

        if (photos[index]) {
            const image = await loadImage(photos[index]);

            drawCrop(
                context,
                image,
                margin,
                y,
                photoWidth,
                photoHeight
            );

        } else {
            // Sample photo panels shown before guests take pictures.
            const gradient = context.createLinearGradient(
                margin,
                y,
                margin + photoWidth,
                y + photoHeight
            );

            if (theme.decoration === "film") {
                gradient.addColorStop(0, "#554b4b");
                gradient.addColorStop(1, "#292525");
            } else if (
                theme.decoration === "sakura" ||
                theme.decoration === "floral"
            ) {
                gradient.addColorStop(0, "#f4cdd8");
                gradient.addColorStop(1, "#e8b8c8");
            } else if (theme.decoration === "night") {
                gradient.addColorStop(0, "#474769");
                gradient.addColorStop(1, "#28283e");
            } else if (theme.decoration === "botanical") {
                gradient.addColorStop(0, "#dce7d7");
                gradient.addColorStop(1, "#a9bea6");
            } else {
                gradient.addColorStop(0, "#ead8ca");
                gradient.addColorStop(1, "#c9b2a3");
            }

            context.fillStyle = gradient;

            context.fillRect(
                margin,
                y,
                photoWidth,
                photoHeight
            );

            context.textAlign = "center";
            context.fillStyle =
                theme.decoration === "night" ||
                theme.decoration === "film"
                    ? "#fff6e8"
                    : theme.ink;

            context.font = "italic 32px Georgia, serif";

            context.fillText(
                isPreview
                    ? `Your Photo ${index + 1}`
                    : `Photo ${index + 1}`,
                width / 2,
                y + photoHeight / 2
            );

            context.font = "14px 'DM Sans', sans-serif";

            context.fillText(
                isPreview ? "YOUR MEMORY HERE" : "",
                width / 2,
                y + photoHeight / 2 + 35
            );
        }

        // Film frames have a stronger outline.
        if (theme.decoration === "film") {
            context.strokeStyle = theme.border;
            context.lineWidth = 5;

            context.strokeRect(
                margin,
                y,
                photoWidth,
                photoHeight
            );
        }

        y += photoHeight + gap;
    }

    // Footer.
    context.textAlign = "center";
    context.fillStyle = theme.ink;

    context.font = "italic 29px 'Playfair Display', Georgia, serif";

    context.fillText(
        "A memory to keep forever",
        width / 2,
        1500
    );

    context.font = "16px 'DM Sans', sans-serif";

    context.fillText(
        "THANK YOU FOR CELEBRATING WITH US",
        width / 2,
        1540
    );

    context.fillText(
        WEDDING_DATE,
        width / 2,
        1580
    );

    if (
        theme.decoration === "sakura" ||
        theme.decoration === "floral"
    ) {
        drawFlower(context, 78, 1695, 23, theme.border);
        drawFlower(context, 522, 1695, 23, theme.border);
    } else {
        context.strokeStyle = theme.border;
        context.lineWidth = 2;

        context.beginPath();
        context.moveTo(90, 1695);
        context.lineTo(510, 1695);
        context.stroke();
    }

    return canvas.toDataURL("image/png");
}


// =====================================================
// 10. CREATE THE LARGE LIVE PREVIEW
// Automatically inserts the preview into your template
// selection area; no additional HTML is required.
// =====================================================

let previewCanvas = null;
let previewStatus = null;
let previewRenderId = 0;

function createPreviewArea() {
    const templateOptions = $(".template-options");

    if (!templateOptions) {
        console.warn(
            "No .template-options element found. Preview cannot be inserted."
        );
        return;
    }

    // Avoid inserting duplicate preview panels.
    if ($("#templatePreviewPanel")) {
        previewCanvas = $("#templatePreviewCanvas");
        previewStatus = $("#templatePreviewStatus");
        return;
    }

    const panel = document.createElement("section");

    panel.id = "templatePreviewPanel";

    panel.style.cssText = `
        width: 100%;
        max-width: 480px;
        margin: 28px auto;
        padding: 22px;
        background: #fffdf9;
        border: 1px solid #e7dcd4;
        border-radius: 18px;
        box-shadow: 0 8px 28px rgba(70,45,40,0.06);
        text-align: center;
    `;

    const heading = document.createElement("h3");

    heading.textContent = "Preview Your Photo Strip";

    heading.style.cssText = `
        margin: 0 0 6px;
        color: #352b29;
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 24px;
        font-weight: 500;
    `;

    const description = document.createElement("p");

    description.textContent =
        "Choose a style above to see how your finished strip will look.";

    description.style.cssText = `
        margin: 0 0 18px;
        color: #8e817d;
        font-size: 12px;
    `;

    previewStatus = document.createElement("p");
    previewStatus.id = "templatePreviewStatus";

    previewStatus.style.cssText = `
        margin: 14px 0 0;
        color: #8e817d;
        font-size: 12px;
    `;

    previewCanvas = document.createElement("canvas");

    previewCanvas.id = "templatePreviewCanvas";
    previewCanvas.width = 600;
    previewCanvas.height = 1760;

    previewCanvas.style.cssText = `
        display: block;
        width: 100%;
        max-width: 280px;
        height: auto;
        margin: 0 auto;
        border-radius: 3px;
        box-shadow: 0 5px 18px rgba(0,0,0,0.13);
        background: #fffdf8;
    `;

    panel.append(
        heading,
        description,
        previewCanvas,
        previewStatus
    );

    templateOptions.insertAdjacentElement("afterend", panel);
}

async function updatePhotostripPreview() {
    if (!previewCanvas) return;

    const renderId = ++previewRenderId;
    const theme = getTemplate();

    if (previewStatus) {
        previewStatus.textContent =
            `Selected style: ${theme.name}. ` +
            `${capturedPhotos.length} of 3 photos captured.`;
    }

    try {
        // Use real photos if captured. Otherwise show sample frames.
        await drawPhotostrip(
            previewCanvas,
            capturedPhotos,
            { preview: true }
        );

        // Ignore outdated renders if the guest changes styles quickly.
        if (renderId !== previewRenderId) return;

    } catch (error) {
        console.error("Preview rendering error:", error);

        if (previewStatus) {
            previewStatus.textContent =
                "Could not display preview. Please try another style.";
        }
    }
}


// =====================================================
// 11. TEMPLATE SELECTION
// =====================================================

function selectTemplate(button) {
    if (!button) return;

    const template = button.dataset.template;

    if (!template) return;

    selectedTemplate = template;

    $$(".template-option").forEach(option => {
        const selected = option === button;

        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
    });

    updatePhotostripPreview();
}

$$(".template-option").forEach(button => {
    button.addEventListener("click", () => {
        selectTemplate(button);
    });
});


// =====================================================
// 12. RESET / RETAKE PHOTOS
// =====================================================

function resetPhotos() {
    capturedPhotos = [];
    latestStripData = "";

    const canvas = $("#stripCanvas");

    if (canvas) {
        const context = canvas.getContext("2d");

        if (context) {
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    const qrPanel = $("#qrPanel");
    const qrCode = $("#qrCode");

    if (qrPanel) qrPanel.hidden = true;
    if (qrCode) qrCode.replaceChildren();

    const uploadButton = $("#uploadButton");

    if (uploadButton) {
        uploadButton.disabled = false;
        uploadButton.textContent = "Upload to wedding gallery";
    }

    const downloadButton = $("#downloadButton");

    if (downloadButton) downloadButton.disabled = false;

    setMessage("#resultMessage", "");

    setMessage(
        "#cameraHelp",
        cameraStream
            ? "Press the shutter once to take three photos automatically."
            : "Turn on your camera to get started."
    );

    renderSlots();
}

const retakeButton = $("#retakeButton");

if (retakeButton) {
    retakeButton.addEventListener("click", resetPhotos);
}


// =====================================================
// 13. MAKE THE FINAL PHOTO STRIP
// Uses the SAME renderer as the live preview.
// =====================================================

const finishButton = $("#finishButton");

if (finishButton) {
    finishButton.addEventListener("click", async () => {
        if (busy || capturedPhotos.length !== 3) return;

        busy = true;

        finishButton.disabled = true;
        finishButton.textContent = "Creating strip...";

        try {
            const canvas = $("#stripCanvas");

            if (!canvas) {
                throw new Error(
                    "The final photo strip canvas is missing from the HTML."
                );
            }

            latestStripData = await drawPhotostrip(
                canvas,
                capturedPhotos,
                { preview: false }
            );

            showView("result");

        } catch (error) {
            console.error("Strip rendering error:", error);

            alert(
                error.message ||
                "Could not create your photo strip."
            );

        } finally {
            busy = false;

            finishButton.textContent = "Make my photo strip →";

            renderSlots();
        }
    });
}


// =====================================================
// 14. DOWNLOAD PHOTO STRIP
// =====================================================

const downloadButton = $("#downloadButton");

if (downloadButton) {
    downloadButton.addEventListener("click", () => {
        if (!latestStripData) {
            setMessage(
                "#resultMessage",
                "Create your photo strip before downloading."
            );
            return;
        }

        try {
            const link = document.createElement("a");

            link.href = latestStripData;
            link.download = "sahlen-atiqah-wedding-photo-strip.png";

            document.body.appendChild(link);
            link.click();
            link.remove();

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
        }
    });
}


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
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${Date.now()}-${uuid}.png`;
}


// =====================================================
// 16. UPLOAD PHOTO STRIP TO SUPABASE
// =====================================================

async function uploadPhotoStrip() {
    if (!latestStripData || busy) return;

    const button = $("#uploadButton");
    const resultMessage = $("#resultMessage");

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

    if (resultMessage) {
        resultMessage.textContent = "Uploading your photo strip...";
    }

    const path = `photostrips/${safeFileName()}`;

    const guestNameInput = $("#guestName");

    const name = guestNameInput
        ? guestNameInput.value.trim().slice(0, 60) || "A wedding guest"
        : "A wedding guest";

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
            .insert({
                name,
                image_path: path
            });

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

        if (button) {
            button.textContent = "✓ Uploaded successfully";
        }

        await loadGallery();

    } catch (error) {
        console.error("Upload error:", error);

        setMessage(
            "#resultMessage",
            `Upload failed: ${error.message || "Unknown error"}. Check your Supabase bucket, table and access policies.`
        );

        if (button) {
            button.textContent = "Try uploading again";
        }

    } finally {
        busy = false;

        if (button) button.disabled = false;
    }
}

const uploadButton = $("#uploadButton");

if (uploadButton) {
    uploadButton.addEventListener("click", uploadPhotoStrip);
}


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

    grid.replaceChildren(
        makeText("Loading wedding photos...")
    );

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

        for (const photo of data) {
            const { data: urlData } = supabaseClient
                .storage
                .from(BUCKET)
                .getPublicUrl(photo.image_path);

            const card = document.createElement("article");
            card.className = "photo-card uploaded-card";

            const image = document.createElement("img");

            image.src = urlData.publicUrl;
            image.alt = `Wedding photo shared by ${photo.name || "a guest"}`;
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
        }

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

    list.replaceChildren(
        makeText("Loading wishes...")
    );

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

            guestbookForm.reset();

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
}


// =====================================================
// 19. TAKE ANOTHER SET OF PHOTOS
// =====================================================

const againButton = $("#againButton");

if (againButton) {
    againButton.addEventListener("click", async () => {
        resetPhotos();

        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.textContent = "Upload to wedding gallery";
        }

        setMessage("#resultMessage", "");

        showView("photobooth");

        await startCamera();
    });
}


// =====================================================
// 20. INITIALIZE APPLICATION
// =====================================================

function initialiseApp() {
    const ready = initialiseSupabase();

    // Build the full-sized photostrip preview automatically.
    createPreviewArea();

    // Mark the initial template as selected.
    const initialTemplate =
        $(`.template-option[data-template="${selectedTemplate}"]`) ||
        $(".template-option");

    if (initialTemplate) {
        selectTemplate(initialTemplate);
    } else {
        updatePhotostripPreview();
    }

    renderSlots();

    if (ready) {
        loadGallery();
        loadGuestbook();
    }

    console.log("Wedding photobooth initialized successfully.");
}

initialiseApp();