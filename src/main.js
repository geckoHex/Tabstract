import { initBookmarks } from "./bookmarks.js";
import { startClock } from "./clock.js";
import { initConfirm } from "./confirm.js";
import { initDataPortability } from "./data-portability.js";
import { initEditModals } from "./edit-modals.js";
import { configureFavicons, warmMissingFaviconCache } from "./favicons.js";
import { initIconCustomize } from "./icon-customize.js";
import { initKeyboard } from "./keyboard.js";
import { findItem, linkHasCustomIcon, restoreRecentFolderPath } from "./model.js";
import { initRoutes } from "./routes.js";
import { initBookmarkSearch } from "./search.js";
import { initSettings } from "./settings.js";
import { initSaves } from "./saves.js";
import { setPersistedState } from "./state.js";
import { archiveExpiredSaves, loadPersistedState, reportStorageError } from "./storage.js";
import { initTools } from "./tools.js";

const ctx = {
  findItem,
  linkHasCustomIcon,
  reportStorageError,
};

initConfirm(ctx);
initRoutes(ctx);
initIconCustomize(ctx);
initEditModals(ctx);
initSettings(ctx);
initBookmarkSearch(ctx);
initBookmarks(ctx);
initSaves(ctx);
initDataPortability(ctx);
initTools(ctx);
initKeyboard(ctx);

configureFavicons({
  render: () => ctx.render(),
  renderSavesList: () => ctx.renderSavesList(),
  isSavesModalOpen: () => ctx.isSavesModalOpen(),
});

async function init() {
  startClock();
  const persisted = await loadPersistedState();
  setPersistedState(persisted);
  restoreRecentFolderPath();
  await ctx.setStoredAiSearchEnabled();
  await archiveExpiredSaves();
  setInterval(() => {
    archiveExpiredSaves()
      .then((changed) => {
        if (changed && ctx.isSavesModalOpen()) ctx.renderSavesList();
      })
      .catch(reportStorageError);
  }, 60000);
  if (ctx.getStoredAiSearchEnabled()) await ctx.initAiSearchProvider();
  await ctx.applyWallpaper(ctx.getStoredWallpaper(), { persist: false });
  await ctx.applySaveArchiveAfter(ctx.getStoredSaveArchiveAfterMs(), { persist: false });
  ctx.applyAiSearchBoxVisibility(ctx.getStoredAiSearchEnabled());
  ctx.focusBookmarkSearch();
  ctx.render();
  void warmMissingFaviconCache(linkHasCustomIcon).catch(reportStorageError);
}

init().catch(reportStorageError);
