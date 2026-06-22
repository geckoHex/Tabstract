import { currentItems, extractItem } from "./model.js";
import { state } from "./state.js";
import { saveData } from "./storage.js";

export function clearAllDropIndicators() {
  document.querySelectorAll(".drop-target, .drop-before, .drop-after")
    .forEach((el) => el.classList.remove("drop-target", "drop-before", "drop-after"));
}

export function initBookmarkDrag({ grid, favoritesGrid, render, renderFavorites, moveIntoFolder, reportStorageError }) {
  async function reorderItemBefore(id, beforeId) {
    const item = extractItem(id);
    if (!item) return;
    const items = currentItems();
    const idx = items.findIndex((i) => i.id === beforeId);
    items.splice(idx === -1 ? items.length : idx, 0, item);
    await saveData();
    render();
  }

  async function reorderItemAfter(id, afterId) {
    const item = extractItem(id);
    if (!item) return;
    const items = currentItems();
    const idx = items.findIndex((i) => i.id === afterId);
    items.splice(idx === -1 ? items.length : idx + 1, 0, item);
    await saveData();
    render();
  }

  async function handleGridDrop(e) {
    e.preventDefault();
    if (!state.drag) return;
    clearAllDropIndicators();
    const dt = state.drag.dropTarget;
    const itemId = state.drag.itemId;
    if (!dt) {
      const item = extractItem(itemId);
      if (item) {
        currentItems().push(item);
        await saveData();
        render();
      }
    } else if (dt.mode === "into") await moveIntoFolder(itemId, dt.id);
    else if (dt.mode === "before") await reorderItemBefore(itemId, dt.id);
    else if (dt.mode === "after") await reorderItemAfter(itemId, dt.id);
  }

  async function reorderFavoriteBefore(favId, beforeId) {
    const fromIdx = state.data.favorites.indexOf(favId);
    const arr = state.data.favorites;
    arr.splice(fromIdx, 1);
    const toIdx = arr.indexOf(beforeId);
    arr.splice(toIdx === -1 ? arr.length : toIdx, 0, favId);
    await saveData();
    renderFavorites();
  }

  async function reorderFavoriteAfter(favId, afterId) {
    const fromIdx = state.data.favorites.indexOf(favId);
    const arr = state.data.favorites;
    arr.splice(fromIdx, 1);
    const toIdx = arr.indexOf(afterId);
    arr.splice(toIdx === -1 ? arr.length : toIdx + 1, 0, favId);
    await saveData();
    renderFavorites();
  }

  async function handleFavoritesDrop(e) {
    e.preventDefault();
    if (!state.favDrag) return;
    clearAllDropIndicators();
    const dt = state.favDrag.dropTarget;
    if (!dt) return;
    if (dt.mode === "before") await reorderFavoriteBefore(state.favDrag.favId, dt.id);
    else if (dt.mode === "after") await reorderFavoriteAfter(state.favDrag.favId, dt.id);
  }

  function handleGridDragOver(e) {
    if (!state.drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = e.target.closest(".icon-item");
    if (!target || target.dataset.id === state.drag.itemId) {
      clearAllDropIndicators();
      state.drag.dropTarget = null;
      return;
    }
    const targetId = target.dataset.id;
    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const isFolder = !!currentItems().find((i) => i.id === targetId && i.type === "folder");
    clearAllDropIndicators();
    if (isFolder) {
      const inset = rect.width * 0.28;
      if (e.clientX >= rect.left + inset && e.clientX <= rect.right - inset) {
        target.classList.add("drop-target");
        state.drag.dropTarget = { mode: "into", id: targetId };
      } else setSideDropTarget(target, e.clientX < midX, state.drag, targetId);
    } else setSideDropTarget(target, e.clientX < midX, state.drag, targetId);
  }

  function handleFavoritesDragOver(e) {
    if (!state.favDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const target = e.target.closest(".icon-item");
    if (!target || target.dataset.id === state.favDrag.favId) {
      clearAllDropIndicators();
      state.favDrag.dropTarget = null;
      return;
    }
    const rect = target.getBoundingClientRect();
    clearAllDropIndicators();
    setSideDropTarget(target, e.clientX < rect.left + rect.width / 2, state.favDrag, target.dataset.id);
  }

  function setSideDropTarget(target, before, dragState, id) {
    target.classList.add(before ? "drop-before" : "drop-after");
    dragState.dropTarget = { mode: before ? "before" : "after", id };
  }

  grid.addEventListener("dragover", handleGridDragOver);
  grid.addEventListener("dragleave", (e) => {
    if (!state.drag || grid.contains(e.relatedTarget)) return;
    clearAllDropIndicators();
    state.drag.dropTarget = null;
  });
  grid.addEventListener("drop", (e) => { void handleGridDrop(e).catch(reportStorageError); });
  favoritesGrid.addEventListener("dragover", handleFavoritesDragOver);
  favoritesGrid.addEventListener("dragleave", (e) => {
    if (!state.favDrag || favoritesGrid.contains(e.relatedTarget)) return;
    clearAllDropIndicators();
    state.favDrag.dropTarget = null;
  });
  favoritesGrid.addEventListener("drop", (e) => { void handleFavoritesDrop(e).catch(reportStorageError); });
}
