import {
  DB_NAME,
  DB_VERSION,
  DEFAULT_SAVE_ARCHIVE_AFTER_MS,
  FAVORITES_STORE,
  FAVICONS_STORE,
  ITEMS_STORE,
  SAVE_ARCHIVE_OPTIONS,
  SAVES_STORE,
  SETTINGS_STORE,
  WALLPAPERS,
} from "./constants.js";
import { normalizeRoutes } from "./model.js";
import { defaultData, defaultSettings, state } from "./state.js";
import { normaliseUrl, uid } from "./utils.js";

let dbPromise = null;

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export function openDatabase() {
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
      if (!db.objectStoreNames.contains(FAVICONS_STORE)) {
        db.createObjectStore(FAVICONS_STORE, { keyPath: "hostname" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export function flattenItems(items, parentId = null, out = []) {
  items.forEach((item, position) => {
    if (item.type === "folder") {
      out.push({ id: item.id, type: "folder", name: item.name, parentId, position });
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

export function hydrateItems(records) {
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

export function hydrateFavorites(records) {
  return records
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((record) => record.id);
}

export function hydrateSettings(records) {
  const settings = defaultSettings();
  for (const record of records) {
    if (record.key === "aiProvider" && (record.value === "chatgpt" || record.value === "claude")) {
      settings.aiProvider = record.value;
    }
    if (record.key === "bookmarkSearchResultLimit") {
      const value = Number(record.value);
      if (Number.isInteger(value) && value >= 1 && value <= 8) settings.bookmarkSearchResultLimit = value;
    }
    if (record.key === "saveArchiveAfterMs") {
      const value = Number(record.value);
      if (SAVE_ARCHIVE_OPTIONS[value]) settings.saveArchiveAfterMs = value;
    }
    if (record.key === "openaiApiKey" && typeof record.value === "string") settings.openaiApiKey = record.value;
    if (record.key === "lastFolderVisit") {
      const value = record.value;
      if (
        value &&
        typeof value === "object" &&
        Array.isArray(value.path) &&
        value.path.every((id) => typeof id === "string") &&
        typeof value.visitedAt === "string" &&
        Number.isFinite(Date.parse(value.visitedAt))
      ) {
        settings.lastFolderVisit = { path: [...value.path], visitedAt: value.visitedAt };
      }
    }
    if (record.key === "wallpaper" && WALLPAPERS[record.value]) settings.wallpaper = record.value;
  }
  settings.aiSearchEnabled = false;
  return settings;
}

export function hydrateSaves(records) {
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
      locked: Boolean(record.locked),
    }))
    .filter((record) => record.url);
}

export function hydrateFavicons(records) {
  return records
    .filter((record) => (
      record &&
      typeof record.hostname === "string" &&
      record.hostname &&
      typeof record.dataUrl === "string" &&
      record.dataUrl.startsWith("data:image/")
    ))
    .map((record) => ({
      hostname: record.hostname,
      dataUrl: record.dataUrl,
      sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : "",
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    }));
}

export function saveExpiryTime(save) {
  const savedAt = Date.parse(save.savedAt || "");
  const archiveAfterMs = SAVE_ARCHIVE_OPTIONS[state.settings.saveArchiveAfterMs]
    ? state.settings.saveArchiveAfterMs
    : DEFAULT_SAVE_ARCHIVE_AFTER_MS;
  return Number.isFinite(savedAt) ? savedAt + archiveAfterMs : Date.now() + archiveAfterMs;
}

export function isSaveArchived(save) {
  return Boolean(save.archivedAt);
}

export async function archiveExpiredSaves({ persist = true } = {}) {
  const now = Date.now();
  let changed = false;
  state.data.saves = (state.data.saves || []).map((save) => {
    if (isSaveArchived(save) || saveExpiryTime(save) > now || save.locked) return save;
    changed = true;
    return { ...save, archivedAt: new Date(now).toISOString() };
  });
  if (changed && persist) await saveData();
  return changed;
}

export async function loadPersistedState() {
  const db = await openDatabase();
  const tx = db.transaction([ITEMS_STORE, FAVORITES_STORE, SETTINGS_STORE, SAVES_STORE, FAVICONS_STORE], "readonly");
  const itemsRequest = tx.objectStore(ITEMS_STORE).getAll();
  const favoritesRequest = tx.objectStore(FAVORITES_STORE).getAll();
  const settingsRequest = tx.objectStore(SETTINGS_STORE).getAll();
  const savesRequest = tx.objectStore(SAVES_STORE).getAll();
  const faviconsRequest = tx.objectStore(FAVICONS_STORE).getAll();
  const [itemRecords, favoriteRecords, settingRecords, saveRecords, faviconRecords] = await Promise.all([
    requestToPromise(itemsRequest),
    requestToPromise(favoritesRequest),
    requestToPromise(settingsRequest),
    requestToPromise(savesRequest),
    requestToPromise(faviconsRequest),
    transactionToPromise(tx),
  ]);
  return {
    data: {
      items: hydrateItems(itemRecords),
      favorites: hydrateFavorites(favoriteRecords),
      saves: hydrateSaves(saveRecords),
    },
    settings: hydrateSettings(settingRecords),
    favicons: hydrateFavicons(faviconRecords),
  };
}

export async function saveData() {
  const db = await openDatabase();
  const tx = db.transaction([ITEMS_STORE, FAVORITES_STORE, SAVES_STORE], "readwrite");
  const itemStore = tx.objectStore(ITEMS_STORE);
  const favoriteStore = tx.objectStore(FAVORITES_STORE);
  const savesStore = tx.objectStore(SAVES_STORE);
  itemStore.clear();
  favoriteStore.clear();
  savesStore.clear();
  for (const record of flattenItems(state.data.items)) itemStore.put(record);
  state.data.favorites.forEach((id, position) => favoriteStore.put({ id, position }));
  for (const save of state.data.saves || []) savesStore.put(save);
  await transactionToPromise(tx);
}

export async function saveSetting(key, value) {
  const db = await openDatabase();
  const tx = db.transaction(SETTINGS_STORE, "readwrite");
  tx.objectStore(SETTINGS_STORE).put({ key, value });
  await transactionToPromise(tx);
}

export async function saveSettings(nextSettings) {
  nextSettings.aiSearchEnabled = false;
  const db = await openDatabase();
  const tx = db.transaction(SETTINGS_STORE, "readwrite");
  const store = tx.objectStore(SETTINGS_STORE);
  for (const [key, value] of Object.entries(nextSettings)) store.put({ key, value });
  await transactionToPromise(tx);
}

export async function saveFaviconRecord(record) {
  const db = await openDatabase();
  const tx = db.transaction(FAVICONS_STORE, "readwrite");
  tx.objectStore(FAVICONS_STORE).put(record);
  await transactionToPromise(tx);
}

export async function replaceFaviconStore(records) {
  const db = await openDatabase();
  const tx = db.transaction(FAVICONS_STORE, "readwrite");
  const store = tx.objectStore(FAVICONS_STORE);
  store.clear();
  for (const record of records) store.put(record);
  await transactionToPromise(tx);
}

export async function clearFaviconStore() {
  const db = await openDatabase();
  const tx = db.transaction(FAVICONS_STORE, "readwrite");
  tx.objectStore(FAVICONS_STORE).clear();
  await transactionToPromise(tx);
}

export function reportStorageError(error) {
  console.error("IndexedDB operation failed", error);
}

export function resetStoredDataInMemory() {
  state.data = defaultData();
}
