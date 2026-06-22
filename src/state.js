import { DEFAULT_SAVE_ARCHIVE_AFTER_MS } from "./constants.js";

export function defaultData() {
  return { items: [], favorites: [], saves: [] };
}

export function defaultSettings() {
  return {
    aiProvider: "chatgpt",
    aiSearchEnabled: false,
    bookmarkSearchResultLimit: 8,
    lastFolderVisit: null,
    openaiApiKey: "",
    saveArchiveAfterMs: DEFAULT_SAVE_ARCHIVE_AFTER_MS,
    wallpaper: "off",
  };
}

export const state = {
  data: defaultData(),
  settings: defaultSettings(),
  faviconCache: new Map(),
  faviconFetches: new Map(),
  faviconRenderTimer: 0,
  faviconRefreshInProgress: false,
  currentPath: [],
  folderForwardHistory: [],
  drag: null,
  favDrag: null,
  aiProviderId: "chatgpt",
  wallpaperId: "off",
  saveArchiveAfterMs: DEFAULT_SAVE_ARCHIVE_AFTER_MS,
};

export function setPersistedState(persisted) {
  state.data = persisted.data;
  state.settings = persisted.settings;
  state.faviconCache = new Map(persisted.favicons.map((record) => [record.hostname, record]));
}
