(() => {
  const STORAGE_KEY = "skipline-ticket-id";
  const LEGACY_STORAGE_KEY = "queueless-ticket-id";
  const formView = document.getElementById("join-form-view");
  const form = document.getElementById("join-form");
  const nameInput = document.getElementById("customer-name");
  const robotCheck = document.getElementById("robot-check");
  const joinButton = document.getElementById("join-button");
  const joinError = document.getElementById("join-error");
  const ticketView = document.getElementById("ticket-view");
  const connectionError = document.getElementById("connection-error");
  const statusPill = document.getElementById("ticket-status-pill");
  const turnHeading = document.getElementById("your-turn-heading");
  const token = document.getElementById("ticket-token");
  const ahead = document.getElementById("people-ahead");
  const wait = document.getElementById("wait-time");
  const nowServing = document.getElementById("now-serving");
  const message = document.getElementById("ticket-message");
  let ticketId = localStorage.getItem(STORAGE_KEY);
  if (!ticketId) {
    ticketId = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (ticketId) localStorage.setItem(STORAGE_KEY, ticketId);
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  let previousState = null;
  let requestInFlight = false;

  function showJoinForm() {
    formView.hidden = false;
    ticketView.hidden = true;
    document.body.classList.remove("turn-screen");
  }

  function displayStatus(data) {
    formView.hidden = true;
    ticketView.hidden = false;
    connectionError.textContent = "";
    token.textContent = `#${data.token}`;
    ahead.textContent = data.state === "waiting" ? data.ahead : "0";
    wait.textContent = `~${data.state === "waiting" ? Math.ceil(data.wait_min) : 0} min`;
    nowServing.textContent = data.now_serving ? `#${data.now_serving}` : "—";

    if (data.state === "called") {
      document.body.classList.add("turn-screen");
      turnHeading.hidden = false;
      statusPill.textContent = "Your turn";
      statusPill.classList.add("status-pill-turn");
      message.textContent = "Please head to the counter now.";
      if (previousState !== "called" && "vibrate" in navigator) navigator.vibrate([180, 100, 180]);
    } else if (data.state === "done") {
      document.body.classList.remove("turn-screen");
      turnHeading.hidden = true;
      statusPill.textContent = "Served";
      statusPill.classList.remove("status-pill-turn");
      message.textContent = "You have been served. Thank you for using Skipline.";
    } else {
      document.body.classList.remove("turn-screen");
      turnHeading.hidden = true;
      statusPill.textContent = "In the queue";
      statusPill.classList.remove("status-pill-turn");
      message.textContent = "Stay nearby. This page updates automatically.";
    }
    previousState = data.state;
  }

  async function refreshStatus() {
    if (!ticketId || requestInFlight) return;
    requestInFlight = true;
    try {
      const response = await fetch(`/api/status/${encodeURIComponent(ticketId)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.status === 404) {
        localStorage.removeItem(STORAGE_KEY);
        ticketId = null;
        previousState = null;
        showJoinForm();
        connectionError.textContent = "Your ticket is no longer active. Join the queue to get a new place.";
      } else if (!response.ok) {
        throw new Error(data.error || "Could not load your place in line.");
      } else {
        displayStatus(data);
      }
    } catch (error) {
      connectionError.textContent = "Could not update your place. Check your connection and we’ll try again.";
    } finally {
      requestInFlight = false;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    joinError.textContent = "";
    if (!robotCheck.checked) {
      robotCheck.reportValidity();
      return;
    }
    joinButton.disabled = true;
    joinButton.textContent = "Joining…";
    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not join the queue.");
      ticketId = data.id;
      localStorage.setItem(STORAGE_KEY, ticketId);
      previousState = null;
      await refreshStatus();
    } catch (error) {
      joinError.textContent = error.message || "Could not join. Please try again.";
    } finally {
      joinButton.disabled = false;
      joinButton.textContent = "Join Queue";
    }
  });

  if (ticketId) {
    formView.hidden = true;
    ticketView.hidden = false;
    refreshStatus();
    window.setInterval(refreshStatus, 3000);
  }
})();
