
"use strict";

const SUPABASE_URL = "https://vdcxvxtgkzwsknxmevwt.supabase.co";
const SUPABASE_KEY = "PASTE_YOUR_EXISTING_PUBLISHABLE_KEY_HERE";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const token = new URLSearchParams(location.search).get("token");

function showError(message) {
  $("passContainer").hidden = true;
  $("errorState").hidden = false;
  $("errorMessage").textContent = message;
  $("statusPill").textContent = "PASS UNAVAILABLE";
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-IN", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  });
}

function formatReportingTime(slot) {
  const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "Confirm with temple";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;

  const date = new Date();
  date.setHours(hour, minute - 15, 0, 0);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true
  });
}

async function loadPass() {
  if (!token || token.length > 100) {
    showError("The QR link does not contain a valid booking token.");
    return;
  }

  if (!SUPABASE_KEY || SUPABASE_KEY.includes("PASTE_YOUR")) {
    showError("The pass page needs the Supabase publishable key.");
    return;
  }

  try {
    const { data, error } = await sb.rpc("get_public_darshan_pass", {
      p_token: token
    });

    if (error) throw error;
    if (!data) {
      showError("No active booking was found for this QR code. It may be invalid or cancelled.");
      return;
    }

    $("templeName").textContent = data.temple_name;
    $("templeCity").textContent = data.temple_city || "City not listed";
    $("tokenNumber").textContent = data.booking_token;
    $("qrToken").textContent = data.booking_token;
    $("devoteeName").textContent = data.devotee_name;
    $("devoteeCount").textContent =
      `${data.devotee_count} ${Number(data.devotee_count) === 1 ? "Devotee" : "Devotees"}`;
    $("bookingStatus").textContent = data.status.toUpperCase();
    $("darshanDate").textContent = formatDate(data.darshan_date);
    $("dateIso").textContent = data.darshan_date;
    $("darshanTime").textContent = data.time_slot;
    $("reportingTime").textContent = formatReportingTime(data.time_slot);
    $("statusPill").textContent = data.status.toUpperCase();
    $("createdStatus").textContent = "● BOOKING RECORD FOUND";

    $("entryGate").textContent = "Confirm with temple staff";
    $("gateLocation").textContent = "No gate assignment stored";

    const qr = $("passQr");
    qr.replaceChildren();

    // This QR opens this same pass URL on another device.
    if (window.QRCode) {
      new QRCode(qr, {
        text: location.href,
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      qr.textContent = "QR library unavailable.";
    }

    document.title = `${data.temple_name} | E-Darshan Pass`;
  } catch (error) {
    console.error("Pass lookup failed:", error);
    showError("We couldn't retrieve the pass. Check the database function, network connection, and Supabase settings.");
  }
}

$("printPass").addEventListener("click", () => window.print());
loadPass();
