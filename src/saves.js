import { iconSrc } from "./constants.js";
import { queueFaviconCache, savedLinkFaviconSrc } from "./favicons.js";
import { state } from "./state.js";
import { archiveExpiredSaves, isSaveArchived, saveData, saveExpiryTime } from "./storage.js";
import { fetchSavedLinkMetadata, formatTimeAgo, hostname, uid, urlFromClipboardText } from "./utils.js";

export function initSaves(ctx) {
  const savesModal = document.getElementById("saves-modal");
  const savesUrlInput = document.getElementById("saves-url-input");
  const savesAddBtn = document.getElementById("saves-add-btn");
  const savesArchiveToggle = document.getElementById("saves-archive-toggle");
  const savesStatus = document.getElementById("saves-status");
  const savesList = document.getElementById("saves-list");
  let saveUrlInFlight = "";
  let viewingSavesArchive = false;
  let savesArchiveSearchQuery = "";

  function setSavesStatus(message) {
    savesStatus.textContent = message;
  }

  function setSavesInputMode() {
    document.getElementById("saves-form").classList.toggle("saves-form--searching", viewingSavesArchive);
    savesUrlInput.type = viewingSavesArchive ? "search" : "url";
    savesUrlInput.placeholder = viewingSavesArchive ? "Search saved links..." : "Paste a link...";
    savesUrlInput.setAttribute("aria-label", viewingSavesArchive ? "Search archived saved links" : "Paste a link to save");
    savesUrlInput.value = viewingSavesArchive ? savesArchiveSearchQuery : "";
    savesAddBtn.hidden = viewingSavesArchive;
    savesAddBtn.disabled = viewingSavesArchive || Boolean(saveUrlInFlight);
  }

  function saveMatchesSearch(save, query) {
    if (!query) return true;
    return [save.title, save.url, hostname(save.url)]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  }

  function startEditingSaveTitle(save, titleEl) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "saves-item-title-input";
    input.value = save.title || hostname(save.url);
    input.setAttribute("aria-label", "Edit link title");
    let finished = false;
    const finish = async (shouldSave) => {
      if (finished) return;
      finished = true;
      const newTitle = input.value.trim();
      if (shouldSave && newTitle !== (save.title || hostname(save.url))) {
        save.title = newTitle;
        await saveData();
      }
      renderSavesList();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    });
    input.addEventListener("blur", () => { setTimeout(() => finish(true), 0); });
    input.addEventListener("click", (e) => e.stopPropagation());
    titleEl.replaceWith(input);
    input.focus();
    input.select();
  }

  function renderSavesList() {
    const archiveQuery = savesArchiveSearchQuery.trim().toLowerCase();
    const saves = (state.data.saves || [])
      .filter((save) => isSaveArchived(save) === viewingSavesArchive)
      .filter((save) => !viewingSavesArchive || saveMatchesSearch(save, archiveQuery));
    const archivedSavesCount = (state.data.saves || []).filter(isSaveArchived).length;
    savesArchiveToggle.querySelector("span").textContent = viewingSavesArchive ? "Back to saves" : `See archive (${archivedSavesCount})`;
    setSavesInputMode();
    savesList.innerHTML = "";
    if (saves.length === 0) {
      const empty = document.createElement("div");
      empty.className = "saves-empty";
      empty.textContent = viewingSavesArchive && archiveQuery
        ? "No archived links match your search."
        : viewingSavesArchive ? "No archived links yet." : "No current saves";
      savesList.appendChild(empty);
      return;
    }
    for (const save of saves) savesList.appendChild(makeSaveItem(save));
  }

  function makeSaveItem(save) {
    const item = document.createElement("div");
    item.className = "saves-item";
    item.classList.toggle("saves-item--archived", viewingSavesArchive);
    const favicon = document.createElement("img");
    favicon.className = "saves-item-favicon";
    const storedSaveFavicon = String(save.faviconUrl || "").startsWith("data:image/") ? save.faviconUrl : "";
    const saveFaviconSrc = savedLinkFaviconSrc(save.url) || storedSaveFavicon;
    favicon.src = saveFaviconSrc;
    favicon.alt = "";
    favicon.width = 28;
    favicon.height = 28;
    if (!saveFaviconSrc) {
      favicon.hidden = true;
      queueFaviconCache(save.url);
    }
    favicon.addEventListener("error", () => { favicon.hidden = true; });

    const link = document.createElement("a");
    link.className = "saves-item-link";
    link.href = save.url;
    link.rel = "noreferrer";
    const title = document.createElement("span");
    title.className = "saves-item-title";
    title.textContent = save.title || hostname(save.url);
    title.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startEditingSaveTitle(save, title);
    });
    const meta = document.createElement("div");
    meta.className = "saves-item-meta";
    const clockIcon = document.createElement("img");
    clockIcon.className = "saves-item-clock";
    clockIcon.src = iconSrc("clock.svg");
    clockIcon.alt = "";
    clockIcon.width = 12;
    clockIcon.height = 12;
    const timeAgo = document.createElement("span");
    timeAgo.className = "saves-item-time";
    timeAgo.textContent = formatTimeAgo(save.savedAt);
    meta.append(clockIcon, timeAgo);
    link.append(title, meta);
    if (viewingSavesArchive) item.append(favicon, link);
    else item.append(favicon, link, makeSaveActions(save));
    return item;
  }

  function makeSaveActions(save) {
    const actions = document.createElement("div");
    actions.className = "saves-item-actions";
    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = "saves-item-lock";
    lockBtn.setAttribute("aria-label", save.locked ? "Unlock link" : "Lock link");
    const lockIcon = document.createElement("img");
    lockIcon.src = iconSrc(save.locked ? "locked.svg" : "unlocked.svg");
    lockIcon.alt = "";
    lockIcon.width = 15;
    lockIcon.height = 15;
    lockBtn.appendChild(lockIcon);
    lockBtn.addEventListener("click", () => { void toggleSaveLocked(save.id).catch(ctx.reportStorageError); });
    const archiveBtn = document.createElement("button");
    archiveBtn.type = "button";
    archiveBtn.className = "saves-item-archive";
    archiveBtn.setAttribute("aria-label", `Archive ${save.title || hostname(save.url)}`);
    const archiveIcon = document.createElement("img");
    archiveIcon.src = iconSrc("archive.svg");
    archiveIcon.alt = "";
    archiveIcon.width = 15;
    archiveIcon.height = 15;
    archiveBtn.appendChild(archiveIcon);
    archiveBtn.addEventListener("click", () => { void archiveSave(save.id).catch(ctx.reportStorageError); });
    actions.append(lockBtn, archiveBtn);
    return actions;
  }

  async function openSavesModal() {
    await archiveExpiredSaves();
    viewingSavesArchive = false;
    savesArchiveSearchQuery = "";
    setSavesStatus("");
    savesUrlInput.value = "";
    renderSavesList();
    savesModal.hidden = false;
    setTimeout(() => savesUrlInput.focus(), 0);
  }

  function closeSavesModal() {
    savesModal.hidden = true;
    saveUrlInFlight = "";
    viewingSavesArchive = false;
    savesArchiveSearchQuery = "";
    setSavesStatus("");
    savesUrlInput.value = "";
    setSavesInputMode();
  }

  async function savePastedLink(rawUrl) {
    const url = urlFromClipboardText(rawUrl);
    if (!url) {
      savesUrlInput.focus();
      return;
    }
    if (saveUrlInFlight === url) return;
    const existing = (state.data.saves || []).find((save) => save.url === url);
    if (existing && !isSaveArchived(existing)) {
      savesUrlInput.value = "";
      setSavesStatus("Already saved.");
      return;
    }
    saveUrlInFlight = url;
    savesAddBtn.disabled = true;
    setSavesStatus("Saving...");
    try {
      const metadata = await fetchSavedLinkMetadata(url);
      state.data.saves = state.data.saves || [];
      if (existing) {
        existing.title = metadata.title || existing.title;
        existing.faviconUrl = metadata.faviconUrl || existing.faviconUrl;
        existing.savedAt = new Date().toISOString();
        existing.archivedAt = null;
        state.data.saves = [existing, ...state.data.saves.filter((save) => save.id !== existing.id)];
      } else {
        state.data.saves.unshift({
          id: uid(),
          url,
          title: metadata.title,
          faviconUrl: metadata.faviconUrl,
          savedAt: new Date().toISOString(),
          archivedAt: null,
          locked: false,
        });
      }
      await saveData();
      queueFaviconCache(url);
      savesUrlInput.value = "";
      viewingSavesArchive = false;
      setSavesStatus("");
      renderSavesList();
    } finally {
      saveUrlInFlight = "";
      savesAddBtn.disabled = false;
    }
  }

  async function archiveSave(id) {
    const save = (state.data.saves || []).find((item) => item.id === id);
    if (!save || isSaveArchived(save)) return;
    save.archivedAt = new Date().toISOString();
    await saveData();
    renderSavesList();
  }

  async function toggleSaveLocked(id) {
    const save = (state.data.saves || []).find((item) => item.id === id);
    if (!save || isSaveArchived(save)) return;
    const nextLocked = !save.locked;
    save.locked = nextLocked;
    if (!nextLocked && saveExpiryTime(save) <= Date.now()) save.archivedAt = new Date().toISOString();
    await saveData();
    renderSavesList();
  }

  document.getElementById("saves-btn").addEventListener("click", () => {
    void openSavesModal().catch(ctx.reportStorageError);
  });
  document.getElementById("saves-modal-close").addEventListener("click", closeSavesModal);
  savesModal.addEventListener("click", (e) => { if (e.target === savesModal) closeSavesModal(); });
  savesArchiveToggle.addEventListener("click", () => {
    viewingSavesArchive = !viewingSavesArchive;
    setSavesStatus("");
    if (!viewingSavesArchive) savesArchiveSearchQuery = "";
    renderSavesList();
    savesUrlInput.focus();
  });
  document.getElementById("saves-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!viewingSavesArchive) void savePastedLink(savesUrlInput.value).catch(ctx.reportStorageError);
  });
  savesUrlInput.addEventListener("input", () => {
    if (!viewingSavesArchive) return;
    savesArchiveSearchQuery = savesUrlInput.value;
    renderSavesList();
  });
  savesUrlInput.addEventListener("paste", () => {
    if (viewingSavesArchive) return;
    setTimeout(() => { void savePastedLink(savesUrlInput.value).catch(ctx.reportStorageError); }, 0);
  });

  Object.assign(ctx, {
    closeSavesModal,
    isSavesModalOpen: () => !savesModal.hidden,
    renderSavesList,
  });
}
