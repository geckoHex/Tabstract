import { RECENT_FOLDER_RESTORE_MS } from "./constants.js";
import { state } from "./state.js";
import { normaliseUrl, uid } from "./utils.js";

export function normalizeRoutes(routes) {
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

export function linkRoutes(link) {
  return normalizeRoutes(link?.routes);
}

export function linkRoutesEnabled(link) {
  return Boolean(link?.routesEnabled && linkRoutes(link).length > 0);
}

export function linkHasCustomIcon(link) {
  return Boolean(link?.customIcon);
}

export function findItem(items, id) {
  for (const item of items) {
    if (item.id === id) return { item, arr: items };
    if (item.type === "folder") {
      const r = findItem(item.children, id);
      if (r) return r;
    }
  }
  return null;
}

export function pathIdsToFolder(folderId, items = state.data.items, prefix = []) {
  for (const item of items) {
    if (item.type !== "folder") continue;
    const chain = [...prefix, item.id];
    if (item.id === folderId) return chain;
    const found = pathIdsToFolder(folderId, item.children, chain);
    if (found) return found;
  }
  return null;
}

export function pathsEqual(a, b) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function pathExists(path) {
  let arr = state.data.items;
  for (const id of path) {
    const folder = arr.find((item) => item.type === "folder" && item.id === id);
    if (!folder) return false;
    arr = folder.children;
  }
  return true;
}

export function pruneFolderHistory() {
  state.folderForwardHistory = state.folderForwardHistory.filter(pathExists);
}

export function lastFolderVisitIsRecent(visit, now = Date.now()) {
  const visitedAt = Date.parse(visit?.visitedAt || "");
  return (
    Array.isArray(visit?.path) &&
    Number.isFinite(visitedAt) &&
    now - visitedAt >= 0 &&
    now - visitedAt < RECENT_FOLDER_RESTORE_MS
  );
}

export function restoreRecentFolderPath() {
  const visit = state.settings.lastFolderVisit;
  if (!lastFolderVisitIsRecent(visit) || !pathExists(visit.path)) return;
  state.currentPath = [...visit.path];
}

export function resetFolderNavigation() {
  state.currentPath = [];
  state.folderForwardHistory = [];
}

export function extractItem(id) {
  const r = findItem(state.data.items, id);
  if (!r) return null;
  r.arr.splice(r.arr.indexOf(r.item), 1);
  return r.item;
}

export function currentItems() {
  let arr = state.data.items;
  for (const id of state.currentPath) {
    const folder = arr.find((item) => item.type === "folder" && item.id === id);
    if (!folder) return arr;
    arr = folder.children;
  }
  return arr;
}
