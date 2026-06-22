import { currentItems } from "./model.js";
import { state } from "./state.js";
import { saveData } from "./storage.js";
import { fetchPageTitle, hostname, normaliseUrl, uid, urlFromClipboardText } from "./utils.js";
import { queueFaviconCache } from "./favicons.js";

export function initEditModals(ctx) {
  const linkModal = document.getElementById("link-modal");
  const linkUrlInput = document.getElementById("link-url");
  const linkTitleInput = document.getElementById("link-title");
  const linkModalTitle = document.getElementById("link-modal-title");
  const linkSaveBtn = document.getElementById("link-save");
  const folderModal = document.getElementById("folder-modal");
  const folderNameInput = document.getElementById("folder-name");
  const folderModalTitle = document.getElementById("folder-modal-title");
  const folderSaveBtn = document.getElementById("folder-save");
  let editingLinkId = null;
  let pendingTitleAutofillUrl = "";
  let titleAutofillRequestId = 0;
  let editingFolderId = null;

  async function autofillTitleForUrlField() {
    if (editingLinkId || linkModal.hidden || linkTitleInput.value.trim()) return;
    const url = normaliseUrl(linkUrlInput.value.trim());
    if (!url || pendingTitleAutofillUrl === url) return;
    pendingTitleAutofillUrl = url;
    const requestId = ++titleAutofillRequestId;
    try {
      const title = await fetchPageTitle(url);
      if (
        title &&
        requestId === titleAutofillRequestId &&
        !editingLinkId &&
        !linkModal.hidden &&
        normaliseUrl(linkUrlInput.value.trim()) === url &&
        !linkTitleInput.value.trim()
      ) {
        linkTitleInput.value = title;
      }
    } catch {
      if (pendingTitleAutofillUrl === url) pendingTitleAutofillUrl = "";
    }
  }

  function openLinkModal() {
    editingLinkId = null;
    pendingTitleAutofillUrl = "";
    titleAutofillRequestId += 1;
    linkModalTitle.textContent = "Add Bookmark";
    linkSaveBtn.textContent = "Add Bookmark";
    linkUrlInput.value = "";
    linkTitleInput.value = "";
    linkModal.hidden = false;
    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText().then((text) => {
        const url = urlFromClipboardText(text);
        if (!url) return null;
        linkUrlInput.value = url;
        return autofillTitleForUrlField();
      }).catch(() => {});
    }
    setTimeout(() => linkTitleInput.focus(), 0);
    setTimeout(() => { void autofillTitleForUrlField(); }, 100);
    setTimeout(() => { void autofillTitleForUrlField(); }, 500);
  }

  function openLinkModalForEdit(link) {
    editingLinkId = link.id;
    pendingTitleAutofillUrl = "";
    titleAutofillRequestId += 1;
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
    pendingTitleAutofillUrl = "";
    titleAutofillRequestId += 1;
    linkModalTitle.textContent = "Add Bookmark";
    linkSaveBtn.textContent = "Add Bookmark";
  }

  async function saveLinkModal() {
    const url = normaliseUrl(linkUrlInput.value.trim());
    if (!url) {
      linkUrlInput.focus();
      return;
    }
    const title = linkTitleInput.value.trim() || hostname(url);
    if (editingLinkId) {
      const r = ctx.findItem(state.data.items, editingLinkId);
      if (r && r.item.type === "link") {
        r.item.url = url;
        r.item.title = title;
      }
    } else {
      currentItems().push({ type: "link", id: uid(), title, url });
    }
    await saveData();
    queueFaviconCache(url);
    ctx.render();
    closeLinkModal();
  }

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

  async function saveFolderModal() {
    const name = folderNameInput.value.trim();
    if (!name) {
      folderNameInput.focus();
      return;
    }
    if (editingFolderId) {
      const r = ctx.findItem(state.data.items, editingFolderId);
      if (r && r.item.type === "folder") r.item.name = name;
    } else {
      currentItems().push({ type: "folder", id: uid(), name, children: [] });
    }
    await saveData();
    ctx.render();
    closeFolderModal();
  }

  document.getElementById("link-modal-close").addEventListener("click", closeLinkModal);
  document.getElementById("link-cancel").addEventListener("click", closeLinkModal);
  document.getElementById("link-save").addEventListener("click", () => {
    void saveLinkModal().catch(ctx.reportStorageError);
  });
  linkModal.addEventListener("click", (e) => { if (e.target === linkModal) closeLinkModal(); });
  linkUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void saveLinkModal().catch(ctx.reportStorageError);
  });
  linkUrlInput.addEventListener("input", () => {
    pendingTitleAutofillUrl = "";
    void autofillTitleForUrlField();
  });
  linkUrlInput.addEventListener("change", () => {
    pendingTitleAutofillUrl = "";
    void autofillTitleForUrlField();
  });
  linkTitleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void saveLinkModal().catch(ctx.reportStorageError);
  });
  linkTitleInput.addEventListener("click", () => {
    linkTitleInput.select();
  });
  document.getElementById("folder-modal-close").addEventListener("click", closeFolderModal);
  document.getElementById("folder-cancel").addEventListener("click", closeFolderModal);
  document.getElementById("folder-save").addEventListener("click", () => {
    void saveFolderModal().catch(ctx.reportStorageError);
  });
  folderModal.addEventListener("click", (e) => { if (e.target === folderModal) closeFolderModal(); });
  folderNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void saveFolderModal().catch(ctx.reportStorageError);
  });

  Object.assign(ctx, {
    closeFolderModal,
    closeLinkModal,
    isFolderModalOpen: () => !folderModal.hidden,
    isLinkModalOpen: () => !linkModal.hidden,
    openFolderModal,
    openFolderModalForEdit,
    openLinkModal,
    openLinkModalForEdit,
  });
}
