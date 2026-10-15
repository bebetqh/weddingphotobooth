/* Wedding digital photobooth — Supabase + automatic 3-shot timer + QR sharing */

// Supabase configuration
const SUPABASE_URL = "https://hxaudbnyagbfhhwuawua.supabase.co";
const SUPABASE_KEY = "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

// Wedding details
const COUPLE_NAMES = "SYAZWAN  ♥  SYILAH";
const WEDDING_DATE = "19 · 12 · 2026";

// DOM helpers
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// Application views
const views = {
    photos: $("#photosView"),
    photobooth: $("#photoboothView"),
    result: $("#resultView"),
    guestbook: $("#guestbookView"),
};

// Application state
let supabaseClient = null;
let cameraStream = null;
let capturedPhotos = [];

let selectedTemplate = "classic";
let latestStripData = "";
let latestPublicUrl = "";

let busy = false;
let cameraStarting = false;
let captureSequence = false;


// --------------------------------------------------
// General helpers
// --------------------------------------------------

function setMessage(selector, message) {
    const element = $(selector);

    if (element) {
        element.textContent = message;
    }
}

function makeText(text, className = "muted") {
    const paragraph = document.createElement("p");

    paragraph.className = className;
    paragraph.textContent = text;

    return paragraph;
}

function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}


// --------------------------------------------------
// Supabase initialization
// --------------------------------------------------

function initSupabase() {
    if (!window.supabase?.createClient) {
        setMessage("#photoCount", "Gallery unavailable");

        $("#photoGrid").replaceChildren(
            makeText(
                "Gallery service did not load. Check your connection and reload."
            )
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
        console.error(error);
        return false;
    }
}


// --------------------------------------------------
// Navigation
// --------------------------------------------------

function showView(name) {
    if (!views[name]) {
        return;
    }

    Object.values(views).forEach((view) => {
        view.classList.remove("active");
    });

    views[name].classList.add("active");

    $$(".nav-tab").forEach((button) => {
        const isActive = button.dataset.page === name;

        button.classList.toggle("active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });

    $("#navTabs").classList.remove("open");
    $("#menuButton").setAttribute("aria-expanded", "false");

    window.scrollTo({
        top: 0,
        behavior: "smooth",
    });

    if (name !== "photobooth") {
        stopCamera();
    }

    if (name === "photos") {
        loadGallery();
    }

    if (name === "guestbook") {
        loadGuestbook();
    }
}

$$("[data-page]").forEach((button) => {
    button.addEventListener("click", async (event) => {
        event.preventDefault();

        const page = button.dataset.page;

        showView(page);

        if (page === "photobooth") {
            await startCamera();
        }
    });
});

$("#menuButton").addEventListener("click", () => {
    const isOpen = $("#navTabs").classList.toggle("open");

    $("#menuButton").setAttribute(
        "aria-expanded",
        String(isOpen)
    );
});


// --------------------------------------------------
// Camera
// --------------------------------------------------

async function startCamera() {
    if (cameraStream || cameraStarting) {
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("#cameraStatus", "Camera unavailable");

        setMessage(
            "#cameraHelp",
            "Camera requires HTTPS or localhost. Open the secure website and try again."
        );

        return;
    }

    cameraStarting = true;
    $("#startCamera").disabled = true;

    setMessage("#cameraStatus", "Opening camera…");

    setMessage(
        "#cameraHelp",
        "Please allow camera access when your browser asks."
    );

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 960 },
            },
            audio: false,
        });

        const video = $("#cameraVideo");

        video.srcObject = cameraStream;
        video.muted = true;
        video.playsInline = true;

        await new Promise((resolve, reject) => {
            if (video.readyState >= 2 && video.videoWidth) {
                resolve();
                return;
            }

            const clean = () => {
                video.removeEventListener("loadeddata", ready);
                video.removeEventListener("error", error);
            };

            const ready = () => {
                clean();
                resolve();
            };

            const error = () => {
                clean();

                reject(
                    new Error("Camera video could not be displayed.")
                );
            };

            video.addEventListener("loadeddata", ready, {
                once: true,
            });

            video.addEventListener("error", error, {
                once: true,
            });
        });

        await video.play();

        video.classList.add("ready");
        $("#cameraPlaceholder").style.display = "none";

        setMessage("#cameraStatus", "Camera is ready");

        setMessage(
            "#cameraHelp",
            "Tap the shutter to begin three automatic snaps. Each photo has a 3-second countdown."
        );

        renderSlots();
    } catch (error) {
        console.error(error);

        stopCamera();

        const messages = {
            NotAllowedError:
                "Camera permission was denied. Allow camera access in your browser settings.",

            NotFoundError:
                "No camera was found on this device.",

            NotReadableError:
                "The camera may be in use by another app.",

            SecurityError:
                "Camera access requires HTTPS.",
        };

        setMessage("#cameraStatus", "Camera unavailable");

        setMessage(
            "#cameraHelp",
            messages[error.name] ||
                `Could not open camera: ${error.message || "check permissions"}.`
        );
    } finally {
        cameraStarting = false;
        $("#startCamera").disabled = false;
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach((track) => {
            track.stop();
        });

        cameraStream = null;
    }

    const video = $("#cameraVideo");

    if (video) {
        video.srcObject = null;
        video.classList.remove("ready");
    }

    if ($("#cameraPlaceholder")) {
        $("#cameraPlaceholder").style.display = "flex";
    }

    if ($("#startCamera")) {
        $("#startCamera").disabled = false;
    }

    if ($("#cameraStatus")) {
        $("#cameraStatus").textContent = "Camera not started";
    }

    if ($("#captureButton")) {
        $("#captureButton").disabled = true;
    }

    captureSequence = false;
}

$("#startCamera").addEventListener("click", startCamera);

window.addEventListener("beforeunload", stopCamera);


// --------------------------------------------------
// Photo countdown and capture
// --------------------------------------------------

async function countdown(seconds = 3) {
    const element = $("#countdown");

    element.classList.add("show");

    try {
        for (let number = seconds; number >= 1; number--) {
            element.textContent = number;

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

    if (
        !cameraStream ||
        !video.videoWidth ||
        !video.videoHeight
    ) {
        throw new Error(
            "Camera is not ready. Turn on the camera and try again."
        );
    }

    const canvas = $("#captureCanvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Could not access photo canvas.");
    }

    // Mirror the camera image for a selfie-style photo.
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

            slot.append(image);
        } else {
            slot.textContent = String(index + 1);
        }
    });

    $("#finishButton").disabled =
        capturedPhotos.length !== 3 || busy;

    $("#captureButton").disabled =
        !cameraStream ||
        capturedPhotos.length >= 3 ||
        busy;

    $("#retakeButton").disabled =
        busy || capturedPhotos.length === 0;

    if (capturedPhotos.length === 3) {
        setMessage(
            "#cameraStatus",
            "All three snaps captured"
        );
    } else if (cameraStream) {
        setMessage(
            "#cameraStatus",
            captureSequence
                ? "Taking photos…"
                : `Ready · ${capturedPhotos.length} of 3 photos`
        );
    } else {
        setMessage("#cameraStatus", "Camera not started");
    }
}

$("#captureButton").addEventListener("click", async () => {
    if (
        !cameraStream ||
        busy ||
        captureSequence ||
        capturedPhotos.length >= 3
    ) {
        return;
    }

    captureSequence = true;
    busy = true;

    renderSlots();

    $("#captureButton").disabled = true;

    try {
        while (
            capturedPhotos.length < 3 &&
            cameraStream
        ) {
            setMessage(
                "#cameraHelp",
                `Photo ${capturedPhotos.length + 1} of 3 — get ready!`
            );

            await countdown(3);

            if (!cameraStream) {
                break;
            }

            capturedPhotos.push(await takeSnapshot());

            renderSlots();

            if (capturedPhotos.length < 3) {
                await delay(500);
            }
        }

        setMessage(
            "#cameraHelp",
            capturedPhotos.length === 3
                ? "All done! Choose your style and make your photo strip."
                : "Capture stopped."
        );
    } catch (error) {
        setMessage(
            "#cameraHelp",
            error.message || "Could not capture photo."
        );
    } finally {
        captureSequence = false;
        busy = false;

        renderSlots();
    }
});


// --------------------------------------------------
// Reset and retake photos
// --------------------------------------------------

function resetPhotos() {
    capturedPhotos = [];
    latestStripData = "";
    latestPublicUrl = "";

    $("#stripCanvas")
        .getContext("2d")
        .clearRect(0, 0, 600, 1760);

    renderSlots();

    $("#qrPanel").hidden = true;
    $("#qrCode").replaceChildren();

    $("#uploadButton").disabled = false;
    $("#uploadButton").textContent =
        "Upload to wedding gallery";

    $("#downloadButton").disabled = false;

    setMessage("#resultMessage", "");

    setMessage(
        "#cameraHelp",
        cameraStream
            ? "Tap the shutter to begin three automatic snaps."
            : "Turn on your camera to get started."
    );
}

$("#retakeButton").addEventListener("click", resetPhotos);


// --------------------------------------------------
// Photo strip templates
// --------------------------------------------------

$$(".template-option").forEach((button) => {
    button.addEventListener("click", () => {
        selectedTemplate = button.dataset.template;

        $$(".template-option").forEach((option) => {
            const isSelected = option === button;

            option.classList.toggle(
                "selected",
                isSelected
            );

            option.setAttribute(
                "aria-pressed",
                String(isSelected)
            );
        });
    });
});

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);

        image.onerror = () => {
            reject(
                new Error("Could not load a captured photo.")
            );
        };

        image.src = source;
    });
}

function drawCrop(context, image, x, y, width, height) {
    const sourceRatio = image.width / image.height;
    const targetRatio = width / height;

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
        width,
        height
    );
}

function drawFlower(context, x, y, radius, color) {
    context.save();
    context.translate(x, y);
    context.fillStyle = color;

    for (let index = 0; index < 5; index++) {
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

    context.arc(
        0,
        0,
        radius * 0.25,
        0,
        Math.PI * 2
    );

    context.fillStyle = "#f9e9bd";
    context.fill();

    context.restore();
}


// --------------------------------------------------
// Render photo strip
// --------------------------------------------------

async function renderStrip() {
    if (capturedPhotos.length !== 3) {
        throw new Error("Please capture three photos first.");
    }

    const canvas = $("#stripCanvas");
    const context = canvas.getContext("2d");

    const width = canvas.width;
    const height = canvas.height;

    const themes = {
        classic: {
            bg: "#fffdf8",
            ink: "#51413b",
            line: "#e6d8ca",
            accent: "#cdb9a9",
        },

        sakura: {
            bg: "#f8e4e9",
            ink: "#98556b",
            line: "#e6b5c5",
            accent: "#d99caf",
        },

        doodle: {
            bg: "#fff8ec",
            ink: "#61475a",
            line: "#d9b7c5",
            accent: "#d99caf",
        },

        minimal: {
            bg: "#ffffff",
            ink: "#222222",
            line: "#dedede",
            accent: "#dedede",
        },

        colorful: {
            bg: "#fff0d8",
            ink: "#663c65",
            line: "#ee9a86",
            accent: "#e77d9b",
        },

        film: {
            bg: "#252323",
            ink: "#f8ead8",
            line: "#bca48b",
            accent: "#d7c3aa",
        },

        botanical: {
            bg: "#eef2e8",
            ink: "#425c47",
            line: "#b5c5ae",
            accent: "#789477",
        },

        night: {
            bg: "#24243a",
            ink: "#f7e7bd",
            line: "#8d83a8",
            accent: "#d3b56e",
        },
    };

    const theme = themes[selectedTemplate] || themes.classic;

    context.clearRect(0, 0, width, height);

    context.fillStyle = theme.bg;
    context.fillRect(0, 0, width, height);

    // Border styles.
    if (
        [
            "classic",
            "minimal",
            "botanical",
            "film",
            "night",
        ].includes(selectedTemplate)
    ) {
        context.strokeStyle = theme.line;
        context.lineWidth =
            selectedTemplate === "minimal" ? 1 : 3;

        context.strokeRect(
            20,
            20,
            width - 40,
            height - 40
        );
    }

    // Sakura flowers.
    if (selectedTemplate === "sakura") {
        for (let index = 0; index < 38; index++) {
            drawFlower(
                context,
                (index * 83 + 24) % width,
                (index * 127 + 35) % height,
                7 + (index % 3) * 2,
                "#d99caf"
            );
        }
    }

    // Decorative doodles.
    if (selectedTemplate === "doodle") {
        context.strokeStyle = theme.accent;
        context.lineWidth = 3;
        context.font = "30px serif";

        const decorations = ["♡", "✧", "☆", "♡", "✿"];

        for (let index = 0; index < 9; index++) {
            context.fillStyle = theme.accent;

            context.fillText(
                decorations[index % decorations.length],
                35 + (index * 67) % 520,
                230 + (index * 160) % 1450
            );
        }
    }

    // Colorful circles.
    if (selectedTemplate === "colorful") {
        const colors = [
            "#ef9d91",
            "#e7c45f",
            "#8cb8a2",
            "#b3a1d5",
            "#e77d9b",
        ];

        for (let index = 0; index < 18; index++) {
            context.fillStyle = colors[index % colors.length];

            context.beginPath();

            context.arc(
                (index * 91 + 30) % width,
                (index * 113 + 50) % height,
                8 + (index % 4) * 3,
                0,
                Math.PI * 2
            );

            context.fill();
        }
    }

    // Botanical decorations.
    if (selectedTemplate === "botanical") {
        context.font = "52px serif";
        context.fillStyle = theme.accent;

        context.fillText("❧", 42, 190);
        context.fillText("❧", 510, 1660);
    }

    // Night-sky decorations.
    if (selectedTemplate === "night") {
        for (let index = 0; index < 32; index++) {
            context.fillStyle = "#d3b56e";
            context.font = `${8 + (index % 3) * 4}px serif`;

            context.fillText(
                "✦",
                (index * 71 + 20) % width,
                (index * 97 + 50) % height
            );
        }
    }

    // Film-strip perforations.
    if (selectedTemplate === "film") {
        context.fillStyle = theme.line;

        for (
            let y = 34;
            y < height - 30;
            y += 26
        ) {
            context.fillRect(28, y, 12, 13);
            context.fillRect(width - 40, y, 12, 13);
        }
    }

    // Header.
    context.textAlign = "center";
    context.fillStyle = theme.ink;

    context.font = "600 19px 'DM Sans', sans-serif";

    context.fillText(
        "OUR WEDDING DAY",
        width / 2,
        68
    );

    context.font = "italic 48px 'Playfair Display', serif";

    context.fillText(
        "Just Married",
        width / 2,
        128
    );

    context.font = "18px 'DM Sans', sans-serif";

    context.fillText(
        COUPLE_NAMES,
        width / 2,
        165
    );

    // Three captured photos.
    const margin = 65;
    const photoWidth = width - margin * 2;
    const photoHeight = 350;
    const gap = 18;

    let y = 205;

    for (const source of capturedPhotos) {
        const image = await loadImage(source);

        context.fillStyle =
            selectedTemplate === "film"
                ? "#403b39"
                : "#ffffff";

        context.fillRect(
            margin - 8,
            y - 8,
            photoWidth + 16,
            photoHeight + 16
        );

        drawCrop(
            context,
            image,
            margin,
            y,
            photoWidth,
            photoHeight
        );

        if (selectedTemplate === "film") {
            context.strokeStyle = theme.line;
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
    context.font = "italic 29px 'Playfair Display', serif";
    context.fillStyle = theme.ink;

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
        selectedTemplate === "sakura" ||
        selectedTemplate === "botanical"
    ) {
        drawFlower(context, 78, 1695, 23, theme.accent);
        drawFlower(context, 522, 1695, 23, theme.accent);
    } else {
        context.strokeStyle = theme.line;
        context.lineWidth = 2;

        context.beginPath();
        context.moveTo(90, 1695);
        context.lineTo(510, 1695);
        context.stroke();
    }

    latestStripData = canvas.toDataURL("image/png");
}


// --------------------------------------------------
// Create and download photo strip
// --------------------------------------------------

$("#finishButton").addEventListener("click", async () => {
    if (busy || capturedPhotos.length !== 3) {
        return;
    }

    busy = true;
    $("#finishButton").disabled = true;
    $("#finishButton").textContent = "Creating strip…";

    try {
        await renderStrip();
        showView("result");
    } catch (error) {
        alert(error.message || "Could not create photo strip.");
    } finally {
        busy = false;

        $("#finishButton").textContent =
            "Make my photo strip →";

        renderSlots();
    }
});

$("#downloadButton").addEventListener("click", () => {
    if (!latestStripData) {
        setMessage(
            "#resultMessage",
            "Create your photo strip first."
        );

        return;
    }

    const link = document.createElement("a");

    link.href = latestStripData;
    link.download = "syazwan-syilah-wedding-photo-strip.png";

    document.body.append(link);
    link.click();
    link.remove();

    setMessage(
        "#resultMessage",
        "Your download should begin shortly."
    );
});


// --------------------------------------------------
// Image upload helpers
// --------------------------------------------------

function dataURLToBlob(dataURL) {
    const parts = dataURL.split(",");
    const match = parts[0].match(/:(.*?);/);

    if (!match) {
        throw new Error("Invalid image data.");
    }

    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], {
        type: match[1],
    });
}

function safeFileName() {
    const uniqueId = window.crypto?.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(16).slice(2);

    return `${Date.now()}-${uniqueId}.png`;
}


// --------------------------------------------------
// Upload photo strip and generate QR code
// --------------------------------------------------

$("#uploadButton").addEventListener(
    "click",
    uploadPhotoStrip
);

async function uploadPhotoStrip() {
    if (!latestStripData || busy) {
        if (!latestStripData) {
            setMessage(
                "#resultMessage",
                "Create your photo strip first."
            );
        }

        return;
    }

    if (!supabaseClient) {
        setMessage(
            "#resultMessage",
            "Upload is not configured. Check Supabase settings."
        );

        return;
    }

    busy = true;

    const button = $("#uploadButton");

    button.disabled = true;
    button.textContent = "Uploading…";

    setMessage(
        "#resultMessage",
        "Uploading your photo strip…"
    );

    const path = `photostrips/${safeFileName()}`;

    const name =
        $("#guestName").value.trim().slice(0, 60) ||
        "A wedding guest";

    try {
        // Upload the photo strip to Supabase Storage.
        const { error: uploadError } = await supabaseClient
            .storage
            .from(BUCKET)
            .upload(
                path,
                dataURLToBlob(latestStripData),
                {
                    contentType: "image/png",
                    cacheControl: "3600",
                    upsert: false,
                }
            );

        if (uploadError) {
            throw uploadError;
        }

        // Save the photo information in the database.
        const { error: databaseError } = await supabaseClient
            .from(PHOTO_TABLE)
            .insert({
                name,
                image_path: path,
            });

        if (databaseError) {
            await supabaseClient
                .storage
                .from(BUCKET)
                .remove([path]);

            throw databaseError;
        }

        // Get the public image URL.
        const { data: publicData } = supabaseClient
            .storage
            .from(BUCKET)
            .getPublicUrl(path);

        latestPublicUrl = publicData.publicUrl;

        // Generate the QR code.
        $("#qrCode").replaceChildren();

        if (window.QRCode) {
            new QRCode($("#qrCode"), {
                text: latestPublicUrl,
                width: 180,
                height: 180,
                colorDark: "#352b29",
                colorLight: "#fffdf9",
                correctLevel: QRCode.CorrectLevel.H,
            });
        }

        $("#photoLink").href = latestPublicUrl;
        $("#qrPanel").hidden = false;

        setMessage(
            "#resultMessage",
            "Uploaded! Scan the QR code with your phone to open and save your photo."
        );

        button.textContent = "✓ Uploaded successfully";

        await loadGallery();
    } catch (error) {
        console.error(error);

        setMessage(
            "#resultMessage",
            `Upload failed: ${
                error.message ||
                "check Supabase table and storage policies"
            }.`
        );

        button.textContent = "Try uploading again";
    } finally {
        busy = false;
        button.disabled = false;
    }
}


// --------------------------------------------------
// Wedding photo gallery
// --------------------------------------------------

async function loadGallery() {
    const grid = $("#photoGrid");

    grid.replaceChildren(
        makeText("Loading wedding photos…")
    );

    if (!supabaseClient) {
        setMessage("#photoCount", "Not connected");

        grid.replaceChildren(
            makeText(
                "Gallery is not connected. Check Supabase setup."
            )
        );

        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from(PHOTO_TABLE)
            .select("id,name,image_path,created_at")
            .order("created_at", {
                ascending: false,
            })
            .limit(100);

        if (error) {
            throw error;
        }

        setMessage(
            "#photoCount",
            `${data.length} ${
                data.length === 1 ? "photo" : "photos"
            }`
        );

        grid.replaceChildren();

        if (!data.length) {
            grid.append(
                makeText(
                    "No photos yet. Be the first to share a memory!"
                )
            );

            return;
        }

        for (const photo of data) {
            const { data: publicData } = supabaseClient
                .storage
                .from(BUCKET)
                .getPublicUrl(photo.image_path);

            const card = document.createElement("article");
            card.className = "photo-card";

            const image = document.createElement("img");

            image.className = "uploaded-photo";
            image.src = publicData.publicUrl;

            image.alt =
                `Wedding photo shared by ${photo.name || "a guest"}`;

            image.loading = "lazy";

            image.onerror = () => {
                image.alt = "Photo could not be loaded";
                image.style.opacity = "0.5";
            };

            const caption = document.createElement("p");

            caption.textContent =
                `Shared by ${photo.name || "A wedding guest"}`;

            card.append(image, caption);
            grid.append(card);
        }
    } catch (error) {
        console.error(error);

        setMessage("#photoCount", "Unavailable");

        grid.replaceChildren(
            makeText(
                `Could not load gallery: ${
                    error.message || "check Supabase permissions"
                }.`
            )
        );
    }
}


// --------------------------------------------------
// Wedding guestbook
// --------------------------------------------------

async function loadGuestbook() {
    const list = $("#wishesList");

    list.replaceChildren(
        makeText("Loading wishes…")
    );

    if (!supabaseClient) {
        list.replaceChildren(
            makeText(
                "Guestbook is not connected. Check Supabase setup."
            )
        );

        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from(GUESTBOOK_TABLE)
            .select("id,name,message,created_at")
            .order("created_at", {
                ascending: false,
            })
            .limit(100);

        if (error) {
            throw error;
        }

        list.replaceChildren();

        if (!data.length) {
            list.append(
                makeText(
                    "No wishes yet. Leave the first message!"
                )
            );

            return;
        }

        data.forEach((wish) => {
            const card = document.createElement("article");
            card.className = "wish-card";

            const heart = document.createElement("span");

            heart.className = "wish-heart";
            heart.textContent = "♡";

            const heading = document.createElement("h3");

            heading.textContent =
                wish.name || "A wedding guest";

            const paragraph = document.createElement("p");

            paragraph.textContent = wish.message || "";

            card.append(heart, heading, paragraph);
            list.append(card);
        });
    } catch (error) {
        console.error(error);

        list.replaceChildren(
            makeText(
                `Could not load messages: ${
                    error.message || "check table permissions"
                }.`
            )
        );
    }
}


// --------------------------------------------------
// Submit a guestbook message
// --------------------------------------------------

$("#guestbookForm").addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const name = $("#messageName").value.trim();
        const message = $("#messageText").value.trim();

        const button = $("#sendWishButton");
        const status = $("#guestbookStatus");

        if (!name || !message) {
            status.textContent =
                "Please enter your name and a wish.";

            return;
        }

        if (name.length > 50 || message.length > 400) {
            status.textContent =
                "Please shorten your name or message.";

            return;
        }

        if (!supabaseClient) {
            status.textContent =
                "Guestbook is not configured. Check Supabase setup.";

            return;
        }

        button.disabled = true;
        button.textContent = "Sending…";

        status.textContent = "";

        try {
            const { error } = await supabaseClient
                .from(GUESTBOOK_TABLE)
                .insert({
                    name,
                    message,
                });

            if (error) {
                throw error;
            }

            $("#guestbookForm").reset();

            status.textContent =
                "Your wishes have been shared. Thank you!";

            await loadGuestbook();
        } catch (error) {
            console.error(error);

            status.textContent =
                `Could not send message: ${
                    error.message || "check guestbook permissions"
                }`;
        } finally {
            button.disabled = false;
            button.textContent = "Send your wishes ♡";
        }
    }
);


// --------------------------------------------------
// Start another photo session
// --------------------------------------------------

$("#againButton").addEventListener("click", async () => {
    resetPhotos();
    showView("photobooth");

    await startCamera();
});


// --------------------------------------------------
// Initialize the application
// --------------------------------------------------

async function initialiseApp() {
    if (initSupabase()) {
        await Promise.allSettled([
            loadGallery(),
            loadGuestbook(),
        ]);
    }

    renderSlots();
}

initialiseApp();