
"use strict";

const SUPABASE_URL = "https://vdcxvxtgkzwsknxmevwt.supabase.co";
const SUPABASE_KEY = "sb_publishable_xKYJqVUJ9CzA7TFxKKKjKQ_Nn6bdDLM";

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(window.location.search);
const token = (params.get("token") || "").trim();

let supabaseClient = null;
let printStarted = false;

function showError(message) {
  $("passContainer").hidden = true;
  $("noticeBar").hidden = true;
  $("errorState").hidden = false;
  $("errorMessage").textContent = message;
  $("printPass").disabled = true;
  document.title = "Pass Unavailable | Smart Temple";
}

function showPass() {
  $("errorState").hidden = true;
  $("noticeBar").hidden = false;
  $("passContainer").hidden = false;
  $("printPass").disabled = false;
}

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatReportingTime(slot) {
  const match = String(slot || "").match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );

  if (!match) return "Confirm with temple";

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setMinutes(date.getMinutes() - 15);

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function getHostedPassUrl(bookingToken) {
  // Build from the current hosted page. Do not hardcode a Vercel domain.
  const url = new URL("./darshan-pass.html", window.location.href);

  url.search = "";
  url.searchParams.set("token", bookingToken);
  url.hash = "";

  return url.href;
}

function generateQr(bookingToken) {
  const qrContainer = $("passQr");
  qrContainer.replaceChildren();

  if (!window.QRCode) {
    throw new Error(
      "The QR-code library did not load. Check your internet connection and reload the pass."
    );
  }

  const passUrl = getHostedPassUrl(bookingToken);

  new QRCode(qrContainer, {
    text: passUrl,
    width: 180,
    height: 180,
    correctLevel: QRCode.CorrectLevel.M
  });

  $("qrToken").textContent = bookingToken;
}

function getBookingFromResponse(data) {
  if (Array.isArray(data)) return data[0] || null;

  // Some RPCs return a single object, others wrap it in an array.
  return data || null;
}

function setBookingDetails(booking) {
  // Use the stored token exactly as returned by the database.
  // Do not generate a new token when the pass is reopened.
  const bookingToken = String(
    booking.booking_token || booking.booking_ref || token
  ).trim();

  if (!bookingToken) {
    throw new Error("The booking record does not contain a booking token.");
  }

  $("templeName").textContent =
    booking.temple_name || "Temple";

  $("templeCity").textContent =
    booking.temple_city || "City not listed";

  $("tokenNumber").textContent = bookingToken;
  $("qrToken").textContent = bookingToken;

  $("devoteeName").textContent =
    booking.devotee_name || "Devotee";

  const count = Number(booking.devotee_count ?? 1);

  $("devoteeCount").textContent =
    `${count} ${count === 1 ? "Devotee" : "Devotees"}`;

  const status = String(booking.status || "Unknown").toUpperCase();

  $("bookingStatus").textContent = status;
  $("statusPill").textContent = status;
  $("createdStatus").textContent = "● BOOKING RECORD FOUND";

  const dateValue = booking.darshan_date || booking.booking_date || "";

  $("darshanDate").textContent = formatDate(dateValue);
  $("dateIso").textContent = dateValue;

  const timeSlot =
    booking.time_slot ||
    (
      booking.slot_start && booking.slot_end
        ? `${booking.slot_start} - ${booking.slot_end}`
        : ""
    );

  $("darshanTime").textContent =
    timeSlot || "Confirm with temple";

  $("reportingTime").textContent =
    formatReportingTime(timeSlot);

  // Do not invent gate details if the database doesn't store them.
  $("entryGate").textContent =
    booking.entry_gate || "Confirm with temple staff";

  $("gateLocation").textContent =
    booking.gate_location || "No gate assignment stored";

  generateQr(bookingToken);

  document.title =
    `${booking.temple_name || "Temple"} | E-Darshan Pass`;

  showPass();
}

async function waitForQrRender() {
  // QRCodeJS may render a canvas or an image, depending on browser support.
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const qr = $("passQr");
  const image = qr.querySelector("img");

  if (image && !image.complete) {
    await new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }

  await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function printCompletePass() {
  if ($("passContainer").hidden) {
    showError("The pass has not loaded yet. Load a valid booking before printing.");
    return;
  }

  await waitForQrRender();

  // The print stylesheet hides navigation and the notice bar,
  // leaving the complete pass as the printable content.
  window.print();
}

async function loadPass() {
  if (!token || token.length > 200) {
    showError("This link does not contain a valid booking token.");
    return;
  }

  if (!window.supabase) {
    showError("Supabase did not load. Check your internet connection and reload.");
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    $("statusPill").textContent = "VERIFYING BOOKING";

    const { data, error } = await supabaseClient.rpc(
      "get_public_darshan_pass",
      { p_token: token }
    );

    if (error) {
      console.error("Pass lookup error:", error);
      throw new Error(
        "The booking could not be retrieved. Check the Supabase function and its permissions."
      );
    }

    const booking = getBookingFromResponse(data);

    if (!booking) {
      showError(
        "No booking was found for this token. Check the booking reference or whether the booking has been cancelled."
      );
      return;
    }

    setBookingDetails(booking);

    if (params.get("autoprint") === "1" && !printStarted) {
      printStarted = true;

      // Wait for content and QR rendering before opening print preview.
      await waitForQrRender();
      setTimeout(() => window.print(), 300);
    }
  } catch (error) {
    console.error("Could not load E-Darshan pass:", error);

    showError(
      error.message ||
      "Unable to load this pass. Please try again."
    );
  }
}

$("printPass").addEventListener("click", () => {
  printCompletePass().catch((error) => {
    console.error("Print failed:", error);
    showError("Unable to prepare the pass for printing. Please reload and try again.");
  });
});

$("retryPass").addEventListener("click", () => {
  window.location.reload();
});

window.addEventListener("beforeprint", () => {
  if ($("passContainer").hidden) {
    console.warn("The pass is not loaded; printing may be empty.");
  }
});

loadPass();
