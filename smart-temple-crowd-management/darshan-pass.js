
"use strict";

const SUPABASE_URL = "https://vdcxvxtgkzwsknxmevwt.supabase.co";

// Use the same Supabase publishable key as dashboard.js.
const SUPABASE_KEY = "sb_publishable_xKYJqVUJ9CzA7TFxKKKjKQ_Nn6bdDLM";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const token = params.get("token");

function showError(message) {
  $("passContainer").hidden = true;
  $("errorState").hidden = false;
  $("errorMessage").textContent = message;
  $("statusPill").textContent = "PASS UNAVAILABLE";
}

function formatDate(dateString) {
  if (!dateString) return "Date unavailable";

  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatReportingTime(slot) {
  const match = String(slot || "").match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );

  if (!match) return "Confirm with temple";

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  const date = new Date();
  date.setHours(hour, minute - 15, 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

async function loadPass() {
  if (!token || token.length > 100) {
    showError("This link has no valid booking token.");
    return;
  }

  if (!window.supabase || !SUPABASE_KEY) {
    showError("Supabase could not be initialized.");
    return;
  }

  try {
    const { data, error } = await sb.rpc("get_public_darshan_pass", {
      p_token: token
    });

    if (error) throw error;

    // A table-returning RPC may return an array.
    const booking = Array.isArray(data) ? data[0] : data;

    if (!booking) {
      showError(
        "No booking was found for this QR code. Check the booking token or whether the booking was cancelled."
      );
      return;
    }

    $("templeName").textContent = booking.temple_name || "Temple";
    $("templeCity").textContent = booking.temple_city || "City not listed";
    $("tokenNumber").textContent = booking.booking_token || token;
    $("qrToken").textContent = booking.booking_token || token;
    $("devoteeName").textContent = booking.devotee_name || "Devotee";
    $("devoteeCount").textContent =
      `${booking.devotee_count ?? 1} ${
        Number(booking.devotee_count ?? 1) === 1 ? "Devotee" : "Devotees"
      }`;

    $("bookingStatus").textContent =
      String(booking.status || "Unknown").toUpperCase();

    $("darshanDate").textContent = formatDate(booking.darshan_date);
    $("dateIso").textContent = booking.darshan_date || "";
    $("darshanTime").textContent = booking.time_slot || "Confirm with temple";
    $("reportingTime").textContent = formatReportingTime(booking.time_slot);

    $("statusPill").textContent =
      String(booking.status || "BOOKING FOUND").toUpperCase();

    $("createdStatus").textContent = "● BOOKING RECORD FOUND";
    $("entryGate").textContent = "Confirm with temple staff";
    $("gateLocation").textContent = "No gate assignment stored";

    const qr = $("passQr");
    qr.replaceChildren();

    // Keep the QR URL clean, even when this page was opened for printing.
    const passUrl = new URL(location.href);
    passUrl.searchParams.delete("autoprint");
    passUrl.searchParams.set("token", token);
    passUrl.hash = "";

    if (window.QRCode) {
      new QRCode(qr, {
        text: passUrl.href,
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      qr.textContent = "QR library unavailable. Reload the page with internet access.";
    }

    document.title = `${booking.temple_name || "Temple"} | E-Darshan Pass`;

    // Print only after the booking and QR have rendered.
    if (params.get("autoprint") === "1") {
      setTimeout(() => window.print(), 800);
    }
  } catch (error) {
    console.error("Pass lookup failed:", error);
    showError(
      "We couldn't retrieve this booking. Check the Supabase function, its permissions, and the network connection."
    );
  }
}

$("printPass").addEventListener("click", () => window.print());

loadPass();
