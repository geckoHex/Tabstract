import { AI_PROVIDERS, DEFAULT_SAVE_ARCHIVE_AFTER_MS, SAVE_ARCHIVE_OPTIONS, WALLPAPERS } from "./constants.js";
import { state } from "./state.js";
import { archiveExpiredSaves, saveSetting } from "./storage.js";

export function initSettings(ctx) {
  const aiSearchForm = document.getElementById("ai-search-form");
  const aiSearchIcon = document.getElementById("ai-search-icon");
  const aiSearchInput = document.getElementById("ai-search-input");
  const aiClearBtn = document.getElementById("ai-clear-btn");
  const aiProviderCustom = document.getElementById("ai-provider-custom-select");
  const aiProviderTrigger = document.getElementById("ai-provider-trigger");
  const aiProviderTriggerText = document.getElementById("ai-provider-trigger-text");
  const aiProviderList = document.getElementById("ai-provider-list");
  const bookmarkSearchLimitInput = document.getElementById("bookmark-search-limit-input");
  const openaiApiKeyInput = document.getElementById("openai-api-key-input");
  const aiSearchEnabledInput = document.getElementById("ai-search-enabled");
  const aiProviderSettingsRow = document.getElementById("ai-provider-settings-row");
  const wallpaperCustom = document.getElementById("wallpaper-custom-select");
  const wallpaperTrigger = document.getElementById("wallpaper-trigger");
  const wallpaperTriggerText = document.getElementById("wallpaper-trigger-text");
  const wallpaperList = document.getElementById("wallpaper-list");
  const saveArchiveAfterCustom = document.getElementById("save-archive-after-custom-select");
  const saveArchiveAfterTrigger = document.getElementById("save-archive-after-trigger");
  const saveArchiveAfterTriggerText = document.getElementById("save-archive-after-trigger-text");
  const saveArchiveAfterList = document.getElementById("save-archive-after-list");
  const settingsModal = document.getElementById("settings-modal");
  const settingsTabs = Array.from(document.querySelectorAll("[data-settings-tab]"));
  const settingsPanels = Array.from(document.querySelectorAll("[data-settings-panel]"));

  const getStoredAiProvider = () => state.settings.aiProvider;
  const getStoredAiSearchEnabled = () => false;
  const getStoredBookmarkSearchResultLimit = () => state.settings.bookmarkSearchResultLimit;
  const getStoredOpenaiApiKey = () => typeof state.settings.openaiApiKey === "string" ? state.settings.openaiApiKey : "";
  const getStoredWallpaper = () => state.settings.wallpaper;
  const getStoredSaveArchiveAfterMs = () => (
    SAVE_ARCHIVE_OPTIONS[state.settings.saveArchiveAfterMs] ? state.settings.saveArchiveAfterMs : DEFAULT_SAVE_ARCHIVE_AFTER_MS
  );

  async function setStoredAiSearchEnabled() {
    state.settings.aiSearchEnabled = false;
    await saveSetting("aiSearchEnabled", false);
  }

  async function setStoredBookmarkSearchResultLimit(limit) {
    state.settings.bookmarkSearchResultLimit = limit;
    await saveSetting("bookmarkSearchResultLimit", limit);
  }

  async function setStoredOpenaiApiKey(apiKey) {
    state.settings.openaiApiKey = apiKey;
    await saveSetting("openaiApiKey", apiKey);
  }

  function providerOrDefault(id) {
    return AI_PROVIDERS[id] || AI_PROVIDERS.chatgpt;
  }

  function wallpaperOrDefault(id) {
    return WALLPAPERS[id] || WALLPAPERS.off;
  }

  function closeAiProviderDropdown() {
    setAiProviderDropdownOpen(false);
  }

  function closeWallpaperDropdown() {
    setWallpaperDropdownOpen(false);
  }

  function closeSaveArchiveAfterDropdown() {
    setSaveArchiveAfterDropdownOpen(false);
  }

  function setAiSearchProviderSettingRowVisible(visible) {
    if (!aiProviderSettingsRow) return;
    aiProviderSettingsRow.classList.toggle("settings-ai-provider-row--collapsed", !visible);
    aiProviderSettingsRow.toggleAttribute("hidden", !visible);
    if (!visible) closeAiProviderDropdown();
  }

  function applyAiSearchBoxVisibility() {
    const forcedEnabled = false;
    state.settings.aiSearchEnabled = forcedEnabled;
    aiSearchForm.hidden = !forcedEnabled;
    if (aiSearchEnabledInput) {
      aiSearchEnabledInput.checked = forcedEnabled;
      aiSearchEnabledInput.disabled = true;
      aiSearchEnabledInput.setAttribute("aria-disabled", "true");
    }
    setAiSearchProviderSettingRowVisible(forcedEnabled);
  }

  async function applyAiSearchProvider(id, { persist } = {}) {
    const p = providerOrDefault(id);
    state.aiProviderId = p.id;
    if (persist) {
      state.settings.aiProvider = state.aiProviderId;
      await saveSetting("aiProvider", state.aiProviderId);
    }
    aiSearchIcon.src = `icons/${p.icon}`;
    aiSearchInput.placeholder = p.placeholder;
    aiSearchInput.setAttribute("aria-label", p.inputAria);
    aiClearBtn.setAttribute("aria-label", p.clearAria);
    syncAiProviderCustomSelect();
  }

  function syncAiProviderCustomSelect() {
    if (!aiProviderTriggerText || !aiProviderList) return;
    const p = providerOrDefault(state.aiProviderId);
    aiProviderTriggerText.textContent = p.label;
    aiProviderList.querySelectorAll("[role='option']").forEach((opt) => {
      const on = opt.getAttribute("data-value") === state.aiProviderId;
      opt.setAttribute("aria-selected", on ? "true" : "false");
      opt.classList.toggle("is-selected", on);
    });
  }

  function syncWallpaperCustomSelect() {
    if (!wallpaperTriggerText || !wallpaperList) return;
    const wallpaper = wallpaperOrDefault(state.wallpaperId);
    wallpaperTriggerText.textContent = wallpaper.label;
    wallpaperList.querySelectorAll("[role='option']").forEach((opt) => {
      const on = opt.getAttribute("data-value") === state.wallpaperId;
      opt.setAttribute("aria-selected", on ? "true" : "false");
      opt.classList.toggle("is-selected", on);
    });
  }

  function syncSaveArchiveAfterCustomSelect() {
    if (!saveArchiveAfterTriggerText || !saveArchiveAfterList) return;
    const option = SAVE_ARCHIVE_OPTIONS[state.saveArchiveAfterMs] || SAVE_ARCHIVE_OPTIONS[DEFAULT_SAVE_ARCHIVE_AFTER_MS];
    saveArchiveAfterTriggerText.textContent = option.label;
    saveArchiveAfterList.querySelectorAll("[role='option']").forEach((opt) => {
      const on = Number(opt.getAttribute("data-value")) === option.value;
      opt.setAttribute("aria-selected", on ? "true" : "false");
      opt.classList.toggle("is-selected", on);
    });
  }

  const isAiProviderDropdownOpen = () => aiProviderTrigger && aiProviderTrigger.getAttribute("aria-expanded") === "true";
  const isWallpaperDropdownOpen = () => wallpaperTrigger && wallpaperTrigger.getAttribute("aria-expanded") === "true";
  const isSaveArchiveAfterDropdownOpen = () => (
    saveArchiveAfterTrigger && saveArchiveAfterTrigger.getAttribute("aria-expanded") === "true"
  );

  function setAiProviderDropdownOpen(open) {
    if (!aiProviderTrigger || !aiProviderList) return;
    if (open) {
      closeWallpaperDropdown();
      closeSaveArchiveAfterDropdown();
    }
    aiProviderList.hidden = !open;
    aiProviderTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setWallpaperDropdownOpen(open) {
    if (!wallpaperTrigger || !wallpaperList) return;
    if (open) {
      closeAiProviderDropdown();
      closeSaveArchiveAfterDropdown();
    }
    wallpaperList.hidden = !open;
    wallpaperTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function setSaveArchiveAfterDropdownOpen(open) {
    if (!saveArchiveAfterTrigger || !saveArchiveAfterList) return;
    if (open) {
      closeAiProviderDropdown();
      closeWallpaperDropdown();
    }
    saveArchiveAfterList.hidden = !open;
    saveArchiveAfterTrigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function focusOption(list, dir) {
    const opts = [...list.querySelectorAll("[role='option']")];
    if (!opts.length) return;
    const ix = opts.findIndex((o) => o === document.activeElement);
    const next = ix < 0 ? (dir === 1 ? 0 : opts.length - 1) : Math.min(Math.max(ix + dir, 0), opts.length - 1);
    opts[next].focus();
  }

  function syncBookmarkSearchLimitInput() {
    if (bookmarkSearchLimitInput) bookmarkSearchLimitInput.value = String(getStoredBookmarkSearchResultLimit());
  }

  function syncOpenaiApiKeyInput() {
    if (openaiApiKeyInput) openaiApiKeyInput.value = getStoredOpenaiApiKey();
  }

  async function applyBookmarkSearchResultLimit(limit, { persist } = {}) {
    const normalized = Number(limit);
    if (!Number.isInteger(normalized) || normalized < 1 || normalized > 8) return;
    if (persist) await setStoredBookmarkSearchResultLimit(normalized);
    else state.settings.bookmarkSearchResultLimit = normalized;
    syncBookmarkSearchLimitInput();
    ctx.updateBookmarkSearchResults?.();
  }

  async function applyWallpaper(id, { persist } = {}) {
    const wallpaper = wallpaperOrDefault(id);
    state.wallpaperId = wallpaper.id;
    state.settings.wallpaper = state.wallpaperId;
    const gridScroll = document.getElementById("grid-scroll");
    if (gridScroll) {
      Object.keys(WALLPAPERS).forEach((key) => {
        if (key !== "off") gridScroll.classList.remove(`grid-scroll--wallpaper-${key}`);
      });
      if (state.wallpaperId !== "off") gridScroll.classList.add(`grid-scroll--wallpaper-${state.wallpaperId}`);
    }
    if (persist) await saveSetting("wallpaper", state.wallpaperId);
    syncWallpaperCustomSelect();
  }

  async function applySaveArchiveAfter(value, { persist } = {}) {
    const normalized = Number(value);
    if (!SAVE_ARCHIVE_OPTIONS[normalized]) return;
    state.saveArchiveAfterMs = normalized;
    state.settings.saveArchiveAfterMs = normalized;
    if (persist) {
      await saveSetting("saveArchiveAfterMs", normalized);
      const changed = await archiveExpiredSaves();
      if (changed && ctx.isSavesModalOpen?.()) ctx.renderSavesList?.();
    }
    syncSaveArchiveAfterCustomSelect();
  }

  async function initAiSearchProvider() {
    await applyAiSearchProvider(getStoredAiProvider(), { persist: false });
  }

  function navigateToAi(prompt) {
    const q = prompt.trim();
    if (!q) return;
    const p = providerOrDefault(state.aiProviderId);
    window.location.href = p.urlPrefix + encodeURIComponent(q);
  }

  function openSettingsModal() {
    applyAiSearchBoxVisibility(getStoredAiSearchEnabled());
    syncAiProviderCustomSelect();
    syncWallpaperCustomSelect();
    syncOpenaiApiKeyInput();
    void applySaveArchiveAfter(getStoredSaveArchiveAfterMs(), { persist: false });
    syncBookmarkSearchLimitInput();
    activateSettingsTab("theme");
    closeAiProviderDropdown();
    closeWallpaperDropdown();
    closeSaveArchiveAfterDropdown();
    settingsModal.hidden = false;
  }

  function closeSettingsModal() {
    closeAiProviderDropdown();
    closeWallpaperDropdown();
    closeSaveArchiveAfterDropdown();
    settingsModal.hidden = true;
  }

  function activateSettingsTab(sectionId, focusTab = false) {
    if (!sectionId) return;
    closeAiProviderDropdown();
    closeWallpaperDropdown();
    closeSaveArchiveAfterDropdown();
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
    if (e.key === "ArrowDown" || e.key === "ArrowRight") nextIndex = (currentIndex + 1) % settingsTabs.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + settingsTabs.length) % settingsTabs.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = settingsTabs.length - 1;
    else return;
    e.preventDefault();
    activateSettingsTab(settingsTabs[nextIndex].dataset.settingsTab, true);
  }

  function wireCustomSelect(trigger, list, custom, helpers, applyValue) {
    if (!trigger || !list) return;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      helpers.setOpen(!helpers.isOpen());
    });
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!helpers.isOpen()) helpers.open();
        focusOption(list, e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Escape" && helpers.isOpen()) {
        e.preventDefault();
        e.stopPropagation();
        helpers.close();
      }
    });
    list.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        helpers.close();
        trigger.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        focusOption(list, e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const v = document.activeElement.getAttribute("data-value");
        if (v) void applyValue(v).then(() => { helpers.close(); trigger.focus(); }).catch(ctx.reportStorageError);
      }
    });
    list.querySelectorAll("[role='option']").forEach((opt) => {
      opt.addEventListener("click", () => {
        const v = opt.getAttribute("data-value");
        if (v) void applyValue(v).then(() => { helpers.close(); trigger.focus(); }).catch(ctx.reportStorageError);
        else {
          helpers.close();
          trigger.focus();
        }
      });
    });
    document.addEventListener("click", (e) => {
      if (!helpers.isOpen() || !custom) return;
      if (!custom.contains(e.target)) helpers.close();
    });
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
  document.getElementById("settings-btn").addEventListener("click", openSettingsModal);
  document.getElementById("settings-modal-done").addEventListener("click", closeSettingsModal);
  settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) closeSettingsModal(); });
  settingsTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateSettingsTab(tab.dataset.settingsTab));
    tab.addEventListener("keydown", handleSettingsTabKeydown);
  });
  aiSearchEnabledInput?.addEventListener("change", () => {
    void setStoredAiSearchEnabled().catch(ctx.reportStorageError);
    applyAiSearchBoxVisibility();
  });
  wireCustomSelect(aiProviderTrigger, aiProviderList, aiProviderCustom, {
    isOpen: isAiProviderDropdownOpen,
    setOpen: setAiProviderDropdownOpen,
    open: () => setAiProviderDropdownOpen(true),
    close: closeAiProviderDropdown,
  }, (v) => applyAiSearchProvider(v, { persist: true }));
  wireCustomSelect(wallpaperTrigger, wallpaperList, wallpaperCustom, {
    isOpen: isWallpaperDropdownOpen,
    setOpen: setWallpaperDropdownOpen,
    open: () => setWallpaperDropdownOpen(true),
    close: closeWallpaperDropdown,
  }, (v) => applyWallpaper(v, { persist: true }));
  wireCustomSelect(saveArchiveAfterTrigger, saveArchiveAfterList, saveArchiveAfterCustom, {
    isOpen: isSaveArchiveAfterDropdownOpen,
    setOpen: setSaveArchiveAfterDropdownOpen,
    open: () => setSaveArchiveAfterDropdownOpen(true),
    close: closeSaveArchiveAfterDropdown,
  }, (v) => applySaveArchiveAfter(v, { persist: true }));
  bookmarkSearchLimitInput?.addEventListener("change", persistBookmarkSearchLimitInput);
  bookmarkSearchLimitInput?.addEventListener("blur", persistBookmarkSearchLimitInput);
  openaiApiKeyInput?.addEventListener("change", persistOpenaiApiKeyInput);
  openaiApiKeyInput?.addEventListener("blur", persistOpenaiApiKeyInput);

  function persistBookmarkSearchLimitInput() {
    const raw = Number(bookmarkSearchLimitInput.value);
    const normalized = Number.isFinite(raw) ? Math.min(8, Math.max(1, Math.round(raw))) : getStoredBookmarkSearchResultLimit();
    void applyBookmarkSearchResultLimit(normalized, { persist: true }).catch(ctx.reportStorageError);
  }

  function persistOpenaiApiKeyInput() {
    void setStoredOpenaiApiKey(openaiApiKeyInput.value.trim()).catch(ctx.reportStorageError);
  }

  Object.assign(ctx, {
    applyAiSearchBoxVisibility,
    applySaveArchiveAfter,
    applyWallpaper,
    closeAiProviderDropdown,
    closeSaveArchiveAfterDropdown,
    closeSettingsModal,
    closeWallpaperDropdown,
    getStoredAiSearchEnabled,
    getStoredBookmarkSearchResultLimit,
    getStoredOpenaiApiKey,
    getStoredSaveArchiveAfterMs,
    getStoredWallpaper,
    initAiSearchProvider,
    isAiProviderDropdownOpen,
    isSaveArchiveAfterDropdownOpen,
    isSettingsModalOpen: () => !settingsModal.hidden,
    isWallpaperDropdownOpen,
    setStoredAiSearchEnabled,
    syncBookmarkSearchLimitInput,
    syncOpenaiApiKeyInput,
  });
}
