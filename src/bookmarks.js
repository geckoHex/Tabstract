import { iconSrc, MAX_FAVORITES } from "./constants.js";
import { clearAllDropIndicators, initBookmarkDrag } from "./bookmark-drag.js";
import { linkIconSrc, queueFaviconCache } from "./favicons.js";
import {
  currentItems,
  extractItem,
  findItem,
  pathExists,
  pathIdsToFolder,
  pathsEqual,
  pruneFolderHistory,
} from "./model.js";
import { state } from "./state.js";
import { saveData, saveSetting } from "./storage.js";
import { hostname } from "./utils.js";

export function initBookmarks(ctx) {
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
  let contextItemType = null;

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
    const already = state.data.favorites.includes(id);
    if (already) {
      ctxFavoriteLabel.textContent = "Unpin";
      ctxFavoriteIcon.src = "icons/push-pin-slash.svg";
      ctxFavorite.disabled = false;
    } else {
      ctxFavoriteLabel.textContent = "Pin";
      ctxFavoriteIcon.src = "icons/push-pin.svg";
      ctxFavorite.disabled = state.data.favorites.length >= MAX_FAVORITES;
    }
    positionContextMenu(itemContextMenu, e);
  }

  function showGridContextMenu(e) {
    e.preventDefault();
    hideItemContextMenu();
    ctx.closeRouteChoiceModal?.();
    positionContextMenu(gridContextMenu, e);
  }

  async function rememberCurrentFolderPath() {
    state.settings.lastFolderVisit = {
      path: [...state.currentPath],
      visitedAt: new Date().toISOString(),
    };
    await saveSetting("lastFolderVisit", state.settings.lastFolderVisit);
  }

  async function clearLastFolderVisit() {
    state.settings.lastFolderVisit = null;
    await saveSetting("lastFolderVisit", null);
  }

  function setCurrentPath(nextPath) {
    if (!Array.isArray(nextPath) || !pathExists(nextPath) || pathsEqual(state.currentPath, nextPath)) return;
    state.currentPath = [...nextPath];
    state.folderForwardHistory = [];
    void rememberCurrentFolderPath().catch(ctx.reportStorageError);
    render();
  }

  function goUpFolder() {
    if (state.currentPath.length === 0) return;
    state.folderForwardHistory.unshift([...state.currentPath]);
    state.currentPath = state.currentPath.slice(0, -1);
    void rememberCurrentFolderPath().catch(ctx.reportStorageError);
    render();
  }

  function goForwardFolder() {
    pruneFolderHistory();
    const nextPath = state.folderForwardHistory.shift();
    if (!nextPath) {
      renderFolderNavigation();
      return;
    }
    state.currentPath = [...nextPath];
    void rememberCurrentFolderPath().catch(ctx.reportStorageError);
    render();
  }

  function pruneStaleFavorites() {
    const next = state.data.favorites.filter((id) => findItem(state.data.items, id));
    if (next.length !== state.data.favorites.length) {
      state.data.favorites = next;
      void saveData().catch(ctx.reportStorageError);
    }
  }

  async function deleteItem(id) {
    extractItem(id);
    state.data.favorites = state.data.favorites.filter((fid) => fid !== id);
    await saveData();
    render();
  }

  async function moveIntoFolder(id, targetFolderId) {
    const item = extractItem(id);
    if (!item) return;
    const r = findItem(state.data.items, targetFolderId);
    if (r && r.item.type === "folder") r.item.children.push(item);
    else state.data.items.push(item);
    await saveData();
    render();
  }

  function renderPathBar() {
    const bar = document.getElementById("path-bar");
    bar.innerHTML = "";
    renderFolderNavigation();
    const rootBtn = document.createElement("button");
    rootBtn.className = `path-segment${state.currentPath.length === 0 ? " current" : ""}`;
    rootBtn.innerHTML = `<span class="path-root-label">Bookmarks</span>`;
    rootBtn.addEventListener("click", () => setCurrentPath([]));
    bar.appendChild(rootBtn);
    let arr = state.data.items;
    for (let i = 0; i < state.currentPath.length; i++) {
      const id = state.currentPath[i];
      const folder = arr.find((f) => f.type === "folder" && f.id === id);
      if (!folder) break;
      const sep = document.createElement("span");
      sep.className = "path-sep";
      sep.textContent = "›";
      bar.appendChild(sep);
      const btn = document.createElement("button");
      const isCurrent = i === state.currentPath.length - 1;
      btn.className = `path-segment${isCurrent ? " current" : ""}`;
      btn.textContent = folder.name;
      if (!isCurrent) btn.addEventListener("click", () => setCurrentPath(state.currentPath.slice(0, i + 1)));
      bar.appendChild(btn);
      arr = folder.children;
    }
  }

  function renderFolderNavigation() {
    const upBtn = document.getElementById("folder-up-btn");
    const forwardBtn = document.getElementById("folder-forward-btn");
    if (!upBtn || !forwardBtn) return;
    pruneFolderHistory();
    upBtn.disabled = state.currentPath.length === 0;
    forwardBtn.disabled = state.folderForwardHistory.length === 0;
  }

  function render() {
    renderPathBar();
    grid.innerHTML = "";
    const items = currentItems();
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "grid-empty";
      const isRoot = state.currentPath.length === 0;
      empty.innerHTML = `
        <img class="empty-bookmark-icon" src="${iconSrc("bookmark-simple.svg")}" alt="" width="40" height="40" />
        <p>${isRoot ? "No bookmarks yet.<br>Add links or folders above." : "This folder is empty.<br>Use Add Link to add one."}</p>`;
      grid.appendChild(empty);
      ctx.updateBookmarkSearchResults?.();
      renderFavorites();
      return;
    }
    for (const item of items) grid.appendChild(item.type === "folder" ? makeFolderIcon(item) : makeLinkIcon(item));
    ctx.updateBookmarkSearchResults?.();
    renderFavorites();
  }

  function renderFavorites() {
    pruneStaleFavorites();
    favoritesGrid.innerHTML = "";
    for (const id of state.data.favorites) {
      const r = findItem(state.data.items, id);
      if (!r) continue;
      const item = r.item;
      const node = item.type === "folder"
        ? makeFolderIcon(item, { draggable: false, navigateFromRoot: true })
        : makeLinkIcon(item, { draggable: false });
      node.draggable = true;
      node.addEventListener("dragstart", (e) => {
        state.favDrag = { favId: id, dropTarget: null };
        node.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      node.addEventListener("dragend", () => {
        state.favDrag = null;
        node.classList.remove("dragging");
        clearAllDropIndicators();
      });
      favoritesGrid.appendChild(node);
    }
  }

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
    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = folder.name;
    el.appendChild(label);
    el.addEventListener("contextmenu", (e) => showItemContextMenu(e, folder.id, "folder"));
    el.addEventListener("click", () => {
      if (navigateFromRoot) {
        const p = pathIdsToFolder(folder.id);
        if (p) setCurrentPath(p);
      } else setCurrentPath([...state.currentPath, folder.id]);
    });
    el.draggable = draggable;
    if (draggable) {
      el.addEventListener("dragstart", (e) => {
        state.drag = { itemId: folder.id, dropTarget: null };
        el.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      el.addEventListener("dragend", () => {
        state.drag = null;
        el.classList.remove("dragging");
        clearAllDropIndicators();
      });
    }
    return el;
  }

  function makeLinkIcon(link, opts = {}) {
    const { draggable = true } = opts;
    const el = document.createElement("div");
    el.className = "icon-item";
    el.dataset.id = link.id;
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
      queueFaviconCache(link.url);
      wrap.appendChild(makeFallbackLetter(link));
    }
    el.appendChild(wrap);
    const label = document.createElement("span");
    label.className = "icon-label";
    label.textContent = link.title || hostname(link.url);
    el.appendChild(label);
    el.addEventListener("contextmenu", (e) => showItemContextMenu(e, link.id, "link"));
    el.addEventListener("click", () => {
      if (ctx.linkRoutesEnabled(link)) ctx.openRoutePopup(link, el);
      else {
        ctx.closeRouteChoiceModal?.();
        window.location.href = link.url;
      }
    });
    el.draggable = draggable;
    if (draggable) {
      el.addEventListener("dragstart", (e) => {
        state.drag = { itemId: link.id, dropTarget: null };
        el.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      el.addEventListener("dragend", () => {
        state.drag = null;
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

  function openDeleteConfirm(id) {
    const r = findItem(state.data.items, id);
    if (!r) return;
    const item = r.item;
    const title = item.type === "link" ? "Delete bookmark?" : "Delete folder?";
    const message = item.type === "link"
      ? `Permanently delete "${item.title || hostname(item.url)}"?`
      : `Permanently delete the folder "${item.name}" and all ${item.children.length} ${item.children.length === 1 ? "item" : "items"} inside it?`;
    ctx.openDestructiveConfirm({ title, message, confirmLabel: "Delete", action: async () => deleteItem(id) });
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
  ctxFavorite.addEventListener("click", () => {
    void (async () => {
      if (!contextItemId || ctxFavorite.disabled) return;
      const id = contextItemId;
      const ix = state.data.favorites.indexOf(id);
      if (ix >= 0) state.data.favorites.splice(ix, 1);
      else if (state.data.favorites.length < MAX_FAVORITES) state.data.favorites.push(id);
      await saveData();
      hideItemContextMenu();
      render();
    })().catch(ctx.reportStorageError);
  });
  ctxEdit.addEventListener("click", () => {
    if (!contextItemId) return;
    const r = findItem(state.data.items, contextItemId);
    if (!r) {
      hideItemContextMenu();
      return;
    }
    if (contextItemType === "link" && r.item.type === "link") ctx.openLinkModalForEdit(r.item);
    else if (contextItemType === "folder" && r.item.type === "folder") ctx.openFolderModalForEdit(r.item);
    hideItemContextMenu();
  });
  ctxCustomize.addEventListener("click", () => {
    if (!contextItemId || contextItemType !== "link") return;
    const r = findItem(state.data.items, contextItemId);
    hideItemContextMenu();
    if (r?.item.type === "link") ctx.openIconCustomizeModal(r.item);
  });
  ctxRoutes.addEventListener("click", () => {
    if (!contextItemId || contextItemType !== "link") return;
    const r = findItem(state.data.items, contextItemId);
    hideItemContextMenu();
    if (r?.item.type === "link") ctx.openRoutesModal(r.item);
  });
  ctxDelete.addEventListener("click", () => {
    if (!contextItemId) {
      hideItemContextMenu();
      return;
    }
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
    ctx.openLinkModal();
  });
  ctxGridNewFolder.addEventListener("click", () => {
    hideGridContextMenu();
    ctx.openFolderModal();
  });
  document.getElementById("folder-up-btn").addEventListener("click", goUpFolder);
  document.getElementById("folder-forward-btn").addEventListener("click", goForwardFolder);
  initBookmarkDrag({
    grid,
    favoritesGrid,
    render,
    renderFavorites,
    moveIntoFolder,
    reportStorageError: ctx.reportStorageError,
  });

  Object.assign(ctx, {
    clearLastFolderVisit,
    currentItems,
    goUpFolder,
    hideAllContextMenus,
    isGridContextMenuOpen: () => !gridContextMenu.hidden,
    isItemContextMenuOpen: () => !itemContextMenu.hidden,
    render,
    renderFavorites,
    setCurrentPath,
  });
}
