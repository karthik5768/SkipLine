(() => {
  const list = document.getElementById("waiting-list");
  const emptyState = document.getElementById("empty-queue");
  const count = document.getElementById("waiting-count");
  const currentToken = document.getElementById("admin-now-serving");
  const currentName = document.getElementById("admin-current-name");
  const average = document.getElementById("admin-average");
  const learning = document.getElementById("admin-learning");
  const errorMessage = document.getElementById("admin-error");
  const nextButton = document.getElementById("call-next");
  const resetButton = document.getElementById("reset-queue");
  let pollInFlight = false;

  function renderQueue(data) {
    currentToken.textContent = data.now_serving ? `#${data.now_serving}` : "#—";
    currentName.textContent = data.current_name || "No one at the counter";
    average.textContent = `${Number(data.avg_min).toLocaleString(undefined, { maximumFractionDigits: 1 })} min`;
    learning.textContent = data.learning
      ? `Learning estimate · ${data.click_count} Call Next ${data.click_count === 1 ? "click" : "clicks"}`
      : `Estimate based on ${data.click_count} Call Next clicks`;
    count.textContent = data.waiting.length;
    list.replaceChildren(...data.waiting.map((person) => {
      const item = document.createElement("li");
      item.className = "waiting-person";
      const ticket = document.createElement("span");
      ticket.className = "waiting-token";
      ticket.textContent = `#${person.token}`;
      const name = document.createElement("span");
      name.className = "waiting-name";
      name.textContent = person.name;
      item.append(ticket, name);
      return item;
    }));
    emptyState.hidden = data.waiting.length > 0;
    nextButton.disabled = false;
    errorMessage.textContent = "";
  }

  async function loadQueue() {
    if (pollInFlight) return;
    pollInFlight = true;
    try {
      const response = await fetch("/api/queue", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load the queue.");
      renderQueue(data);
    } catch (error) {
      errorMessage.textContent = "Unable to refresh the queue. Check the connection and try again.";
    } finally {
      pollInFlight = false;
    }
  }

  nextButton.addEventListener("click", async () => {
    nextButton.disabled = true;
    errorMessage.textContent = "";
    try {
      const response = await fetch("/api/next", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not call the next person.");
      await loadQueue();
    } catch (error) {
      nextButton.disabled = false;
      errorMessage.textContent = error.message || "Could not call the next person.";
    }
  });

  resetButton.addEventListener("click", async () => {
    if (!window.confirm("Reset the queue? This clears every ticket and starts token numbers again.")) return;
    resetButton.disabled = true;
    errorMessage.textContent = "";
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reset the queue.");
      await loadQueue();
    } catch (error) {
      errorMessage.textContent = error.message || "Could not reset the queue.";
    } finally {
      resetButton.disabled = false;
    }
  });

  loadQueue();
  window.setInterval(loadQueue, 2000);
})();
