import { collectFaviconUrls, fetchAndCacheFavicon, resetFaviconCache, warmMissingFaviconCache } from "./favicons.js";
import { resetFolderNavigation } from "./model.js";
import { defaultData, state } from "./state.js";
import {
  archiveExpiredSaves,
  hydrateFavicons,
  hydrateSaves,
  hydrateSettings,
  replaceFaviconStore,
  saveData,
  saveSettings,
} from "./storage.js";

export function initDataPortability(ctx) {
  function exportData() {
    const payload = {
      version: 4,
      exportedAt: new Date().toISOString(),
      bookmarks: state.data,
      settings: state.settings,
      favicons: [...state.faviconCache.values()],
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

  async function applyImport(imported, importedSettings = null, importedFavicons = null) {
    state.data = imported;
    if (importedSettings) state.settings = importedSettings;
    const nextFavicons = importedFavicons || [];
    state.faviconCache = new Map(nextFavicons.map((record) => [record.hostname, record]));
    await replaceFaviconStore(nextFavicons);
    await archiveExpiredSaves({ persist: false });
    await saveData();
    if (importedSettings) {
      await saveSettings(state.settings);
      if (ctx.getStoredAiSearchEnabled()) await ctx.initAiSearchProvider();
      await ctx.applyWallpaper(ctx.getStoredWallpaper(), { persist: false });
      await ctx.applySaveArchiveAfter(ctx.getStoredSaveArchiveAfterMs(), { persist: false });
      ctx.applyAiSearchBoxVisibility(ctx.getStoredAiSearchEnabled());
      ctx.syncBookmarkSearchLimitInput();
      ctx.syncOpenaiApiKeyInput();
    }
    resetFolderNavigation();
    await ctx.clearLastFolderVisit();
    ctx.render();
    void warmMissingFaviconCache(ctx.linkHasCustomIcon).catch(ctx.reportStorageError);
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
      let parsedFavicons = null;
      try {
        const raw = JSON.parse(e.target.result);
        if (raw && raw.version === 1 && raw.bookmarks) parsed = raw.bookmarks;
        else if (raw && raw.version === 2 && raw.bookmarks) {
          parsed = raw.bookmarks;
          parsedSettings = sanitizeImportedSettings(raw.settings);
        } else if (raw && raw.version === 3 && raw.bookmarks) {
          parsed = raw.bookmarks;
          parsedSettings = sanitizeImportedSettings(raw.settings);
        } else if (raw && raw.version === 4 && raw.bookmarks) {
          parsed = raw.bookmarks;
          parsedSettings = sanitizeImportedSettings(raw.settings);
          parsedFavicons = hydrateFavicons(Array.isArray(raw.favicons) ? raw.favicons : []);
        } else if (raw && Array.isArray(raw.items)) parsed = raw;
        else throw new Error("Unrecognised format");
        if (!Array.isArray(parsed.items)) throw new Error("Missing items");
        if (!Array.isArray(parsed.favorites)) parsed.favorites = [];
        if (!Array.isArray(parsed.saves)) parsed.saves = [];
        parsed.saves = hydrateSaves(parsed.saves);
      } catch {
        alert("Could not read the file. Make sure it's a valid Tabstract export.");
        return;
      }
      ctx.openDestructiveConfirm({
        title: "Replace all data?",
        message: "This will permanently replace all your current bookmarks, favorites, saves, cached favicons, and any exported settings with the imported file. This cannot be undone.",
        confirmLabel: "Replace",
        action: async () => {
          await applyImport(parsed, parsedSettings, parsedFavicons);
          ctx.closeSettingsModal();
        },
      });
    };
    reader.readAsText(file);
  }

  function deleteAllData() {
    ctx.openDestructiveConfirm({
      title: "Delete all data?",
      message: "This will permanently delete all your bookmarks, favorites, and saves. This cannot be undone.",
      confirmLabel: "Delete All",
      action: async () => {
        state.data = defaultData();
        await saveData();
        state.faviconCache = new Map();
        await clearFaviconStore();
        resetFolderNavigation();
        await ctx.clearLastFolderVisit();
        ctx.render();
        ctx.closeSettingsModal();
      },
    });
  }

  function setFaviconRefreshStatus(message) {
    const status = document.getElementById("favicon-refresh-status");
    if (status) status.textContent = message;
  }

  async function refreshAllFavicons() {
    const refreshBtn = document.getElementById("refresh-favicons-btn");
    const urls = collectFaviconUrls(ctx.linkHasCustomIcon);
    refreshBtn.disabled = true;
    setFaviconRefreshStatus(urls.length ? `Refreshing 0 of ${urls.length}...` : "No favicons to refresh.");
    try {
      state.faviconRefreshInProgress = true;
      await resetFaviconCache();
      let complete = 0;
      let refreshed = 0;
      for (const url of urls) {
        try {
          await fetchAndCacheFavicon(url, { force: true, rerender: false });
          refreshed += 1;
        } catch (error) {
          console.warn("Could not refresh favicon", url, error);
        }
        complete += 1;
        setFaviconRefreshStatus(`Refreshing ${complete} of ${urls.length}...`);
      }
      ctx.render();
      if (ctx.isSavesModalOpen()) ctx.renderSavesList();
      setFaviconRefreshStatus(urls.length ? `Refreshed ${refreshed} of ${urls.length} favicons.` : "No favicons to refresh.");
    } finally {
      state.faviconRefreshInProgress = false;
      refreshBtn.disabled = false;
    }
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
  document.getElementById("refresh-favicons-btn").addEventListener("click", () => {
    void refreshAllFavicons().catch((error) => {
      setFaviconRefreshStatus("Refresh failed.");
      ctx.reportStorageError(error);
      const refreshBtn = document.getElementById("refresh-favicons-btn");
      if (refreshBtn) refreshBtn.disabled = false;
    });
  });
}
