(() => {
  const SEARCH_URL = "https://www.google.com/search?q=";
  const DB_NAME = "TabstractDB";
  const DB_VERSION = 2;
  const ITEMS_STORE = "items";
  const FAVORITES_STORE = "favorites";
  const SETTINGS_STORE = "settings";
  const SAVES_STORE = "saves";
  const SAVE_ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;

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
  const WALLPAPERS = {
    off: { id: "off", label: "Off" },
    city: { id: "city", label: "City" },
    farm: { id: "farm", label: "Farm" },
    mountains: { id: "mountains", label: "Mountains" },
    ponds: { id: "ponds", label: "Ponds" },
  };
  const iconSrc = (file) => chrome.runtime.getURL(`icons/${file}`);

  // ── Storage ────────────────────────────────────────────────────────────────

  const MAX_FAVORITES = 16;
  let dbPromise = null;

  function defaultData() {
    return { items: [], favorites: [], saves: [] };
  }

  function defaultSettings() {
    return {
      aiProvider: "chatgpt",
      aiSearchEnabled: true,
      bookmarkSearchResultLimit: 8,
      wallpaper: "off",
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
        if (!db.objectStoreNames.contains(SAVES_STORE)) {
          const saves = db.createObjectStore(SAVES_STORE, { keyPath: "id" });
          saves.createIndex("savedAt", "savedAt", { unique: false });
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
          customIcon: item.customIcon || null,
          routesEnabled: Boolean(item.routesEnabled),
          routes: normalizeRoutes(item.routes),
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
          customIcon: typeof record.customIcon === "string" ? record.customIcon : null,
          routesEnabled: Boolean(record.routesEnabled),
          routes: normalizeRoutes(record.routes),
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
      if (record.key === "bookmarkSearchResultLimit") {
        const value = Number(record.value);
        if (Number.isInteger(value) && value >= 1 && value <= 8) {
          settings.bookmarkSearchResultLimit = value;
        }
      }
      if (record.key === "wallpaper" && WALLPAPERS[record.value]) {
        settings.wallpaper = record.value;
      }
    }
    return settings;
  }

  function hydrateSaves(records) {
    return records
      .slice()
      .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")))
      .map((record) => ({
        id: typeof record.id === "string" && record.id ? record.id : uid(),
        url: normaliseUrl(String(record.url || "").trim()),
        title: String(record.title || "").trim(),
        faviconUrl: String(record.faviconUrl || "").trim(),
        savedAt: String(record.savedAt || new Date().toISOString()),
        archivedAt: typeof record.archivedAt === "string" && record.archivedAt ? record.archivedAt : null,
      }))
      .filter((record) => record.url);
  }

  function saveExpiryTime(save) {
    const savedAt = Date.parse(save.savedAt || "");
    return Number.isFinite(savedAt) ? savedAt + SAVE_ARCHIVE_AFTER_MS : Date.now() + SAVE_ARCHIVE_AFTER_MS;
  }

  function isSaveArchived(save) {
    return Boolean(save.archivedAt);
  }

  async function archiveExpiredSaves({ persist = true } = {}) {
    const now = Date.now();
    let changed = false;
    data.saves = (data.saves || []).map((save) => {
      if (isSaveArchived(save) || saveExpiryTime(save) > now) return save;
      changed = true;
      return { ...save, archivedAt: new Date(now).toISOString() };
    });
    if (changed && persist) await saveData();
    return changed;
  }

  async function loadPersistedState() {
    const db = await openDatabase();
    const tx = db.transaction([ITEMS_STORE, FAVORITES_STORE, SETTINGS_STORE, SAVES_STORE], "readonly");
    const itemsRequest = tx.objectStore(ITEMS_STORE).getAll();
    const favoritesRequest = tx.objectStore(FAVORITES_STORE).getAll();
    const settingsRequest = tx.objectStore(SETTINGS_STORE).getAll();
    const savesRequest = tx.objectStore(SAVES_STORE).getAll();
    const [itemRecords, favoriteRecords, settingRecords, saveRecords] = await Promise.all([
      requestToPromise(itemsRequest),
      requestToPromise(favoritesRequest),
      requestToPromise(settingsRequest),
      requestToPromise(savesRequest),
      transactionToPromise(tx),
    ]);
    return {
      data: {
        items: hydrateItems(itemRecords),
        favorites: hydrateFavorites(favoriteRecords),
        saves: hydrateSaves(saveRecords),
      },
      settings: hydrateSettings(settingRecords),
    };
  }

  async function saveData() {
    const db = await openDatabase();
    const tx = db.transaction([ITEMS_STORE, FAVORITES_STORE, SAVES_STORE], "readwrite");
    const itemStore = tx.objectStore(ITEMS_STORE);
    const favoriteStore = tx.objectStore(FAVORITES_STORE);
    const savesStore = tx.objectStore(SAVES_STORE);

    itemStore.clear();
    favoriteStore.clear();
    savesStore.clear();

    for (const record of flattenItems(data.items)) {
      itemStore.put(record);
    }
    data.favorites.forEach((id, position) => {
      favoriteStore.put({ id, position });
    });
    for (const save of data.saves || []) {
      savesStore.put(save);
    }

    await transactionToPromise(tx);
  }

  async function saveSetting(key, value) {
    const db = await openDatabase();
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    tx.objectStore(SETTINGS_STORE).put({ key, value });
    await transactionToPromise(tx);
  }

  async function saveSettings(nextSettings) {
    const db = await openDatabase();
    const tx = db.transaction(SETTINGS_STORE, "readwrite");
    const store = tx.objectStore(SETTINGS_STORE);
    for (const [key, value] of Object.entries(nextSettings)) {
      store.put({ key, value });
    }
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
  const bookmarkSearchLimitInput = document.getElementById("bookmark-search-limit-input");
  const aiSearchEnabledInput = document.getElementById("ai-search-enabled");
  const aiProviderSettingsRow = document.getElementById("ai-provider-settings-row");
  const wallpaperCustom = document.getElementById("wallpaper-custom-select");
  const wallpaperTrigger = document.getElementById("wallpaper-trigger");
  const wallpaperTriggerText = document.getElementById("wallpaper-trigger-text");
  const wallpaperList = document.getElementById("wallpaper-list");

  let aiProviderId = "chatgpt";
  let wallpaperId = "off";

  function getStoredAiProvider() {
    return settings.aiProvider;
  }

  function getStoredAiSearchEnabled() {
    return settings.aiSearchEnabled;
  }

  function getStoredBookmarkSearchResultLimit() {
    return settings.bookmarkSearchResultLimit;
  }

  function getStoredWallpaper() {
    return settings.wallpaper;
  }

  async function setStoredAiSearchEnabled(on) {
    settings.aiSearchEnabled = on;
    await saveSetting("aiSearchEnabled", on);
  }

  async function setStoredBookmarkSearchResultLimit(limit) {
    settings.bookmarkSearchResultLimit = limit;
    await saveSetting("bookmarkSearchResultLimit", limit);
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

  function wallpaperOrDefault(id) {
    return WALLPAPERS[id] || WALLPAPERS.off;
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

  function syncWallpaperCustomSelect() {
    if (!wallpaperTriggerText || !wallpaperList) return;
    const wallpaper = wallpaperOrDefault(wallpaperId);
    wallpaperTriggerText.textContent = wallpaper.label;
    wallpaperList.querySelectorAll("[role='option']").forEach((opt) => {
      const on = opt.getAttribute("data-value") === wallpaperId;
      opt.setAttribute("aria-selected", on ? "true" : "false");
      opt.classList.toggle("is-selected", on);
    });
  }

  function isAiProviderDropdownOpen() {
    return aiProviderTrigger && aiProviderTrigger.getAttribute("aria-expanded") === "true";
  }

  function setAiProviderDropdownOpen(open) {
    if (!aiProviderTrigger || !aiProviderList) return;
    if (open) closeWallpaperDropdown();
    aiProviderList.hidden = !open;
    aiProviderTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeAiProviderDropdown() {
    setAiProviderDropdownOpen(false);
  }

  function openAiProviderDropdown() {
    setAiProviderDropdownOpen(true);
  }

  function isWallpaperDropdownOpen() {
    return wallpaperTrigger && wallpaperTrigger.getAttribute("aria-expanded") === "true";
  }

  function setWallpaperDropdownOpen(open) {
    if (!wallpaperTrigger || !wallpaperList) return;
    if (open) closeAiProviderDropdown();
    wallpaperList.hidden = !open;
    wallpaperTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeWallpaperDropdown() {
    setWallpaperDropdownOpen(false);
  }

  function openWallpaperDropdown() {
    setWallpaperDropdownOpen(true);
  }

  function focusWallpaperOption(dir) {
    const opts = [...wallpaperList.querySelectorAll("[role='option']")];
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

  function syncBookmarkSearchLimitInput() {
    if (!bookmarkSearchLimitInput) return;
    bookmarkSearchLimitInput.value = String(getStoredBookmarkSearchResultLimit());
  }

  async function applyBookmarkSearchResultLimit(limit, { persist } = {}) {
    const normalized = Number(limit);
    if (!Number.isInteger(normalized) || normalized < 1 || normalized > 8) return;
    if (persist) {
      await setStoredBookmarkSearchResultLimit(normalized);
    } else {
      settings.bookmarkSearchResultLimit = normalized;
    }
    syncBookmarkSearchLimitInput();
    updateBookmarkSearchResults();
  }

  async function applyWallpaper(id, { persist } = {}) {
    const wallpaper = wallpaperOrDefault(id);
    wallpaperId = wallpaper.id;
    settings.wallpaper = wallpaperId;
    if (gridScroll) {
      Object.keys(WALLPAPERS).forEach((key) => {
        if (key !== "off") gridScroll.classList.remove(`grid-scroll--wallpaper-${key}`);
      });
      if (wallpaperId !== "off") {
        gridScroll.classList.add(`grid-scroll--wallpaper-${wallpaperId}`);
      }
    }
    if (persist) {
      await saveSetting("wallpaper", wallpaperId);
    }
    syncWallpaperCustomSelect();
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
  const bookmarkSearchBox = document.querySelector(".bookmark-search-box");
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

    const setResultsVisible = (visible) => {
      bookmarkSearchResults.hidden = !visible;
      bookmarkSearchBox.classList.toggle("has-results", visible);
    };

    if (!q) {
      bookmarkSearchResults.innerHTML = "";
      setResultsVisible(false);
      return;
    }

    const flat = collectAllLinks(data.items, [], []);
    const ranked = [];
    for (const entry of flat) {
      const s = scoreBookmarkEntry(q, entry);
      if (s >= 0) ranked.push({ entry, score: s });
    }
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, getStoredBookmarkSearchResultLimit());

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
        if (linkRoutesEnabled(link)) openRoutePopup(link, btn);
        else {
          closeRouteChoiceModal();
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
    setResultsVisible(true);
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

  function normalizeRoutes(routes) {
    if (!Array.isArray(routes)) return [];
    return routes
      .map((route) => {
        const title = String(route?.title || "").trim();
        const url = normaliseUrl(String(route?.url || "").trim());
        if (!title || !url) return null;
        return {
          id: typeof route.id === "string" && route.id ? route.id : uid(),
          title,
          url,
        };
      })
      .filter(Boolean);
  }

  function linkRoutes(link) {
    return normalizeRoutes(link?.routes);
  }

  function linkRoutesEnabled(link) {
    return Boolean(link?.routesEnabled && linkRoutes(link).length > 0);
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

  function linkIconSrc(link) {
    if (link?.customIcon) return link.customIcon;
    return faviconSrc(link?.url);
  }

  function savedLinkFaviconSrc(url) {
    return faviconSrc(url) || "";
  }

  function titleFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.querySelector("title")?.textContent?.replace(/\s+/g, " ").trim() || "";
  }

  async function fetchPageTitle(url) {
    const response = await fetch(url, { method: "GET", credentials: "omit" });
    if (!response.ok) return "";
    return titleFromHtml(await response.text());
  }

  async function fetchSavedLinkMetadata(url) {
    let title = "";
    try {
      title = await fetchPageTitle(url);
    } catch {
      title = "";
    }
    return {
      title: title || hostname(url),
      faviconUrl: savedLinkFaviconSrc(url),
    };
  }

  function linkHasCustomIcon(link) {
    return Boolean(link?.customIcon);
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
    rootBtn.innerHTML = `<span class="path-root-label">Bookmarks</span>`;
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
  const gridScroll = document.getElementById("grid-scroll");
  const favoritesGrid = document.getElementById("favorites-grid");
  const favoritesScroll = document.getElementById("favorites-scroll");
  const itemContextMenu = document.getElementById("item-context-menu");
  const gridContextMenu = document.getElementById("grid-context-menu");
  const ctxFavorite = document.getElementById("ctx-favorite");
  const ctxFavoriteIcon = document.getElementById("ctx-favorite-icon");
  const ctxFavoriteLabel = document.getElementById("ctx-favorite-label");
  const ctxCustomize = document.getElementById("ctx-customize");
  const ctxRoutes = document.getElementById("ctx-routes");
  const ctxEdit = document.getElementById("ctx-edit");
  const ctxDelete = document.getElementById("ctx-delete");
  const ctxGridNewLink = document.getElementById("ctx-grid-new-link");
  const ctxGridNewFolder = document.getElementById("ctx-grid-new-folder");

  let contextItemId = null;
  let contextItemType = null; // "folder" | "link"

  function hideItemContextMenu() {
    itemContextMenu.hidden = true;
    contextItemId = null;
    contextItemType = null;
  }

  function hideGridContextMenu() {
    gridContextMenu.hidden = true;
  }

  function hideAllContextMenus() {
    hideItemContextMenu();
    hideGridContextMenu();
  }

  function positionContextMenu(menu, e) {
    const pad = 8;
    let x = e.clientX;
    let y = e.clientY;
    menu.hidden = false;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - pad) x = window.innerWidth - rect.width - pad;
    if (rect.bottom > window.innerHeight - pad) y = window.innerHeight - rect.height - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }

  function showItemContextMenu(e, id, type) {
    e.preventDefault();
    hideGridContextMenu();
    contextItemId = id;
    contextItemType = type;
    ctxCustomize.hidden = type !== "link";
    ctxRoutes.hidden = type !== "link";
    const already = data.favorites.includes(id);
    if (already) {
      ctxFavoriteLabel.textContent = "Unpin";
      ctxFavoriteIcon.src = "icons/push-pin-slash.svg";
      ctxFavorite.disabled = false;
    } else {
      ctxFavoriteLabel.textContent = "Pin";
      ctxFavoriteIcon.src = "icons/push-pin.svg";
      ctxFavorite.disabled = data.favorites.length >= MAX_FAVORITES;
    }
    positionContextMenu(itemContextMenu, e);
  }

  function showGridContextMenu(e) {
    e.preventDefault();
    hideItemContextMenu();
    closeRouteChoiceModal();
    positionContextMenu(gridContextMenu, e);
  }

  document.addEventListener("mousedown", (e) => {
    if (!itemContextMenu.hidden && !itemContextMenu.contains(e.target)) hideItemContextMenu();
    if (!gridContextMenu.hidden && !gridContextMenu.contains(e.target)) hideGridContextMenu();
  });

  gridScroll.addEventListener("scroll", () => {
    if (!itemContextMenu.hidden || !gridContextMenu.hidden) hideAllContextMenus();
  });

  favoritesScroll.addEventListener("scroll", () => {
    if (!itemContextMenu.hidden || !gridContextMenu.hidden) hideAllContextMenus();
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
    hideItemContextMenu();
    render();
  }

  ctxFavorite.addEventListener("click", () => {
    void handleFavoriteToggle().catch(reportStorageError);
  });

  ctxEdit.addEventListener("click", () => {
    if (!contextItemId) return;
    const r = findItem(data.items, contextItemId);
    if (!r) { hideItemContextMenu(); return; }
    if (contextItemType === "link" && r.item.type === "link") openLinkModalForEdit(r.item);
    else if (contextItemType === "folder" && r.item.type === "folder") openFolderModalForEdit(r.item);
    hideItemContextMenu();
  });

  // ── Modal: customize icon ────────────────────────────────────────────────

  const iconCustomizeModal = document.getElementById("icon-customize-modal");
  const iconCustomizeCloseBtn = document.getElementById("icon-customize-close");
  const iconCustomizeCancelBtn = document.getElementById("icon-customize-cancel");
  const iconCustomizeSaveBtn = document.getElementById("icon-customize-save");
  const iconUploadBtn = document.getElementById("icon-upload-btn");
  const iconUploadInput = document.getElementById("icon-upload-input");
  const iconRemoveBtn = document.getElementById("icon-remove-btn");
  const iconCustomizeHelp = document.getElementById("icon-customize-help");
  const iconCropStage = document.getElementById("icon-crop-stage");
  const iconCropCanvas = document.getElementById("icon-crop-canvas");
  const iconZoomInput = document.getElementById("icon-zoom");
  const iconCropCtx = iconCropCanvas.getContext("2d");

  let customizingLinkId = null;
  let removeCustomIconOnSave = false;
  const iconCropState = {
    image: null,
    imageSrc: "",
    baseScale: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0,
  };

  function resetIconCropState() {
    iconCropState.image = null;
    iconCropState.imageSrc = "";
    iconCropState.baseScale = 1;
    iconCropState.zoom = 1;
    iconCropState.offsetX = 0;
    iconCropState.offsetY = 0;
    iconCropState.dragging = false;
    iconZoomInput.value = "1";
    drawIconCropPreview();
    syncIconCustomizeControls();
  }

  function getIconCropMetrics(outputSize = iconCropCanvas.width) {
    const image = iconCropState.image;
    if (!image) return null;
    const previewSize = iconCropCanvas.width;
    const finalScale = iconCropState.baseScale * iconCropState.zoom;
    const ratio = outputSize / previewSize;
    const drawnWidth = image.width * finalScale * ratio;
    const drawnHeight = image.height * finalScale * ratio;
    const x = ((previewSize - image.width * finalScale) / 2 + iconCropState.offsetX) * ratio;
    const y = ((previewSize - image.height * finalScale) / 2 + iconCropState.offsetY) * ratio;
    return { image, drawnWidth, drawnHeight, x, y };
  }

  function clampIconCropOffsets() {
    const metrics = getIconCropMetrics();
    if (!metrics) return;
    const maxX = Math.max(0, (metrics.drawnWidth - iconCropCanvas.width) / 2);
    const maxY = Math.max(0, (metrics.drawnHeight - iconCropCanvas.height) / 2);
    iconCropState.offsetX = Math.min(maxX, Math.max(-maxX, iconCropState.offsetX));
    iconCropState.offsetY = Math.min(maxY, Math.max(-maxY, iconCropState.offsetY));
  }

  function drawIconCropPreview() {
    iconCropCtx.clearRect(0, 0, iconCropCanvas.width, iconCropCanvas.height);
    if (!iconCropState.image) return;
    const metrics = getIconCropMetrics();
    if (!metrics) return;
    iconCropCtx.drawImage(metrics.image, metrics.x, metrics.y, metrics.drawnWidth, metrics.drawnHeight);
  }

  function syncIconCustomizeControls() {
    const active = Boolean(iconCropState.image);
    const showUploadState = !active;
    iconZoomInput.disabled = !active;
    iconCustomizeSaveBtn.disabled = !active && !removeCustomIconOnSave;
    iconCropStage.classList.toggle("is-empty", showUploadState);
    iconUploadBtn.hidden = !showUploadState;
    iconRemoveBtn.hidden = !active;
    if (removeCustomIconOnSave) {
      iconCustomizeHelp.textContent = "The custom icon will be removed when you save.";
    } else if (active) {
      iconCustomizeHelp.textContent = "Upload an image, then drag to reposition and use the slider to zoom.";
    } else {
      iconCustomizeHelp.textContent = "Upload an image to replace the default favicon.";
    }
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load image."));
      image.src = src;
    });
  }

  async function setIconCropImage(src) {
    const image = await loadImageElement(src);
    iconCropState.image = image;
    iconCropState.imageSrc = src;
    iconCropState.baseScale = Math.max(
      iconCropCanvas.width / image.width,
      iconCropCanvas.height / image.height,
    );
    iconCropState.zoom = 1;
    iconCropState.offsetX = 0;
    iconCropState.offsetY = 0;
    iconZoomInput.value = "1";
    removeCustomIconOnSave = false;
    clampIconCropOffsets();
    drawIconCropPreview();
    syncIconCustomizeControls();
  }

  function renderCroppedIconDataUrl() {
    const metrics = getIconCropMetrics(128);
    if (!metrics) return null;
    const out = document.createElement("canvas");
    out.width = 128;
    out.height = 128;
    const ctx = out.getContext("2d");
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.drawImage(metrics.image, metrics.x, metrics.y, metrics.drawnWidth, metrics.drawnHeight);
    return out.toDataURL("image/png");
  }

  function closeIconCustomizeModal() {
    iconCustomizeModal.hidden = true;
    customizingLinkId = null;
    removeCustomIconOnSave = false;
    resetIconCropState();
  }

  function openIconCustomizeModal(link) {
    customizingLinkId = link.id;
    removeCustomIconOnSave = false;
    iconCustomizeModal.hidden = false;
    if (linkHasCustomIcon(link)) {
      void setIconCropImage(link.customIcon).catch((error) => {
        console.error(error);
        resetIconCropState();
      });
    } else {
      resetIconCropState();
    }
  }

  async function saveIconCustomizeModal() {
    if (!customizingLinkId) return;
    const r = findItem(data.items, customizingLinkId);
    if (!r || r.item.type !== "link") {
      closeIconCustomizeModal();
      return;
    }
    if (removeCustomIconOnSave) {
      r.item.customIcon = null;
    } else {
      const croppedIcon = renderCroppedIconDataUrl();
      if (!croppedIcon) return;
      r.item.customIcon = croppedIcon;
    }
    await saveData();
    closeIconCustomizeModal();
    render();
  }

  ctxCustomize.addEventListener("click", () => {
    if (!contextItemId || contextItemType !== "link") return;
    const r = findItem(data.items, contextItemId);
    hideItemContextMenu();
    if (!r || r.item.type !== "link") return;
    openIconCustomizeModal(r.item);
  });

  iconUploadBtn.addEventListener("click", () => {
    iconUploadInput.value = "";
    iconUploadInput.click();
  });

  iconUploadInput.addEventListener("change", () => {
    const file = iconUploadInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void setIconCropImage(String(reader.result)).catch(() => {
        alert("Could not read that image. Try a different file.");
      });
    };
    reader.readAsDataURL(file);
  });

  iconRemoveBtn.addEventListener("click", () => {
    resetIconCropState();
    removeCustomIconOnSave = true;
    syncIconCustomizeControls();
  });

  iconRemoveBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });

  iconRemoveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  iconZoomInput.addEventListener("input", () => {
    iconCropState.zoom = Number(iconZoomInput.value);
    clampIconCropOffsets();
    drawIconCropPreview();
  });

  iconCropStage.addEventListener("pointerdown", (e) => {
    if (!iconCropState.image) return;
    iconCropState.dragging = true;
    iconCropState.dragStartX = e.clientX;
    iconCropState.dragStartY = e.clientY;
    iconCropState.dragOriginX = iconCropState.offsetX;
    iconCropState.dragOriginY = iconCropState.offsetY;
    iconCropStage.classList.add("is-dragging");
    iconCropStage.setPointerCapture(e.pointerId);
  });

  iconCropStage.addEventListener("pointermove", (e) => {
    if (!iconCropState.dragging) return;
    iconCropState.offsetX = iconCropState.dragOriginX + (e.clientX - iconCropState.dragStartX);
    iconCropState.offsetY = iconCropState.dragOriginY + (e.clientY - iconCropState.dragStartY);
    clampIconCropOffsets();
    drawIconCropPreview();
  });

  function endIconCropDrag(e) {
    if (!iconCropState.dragging) return;
    iconCropState.dragging = false;
    iconCropStage.classList.remove("is-dragging");
    if (typeof e.pointerId === "number" && iconCropStage.hasPointerCapture(e.pointerId)) {
      iconCropStage.releasePointerCapture(e.pointerId);
    }
  }

  iconCropStage.addEventListener("pointerup", endIconCropDrag);
  iconCropStage.addEventListener("pointercancel", endIconCropDrag);

  iconCustomizeCloseBtn.addEventListener("click", closeIconCustomizeModal);
  iconCustomizeCancelBtn.addEventListener("click", closeIconCustomizeModal);
  iconCustomizeSaveBtn.addEventListener("click", () => {
    void saveIconCustomizeModal().catch(reportStorageError);
  });
  iconCustomizeModal.addEventListener("click", (e) => {
    if (e.target === iconCustomizeModal) closeIconCustomizeModal();
  });

  // ── Modal: routes ────────────────────────────────────────────────────────

  const routesModal = document.getElementById("routes-modal");
  const routesModalTitle = document.getElementById("routes-modal-title");
  const routesModalCloseBtn = document.getElementById("routes-modal-close");
  const routesEnabledInput = document.getElementById("routes-enabled");
  const routesList = document.getElementById("routes-list");
  const routesAddBtn = document.getElementById("routes-add");
  const routesCancelBtn = document.getElementById("routes-cancel");
  const routesSaveBtn = document.getElementById("routes-save");
  const routeChoiceModal = document.getElementById("route-choice-modal");
  const routeChoiceTitle = document.getElementById("route-choice-title");
  const routeChoiceCloseBtn = document.getElementById("route-choice-close");
  const routeChoiceList = document.getElementById("route-choice-list");

  let editingRoutesLinkId = null;
  let draggingRouteRow = null;

  function makeRouteRow(route = {}) {
    const row = document.createElement("div");
    row.className = "route-row";
    row.dataset.routeId = route.id || uid();
    row.draggable = false;

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "route-drag-handle";
    dragHandle.setAttribute("aria-label", "Reorder route");
    dragHandle.textContent = "::";
    dragHandle.addEventListener("pointerdown", () => {
      row.draggable = true;
    });
    dragHandle.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const sibling = e.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (e.key === "ArrowUp") routesList.insertBefore(row, sibling);
      else routesList.insertBefore(sibling, row);
      dragHandle.focus();
    });

    const titleField = document.createElement("div");
    titleField.className = "field route-field route-field--title";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "route-title-input";
    titleInput.placeholder = "Home";
    titleInput.autocomplete = "off";
    titleInput.value = route.title || "";
    titleField.appendChild(titleInput);

    const urlField = document.createElement("div");
    urlField.className = "field route-field route-field--url";
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "route-url-input";
    urlInput.placeholder = "https://example.com/home";
    urlInput.autocomplete = "off";
    urlInput.value = route.url || "";
    urlField.appendChild(urlInput);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "route-remove-btn";
    removeBtn.setAttribute("aria-label", "Remove route");
    const removeIcon = document.createElement("img");
    removeIcon.src = "icons/trash.svg";
    removeIcon.alt = "";
    removeIcon.width = 14;
    removeIcon.height = 14;
    removeBtn.appendChild(removeIcon);
    removeBtn.addEventListener("click", () => row.remove());

    row.addEventListener("dragstart", (e) => {
      draggingRouteRow = row;
      row.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.dataset.routeId);
    });
    row.addEventListener("dragend", () => {
      row.draggable = false;
      row.classList.remove("is-dragging");
      draggingRouteRow = null;
    });

    row.append(dragHandle, titleField, urlField, removeBtn);
    return row;
  }

  function addRouteRow(route) {
    const row = makeRouteRow(route);
    routesList.appendChild(row);
    return row;
  }

  function closeRoutesModal() {
    routesModal.hidden = true;
    editingRoutesLinkId = null;
    routesList.innerHTML = "";
    routesEnabledInput.checked = false;
  }

  function openRoutesModal(link) {
    editingRoutesLinkId = link.id;
    routesModalTitle.textContent = `Routes: ${link.title || hostname(link.url)}`;
    routesEnabledInput.checked = Boolean(link.routesEnabled);
    routesList.innerHTML = "";
    const routes = linkRoutes(link);
    if (routes.length) {
      routes.forEach((route) => addRouteRow(route));
    } else {
      addRouteRow();
    }
    routesModal.hidden = false;
    setTimeout(() => routesList.querySelector(".route-title-input")?.focus(), 0);
  }

  function readRoutesFromModal() {
    const routes = [];
    for (const row of routesList.querySelectorAll(".route-row")) {
      const titleInput = row.querySelector(".route-title-input");
      const urlInput = row.querySelector(".route-url-input");
      const title = titleInput.value.trim();
      const rawUrl = urlInput.value.trim();
      if (!title && !rawUrl) continue;
      if (!title) {
        titleInput.focus();
        return null;
      }
      const url = normaliseUrl(rawUrl);
      if (!url) {
        urlInput.focus();
        return null;
      }
      routes.push({ id: row.dataset.routeId || uid(), title, url });
    }
    return routes;
  }

  async function saveRoutesModal() {
    if (!editingRoutesLinkId) return;
    const r = findItem(data.items, editingRoutesLinkId);
    if (!r || r.item.type !== "link") {
      closeRoutesModal();
      return;
    }
    const routes = readRoutesFromModal();
    if (!routes) return;
    r.item.routesEnabled = routesEnabledInput.checked;
    r.item.routes = routes;
    await saveData();
    closeRoutesModal();
    render();
  }

  function getRouteDragAfterElement(y) {
    const rows = [...routesList.querySelectorAll(".route-row:not(.is-dragging)")];
    return rows.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function closeRouteChoiceModal() {
    routeChoiceModal.hidden = true;
    routeChoiceList.innerHTML = "";
  }

  function openRoutePopup(link) {
    const routes = linkRoutes(link);
    if (!routes.length) {
      window.location.href = link.url;
      return;
    }
    hideAllContextMenus();
    routeChoiceTitle.textContent = `Open ${link.title || hostname(link.url)}`;
    routeChoiceList.innerHTML = "";
    for (const route of routes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "route-choice-item";
      btn.setAttribute("role", "menuitem");
      btn.textContent = route.title;
      btn.addEventListener("click", () => {
        window.location.href = route.url;
      });
      routeChoiceList.appendChild(btn);
    }
    routeChoiceModal.hidden = false;
    routeChoiceList.querySelector(".route-choice-item")?.focus();
  }

  ctxRoutes.addEventListener("click", () => {
    if (!contextItemId || contextItemType !== "link") return;
    const r = findItem(data.items, contextItemId);
    hideItemContextMenu();
    if (!r || r.item.type !== "link") return;
    openRoutesModal(r.item);
  });

  routesAddBtn.addEventListener("click", () => {
    const row = addRouteRow();
    row.querySelector(".route-title-input")?.focus();
  });
  routesList.addEventListener("dragover", (e) => {
    if (!draggingRouteRow) return;
    e.preventDefault();
    const after = getRouteDragAfterElement(e.clientY);
    if (after) routesList.insertBefore(draggingRouteRow, after);
    else routesList.appendChild(draggingRouteRow);
  });
  routesModalCloseBtn.addEventListener("click", closeRoutesModal);
  routesCancelBtn.addEventListener("click", closeRoutesModal);
  routesSaveBtn.addEventListener("click", () => {
    void saveRoutesModal().catch(reportStorageError);
  });
  routesModal.addEventListener("click", (e) => {
    if (e.target === routesModal) closeRoutesModal();
  });
  routeChoiceCloseBtn.addEventListener("click", closeRouteChoiceModal);
  routeChoiceModal.addEventListener("click", (e) => {
    if (e.target === routeChoiceModal) closeRouteChoiceModal();
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
    if (!contextItemId) { hideItemContextMenu(); return; }
    const id = contextItemId;
    hideItemContextMenu();
    openDeleteConfirm(id);
  });

  gridScroll.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".icon-item")) return;
    showGridContextMenu(e);
  });

  ctxGridNewLink.addEventListener("click", () => {
    hideGridContextMenu();
    openLinkModal();
  });

  ctxGridNewFolder.addEventListener("click", () => {
    hideGridContextMenu();
    openFolderModal();
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

    const favSrc = linkIconSrc(link);
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
      if (linkRoutesEnabled(link)) openRoutePopup(link, el);
      else {
        closeRouteChoiceModal();
        window.location.href = link.url;
      }
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
  // MODAL: SAVES
  // ══════════════════════════════════════════════════════════════════════════

  const savesModal = document.getElementById("saves-modal");
  const savesUrlInput = document.getElementById("saves-url-input");
  const savesAddBtn = document.getElementById("saves-add-btn");
  const savesArchiveToggle = document.getElementById("saves-archive-toggle");
  const savesStatus = document.getElementById("saves-status");
  const savesList = document.getElementById("saves-list");

  let saveUrlInFlight = "";
  let viewingSavesArchive = false;

  function setSavesStatus(message) {
    savesStatus.textContent = message;
  }

  function renderSavesList() {
    const saves = (data.saves || []).filter((save) => isSaveArchived(save) === viewingSavesArchive);
    savesArchiveToggle.querySelector("span").textContent = viewingSavesArchive ? "Back to saves" : "View archive";
    savesList.innerHTML = "";
    if (saves.length === 0) {
      const empty = document.createElement("div");
      empty.className = "saves-empty";
      empty.textContent = viewingSavesArchive ? "No archived links yet." : "No saved links yet.";
      savesList.appendChild(empty);
      return;
    }

    for (const save of saves) {
      const item = document.createElement("div");
      item.className = "saves-item";
      item.classList.toggle("saves-item--archived", viewingSavesArchive);

      const favicon = document.createElement("img");
      favicon.className = "saves-item-favicon";
      favicon.src = save.faviconUrl || savedLinkFaviconSrc(save.url);
      favicon.alt = "";
      favicon.width = 28;
      favicon.height = 28;
      favicon.addEventListener("error", () => {
        favicon.hidden = true;
      });

      const link = document.createElement("a");
      link.className = "saves-item-link";
      link.href = save.url;
      link.rel = "noreferrer";

      const title = document.createElement("span");
      title.className = "saves-item-title";
      title.textContent = save.title || hostname(save.url);

      const url = document.createElement("span");
      url.className = "saves-item-url";
      url.textContent = save.url;

      link.append(title, url);

      if (viewingSavesArchive) {
        item.append(favicon, link);
      } else {
        const archiveBtn = document.createElement("button");
        archiveBtn.type = "button";
        archiveBtn.className = "saves-item-archive";
        archiveBtn.setAttribute("aria-label", `Archive ${save.title || hostname(save.url)}`);
        const archiveIcon = document.createElement("img");
        archiveIcon.src = iconSrc("check.svg");
        archiveIcon.alt = "";
        archiveIcon.width = 15;
        archiveIcon.height = 15;
        archiveBtn.appendChild(archiveIcon);
        archiveBtn.addEventListener("click", () => {
          void archiveSave(save.id).catch(reportStorageError);
        });

        item.append(favicon, link, archiveBtn);
      }
      savesList.appendChild(item);
    }
  }

  async function openSavesModal() {
    await archiveExpiredSaves();
    viewingSavesArchive = false;
    setSavesStatus("");
    savesUrlInput.value = "";
    renderSavesList();
    savesModal.hidden = false;
    setTimeout(() => savesUrlInput.focus(), 0);
  }

  function closeSavesModal() {
    savesModal.hidden = true;
    saveUrlInFlight = "";
    viewingSavesArchive = false;
    setSavesStatus("");
    savesUrlInput.value = "";
  }

  async function savePastedLink(rawUrl) {
    const url = urlFromClipboardText(rawUrl);
    if (!url) {
      savesUrlInput.focus();
      return;
    }
    if (saveUrlInFlight === url) return;
    const existing = (data.saves || []).find((save) => save.url === url);
    if (existing && !isSaveArchived(existing)) {
      savesUrlInput.value = "";
      setSavesStatus("Already saved.");
      return;
    }

    saveUrlInFlight = url;
    savesAddBtn.disabled = true;
    setSavesStatus("Saving...");
    try {
      const metadata = await fetchSavedLinkMetadata(url);
      data.saves = data.saves || [];
      if (existing) {
        existing.title = metadata.title || existing.title;
        existing.faviconUrl = metadata.faviconUrl || existing.faviconUrl;
        existing.savedAt = new Date().toISOString();
        existing.archivedAt = null;
        data.saves = [existing, ...data.saves.filter((save) => save.id !== existing.id)];
      } else {
        data.saves.unshift({
          id: uid(),
          url,
          title: metadata.title,
          faviconUrl: metadata.faviconUrl,
          savedAt: new Date().toISOString(),
          archivedAt: null,
        });
      }
      await saveData();
      savesUrlInput.value = "";
      viewingSavesArchive = false;
      setSavesStatus("");
      renderSavesList();
    } finally {
      saveUrlInFlight = "";
      savesAddBtn.disabled = false;
    }
  }

  async function archiveSave(id) {
    const save = (data.saves || []).find((item) => item.id === id);
    if (!save || isSaveArchived(save)) return;
    save.archivedAt = new Date().toISOString();
    await saveData();
    renderSavesList();
  }

  document.getElementById("saves-btn").addEventListener("click", () => {
    void openSavesModal().catch(reportStorageError);
  });
  document.getElementById("saves-modal-close").addEventListener("click", closeSavesModal);
  savesModal.addEventListener("click", (e) => { if (e.target === savesModal) closeSavesModal(); });
  savesArchiveToggle.addEventListener("click", () => {
    viewingSavesArchive = !viewingSavesArchive;
    setSavesStatus("");
    renderSavesList();
  });
  document.getElementById("saves-form").addEventListener("submit", (e) => {
    e.preventDefault();
    void savePastedLink(savesUrlInput.value).catch(reportStorageError);
  });
  savesUrlInput.addEventListener("paste", () => {
    setTimeout(() => {
      void savePastedLink(savesUrlInput.value).catch(reportStorageError);
    }, 0);
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
  let pendingTitleAutofillUrl = "";
  let titleAutofillRequestId = 0;

  async function autofillTitleForUrlField() {
    if (editingLinkId || linkModal.hidden || linkTitleInput.value.trim()) return;

    const url = normaliseUrl(linkUrlInput.value.trim());
    if (!url || pendingTitleAutofillUrl === url) return;

    pendingTitleAutofillUrl = url;
    const requestId = ++titleAutofillRequestId;
    try {
      const title = await fetchPageTitle(url);
      if (
        title &&
        requestId === titleAutofillRequestId &&
        !editingLinkId &&
        !linkModal.hidden &&
        normaliseUrl(linkUrlInput.value.trim()) === url &&
        !linkTitleInput.value.trim()
      ) {
        linkTitleInput.value = title;
      }
    } catch {
      if (pendingTitleAutofillUrl === url) pendingTitleAutofillUrl = "";
    }
  }

  function openLinkModal() {
    editingLinkId = null;
    pendingTitleAutofillUrl = "";
    titleAutofillRequestId += 1;
    linkModalTitle.textContent = "Add Bookmark";
    linkSaveBtn.textContent = "Add Bookmark";
    linkUrlInput.value = "";
    linkTitleInput.value = "";
    linkModal.hidden = false;
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then((text) => {
        const url = urlFromClipboardText(text);
        if (!url) return;
        linkUrlInput.value = url;
        return autofillTitleForUrlField();
      }).catch(() => {});
    }
    setTimeout(() => linkTitleInput.focus(), 0);
    setTimeout(() => { void autofillTitleForUrlField(); }, 100);
    setTimeout(() => { void autofillTitleForUrlField(); }, 500);
  }

  function openLinkModalForEdit(link) {
    editingLinkId = link.id;
    pendingTitleAutofillUrl = "";
    titleAutofillRequestId += 1;
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
    pendingTitleAutofillUrl = "";
    titleAutofillRequestId += 1;
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
  linkUrlInput.addEventListener("input", () => {
    pendingTitleAutofillUrl = "";
    void autofillTitleForUrlField();
  });
  linkUrlInput.addEventListener("change", () => {
    pendingTitleAutofillUrl = "";
    void autofillTitleForUrlField();
  });
  linkTitleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void saveLinkModal().catch(reportStorageError);
  });
  linkTitleInput.addEventListener("click", () => {
    linkTitleInput.select();
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
  const settingsTabs = Array.from(document.querySelectorAll("[data-settings-tab]"));
  const settingsPanels = Array.from(document.querySelectorAll("[data-settings-panel]"));

  function activateSettingsTab(sectionId, focusTab = false) {
    if (!sectionId) return;
    closeAiProviderDropdown();
    closeWallpaperDropdown();

    settingsTabs.forEach((tab) => {
      const active = tab.dataset.settingsTab === sectionId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.tabIndex = active ? 0 : -1;
      if (active && focusTab) tab.focus();
    });

    settingsPanels.forEach((panel) => {
      const active = panel.dataset.settingsPanel === sectionId;
      panel.classList.toggle("is-active", active);
      panel.toggleAttribute("hidden", !active);
    });
  }

  function handleSettingsTabKeydown(e) {
    const currentIndex = settingsTabs.indexOf(e.currentTarget);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % settingsTabs.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + settingsTabs.length) % settingsTabs.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = settingsTabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    activateSettingsTab(settingsTabs[nextIndex].dataset.settingsTab, true);
  }

  function openSettingsModal() {
    applyAiSearchBoxVisibility(getStoredAiSearchEnabled());
    syncAiProviderCustomSelect();
    syncWallpaperCustomSelect();
    syncBookmarkSearchLimitInput();
    activateSettingsTab("theme");
    closeAiProviderDropdown();
    closeWallpaperDropdown();
    settingsModal.hidden = false;
  }

  function closeSettingsModal() {
    closeAiProviderDropdown();
    closeWallpaperDropdown();
    settingsModal.hidden = true;
  }

  document.getElementById("settings-btn").addEventListener("click", openSettingsModal);
  document.getElementById("settings-modal-done").addEventListener("click", closeSettingsModal);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });
  settingsTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateSettingsTab(tab.dataset.settingsTab);
    });
    tab.addEventListener("keydown", handleSettingsTabKeydown);
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

  if (wallpaperTrigger && wallpaperList) {
    wallpaperTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      setWallpaperDropdownOpen(!isWallpaperDropdownOpen());
    });
    wallpaperTrigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!isWallpaperDropdownOpen()) openWallpaperDropdown();
        focusWallpaperOption(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!isWallpaperDropdownOpen()) openWallpaperDropdown();
        focusWallpaperOption(-1);
      } else if (e.key === "Escape" && isWallpaperDropdownOpen()) {
        e.preventDefault();
        e.stopPropagation();
        closeWallpaperDropdown();
      }
    });
    wallpaperList.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeWallpaperDropdown();
        wallpaperTrigger.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        focusWallpaperOption(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusWallpaperOption(-1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const v = document.activeElement.getAttribute("data-value");
        if (v) {
          void applyWallpaper(v, { persist: true })
            .then(() => {
              closeWallpaperDropdown();
              wallpaperTrigger.focus();
            })
            .catch(reportStorageError);
        }
      }
    });
    wallpaperList.querySelectorAll("[role='option']").forEach((opt) => {
      opt.addEventListener("click", () => {
        const v = opt.getAttribute("data-value");
        if (v) {
          void applyWallpaper(v, { persist: true })
            .then(() => {
              closeWallpaperDropdown();
              wallpaperTrigger.focus();
            })
            .catch(reportStorageError);
          return;
        }
        closeWallpaperDropdown();
        wallpaperTrigger.focus();
      });
    });
    document.addEventListener("click", (e) => {
      if (!isWallpaperDropdownOpen() || !wallpaperCustom) return;
      if (!wallpaperCustom.contains(e.target)) closeWallpaperDropdown();
    });
  }

  if (bookmarkSearchLimitInput) {
    const persistBookmarkSearchLimitInput = () => {
      const raw = Number(bookmarkSearchLimitInput.value);
      const normalized = Number.isFinite(raw) ? Math.min(8, Math.max(1, Math.round(raw))) : getStoredBookmarkSearchResultLimit();
      void applyBookmarkSearchResultLimit(normalized, { persist: true }).catch(reportStorageError);
    };

    bookmarkSearchLimitInput.addEventListener("change", persistBookmarkSearchLimitInput);
    bookmarkSearchLimitInput.addEventListener("blur", persistBookmarkSearchLimitInput);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DATA IMPORT / EXPORT / DELETE ALL
  // ══════════════════════════════════════════════════════════════════════════

  function exportData() {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      bookmarks: data,
      settings,
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

  async function applyImport(imported, importedSettings = null) {
    data = imported;
    await archiveExpiredSaves({ persist: false });
    await saveData();
    if (importedSettings) {
      settings = importedSettings;
      await saveSettings(settings);
      await initAiSearchProvider();
      await applyWallpaper(getStoredWallpaper(), { persist: false });
      applyAiSearchBoxVisibility(getStoredAiSearchEnabled());
      syncBookmarkSearchLimitInput();
    }
    currentPath = [];
    render();
  }

  function sanitizeImportedSettings(importedSettings) {
    if (!importedSettings || typeof importedSettings !== "object") return null;
    const records = Object.entries(importedSettings).map(([key, value]) => ({ key, value }));
    return hydrateSettings(records);
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed;
      let parsedSettings = null;
      try {
        const raw = JSON.parse(e.target.result);
        if (raw && raw.version === 1 && raw.bookmarks) {
          parsed = raw.bookmarks;
        } else if (raw && raw.version === 2 && raw.bookmarks) {
          parsed = raw.bookmarks;
          parsedSettings = sanitizeImportedSettings(raw.settings);
        } else if (raw && raw.version === 3 && raw.bookmarks) {
          parsed = raw.bookmarks;
          parsedSettings = sanitizeImportedSettings(raw.settings);
        } else if (raw && Array.isArray(raw.items)) {
          parsed = raw;
        } else {
          throw new Error("Unrecognised format");
        }
        if (!Array.isArray(parsed.items)) throw new Error("Missing items");
        if (!Array.isArray(parsed.favorites)) parsed.favorites = [];
        if (!Array.isArray(parsed.saves)) parsed.saves = [];
        parsed.saves = hydrateSaves(parsed.saves);
      } catch {
        alert("Could not read the file. Make sure it's a valid Tabstract export.");
        return;
      }
      const importedData = parsed;
      const importedSettings = parsedSettings;
      openDestructiveConfirm({
        title: "Replace all data?",
        message: "This will permanently replace all your current bookmarks, favorites, saves, and any exported settings with the imported file. This cannot be undone.",
        confirmLabel: "Replace",
        action: async () => {
          await applyImport(importedData, importedSettings);
          closeSettingsModal();
        },
      });
    };
    reader.readAsText(file);
  }

  function deleteAllData() {
    openDestructiveConfirm({
      title: "Delete all data?",
      message: "This will permanently delete all your bookmarks, favorites, and saves. This cannot be undone.",
      confirmLabel: "Delete All",
      action: async () => {
        data = defaultData();
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
      if (!itemContextMenu.hidden || !gridContextMenu.hidden) { hideAllContextMenus(); return; }
      if (!routeChoiceModal.hidden) { closeRouteChoiceModal(); return; }
      if (!deleteConfirmModal.hidden) { closeDeleteConfirm(); return; }
      if (!routesModal.hidden) { closeRoutesModal(); return; }
      if (!iconCustomizeModal.hidden) { closeIconCustomizeModal(); return; }
      if (!savesModal.hidden) { closeSavesModal(); return; }
      if (!settingsModal.hidden) {
        if (isAiProviderDropdownOpen()) {
          closeAiProviderDropdown();
          return;
        }
        if (isWallpaperDropdownOpen()) {
          closeWallpaperDropdown();
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
        linkModal.hidden && folderModal.hidden && deleteConfirmModal.hidden &&
        iconCustomizeModal.hidden && routesModal.hidden && routeChoiceModal.hidden && savesModal.hidden && settingsModal.hidden &&
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
    await archiveExpiredSaves();
    setInterval(() => {
      archiveExpiredSaves()
        .then((changed) => {
          if (changed && !savesModal.hidden) renderSavesList();
        })
        .catch(reportStorageError);
    }, 60000);
    await initAiSearchProvider();
    await applyWallpaper(getStoredWallpaper(), { persist: false });
    applyAiSearchBoxVisibility(getStoredAiSearchEnabled());
    searchInput.focus();
    render();
  }

  init().catch(reportStorageError);
})();
