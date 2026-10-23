"use strict";

/*
 * Smart Temple — Devotee Queue Card
 * Uses the existing Supabase client, logged-in user and booking list.
 * Does not change the existing booking flow.
 */

(function () {
  const $q = id => document.getElementById(id);

  function queueToday() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function queueText(value) {
    return String(value || "").toLowerCase();
  }

  function hideCard() {
    const card = $q("todayQueueCard");
    if (card) card.style.display = "none";
  }

  async function refreshQueueCard() {
    const card = $q("todayQueueCard");

    if (!card) return;

    // The existing dashboard.js defines these variables.
    if (typeof activeUser === "undefined" || !activeUser) {
      hideCard();
      return;
    }

    const bookings =
      Array.isArray(window.myBookings) ? window.myBookings : [];

    const today = queueToday();

    const booking = bookings.find(item =>
      String(item.booking_date || "").slice(0, 10) === today &&
      queueText(item.status) === "confirmed"
    );

    if (!booking) {
      hideCard();
      return;
    }

    card.style.display = "block";

    $q("queueTempleName").textContent =
      booking.temple_name || "Your Temple";

    $q("queueToken").textContent =
      booking.booking_ref || "ONL";

    $q("queueDevoteeCount").textContent =
      booking.devotee_count ?? 1;

    $q("queuePosition").textContent = "—";
    $q("queueStatusBadge").textContent = "CONFIRMED";
    $q("queueStatusMessage").textContent =
      "Your booking is confirmed. Live queue updates will appear when the Temple Admin queue is connected.";

    /*
     * This query becomes useful after the Temple Admin queue
     * has been created and populated in Supabase.
     */
    try {
      const { data, error } = await sb
        .from("darshan_queue")
        .select("status, queue_position, booking_token")
        .eq("user_id", activeUser.id)
        .eq("booking_token", booking.booking_ref)
        .eq("darshan_date", today)
        .maybeSingle();

      if (error) {
        // The queue table may not exist until the admin feature
        // is implemented. Keep the confirmed-booking card visible.
        console.info("Queue is not connected yet:", error.message);
        return;
      }

      if (!data) return;

      const status = queueText(data.status);

      const labels = {
        waiting: "WAITING",
        serving: "NOW SERVING",
        served: "SERVED"
      };

      const messages = {
        waiting: "Your token is waiting in the queue. Please wait for your turn.",
        serving: "It is your turn! Please proceed for darshan.",
        served: "Your darshan visit has been marked as served."
      };

      $q("queueStatusBadge").textContent =
        labels[status] || "CONFIRMED";

      $q("queueStatusMessage").textContent =
        messages[status] || "Your booking is confirmed.";

      $q("queuePosition").textContent =
        data.queue_position ?? "—";

    } catch (error) {
      console.error("Unable to refresh queue card:", error);
    }
  }

  /*
   * dashboard.js loads bookings asynchronously. Polling the
   * in-memory booking list allows this separate file to work
   * without modifying the existing booking functions.
   */
  function startQueueCard() {
    refreshQueueCard();

    window.setInterval(refreshQueueCard, 5000);

    // Refresh when a user returns to this browser tab.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshQueueCard();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startQueueCard);
  } else {
    startQueueCard();
  }
})();