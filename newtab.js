(() => {
  const SEARCH_URL  = "https://www.google.com/search?q=";
  const STORAGE_KEY = "tabstract_bookmarks_v2";
  const iconSrc = (file) => chrome.runtime.getURL(`icons/${file}`);

  // ── Storage ────────────────────────────────────────────────────────────────

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { items: [] };
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  let data = loadData();

  // ── Navigation state: array of folder IDs from root to current ────────────

  let currentPath = []; // e.g. ['folderId1', 'folderId2']

  // ── Drag state ─────────────────────────────────────────────────────────────

  let drag = null; // { itemId }

  // ══════════════════════════════════════════════════════════════════════════
  // GREETING
  // ══════════════════════════════════════════════════════════════════════════

  function updateGreeting() {
    const h = new Date().getHours();
    const text =
      h < 5  ? "Good night."     :
      h < 12 ? "Good morning."   :
      h < 17 ? "Good afternoon." :
      h < 21 ? "Good evening."   : "Good night.";
    document.getElementById("greeting").textContent = text;
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

  function hostname(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url; }
  }

  function faviconSrc(url) {
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
    } catch { return null; }
  }

  // Deterministic hue from string → used for fallback icon backgrounds
  function strHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h) % 360;
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
  function deleteItem(id) {
    extractItem(id);
    saveData();
    render();
  }

  // Move `id` into `targetFolderId`, appended at end
  function moveIntoFolder(id, targetFolderId) {
    const item = extractItem(id);
    if (!item) return;
    const r = findItem(data.items, targetFolderId);
    if (r && r.item.type === "folder") {
      r.item.children.push(item);
    } else {
      // fallback: restore at root
      data.items.push(item);
    }
    saveData();
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
    rootBtn.innerHTML = `
      <img class="path-icon" src="${iconSrc("house.svg")}" alt="" width="12" height="12" />
      Bookmarks`;
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
      return;
    }

    for (const item of items) {
      grid.appendChild(item.type === "folder" ? makeFolderIcon(item) : makeLinkIcon(item));
    }
  }

  // ── Folder icon ────────────────────────────────────────────────────────────

  function makeFolderIcon(folder) {
    const el = document.createElement("div");
    el.className = "icon-item";
    el.dataset.id = folder.id;

    // Delete button
    el.appendChild(makeDeleteBtn(folder.id));

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

    // Click → navigate into folder
    el.addEventListener("click", (e) => {
      if (e.target.closest(".icon-delete")) return;
      currentPath = [...currentPath, folder.id];
      render();
    });

    // Drag & drop (as drag source)
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      drag = { itemId: folder.id };
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", () => {
      drag = null;
      el.classList.remove("dragging");
      document.querySelectorAll(".drop-target").forEach(t => t.classList.remove("drop-target"));
    });

    // Drop target: receive dragged items INTO this folder
    el.addEventListener("dragover", (e) => {
      if (!drag || drag.itemId === folder.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      el.classList.add("drop-target");
    });
    el.addEventListener("dragleave", (e) => {
      if (!el.contains(e.relatedTarget)) el.classList.remove("drop-target");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drop-target");
      if (!drag || drag.itemId === folder.id) return;
      moveIntoFolder(drag.itemId, folder.id);
    });

    return el;
  }

  // ── Link icon ──────────────────────────────────────────────────────────────

  function makeLinkIcon(link) {
    const el = document.createElement("div");
    el.className = "icon-item";
    el.dataset.id = link.id;

    // Delete button
    el.appendChild(makeDeleteBtn(link.id));

    // Favicon wrapper
    const wrap = document.createElement("div");
    wrap.className = "link-icon-wrap";

    const hue = strHue(link.title || link.url || link.id);
    wrap.style.background = `hsl(${hue}, 40%, 18%)`;

    const favSrc = faviconSrc(link.url);
    if (favSrc) {
      const img = document.createElement("img");
      img.className = "favicon";
      img.src = favSrc;
      img.alt = "";
      img.addEventListener("error", () => {
        img.remove();
        wrap.appendChild(makeFallbackLetter(link, hue));
      });
      wrap.appendChild(img);
    } else {
      wrap.appendChild(makeFallbackLetter(link, hue));
    }

    el.appendChild(wrap);

    // Label
    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = link.title || hostname(link.url);
    el.appendChild(label);

    // Click → open URL
    el.addEventListener("click", (e) => {
      if (e.target.closest(".icon-delete")) return;
      window.location.href = link.url;
    });

    // Drag source
    el.draggable = true;
    el.addEventListener("dragstart", (e) => {
      drag = { itemId: link.id };
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragend", () => {
      drag = null;
      el.classList.remove("dragging");
      document.querySelectorAll(".drop-target").forEach(t => t.classList.remove("drop-target"));
    });

    return el;
  }

  function makeFallbackLetter(link, hue) {
    const span = document.createElement("span");
    span.className = "favicon-fallback";
    span.textContent = (link.title || hostname(link.url) || "?")[0].toUpperCase();
    span.style.color = `hsl(${hue}, 80%, 75%)`;
    return span;
  }

  function makeDeleteBtn(id) {
    const btn = document.createElement("button");
    btn.className = "icon-delete";
    btn.title = "Remove";
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    btn.addEventListener("click", (e) => { e.stopPropagation(); deleteItem(id); });
    return btn;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: ADD LINK
  // ══════════════════════════════════════════════════════════════════════════

  const linkModal      = document.getElementById("link-modal");
  const linkUrlInput   = document.getElementById("link-url");
  const linkTitleInput = document.getElementById("link-title");

  function openLinkModal() {
    linkUrlInput.value = "";
    linkTitleInput.value = "";
    linkModal.hidden = false;
    setTimeout(() => linkUrlInput.focus(), 0);
  }

  function closeLinkModal() {
    linkModal.hidden = true;
  }

  // Auto-fill title from hostname on URL blur
  linkUrlInput.addEventListener("blur", () => {
    const url = linkUrlInput.value.trim();
    if (!url || linkTitleInput.value.trim()) return;
    try { linkTitleInput.value = hostname(normaliseUrl(url)); } catch {}
  });

  function saveLinkModal() {
    const url = normaliseUrl(linkUrlInput.value.trim());
    if (!url) { linkUrlInput.focus(); return; }
    const title = linkTitleInput.value.trim() || hostname(url);

    currentItems().push({ type: "link", id: uid(), title, url });
    saveData();
    render();
    closeLinkModal();
  }

  document.getElementById("add-link-btn").addEventListener("click", openLinkModal);
  document.getElementById("link-modal-close").addEventListener("click", closeLinkModal);
  document.getElementById("link-cancel").addEventListener("click", closeLinkModal);
  document.getElementById("link-save").addEventListener("click", saveLinkModal);
  linkModal.addEventListener("click", (e) => { if (e.target === linkModal) closeLinkModal(); });
  linkUrlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveLinkModal(); });
  linkTitleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveLinkModal(); });

  // ══════════════════════════════════════════════════════════════════════════
  // MODAL: NEW FOLDER
  // ══════════════════════════════════════════════════════════════════════════

  const folderModal     = document.getElementById("folder-modal");
  const folderNameInput = document.getElementById("folder-name");

  function openFolderModal() {
    folderNameInput.value = "";
    folderModal.hidden = false;
    setTimeout(() => folderNameInput.focus(), 0);
  }

  function closeFolderModal() {
    folderModal.hidden = true;
  }

  function saveFolderModal() {
    const name = folderNameInput.value.trim();
    if (!name) { folderNameInput.focus(); return; }

    currentItems().push({ type: "folder", id: uid(), name, children: [] });
    saveData();
    render();
    closeFolderModal();
  }

  document.getElementById("add-folder-btn").addEventListener("click", openFolderModal);
  document.getElementById("folder-modal-close").addEventListener("click", closeFolderModal);
  document.getElementById("folder-cancel").addEventListener("click", closeFolderModal);
  document.getElementById("folder-save").addEventListener("click", saveFolderModal);
  folderModal.addEventListener("click", (e) => { if (e.target === folderModal) closeFolderModal(); });
  folderNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveFolderModal(); });

  // ── Global keyboard ────────────────────────────────────────────────────────

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeLinkModal(); closeFolderModal(); }
    // Backspace/ArrowLeft when no modal is open → go up one level
    if ((e.key === "Backspace" || e.key === "ArrowLeft") &&
        linkModal.hidden && folderModal.hidden &&
        document.activeElement === document.body) {
      if (currentPath.length > 0) { currentPath.pop(); render(); }
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  updateGreeting();
  searchInput.focus();
  render();
})();
