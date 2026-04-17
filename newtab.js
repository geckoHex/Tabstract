(() => {
  const SEARCH_URL = "https://www.google.com/search?q=";

  const greetingEl = document.getElementById("greeting");
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-btn");

  // ── Greeting ──────────────────────────────────────────────────────────────

  function updateGreeting() {
    const hour = new Date().getHours();
    let text;
    if (hour < 5) text = "Good night.";
    else if (hour < 12) text = "Good morning.";
    else if (hour < 17) text = "Good afternoon.";
    else if (hour < 21) text = "Good evening.";
    else text = "Good night.";
    greetingEl.textContent = text;
  }

  // ── Clear button ──────────────────────────────────────────────────────────

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.classList.remove("visible");
    searchInput.focus();
  });

  // ── Navigate ──────────────────────────────────────────────────────────────

  function navigate(query) {
    if (!query.trim()) return;
    if (/^(https?:\/\/)|(localhost)/i.test(query) || /^[\w-]+\.[a-z]{2,}(\/|$)/i.test(query)) {
      const url = /^https?:\/\//i.test(query) ? query : `https://${query}`;
      window.location.href = url;
    } else {
      window.location.href = SEARCH_URL + encodeURIComponent(query);
    }
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchInput.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigate(searchInput.value.trim());
    }
  });

  // ── Input events ──────────────────────────────────────────────────────────

  searchInput.addEventListener("input", () => {
    clearBtn.classList.toggle("visible", searchInput.value.length > 0);
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  updateGreeting();
  searchInput.focus();
})();
