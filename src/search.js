import { linkIconSrc, queueFaviconCache } from "./favicons.js";
import { linkRoutesEnabled } from "./model.js";
import { state } from "./state.js";
import { hostname } from "./utils.js";

export function initBookmarkSearch(ctx) {
  const bookmarkSearchInput = document.getElementById("bookmark-search-input");
  const bookmarkClearBtn = document.getElementById("bookmark-clear-btn");
  const bookmarkSearchResults = document.getElementById("bookmark-search-results");
  const bookmarkSearchBox = document.querySelector(".bookmark-search-box");
  const toolsSection = document.getElementById("tools-section");
  const favoritesSection = document.getElementById("favorites-section");

  function collectAllLinks(items, folderNames, out = []) {
    for (const item of items) {
      if (item.type === "folder") {
        collectAllLinks(item.children, [...folderNames, item.name], out);
      } else if (item.type === "link") {
        const pathLabel = folderNames.length > 0 ? `Bookmarks › ${folderNames.join(" › ")}` : "Bookmarks";
        out.push({ link: item, pathLabel });
      }
    }
    return out;
  }

  function fuzzySimilarity(query, text) {
    const q = query.trim().toLowerCase();
    const t = text.toLowerCase();
    if (!q.length) return 0;
    if (!t.length) return -1;
    const idx = t.indexOf(q);
    if (idx !== -1) return 5000 + (200 - Math.min(199, idx)) + (q.length / t.length) * 50;
    let qi = 0;
    let score = 0;
    let prev = -999;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        const gap = i - prev - 1;
        score += 24 - Math.min(23, Math.max(0, gap));
        if (prev === i - 1) score += 18;
        if (i === 0 || /[\s›/._-]/.test(t[i - 1])) score += 10;
        prev = i;
        qi++;
      }
    }
    if (qi < q.length) return -1;
    score += (q.length / t.length) * 40;
    return score;
  }

  function bookmarkSearchHaystack(entry) {
    const title = entry.link.title || hostname(entry.link.url);
    const host = hostname(entry.link.url);
    return `${title} ${entry.pathLabel} ${host} ${entry.link.url}`;
  }

  function scoreBookmarkEntry(query, entry) {
    const title = entry.link.title || hostname(entry.link.url);
    const host = hostname(entry.link.url);
    return Math.max(
      fuzzySimilarity(query, title),
      fuzzySimilarity(query, entry.pathLabel),
      fuzzySimilarity(query, host),
      fuzzySimilarity(query, bookmarkSearchHaystack(entry)),
    );
  }

  function makeBookmarkSearchFallback(link) {
    const span = document.createElement("span");
    span.className = "bookmark-search-hit-fallback";
    span.textContent = (link.title || hostname(link.url) || "?")[0].toUpperCase();
    return span;
  }

  function updateBookmarkSearchResults() {
    const q = bookmarkSearchInput.value.trim();
    bookmarkClearBtn.classList.toggle("visible", q.length > 0);
    toolsSection.hidden = q.length > 0;
    favoritesSection.hidden = q.length > 0;

    const setResultsVisible = (visible) => {
      bookmarkSearchResults.hidden = !visible;
      bookmarkSearchBox.classList.toggle("has-results", visible);
    };
    if (!q) {
      bookmarkSearchResults.innerHTML = "";
      setResultsVisible(false);
      return;
    }

    const ranked = [];
    for (const entry of collectAllLinks(state.data.items, [], [])) {
      const score = scoreBookmarkEntry(q, entry);
      if (score >= 0) ranked.push({ entry, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, ctx.getStoredBookmarkSearchResultLimit());

    bookmarkSearchResults.innerHTML = "";
    if (top.length === 0) {
      setResultsVisible(false);
      return;
    }
    for (const { entry } of top) {
      const link = entry.link;
      const title = link.title || hostname(link.url);
      const fav = linkIconSrc(link);
      const li = document.createElement("li");
      li.setAttribute("role", "presentation");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bookmark-search-hit";
      btn.addEventListener("click", () => {
        if (linkRoutesEnabled(link)) ctx.openRoutePopup(link, btn);
        else {
          ctx.closeRouteChoiceModal();
          window.location.href = link.url;
        }
      });
      if (fav) {
        const img = document.createElement("img");
        img.className = "bookmark-search-hit-favicon";
        img.src = fav;
        img.alt = "";
        img.addEventListener("error", () => {
          img.replaceWith(makeBookmarkSearchFallback(link));
        });
        btn.appendChild(img);
      } else {
        queueFaviconCache(link.url);
        btn.appendChild(makeBookmarkSearchFallback(link));
      }
      const text = document.createElement("div");
      text.className = "bookmark-search-hit-text";
      const tEl = document.createElement("div");
      tEl.className = "bookmark-search-hit-title";
      tEl.textContent = title;
      const pEl = document.createElement("div");
      pEl.className = "bookmark-search-hit-path";
      pEl.textContent = entry.pathLabel;
      text.append(tEl, pEl);
      btn.appendChild(text);
      li.appendChild(btn);
      bookmarkSearchResults.appendChild(li);
    }
    setResultsVisible(true);
  }

  bookmarkClearBtn.addEventListener("click", () => {
    bookmarkSearchInput.value = "";
    bookmarkClearBtn.classList.remove("visible");
    updateBookmarkSearchResults();
    bookmarkSearchInput.focus();
  });
  bookmarkSearchInput.addEventListener("input", updateBookmarkSearchResults);
  bookmarkSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      bookmarkSearchInput.blur();
      return;
    }
    if (e.key === "Enter") {
      const first = bookmarkSearchResults.querySelector(".bookmark-search-hit");
      if (first) {
        e.preventDefault();
        first.click();
      }
    }
  });

  Object.assign(ctx, {
    focusBookmarkSearch: () => bookmarkSearchInput.focus(),
    updateBookmarkSearchResults,
  });
}
