/* ==========================================
   WEDDING DIGITAL PHOTOBOOTH
   Supabase · Automatic Capture · QR Sharing
========================================== */

/* ---------- Configuration ---------- */

const SUPABASE_URL =
  "https://hxaudbnyagbfhhwuawua.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_5qi7c3qLl4qX3WZgVBxf7g_wl9TPJIO";

const BUCKET = "wedding-media";
const PHOTO_TABLE = "wedding_photos";
const GUESTBOOK_TABLE = "wedding_guestbook";

const COUPLE_NAMES = "SYAHLEN  ♥  ATIQAH";
const WEDDING_DATE = "08 · 11 · 2026";

/* ---------- DOM Helpers ---------- */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  [...document.querySelectorAll(selector)];

/* ---------- Application State ---------- */

const views = {
  photos: $("#photosView"),
  photobooth: $("#photoboothView"),
  result: $("#resultView"),
  guestbook: $("#guestbookView"),
};

let supabaseClient = null;
let cameraStream = null;

let capturedPhotos = [];
let selectedTemplate = "classic";

let latestStripData = "";
let latestPublicUrl = "";

let busy = false;
let cameraStarting = false;
let captureSequence = false;

/* ---------- UI Helpers ---------- */

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

/* ---------- Supabase Initialization ---------- */

function initSupabase() {
  if (!window.supabase?.createClient) {
    setMessage("#photoCount", "Gallery unavailable");

    $("#photoGrid")?.replaceChildren(
      makeText(
        "Gallery service did not load. " +
        "Check your connection and reload."
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
    console.error(
      "Supabase initialization failed:",
      error
    );

    return false;
  }
}