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
  const itemContextMenu = document.getElementById("item-context-menu");
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
    positionContextMenu(e);
  }

  document.addEventListener("mousedown", (e) => {
    if (itemContextMenu.hidden) return;
    if (!itemContextMenu.contains(e.target)) hideContextMenu();
  });

  document.getElementById("grid-scroll").addEventListener("scroll", () => {
    if (!itemContextMenu.hidden) hideContextMenu();
  });

  ctxEdit.addEventListener("click", () => {
    if (!contextItemId) return;
    const r = findItem(data.items, contextItemId);
    if (!r) { hideContextMenu(); return; }
    if (contextItemType === "link" && r.item.type === "link") openLinkModalForEdit(r.item);
    else if (contextItemType === "folder" && r.item.type === "folder") openFolderModalForEdit(r.item);
    hideContextMenu();
  });

  // ── Confirm delete modal ─────────────────────────────────────────────────

  const deleteConfirmModal = document.getElementById("delete-confirm-modal");
  const deleteModalTitle = document.getElementById("delete-modal-title");
  const deleteModalMessage = document.getElementById("delete-modal-message");
  let pendingDeleteId = null;

  function openDeleteConfirm(id) {
    const r = findItem(data.items, id);
    if (!r) return;
    pendingDeleteId = id;
    const item = r.item;
    if (item.type === "link") {
      const label = item.title || hostname(item.url);
      deleteModalTitle.textContent = "Delete bookmark?";
      deleteModalMessage.textContent = `Permanently delete "${label}"?`;
    } else {
      const n = item.children.length;
      const itemWord = n === 1 ? "item" : "items";
      deleteModalTitle.textContent = "Delete folder?";
      deleteModalMessage.textContent =
        `Permanently delete the folder "${item.name}" and all ${n} ${itemWord} inside it?`;
    }
    deleteConfirmModal.hidden = false;
  }

  function closeDeleteConfirm() {
    deleteConfirmModal.hidden = true;
    pendingDeleteId = null;
  }

  document.getElementById("delete-modal-close").addEventListener("click", closeDeleteConfirm);
  document.getElementById("delete-cancel").addEventListener("click", closeDeleteConfirm);
  document.getElementById("delete-confirm").addEventListener("click", () => {
    if (pendingDeleteId) deleteItem(pendingDeleteId);
    closeDeleteConfirm();
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

  function makeFallbackLetter(link) {
    const span = document.createElement("span");
    span.className = "favicon-fallback";
    span.textContent = (link.title || hostname(link.url) || "?")[0].toUpperCase();
    return span;
  }

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

  function saveLinkModal() {
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

  function saveFolderModal() {
    const name = folderNameInput.value.trim();
    if (!name) { folderNameInput.focus(); return; }

    if (editingFolderId) {
      const r = findItem(data.items, editingFolderId);
      if (r && r.item.type === "folder") r.item.name = name;
    } else {
      currentItems().push({ type: "folder", id: uid(), name, children: [] });
    }
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
    if (e.key === "Escape") {
      if (!itemContextMenu.hidden) { hideContextMenu(); return; }
      if (!deleteConfirmModal.hidden) { closeDeleteConfirm(); return; }
      closeLinkModal();
      closeFolderModal();
    }
    // Backspace/ArrowLeft when no modal is open → go up one level
    if ((e.key === "Backspace" || e.key === "ArrowLeft") &&
        linkModal.hidden && folderModal.hidden && deleteConfirmModal.hidden &&
        document.activeElement === document.body) {
      if (currentPath.length > 0) { currentPath.pop(); render(); }
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  updateClock();
  const now = new Date();
  const msUntilNextMinute =
    60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
  setTimeout(() => {
    updateClock();
    setInterval(updateClock, 60000);
  }, msUntilNextMinute);
  searchInput.focus();
  render();
})();
