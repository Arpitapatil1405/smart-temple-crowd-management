
"use strict";

const SUPABASE_URL = "https://vdcxvxtgkzwsknxmevwt.supabase.co";
const SUPABASE_KEY = "sb_publishable_xKYJqVUJ9CzA7TFxKKKjKQ_Nn6bdDLM";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

// Walk-in is intentionally demo data.
// Online booking and slot occupancy remain Supabase-backed.
const WALKIN_DEMO_COUNT = 4;

// Demo-only sensor and gate values.
const DEMO_SENSOR = Object.freeze({
  ambientTemp: "28.5°C",
  indoorAqi: "112",
  securityStatus: "SECURE",
  peopleArriving: 12,
  darshanRate: 5,
  openGates: 4
});

let currentUser = null;
let temples = [];
let currentTempleId = "";
let currentData = null;
let currentFilter = "all";
let toastTimer;
let refreshTimer = null;

const todayLocal = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const escapeHtml = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

function toast(message) {
  const el = $("toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3200);
}

function showOnly(id) {
  ["restrictedView", "selectorView", "dashboardView"].forEach(x => {
    const el = $(x);
    if (el) el.hidden = x !== id;
  });
}

function login() {
  location.href =
    "login.html?next=" +
    encodeURIComponent("live-crowd-status.html");
}

function formatTime(value) {
  if (!value) return "—";

  const [hh, mm] = value.slice(0, 5).split(":").map(Number);

  return `${String(hh % 12 || 12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
}

function formatDate(value) {
  if (!value) return "—";

  const [y, m, d] = value.split("-").map(Number);

  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function slotLabel(row) {
  return `${formatTime(row.slot_start)} - ${formatTime(row.slot_end)}`;
}

function isCancelled(status) {
  return ["cancelled", "canceled"].includes(
    String(status || "").toLowerCase()
  );
}

function isConfirmed(status) {
  return String(status || "").toLowerCase() === "confirmed";
}

function isVisited(status) {
  return ["visited", "admitted", "completed"].includes(
    String(status || "").toLowerCase()
  );
}

function setTextIfPresent(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

async function init() {
  $("loginButton").addEventListener("click", login);
  $("dialogLoginButton").addEventListener("click", login);

  $("dismissRestriction").addEventListener("click", () => {
    $("restrictedDialog").close();
  });

  $("changeTempleBtn").addEventListener("click", () => {
    showOnly("selectorView");
  });

  $("templeSelect").addEventListener("change", async e => {
    currentTempleId = e.target.value;

    if (currentTempleId) {
      await loadDashboard();
    }
  });

  $("slotDate").value = todayLocal();
  $("slotDate").addEventListener("change", loadDashboard);
  $("registrySearch").addEventListener("input", renderRegistry);

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;

      document.querySelectorAll("[data-filter]").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      renderRegistry();
    });
  });

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    if (!data.session) {
      showOnly("restrictedView");
      return;
    }

    currentUser = data.session.user;

    $("signOutBtn").hidden = false;

    $("signOutBtn").addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      location.href = "index.html";
    });

    await loadTemples();

    refreshTimer = setInterval(() => {
      if (
        currentTempleId &&
        currentUser &&
        !$("dashboardView").hidden
      ) {
        loadDashboard();
      }
    }, 30000);

  } catch (err) {
    console.error(err);

    showOnly("restrictedView");

    $("templeError").textContent =
      "Unable to verify login. Please refresh and try again.";
  }
}

async function loadTemples() {
  const select = $("templeSelect");

  select.replaceChildren(
    new Option("Loading temples…", "")
  );

  try {
    const { data, error } = await supabaseClient
      .from("temples")
      .select("id,name,city")
      .order("name");

    if (error) throw error;

    temples = (data || []).filter(t => t.id && t.name);

    if (!temples.length) {
      select.replaceChildren(
        new Option("No temples available", "")
      );

      $("templeError").textContent =
        "No temples are configured in Supabase yet.";

      showOnly("selectorView");
      return;
    }

    select.replaceChildren(
      new Option("-- Choose Temple --", "")
    );

    temples.forEach(t => {
      select.add(
        new Option(
          `${t.name}${t.city ? " — " + t.city : ""}`,
          t.id
        )
      );
    });

    showOnly("selectorView");

    const queryId =
      new URLSearchParams(location.search).get("temple");

    if (queryId && temples.some(t => t.id === queryId)) {
      select.value = queryId;
      currentTempleId = queryId;

      await loadDashboard();
    }

  } catch (err) {
    console.error("Temple list:", err);

    select.replaceChildren(
      new Option("Could not load temples", "")
    );

    $("templeError").textContent =
      "Could not load temples from Supabase. Check the temples table permissions and try again.";

    showOnly("selectorView");
  }
}

async function loadDashboard() {
  if (!currentTempleId || !currentUser) return;

  const temple = temples.find(t => t.id === currentTempleId);
  if (!temple) return;

  showOnly("dashboardView");

  $("selectedTempleName").textContent = temple.name;
  $("selectedTempleCity").textContent = temple.city || "";
  $("pageError").textContent = "";
  $("nowServing").textContent = "LOADING";

  [
    "totalRegistered",
    "activeQueue",
    "onlineActive",
    "upcomingBookings",
    "pastVisited",
    "capacityUsed",
    "capacityCaption",
    "allTabCount",
    "activeTabCount",
    "pastTabCount"
  ].forEach(id => setTextIfPresent(id, "—"));

  $("registryBody").innerHTML =
    '<tr><td colspan="6" class="empty-row">Loading booking records…</td></tr>';

  $("slotGrid").innerHTML =
    '<p class="empty-row">Loading slots from Supabase…</p>';

  try {
    const selectedDate = $("slotDate").value || todayLocal();

    const { data, error } = await supabaseClient.rpc(
      "get_live_temple_crowd_status",
      {
        p_temple_id: currentTempleId,
        p_slot_date: selectedDate
      }
    );

    if (error) throw error;

    if (!data || data.error) {
      throw new Error(data?.error || "No crowd data returned.");
    }

    currentData = data;

    renderMetrics(data);
    renderRegistry();
    renderSlots(data);
    renderPredictions(data);

    $("nowServing").textContent =
      data.now_serving || "NO ACTIVE TOKEN";

  } catch (err) {
    console.error("Crowd status load:", err);

    currentData = null;

    $("pageError").textContent =
      "Could not load live crowd data from Supabase. Check that the SQL setup file has been run and that this account is logged in.";

    $("nowServing").textContent = "UNAVAILABLE";

    $("registryBody").innerHTML =
      '<tr><td colspan="6" class="empty-row">Booking data unavailable.</td></tr>';

    $("slotGrid").innerHTML =
      '<p class="empty-row">Slot occupancy unavailable.</p>';

    [
      "totalRegistered",
      "activeQueue",
      "onlineActive",
      "upcomingBookings",
      "pastVisited",
      "capacityUsed",
      "capacityCaption",
      "allTabCount",
      "activeTabCount",
      "pastTabCount",
      "estimatedQueue",
      "systemLoad"
    ].forEach(id => setTextIfPresent(id, "—"));

    renderDemoSensors();
  }
}

// Demo sensor indicators are separate from booking and occupancy data.
function renderDemoSensors() {
  setTextIfPresent("ambientTemp", DEMO_SENSOR.ambientTemp);
  setTextIfPresent("indoorAqi", DEMO_SENSOR.indoorAqi);
  setTextIfPresent("securityStatus", DEMO_SENSOR.securityStatus);

  setTextIfPresent(
    "peopleArriving",
    `${DEMO_SENSOR.peopleArriving} /min`
  );

  setTextIfPresent(
    "darshanRate",
    `${DEMO_SENSOR.darshanRate} /min`
  );

  setTextIfPresent("openGates", DEMO_SENSOR.openGates);
}

function renderMetrics(data) {
  const m = data.metrics || {};
  const online = Number(m.active_online || 0);

  setTextIfPresent("totalRegistered", Number(m.total_registered || 0));
  setTextIfPresent("onlineActive", online);
  setTextIfPresent("walkinActive", WALKIN_DEMO_COUNT);

  setTextIfPresent(
    "activeQueue",
    online + WALKIN_DEMO_COUNT
  );

  setTextIfPresent(
    "upcomingBookings",
    Number(m.upcoming_bookings || 0)
  );

  setTextIfPresent(
    "pastVisited",
    Number(m.past_visited || 0)
  );

  // Real capacity metrics from Supabase.
  setTextIfPresent(
    "capacityUsed",
    m.capacity_percent == null
      ? "—"
      : `${m.capacity_percent}%`
  );

  setTextIfPresent(
    "capacityCaption",
    `${m.booked_for_date || 0} / ${m.capacity_for_date || 0} places booked`
  );

  setTextIfPresent(
    "allTabCount",
    (data.records || []).filter(r => !isCancelled(r.status)).length
  );

  setTextIfPresent(
    "activeTabCount",
    (data.records || []).filter(
      r => isConfirmed(r.status) && r.darshan_date === todayLocal()
    ).length
  );

  setTextIfPresent(
    "pastTabCount",
    (data.records || []).filter(r => isVisited(r.status)).length
  );

  renderDemoSensors();
}

function renderRegistry() {
  const body = $("registryBody");

  if (!currentData) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty-row">Booking data unavailable.</td></tr>';
    return;
  }

  const q = $("registrySearch").value.trim().toLowerCase();

  let rows = (currentData.records || []).filter(
    r => !isCancelled(r.status)
  );

  if (currentFilter === "active") {
    rows = rows.filter(
      r => isConfirmed(r.status) && r.darshan_date === todayLocal()
    );
  }

  if (currentFilter === "past") {
    rows = rows.filter(r => isVisited(r.status));
  }

  if (q) {
    rows = rows.filter(r =>
      `${r.booking_ref || ""} ${r.devotee_name || ""}`
        .toLowerCase()
        .includes(q)
    );
  }

  $("recordCount").textContent =
    `Showing ${rows.length} booking records`;

  if (!rows.length) {
    body.innerHTML =
      '<tr><td colspan="6" class="empty-row">No booking records match the selected filter.</td></tr>';
    return;
  }

  body.innerHTML = rows.map(r => `
    <tr>
      <td><span class="token">${escapeHtml(r.booking_ref || "—")}</span></td>
      <td>${escapeHtml(r.devotee_name || "Devotee")}</td>
      <td>${escapeHtml(formatDate(r.darshan_date))}</td>
      <td>${escapeHtml(r.time_slot || "—")}</td>
      <td>ONLINE</td>
      <td>
        <span class="status-pill ${isCancelled(r.status) ? "cancelled" : ""}">
          ${escapeHtml(r.status || "Unknown")}
        </span>
      </td>
    </tr>
  `).join("");
}

function renderSlots(data) {
  const grid = $("slotGrid");
  const slots = data.slots || [];

  if (!slots.length) {
    grid.innerHTML =
      '<p class="empty-row">No slots are configured in Supabase for this temple and date.</p>';
    return;
  }

  grid.innerHTML = slots.map(s => {
    const cap = Number(s.capacity || 0);
    const booked = Number(s.booked || 0);
    const available = Math.max(0, cap - booked);

    const pct = cap > 0
      ? Math.min(100, Math.round(booked / cap * 100))
      : 0;

    return `
      <article class="slot-card">
        <div class="slot-card-top">
          <h3>◷ ${escapeHtml(slotLabel(s))}</h3>
          <time>${escapeHtml(formatDate(s.slot_date))}</time>
        </div>

        <div class="progress" aria-label="${pct}% occupied">
          <span style="width:${pct}%"></span>
        </div>

        <div class="slot-foot">
          <span>${booked} / ${cap} Booked</span>
          <b>${available} Available</b>
        </div>
      </article>
    `;
  }).join("");
}

function renderPredictions(data) {
  const m = data.metrics || {};

  // Real online bookings + demo walk-in count.
  const active =
    Number(m.active_online || 0) + WALKIN_DEMO_COUNT;

  setTextIfPresent("estimatedQueue", active);

  // Real Supabase capacity percentage.
  setTextIfPresent(
    "systemLoad",
    m.capacity_percent == null
      ? "—"
      : `${m.capacity_percent}%`
  );

  // Demo queue and gate indicators.
  setTextIfPresent(
    "peopleArriving",
    `${DEMO_SENSOR.peopleArriving} /min`
  );

  setTextIfPresent(
    "darshanRate",
    `${DEMO_SENSOR.darshanRate} /min`
  );

  setTextIfPresent(
    "openGates",
    DEMO_SENSOR.openGates
  );

  // Estimated wait time uses the displayed queue estimate
  // and the demo darshan rate.
  const waitMinutes = DEMO_SENSOR.darshanRate > 0
    ? Math.ceil(active / DEMO_SENSOR.darshanRate)
    : null;

  const wait = $("waitTime");

  if (wait) {
    wait.innerHTML = waitMinutes === null
      ? "— <small>mins</small>"
      : `${waitMinutes} <small>mins</small>`;
  }
}

init();
