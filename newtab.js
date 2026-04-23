(() => {
  const SEARCH_URL = "https://www.google.com/search?q=";
  const DB_NAME = "TabstractDB";
  const DB_VERSION = 1;
  const ITEMS_STORE = "items";
  const FAVORITES_STORE = "favorites";
  const SETTINGS_STORE = "settings";

  const AI_PROVIDERS = {
    chatgpt: {
      id: "chatgpt",
      label: "ChatGPT",
      urlPrefix: "https://chatgpt.com/?q=",
      icon: "openai.svg",
      placeholder: "Ask ChatGPT...",
      inputAria: "ChatGPT prompt",
      clearAria: "Clear ChatGPT prompt",
    },
    claude: {
      id: "claude",
      label: "Claude",
      urlPrefix: "https://claude.ai/new?q=",
      icon: "claude.svg",
      placeholder: "Ask Claude...",
      inputAria: "Claude prompt",
      clearAria: "Clear Claude prompt",
    },
  };
  const iconSrc = (file) => chrome.runtime.getURL(`icons/${file}`);

  // ── Storage ────────────────────────────────────────────────────────────────

  const MAX_FAVORITES = 16;
  let dbPromise = null;

  function defaultData() {
    return { items: [], favorites: [] };
  }

  function defaultSettings() {
    return {
      aiProvider: "chatgpt",
      aiSearchEnabled: true,
    };
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionToPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ITEMS_STORE)) {
          const items = db.createObjectStore(ITEMS_STORE, { keyPath: "id" });
          items.createIndex("parentId", "parentId", { unique: false });
        }
        if (!db.objectStoreNames.contains(FAVORITES_STORE)) {
          db.createObjectStore(FAVORITES_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  function flattenItems(items, parentId = null, out = []) {
    items.forEach((item, position) => {
      if (item.type === "folder") {
        out.push({
          id: item.id,
          type: "folder",
          name: item.name,
          parentId,
          position,
        });
        flattenItems(item.children, item.id, out);
      } else if (item.type === "link") {
        out.push({
          id: item.id,
          type: "link",
          title: item.title,
          url: item.url,
          parentId,
          position,
        });
      }
    });
    return out;
  }

  function hydrateItems(records) {
    const childrenByParent = new Map();
    for (const record of records) {
      const bucket = childrenByParent.get(record.parentId) || [];
      bucket.push(record);
      childrenByParent.set(record.parentId, bucket);
    }

    function build(parentId = null) {
      const children = childrenByParent.get(parentId) || [];
      children.sort((a, b) => a.position - b.position);
      return children.map((record) => {
        if (record.type === "folder") {
          return {
            type: "folder",
            id: record.id,
            name: record.name || "Untitled Folder",
            children: build(record.id),
          };
        }
        return {
          type: "link",
          id: record.id,
          title: record.title || "",
          url: record.url || "",
        };
      });
    }

    return build(null);
  }

  function hydrateFavorites(records) {
    return records
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((record) => record.id);
  }

  function hydrateSettings(records) {
    const settings = defaultSettings();
    for (const record of records) {
      if (record.key === "aiProvider" && (record.value === "chatgpt" || record.value === "claude")) {
        settings.aiProvider = record.value;
      }
      if (record.key === "aiSearchEnabled") {
        settings.aiSearchEnabled = Boolean(record.value);
      }
    }
    return settings;
  }

  async function loadPersistedState() {
    const db = await openDatabase();
    const tx = db.transaction([ITEMS_STORE, FAVORITES_STORE, SETTINGS_STORE], "readonly");
    const itemsRequest = tx.objectStore(ITEMS_STORE).getAll();
    const favoritesRequest = tx.objectStore(FAVORITES_STORE).getAll();
    const settingsRequest = tx.objectStore(SETTINGS_STORE).getAll();
    const [itemRecords, favoriteRecords, settingRecords] = await Promise.all([
      requestToPromise(itemsRequest),
      requestToPromise(favoritesRequest),
      requestToPromise(settingsRequest),
      transactionToPromise(tx),
    ]);
    return {
      data: {
        items: hydrateItems(itemRecords),
        favorites: hydrateFavorites(favoriteRecords),
      },
      settings: hydrateSettings(settingRecords),
    };
  }

  async function saveData() {
    const db = await openDatabase();
    const tx = db.transaction([ITEMS_STORE, FAVORITES_STORE], "readwrite");
    const itemStore = tx.objectStore(ITEMS_STORE);
    const favoriteStore = tx.objectStore(FAVORITES_STORE);

    itemStore.clear();
    favoriteStore.clear();

    for (const record of flattenItems(data.items)) {
      itemStore.put(record);
    }
    data.favorites.forEach((id, position) => {
      favoriteStore.put({ id, position });
    });

    await transactionToPromise(tx);
  }

  async function saveSetting(key, value) {
    const db = await openDatabase();
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).put({ key, value });
    await transactionToPromise(tx);
  }

  function reportStorageError(error) {
    console.error("IndexedDB operation failed", error);
  }

  let data = defaultData();
  let settings = defaultSettings();

  // ── Navigation state: array of folder IDs from root to current ────────────

  let currentPath = []; // e.g. ['folderId1', 'folderId2']

  // ── Drag state ─────────────────────────────────────────────────────────────

  let drag = null;    // { itemId, dropTarget } — bookmark grid
  let favDrag = null; // { favId, dropTarget }  — favorites grid

  // ══════════════════════════════════════════════════════════════════════════
  // CLOCK
  // ══════════════════════════════════════════════════════════════════════════

  function updateClock() {
    const el = document.getElementById("clock");
    const now = new Date();
    el.textContent = now.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ══════════════════════════════════════════════════════════════════════════

  const searchInput = document.getElementById("search-input");
  const clearBtn    = document.getElementById("clear-btn");

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.classList.remove("visible");
    searchInput.focus();
  });

  function navigate(query) {
    if (!query.trim()) return;
    if (/^(https?:\/\/|localhost)/i.test(query) || /^[\w-]+\.[a-z]{2,}(\/|$)/i.test(query)) {
      window.location.href = /^https?:\/\//i.test(query) ? query : `https://${query}`;
    } else {
      window.location.href = SEARCH_URL + encodeURIComponent(query);
    }
  }

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") searchInput.blur();
    else if (e.key === "Enter") { e.preventDefault(); navigate(searchInput.value.trim()); }
  });

  searchInput.addEventListener("input", () => {
    clearBtn.classList.toggle("visible", searchInput.value.length > 0);
  });

  // ── AI prompt (left panel; provider from settings) ─────────────────────────

  const aiSearchForm = document.getElementById("ai-search-form");
  const aiSearchIcon = document.getElementById("ai-search-icon");
  const aiSearchInput = document.getElementById("ai-search-input");
  const aiClearBtn = document.getElementById("ai-clear-btn");
  const aiProviderCustom = document.getElementById("ai-provider-custom-select");
  const aiProviderTrigger = document.getElementById("ai-provider-trigger");
  const aiProviderTriggerText = document.getElementById("ai-provider-trigger-text");
  const aiProviderList = document.getElementById("ai-provider-list");
  const aiSearchEnabledInput = document.getElementById("ai-search-enabled");
  const aiProviderSettingsRow = document.getElementById("ai-provider-settings-row");

  let aiProviderId = "chatgpt";

  function getStoredAiProvider() {
    return settings.aiProvider;
  }

  function getStoredAiSearchEnabled() {
    return settings.aiSearchEnabled;
  }

  async function setStoredAiSearchEnabled(on) {
    settings.aiSearchEnabled = on;
    await saveSetting("aiSearchEnabled", on);
  }

  function setAiSearchProviderSettingRowVisible(visible) {
    if (!aiProviderSettingsRow) return;
    aiProviderSettingsRow.classList.toggle("settings-ai-provider-row--collapsed", !visible);
    aiProviderSettingsRow.toggleAttribute("hidden", !visible);
    if (!visible) closeAiProviderDropdown();
  }

  function applyAiSearchBoxVisibility(enabled) {
    aiSearchForm.hidden = !enabled;
    if (aiSearchEnabledInput) aiSearchEnabledInput.checked = enabled;
    setAiSearchProviderSettingRowVisible(enabled);
  }

  function providerOrDefault(id) {
    return AI_PROVIDERS[id] || AI_PROVIDERS.chatgpt;
  }

  async function applyAiSearchProvider(id, { persist } = {}) {
    const p = providerOrDefault(id);
    aiProviderId = p.id;
    if (persist) {
      settings.aiProvider = aiProviderId;
      await saveSetting("aiProvider", aiProviderId);
    }
    aiSearchIcon.src = `icons/${p.icon}`;
    aiSearchInput.placeholder = p.placeholder;
    aiSearchInput.setAttribute("aria-label", p.inputAria);
    aiClearBtn.setAttribute("aria-label", p.clearAria);
    syncAiProviderCustomSelect();
  }

  function syncAiProviderCustomSelect() {
    if (!aiProviderTriggerText || !aiProviderList) return;
    const p = providerOrDefault(aiProviderId);
    aiProviderTriggerText.textContent = p.label;
    aiProviderList.querySelectorAll("[role='option']").forEach((opt) => {
      const on = opt.getAttribute("data-value") === aiProviderId;
      opt.setAttribute("aria-selected", on ? "true" : "false");
      opt.classList.toggle("is-selected", on);
    });
  }

  function isAiProviderDropdownOpen() {
    return aiProviderTrigger && aiProviderTrigger.getAttribute("aria-expanded") === "true";
  }

  function setAiProviderDropdownOpen(open) {
    if (!aiProviderTrigger || !aiProviderList) return;
    aiProviderList.hidden = !open;
    aiProviderTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeAiProviderDropdown() {
    setAiProviderDropdownOpen(false);
  }

  function openAiProviderDropdown() {
    setAiProviderDropdownOpen(true);
  }

  function focusAiProviderOption(dir) {
    const opts = [...aiProviderList.querySelectorAll("[role='option']")];
    if (!opts.length) return;
    const ix = opts.findIndex((o) => o === document.activeElement);
    const next =
      ix < 0
        ? dir === 1
          ? 0
          : opts.length - 1
        : Math.min(Math.max(ix + dir, 0), opts.length - 1);
    opts[next].focus();
  }

  async function initAiSearchProvider() {
    await applyAiSearchProvider(getStoredAiProvider(), { persist: false });
  }

  function navigateToAi(prompt) {
    const q = prompt.trim();
    if (!q) return;
    const p = providerOrDefault(aiProviderId);
    window.location.href = p.urlPrefix + encodeURIComponent(q);
  }

  aiClearBtn.addEventListener("click", () => {
    aiSearchInput.value = "";
    aiClearBtn.classList.remove("visible");
    aiSearchInput.focus();
  });

  aiSearchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    navigateToAi(aiSearchInput.value);
  });

  aiSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") aiSearchInput.blur();
  });

  aiSearchInput.addEventListener("input", () => {
    aiClearBtn.classList.toggle("visible", aiSearchInput.value.length > 0);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BOOKMARK SEARCH (fuzzy, all folders)
  // ══════════════════════════════════════════════════════════════════════════

  const bookmarkSearchInput = document.getElementById("bookmark-search-input");
  const bookmarkClearBtn = document.getElementById("bookmark-clear-btn");
  const bookmarkSearchResults = document.getElementById("bookmark-search-results");
  const favoritesSection = document.getElementById("favorites-section");

  function collectAllLinks(items, folderNames, out = []) {
    for (const item of items) {
      if (item.type === "folder") {
        collectAllLinks(item.children, [...folderNames, item.name], out);
      } else if (item.type === "link") {
        const pathLabel =
          folderNames.length > 0
            ? `Bookmarks › ${folderNames.join(" › ")}`
            : "Bookmarks";
        out.push({ link: item, pathLabel });
      }
    }
    return out;
  }

  /**
   * Returns a similarity score (higher is better), or -1 if the query does not
   * fuzzy-match as a subsequence (case-insensitive).
   */
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
    const parts = [
      fuzzySimilarity(query, title),
      fuzzySimilarity(query, entry.pathLabel),
      fuzzySimilarity(query, host),
      fuzzySimilarity(query, bookmarkSearchHaystack(entry)),
    ];
    return Math.max(...parts);
  }

  function updateBookmarkSearchResults() {
    const q = bookmarkSearchInput.value.trim();
    bookmarkClearBtn.classList.toggle("visible", q.length > 0);
    favoritesSection.hidden = q.length > 0;

    if (!q) {
      bookmarkSearchResults.innerHTML = "";
      bookmarkSearchResults.hidden = true;
      return;
    }

    const flat = collectAllLinks(data.items, [], []);
    const ranked = [];
    for (const entry of flat) {
      const s = scoreBookmarkEntry(q, entry);
      if (s >= 0) ranked.push({ entry, score: s });
    }
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 5);

    bookmarkSearchResults.innerHTML = "";
    if (top.length === 0) {
      bookmarkSearchResults.hidden = true;
      return;
    }

    for (const { entry } of top) {
      const link = entry.link;
      const title = link.title || hostname(link.url);
      const fav = faviconSrc(link.url);

      const li = document.createElement("li");
      li.setAttribute("role", "presentation");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bookmark-search-hit";
      btn.addEventListener("click", () => {
        window.location.href = link.url;
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
      text.appendChild(tEl);
      text.appendChild(pEl);
      btn.appendChild(text);

      li.appendChild(btn);
      bookmarkSearchResults.appendChild(li);
    }
    bookmarkSearchResults.hidden = false;
  }

  function makeBookmarkSearchFallback(link) {
    const span = document.createElement("span");
    span.className = "bookmark-search-hit-fallback";
    span.textContent = (link.title || hostname(link.url) || "?")[0].toUpperCase();
    return span;
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

  // ══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function normaliseUrl(url) {
    if (!url) return "";
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  /** True if the host looks like a real web target (not arbitrary words turned into https://word). */
  function isHttpUrlHostPlausible(host) {
    if (!host) return false;
    const h = host.toLowerCase();
    if (h === "localhost") return true;
    if (h.includes(".")) return true;
    if (h.includes(":")) return true; // IPv6
    return false;
  }

  /** If clipboard text is a single http(s) URL, return normalised URL; else null. */
  function urlFromClipboardText(text) {
    const raw = String(text).trim();
    if (!raw || /\s/.test(raw)) return null;
    const u = normaliseUrl(raw);
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      if (!isHttpUrlHostPlausible(parsed.hostname)) return null;
      return u;
    } catch {
      return null;
    }
  }

  function hostname(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url; }
  }

  function faviconSrc(url) {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
    } catch { return null; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DATA OPERATIONS  (recursive — supports nested folders)
  // ══════════════════════════════════════════════════════════════════════════

  // Returns { item, arr } or null
  function findItem(items, id) {
    for (const item of items) {
      if (item.id === id) return { item, arr: items };
      if (item.type === "folder") {
        const r = findItem(item.children, id);
        if (r) return r;
      }
    }
    return null;
  }

  /** Folder id chain from root down to and including `folderId` (opens that folder). */
  function pathIdsToFolder(folderId, items = data.items, prefix = []) {
    for (const item of items) {
      if (item.type !== "folder") continue;
      const chain = [...prefix, item.id];
      if (item.id === folderId) return chain;
      const found = pathIdsToFolder(folderId, item.children, chain);
      if (found) return found;
    }
    return null;
  }

  function pruneStaleFavorites() {
    const next = data.favorites.filter((id) => findItem(data.items, id));
    if (next.length !== data.favorites.length) {
      data.favorites = next;
      void saveData().catch(reportStorageError);
    }
  }

  // Removes item from wherever it lives; returns the item
  function extractItem(id) {
    const r = findItem(data.items, id);
    if (!r) return null;
    r.arr.splice(r.arr.indexOf(r.item), 1);
    return r.item;
  }

  // Returns the array of items at the current path (the "open folder" contents)
  function currentItems() {
    let arr = data.items;
    for (const id of currentPath) {
      const folder = arr.find(i => i.type === "folder" && i.id === id);
      if (!folder) return arr; // guard
      arr = folder.children;
    }
    return arr;
  }

  // Delete any item by id (folders: children are lost)
  async function deleteItem(id) {
    extractItem(id);
    data.favorites = data.favorites.filter((fid) => fid !== id);
    await saveData();
    render();
  }

  // Move `id` into `targetFolderId`, appended at end
  async function moveIntoFolder(id, targetFolderId) {
    const item = extractItem(id);
    if (!item) return;
    const r = findItem(data.items, targetFolderId);
    if (r && r.item.type === "folder") {
      r.item.children.push(item);
    } else {
      // fallback: restore at root
      data.items.push(item);
    }
    await saveData();
    render();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PATH BAR
  // ══════════════════════════════════════════════════════════════════════════

  function renderPathBar() {
    const bar = document.getElementById("path-bar");
    bar.innerHTML = "";

    // Root segment
    const rootBtn = document.createElement("button");
    rootBtn.className = "path-segment" + (currentPath.length === 0 ? " current" : "");
    rootBtn.innerHTML = `<img class="path-icon" src="${iconSrc("house.svg")}" alt="" width="16" height="16" /><span class="path-root-label">Bookmarks</span>`;
    rootBtn.addEventListener("click", () => { currentPath = []; render(); });
    bar.appendChild(rootBtn);

    // Folder segments
    let arr = data.items;
    for (let i = 0; i < currentPath.length; i++) {
      const id = currentPath[i];
      const folder = arr.find(f => f.type === "folder" && f.id === id);
      if (!folder) break;

      const sep = document.createElement("span");
      sep.className = "path-sep";
      sep.textContent = "›";
      bar.appendChild(sep);

      const btn = document.createElement("button");
      const isCurrent = i === currentPath.length - 1;
      btn.className = "path-segment" + (isCurrent ? " current" : "");
      btn.textContent = folder.name;
      if (!isCurrent) {
        btn.addEventListener("click", () => {
          currentPath = currentPath.slice(0, i + 1);
          render();
        });
      }
      bar.appendChild(btn);

      arr = folder.children;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ICON RENDERING
  // ══════════════════════════════════════════════════════════════════════════

  const grid = document.getElementById("icon-grid");
  const favoritesGrid = document.getElementById("favorites-grid");
  const itemContextMenu = document.getElementById("item-context-menu");
  const ctxFavorite = document.getElementById("ctx-favorite");
  const ctxFavoriteLabel = document.getElementById("ctx-favorite-label");
  const ctxEdit = document.getElementById("ctx-edit");
  const ctxDelete = document.getElementById("ctx-delete");

  let contextItemId = null;
  let contextItemType = null; // "folder" | "link"

  function hideContextMenu() {
    itemContextMenu.hidden = true;
    contextItemId = null;
    contextItemType = null;
  }

  function positionContextMenu(e) {
    const pad = 8;
    let x = e.clientX;
    let y = e.clientY;
    itemContextMenu.hidden = false;
    itemContextMenu.style.left = `${x}px`;
    itemContextMenu.style.top = `${y}px`;
    const rect = itemContextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth - pad) x = window.innerWidth - rect.width - pad;
    if (rect.bottom > window.innerHeight - pad) y = window.innerHeight - rect.height - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    itemContextMenu.style.left = `${x}px`;
    itemContextMenu.style.top = `${y}px`;
  }

  function showItemContextMenu(e, id, type) {
    e.preventDefault();
    contextItemId = id;
    contextItemType = type;
    const already = data.favorites.includes(id);
    if (already) {
      ctxFavoriteLabel.textContent = "Unfavorite";
      ctxFavorite.disabled = false;
    } else {
      ctxFavoriteLabel.textContent = "Favorite";
      ctxFavorite.disabled = data.favorites.length >= MAX_FAVORITES;
    }
    positionContextMenu(e);
  }

  document.addEventListener("mousedown", (e) => {
    if (itemContextMenu.hidden) return;
    if (!itemContextMenu.contains(e.target)) hideContextMenu();
  });

  document.getElementById("grid-scroll").addEventListener("scroll", () => {
    if (!itemContextMenu.hidden) hideContextMenu();
  });

  document.getElementById("favorites-scroll").addEventListener("scroll", () => {
    if (!itemContextMenu.hidden) hideContextMenu();
  });

  async function handleFavoriteToggle() {
    if (!contextItemId || ctxFavorite.disabled) return;
    const id = contextItemId;
    const ix = data.favorites.indexOf(id);
    if (ix >= 0) {
      data.favorites.splice(ix, 1);
    } else if (data.favorites.length < MAX_FAVORITES) {
      data.favorites.push(id);
    }
    await saveData();
    hideContextMenu();
    render();
  }

  ctxFavorite.addEventListener("click", () => {
    void handleFavoriteToggle().catch(reportStorageError);
  });

  ctxEdit.addEventListener("click", () => {
    if (!contextItemId) return;
    const r = findItem(data.items, contextItemId);
    if (!r) { hideContextMenu(); return; }
    if (contextItemType === "link" && r.item.type === "link") openLinkModalForEdit(r.item);
    else if (contextItemType === "folder" && r.item.type === "folder") openFolderModalForEdit(r.item);
    hideContextMenu();
  });

  // ── Confirm delete modal (generic destructive action) ─────────────────────

  const deleteConfirmModal = document.getElementById("delete-confirm-modal");
  const deleteModalTitle = document.getElementById("delete-modal-title");
  const deleteModalMessage = document.getElementById("delete-modal-message");
  const deleteConfirmBtn = document.getElementById("delete-confirm");
  let pendingConfirmAction = null;

  function openDestructiveConfirm({ title, message, confirmLabel = "Confirm", action }) {
    pendingConfirmAction = action;
    deleteModalTitle.textContent = title;
    deleteModalMessage.textContent = message;
    deleteConfirmBtn.textContent = confirmLabel;
    deleteConfirmModal.hidden = false;
  }

  function openDeleteConfirm(id) {
    const r = findItem(data.items, id);
    if (!r) return;
    const item = r.item;
    let title, message;
    if (item.type === "link") {
      const label = item.title || hostname(item.url);
      title = "Delete bookmark?";
      message = `Permanently delete "${label}"?`;
    } else {
      const n = item.children.length;
      const itemWord = n === 1 ? "item" : "items";
      title = "Delete folder?";
      message = `Permanently delete the folder "${item.name}" and all ${n} ${itemWord} inside it?`;
    }
    openDestructiveConfirm({ title, message, confirmLabel: "Delete", action: async () => deleteItem(id) });
  }

  function closeDeleteConfirm() {
    deleteConfirmModal.hidden = true;
    pendingConfirmAction = null;
  }

  document.getElementById("delete-modal-close").addEventListener("click", closeDeleteConfirm);
  document.getElementById("delete-cancel").addEventListener("click", closeDeleteConfirm);
  async function runPendingConfirmAction() {
    const action = pendingConfirmAction;
    closeDeleteConfirm();
    if (action) {
      await action();
    }
  }

  deleteConfirmBtn.addEventListener("click", () => {
    void runPendingConfirmAction().catch(reportStorageError);
  });
  deleteConfirmModal.addEventListener("click", (e) => {
    if (e.target === deleteConfirmModal) closeDeleteConfirm();
  });

  ctxDelete.addEventListener("click", () => {
    if (!contextItemId) { hideContextMenu(); return; }
    const id = contextItemId;
    hideContextMenu();
    openDeleteConfirm(id);
  });

  function render() {
    renderPathBar();
    grid.innerHTML = "";

    const items = currentItems();

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "grid-empty";
      const isRoot = currentPath.length === 0;
      empty.innerHTML = `
        <img class="empty-bookmark-icon" src="${iconSrc("bookmark-simple.svg")}" alt="" width="40" height="40" />
        <p>${isRoot ? "No bookmarks yet.<br>Add links or folders above." : "This folder is empty.<br>Use Add Link to add one."}</p>`;
      grid.appendChild(empty);
      updateBookmarkSearchResults();
      renderFavorites();
      return;
    }

    for (const item of items) {
      grid.appendChild(item.type === "folder" ? makeFolderIcon(item) : makeLinkIcon(item));
    }
    updateBookmarkSearchResults();
    renderFavorites();
  }

  function renderFavorites() {
    pruneStaleFavorites();
    favoritesGrid.innerHTML = "";
    for (const id of data.favorites) {
      const r = findItem(data.items, id);
      if (!r) continue;
      const item = r.item;
      const node =
        item.type === "folder"
          ? makeFolderIcon(item, { draggable: false, navigateFromRoot: true })
          : makeLinkIcon(item, { draggable: false });

      node.draggable = true;
      node.addEventListener("dragstart", (e) => {
        favDrag = { favId: id, dropTarget: null };
        node.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      node.addEventListener("dragend", () => {
        favDrag = null;
        node.classList.remove("dragging");
        clearAllDropIndicators();
      });

      favoritesGrid.appendChild(node);
    }
  }

  // ── Folder icon ────────────────────────────────────────────────────────────

  function makeFolderIcon(folder, opts = {}) {
    const { draggable = true, navigateFromRoot = false } = opts;
    const el = document.createElement("div");
    el.className = "icon-item";
    el.dataset.id = folder.id;

    const wrap = document.createElement("div");
    wrap.className = "folder-icon-wrap";
    const folderImg = document.createElement("img");
    folderImg.className = "folder-grid-icon";
    folderImg.src = iconSrc("folder.svg");
    folderImg.alt = "";
    folderImg.width = 60;
    folderImg.height = 60;
    wrap.appendChild(folderImg);
    el.appendChild(wrap);

    // Label
    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = folder.name;
    el.appendChild(label);

    el.addEventListener("contextmenu", (e) => showItemContextMenu(e, folder.id, "folder"));

    // Click → navigate into folder
    el.addEventListener("click", () => {
      if (navigateFromRoot) {
        const p = pathIdsToFolder(folder.id);
        if (p) currentPath = p;
      } else {
        currentPath = [...currentPath, folder.id];
      }
      render();
    });

    // Drag & drop (as drag source)
    el.draggable = draggable;
    if (draggable) {
      el.addEventListener("dragstart", (e) => {
        drag = { itemId: folder.id, dropTarget: null };
        el.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      el.addEventListener("dragend", () => {
        drag = null;
        el.classList.remove("dragging");
        clearAllDropIndicators();
      });
    }

    return el;
  }

  // ── Link icon ──────────────────────────────────────────────────────────────

  function makeLinkIcon(link, opts = {}) {
    const { draggable = true } = opts;
    const el = document.createElement("div");
    el.className = "icon-item";
    el.dataset.id = link.id;

    // Favicon wrapper
    const wrap = document.createElement("div");
    wrap.className = "link-icon-wrap";

    const favSrc = faviconSrc(link.url);
    if (favSrc) {
      const img = document.createElement("img");
      img.className = "favicon";
      img.src = favSrc;
      img.alt = "";
      img.addEventListener("error", () => {
        img.remove();
        wrap.appendChild(makeFallbackLetter(link));
      });
      wrap.appendChild(img);
    } else {
      wrap.appendChild(makeFallbackLetter(link));
    }

    el.appendChild(wrap);

    // Label
    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = link.title || hostname(link.url);
    el.appendChild(label);

    el.addEventListener("contextmenu", (e) => showItemContextMenu(e, link.id, "link"));

    // Click → open URL
    el.addEventListener("click", () => {
      window.location.href = link.url;
    });

    // Drag source
    el.draggable = draggable;
    if (draggable) {
      el.addEventListener("dragstart", (e) => {
        drag = { itemId: link.id, dropTarget: null };
        el.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      el.addEventListener("dragend", () => {
        drag = null;
        el.classList.remove("dragging");
        clearAllDropIndicators();
      });
    }

    return el;
  }

  function makeFallbackLetter(link) {
    const span = document.createElement("span");
    span.className = "favicon-fallback";
    span.textContent = (link.title || hostname(link.url) || "?")[0].toUpperCase();
    return span;
  }

  // ── Drag-to-reorder ────────────────────────────────────────────────────────

  function clearAllDropIndicators() {
    document.querySelectorAll(".drop-target, .drop-before, .drop-after")
      .forEach(el => el.classList.remove("drop-target", "drop-before", "drop-after"));
  }

  async function reorderItemBefore(id, beforeId) {
    const item = extractItem(id);
    if (!item) return;
    const items = currentItems();
    const idx = items.findIndex(i => i.id === beforeId);
    items.splice(idx === -1 ? items.length : idx, 0, item);
    await saveData();
    render();
  }

  async function reorderItemAfter(id, afterId) {
    const item = extractItem(id);
    if (!item) return;
    const items = currentItems();
    const idx = items.findIndex(i => i.id === afterId);
    items.splice(idx === -1 ? items.length : idx + 1, 0, item);
    await saveData();
    render();
  }

  grid.addEventListener("dragover", (e) => {
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const target = e.target.closest(".icon-item");
    if (!target || target.dataset.id === drag.itemId) {
      clearAllDropIndicators();
      drag.dropTarget = null;
      return;
    }

    const targetId = target.dataset.id;
    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const isFolder = !!currentItems().find(i => i.id === targetId && i.type === "folder");

    clearAllDropIndicators();

    if (isFolder) {
      const inset = rect.width * 0.28;
      if (e.clientX >= rect.left + inset && e.clientX <= rect.right - inset) {
        target.classList.add("drop-target");
        drag.dropTarget = { mode: "into", id: targetId };
      } else if (e.clientX < midX) {
        target.classList.add("drop-before");
        drag.dropTarget = { mode: "before", id: targetId };
      } else {
        target.classList.add("drop-after");
        drag.dropTarget = { mode: "after", id: targetId };
      }
    } else {
      if (e.clientX < midX) {
        target.classList.add("drop-before");
        drag.dropTarget = { mode: "before", id: targetId };
      } else {
        target.classList.add("drop-after");
        drag.dropTarget = { mode: "after", id: targetId };
      }
    }
  });

  grid.addEventListener("dragleave", (e) => {
    if (!drag || grid.contains(e.relatedTarget)) return;
    clearAllDropIndicators();
    drag.dropTarget = null;
  });

  async function handleGridDrop(e) {
    e.preventDefault();
    if (!drag) return;
    clearAllDropIndicators();
    const dt = drag.dropTarget;
    const itemId = drag.itemId;
    if (!dt) {
      const item = extractItem(itemId);
      if (item) {
        currentItems().push(item);
        await saveData();
        render();
      }
    } else if (dt.mode === "into") {
      await moveIntoFolder(itemId, dt.id);
    } else if (dt.mode === "before") {
      await reorderItemBefore(itemId, dt.id);
    } else if (dt.mode === "after") {
      await reorderItemAfter(itemId, dt.id);
    }
  }

  grid.addEventListener("drop", (e) => {
    void handleGridDrop(e).catch(reportStorageError);
  });

  // ── Favorites drag-to-reorder ──────────────────────────────────────────────

  async function reorderFavoriteBefore(favId, beforeId) {
    const fromIdx = data.favorites.indexOf(favId);
    const arr = data.favorites;
    arr.splice(fromIdx, 1);
    const toIdx = arr.indexOf(beforeId);
    arr.splice(toIdx === -1 ? arr.length : toIdx, 0, favId);
    await saveData();
    renderFavorites();
  }

  async function reorderFavoriteAfter(favId, afterId) {
    const fromIdx = data.favorites.indexOf(favId);
    const arr = data.favorites;
    arr.splice(fromIdx, 1);
    const toIdx = arr.indexOf(afterId);
    arr.splice(toIdx === -1 ? arr.length : toIdx + 1, 0, favId);
    await saveData();
    renderFavorites();
  }

  favoritesGrid.addEventListener("dragover", (e) => {
    if (!favDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const target = e.target.closest(".icon-item");
    if (!target || target.dataset.id === favDrag.favId) {
      clearAllDropIndicators();
      favDrag.dropTarget = null;
      return;
    }

    const targetId = target.dataset.id;
    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    clearAllDropIndicators();

    if (e.clientX < midX) {
      target.classList.add("drop-before");
      favDrag.dropTarget = { mode: "before", id: targetId };
    } else {
      target.classList.add("drop-after");
      favDrag.dropTarget = { mode: "after", id: targetId };
    }
  });

  favoritesGrid.addEventListener("dragleave", (e) => {
    if (!favDrag || favoritesGrid.contains(e.relatedTarget)) return;
    clearAllDropIndicators();
    favDrag.dropTarget = null;
  });

  async function handleFavoritesDrop(e) {
    e.preventDefault();
    if (!favDrag) return;
    clearAllDropIndicators();
    const dt = favDrag.dropTarget;
    const favId = favDrag.favId;
    if (!dt) return;
    if (dt.mode === "before") {
      await reorderFavoriteBefore(favId, dt.id);
    } else if (dt.mode === "after") {
      await reorderFavoriteAfter(favId, dt.id);
    }
  }

  favoritesGrid.addEventListener("drop", (e) => {
    void handleFavoritesDrop(e).catch(reportStorageError);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: ADD LINK
  // ══════════════════════════════════════════════════════════════════════════

  const linkModal       = document.getElementById("link-modal");
  const linkUrlInput    = document.getElementById("link-url");
  const linkTitleInput  = document.getElementById("link-title");
  const linkModalTitle  = document.getElementById("link-modal-title");
  const linkSaveBtn     = document.getElementById("link-save");

  let editingLinkId = null;

  function openLinkModal() {
    editingLinkId = null;
    linkModalTitle.textContent = "Add Bookmark";
    linkSaveBtn.textContent = "Add Bookmark";
    linkUrlInput.value = "";
    linkTitleInput.value = "";
    linkModal.hidden = false;
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then((text) => {
        const url = urlFromClipboardText(text);
        if (url) linkUrlInput.value = url;
      }).catch(() => {});
    }
    setTimeout(() => linkTitleInput.focus(), 0);
  }

  function openLinkModalForEdit(link) {
    editingLinkId = link.id;
    linkModalTitle.textContent = "Edit Bookmark";
    linkSaveBtn.textContent = "Save";
    linkUrlInput.value = link.url;
    linkTitleInput.value = link.title;
    linkModal.hidden = false;
    setTimeout(() => linkTitleInput.focus(), 0);
  }

  function closeLinkModal() {
    linkModal.hidden = true;
    editingLinkId = null;
    linkModalTitle.textContent = "Add Bookmark";
    linkSaveBtn.textContent = "Add Bookmark";
  }

  async function saveLinkModal() {
    const url = normaliseUrl(linkUrlInput.value.trim());
    if (!url) { linkUrlInput.focus(); return; }
    const title = linkTitleInput.value.trim() || hostname(url);

    if (editingLinkId) {
      const r = findItem(data.items, editingLinkId);
      if (r && r.item.type === "link") {
        r.item.url = url;
        r.item.title = title;
      }
    } else {
      currentItems().push({ type: "link", id: uid(), title, url });
    }
    await saveData();
    render();
    closeLinkModal();
  }

  document.getElementById("add-link-btn").addEventListener("click", openLinkModal);
  document.getElementById("link-modal-close").addEventListener("click", closeLinkModal);
  document.getElementById("link-cancel").addEventListener("click", closeLinkModal);
  document.getElementById("link-save").addEventListener("click", () => {
    void saveLinkModal().catch(reportStorageError);
  });
  linkModal.addEventListener("click", (e) => { if (e.target === linkModal) closeLinkModal(); });
  linkUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void saveLinkModal().catch(reportStorageError);
  });
  linkTitleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void saveLinkModal().catch(reportStorageError);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: NEW FOLDER
  // ══════════════════════════════════════════════════════════════════════════

  const folderModal      = document.getElementById("folder-modal");
  const folderNameInput  = document.getElementById("folder-name");
  const folderModalTitle = document.getElementById("folder-modal-title");
  const folderSaveBtn    = document.getElementById("folder-save");

  let editingFolderId = null;

  function openFolderModal() {
    editingFolderId = null;
    folderModalTitle.textContent = "New Folder";
    folderSaveBtn.textContent = "Create";
    folderNameInput.value = "";
    folderModal.hidden = false;
    setTimeout(() => folderNameInput.focus(), 0);
  }

  function openFolderModalForEdit(folder) {
    editingFolderId = folder.id;
    folderModalTitle.textContent = "Rename Folder";
    folderSaveBtn.textContent = "Save";
    folderNameInput.value = folder.name;
    folderModal.hidden = false;
    setTimeout(() => folderNameInput.focus(), 0);
  }

  function closeFolderModal() {
    folderModal.hidden = true;
    editingFolderId = null;
    folderModalTitle.textContent = "New Folder";
    folderSaveBtn.textContent = "Create";
  }

  async function saveFolderModal() {
    const name = folderNameInput.value.trim();
    if (!name) { folderNameInput.focus(); return; }

    if (editingFolderId) {
      const r = findItem(data.items, editingFolderId);
      if (r && r.item.type === "folder") r.item.name = name;
    } else {
      currentItems().push({ type: "folder", id: uid(), name, children: [] });
    }
    await saveData();
    render();
    closeFolderModal();
  }

  document.getElementById("add-folder-btn").addEventListener("click", openFolderModal);
  document.getElementById("folder-modal-close").addEventListener("click", closeFolderModal);
  document.getElementById("folder-cancel").addEventListener("click", closeFolderModal);
  document.getElementById("folder-save").addEventListener("click", () => {
    void saveFolderModal().catch(reportStorageError);
  });
  folderModal.addEventListener("click", (e) => { if (e.target === folderModal) closeFolderModal(); });
  folderNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void saveFolderModal().catch(reportStorageError);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: SETTINGS
  // ══════════════════════════════════════════════════════════════════════════

  const settingsModal = document.getElementById("settings-modal");

  function openSettingsModal() {
    applyAiSearchBoxVisibility(getStoredAiSearchEnabled());
    syncAiProviderCustomSelect();
    closeAiProviderDropdown();
    settingsModal.hidden = false;
  }

  function closeSettingsModal() {
    closeAiProviderDropdown();
    settingsModal.hidden = true;
  }

  document.getElementById("settings-btn").addEventListener("click", openSettingsModal);
  document.getElementById("settings-modal-done").addEventListener("click", closeSettingsModal);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  if (aiSearchEnabledInput) {
    aiSearchEnabledInput.addEventListener("change", () => {
      const on = aiSearchEnabledInput.checked;
      void setStoredAiSearchEnabled(on).catch(reportStorageError);
      applyAiSearchBoxVisibility(on);
    });
  }

  if (aiProviderTrigger && aiProviderList) {
    aiProviderTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      setAiProviderDropdownOpen(!isAiProviderDropdownOpen());
    });
    aiProviderTrigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isAiProviderDropdownOpen()) openAiProviderDropdown();
        focusAiProviderOption(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isAiProviderDropdownOpen()) openAiProviderDropdown();
        focusAiProviderOption(-1);
      } else if (e.key === "Escape" && isAiProviderDropdownOpen()) {
        e.preventDefault();
        e.stopPropagation();
        closeAiProviderDropdown();
      }
    });
    aiProviderList.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeAiProviderDropdown();
        aiProviderTrigger.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        focusAiProviderOption(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusAiProviderOption(-1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const v = document.activeElement.getAttribute("data-value");
        if (v) {
          void applyAiSearchProvider(v, { persist: true })
            .then(() => {
              closeAiProviderDropdown();
              aiProviderTrigger.focus();
            })
            .catch(reportStorageError);
        }
      }
    });
    aiProviderList.querySelectorAll("[role='option']").forEach((opt) => {
      opt.addEventListener("click", () => {
        const v = opt.getAttribute("data-value");
        if (v) {
          void applyAiSearchProvider(v, { persist: true })
            .then(() => {
              closeAiProviderDropdown();
              aiProviderTrigger.focus();
            })
            .catch(reportStorageError);
          return;
        }
        closeAiProviderDropdown();
        aiProviderTrigger.focus();
      });
    });
    document.addEventListener("click", (e) => {
      if (!isAiProviderDropdownOpen() || !aiProviderCustom) return;
      if (!aiProviderCustom.contains(e.target)) closeAiProviderDropdown();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DATA IMPORT / EXPORT / DELETE ALL
  // ══════════════════════════════════════════════════════════════════════════

  function exportData() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      bookmarks: data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tabstract_export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function applyImport(imported) {
    data = imported;
    await saveData();
    currentPath = [];
    render();
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed;
      try {
        const raw = JSON.parse(e.target.result);
        if (raw && raw.version === 1 && raw.bookmarks) {
          parsed = raw.bookmarks;
        } else if (raw && Array.isArray(raw.items)) {
          parsed = raw;
        } else {
          throw new Error("Unrecognised format");
        }
        if (!Array.isArray(parsed.items)) throw new Error("Missing items");
        if (!Array.isArray(parsed.favorites)) parsed.favorites = [];
      } catch {
        alert("Could not read the file. Make sure it's a valid Tabstract export.");
        return;
      }
      const importedData = parsed;
      openDestructiveConfirm({
        title: "Replace all data?",
        message: "This will permanently replace all your current bookmarks and favorites with the imported file. This cannot be undone.",
        confirmLabel: "Replace",
        action: async () => {
          await applyImport(importedData);
          closeSettingsModal();
        },
      });
    };
    reader.readAsText(file);
  }

  function deleteAllData() {
    openDestructiveConfirm({
      title: "Delete all data?",
      message: "This will permanently delete all your bookmarks and favorites. This cannot be undone.",
      confirmLabel: "Delete All",
      action: async () => {
        data = { items: [], favorites: [] };
        await saveData();
        currentPath = [];
        render();
        closeSettingsModal();
      },
    });
  }

  document.getElementById("export-data-btn").addEventListener("click", exportData);

  const importFileInput = document.getElementById("import-file-input");
  document.getElementById("import-data-btn").addEventListener("click", () => {
    importFileInput.value = "";
    importFileInput.click();
  });
  importFileInput.addEventListener("change", () => {
    handleImportFile(importFileInput.files[0]);
  });

  document.getElementById("delete-all-data-btn").addEventListener("click", deleteAllData);

  // ── Global keyboard ────────────────────────────────────────────────────────

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!itemContextMenu.hidden) { hideContextMenu(); return; }
      if (!deleteConfirmModal.hidden) { closeDeleteConfirm(); return; }
      if (!settingsModal.hidden) {
        if (isAiProviderDropdownOpen()) {
          closeAiProviderDropdown();
          return;
        }
        closeSettingsModal();
        return;
      }
      closeLinkModal();
      closeFolderModal();
    }
    // Backspace/ArrowLeft when no modal is open → go up one level
    if ((e.key === "Backspace" || e.key === "ArrowLeft") &&
        linkModal.hidden && folderModal.hidden && deleteConfirmModal.hidden && settingsModal.hidden &&
        document.activeElement === document.body) {
      if (currentPath.length > 0) { currentPath.pop(); render(); }
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    updateClock();
    const now = new Date();
    const msUntilNextMinute =
      60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    setTimeout(() => {
      updateClock();
      setInterval(updateClock, 60000);
    }, msUntilNextMinute);

    const persisted = await loadPersistedState();
    data = persisted.data;
    settings = persisted.settings;
    await initAiSearchProvider();
    applyAiSearchBoxVisibility(getStoredAiSearchEnabled());
    searchInput.focus();
    render();
  }

  init().catch(reportStorageError);
})();
