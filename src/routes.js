import { linkRoutes, normalizeRoutes } from "./model.js";
import { state } from "./state.js";
import { saveData } from "./storage.js";
import { hostname, normaliseUrl, uid } from "./utils.js";

export function initRoutes(ctx) {
  const routesModal = document.getElementById("routes-modal");
  const routesModalTitle = document.getElementById("routes-modal-title");
  const routesModalCloseBtn = document.getElementById("routes-modal-close");
  const routesEnabledInput = document.getElementById("routes-enabled");
  const routesList = document.getElementById("routes-list");
  const routesAddBtn = document.getElementById("routes-add");
  const routesCancelBtn = document.getElementById("routes-cancel");
  const routesSaveBtn = document.getElementById("routes-save");
  const routeChoiceModal = document.getElementById("route-choice-modal");
  const routeChoiceTitle = document.getElementById("route-choice-title");
  const routeChoiceCloseBtn = document.getElementById("route-choice-close");
  const routeChoiceList = document.getElementById("route-choice-list");
  let editingRoutesLinkId = null;
  let draggingRouteRow = null;

  function makeRouteRow(route = {}) {
    const row = document.createElement("div");
    row.className = "route-row";
    row.dataset.routeId = route.id || uid();
    row.draggable = false;
    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "route-drag-handle";
    dragHandle.setAttribute("aria-label", "Reorder route");
    dragHandle.textContent = "::";
    dragHandle.addEventListener("pointerdown", () => { row.draggable = true; });
    dragHandle.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const sibling = e.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (e.key === "ArrowUp") routesList.insertBefore(row, sibling);
      else routesList.insertBefore(sibling, row);
      dragHandle.focus();
    });

    const titleField = document.createElement("div");
    titleField.className = "field route-field route-field--title";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "route-title-input";
    titleInput.placeholder = "Home";
    titleInput.autocomplete = "off";
    titleInput.value = route.title || "";
    titleField.appendChild(titleInput);

    const urlField = document.createElement("div");
    urlField.className = "field route-field route-field--url";
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "route-url-input";
    urlInput.placeholder = "https://example.com/home";
    urlInput.autocomplete = "off";
    urlInput.value = route.url || "";
    urlField.appendChild(urlInput);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "route-remove-btn";
    removeBtn.setAttribute("aria-label", "Remove route");
    const removeIcon = document.createElement("img");
    removeIcon.src = "icons/trash.svg";
    removeIcon.alt = "";
    removeIcon.width = 14;
    removeIcon.height = 14;
    removeBtn.appendChild(removeIcon);
    removeBtn.addEventListener("click", () => row.remove());

    row.addEventListener("dragstart", (e) => {
      draggingRouteRow = row;
      row.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", row.dataset.routeId);
    });
    row.addEventListener("dragend", () => {
      row.draggable = false;
      row.classList.remove("is-dragging");
      draggingRouteRow = null;
    });
    row.append(dragHandle, titleField, urlField, removeBtn);
    return row;
  }

  function addRouteRow(route) {
    const row = makeRouteRow(route);
    routesList.appendChild(row);
    return row;
  }

  function closeRoutesModal() {
    routesModal.hidden = true;
    editingRoutesLinkId = null;
    routesList.innerHTML = "";
    routesEnabledInput.checked = false;
  }

  function openRoutesModal(link) {
    editingRoutesLinkId = link.id;
    routesModalTitle.textContent = `Routes: ${link.title || hostname(link.url)}`;
    routesEnabledInput.checked = Boolean(link.routesEnabled);
    routesList.innerHTML = "";
    const routes = linkRoutes(link);
    if (routes.length) routes.forEach((route) => addRouteRow(route));
    else addRouteRow();
    routesModal.hidden = false;
    setTimeout(() => routesList.querySelector(".route-title-input")?.focus(), 0);
  }

  function readRoutesFromModal() {
    const routes = [];
    for (const row of routesList.querySelectorAll(".route-row")) {
      const titleInput = row.querySelector(".route-title-input");
      const urlInput = row.querySelector(".route-url-input");
      const title = titleInput.value.trim();
      const rawUrl = urlInput.value.trim();
      if (!title && !rawUrl) continue;
      if (!title) {
        titleInput.focus();
        return null;
      }
      const url = normaliseUrl(rawUrl);
      if (!url) {
        urlInput.focus();
        return null;
      }
      routes.push({ id: row.dataset.routeId || uid(), title, url });
    }
    return routes;
  }

  async function saveRoutesModal() {
    if (!editingRoutesLinkId) return;
    const r = ctx.findItem(state.data.items, editingRoutesLinkId);
    if (!r || r.item.type !== "link") {
      closeRoutesModal();
      return;
    }
    const routes = readRoutesFromModal();
    if (!routes) return;
    r.item.routesEnabled = routesEnabledInput.checked;
    r.item.routes = routes;
    await saveData();
    closeRoutesModal();
    ctx.render();
  }

  function getRouteDragAfterElement(y) {
    const rows = [...routesList.querySelectorAll(".route-row:not(.is-dragging)")];
    return rows.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function closeRouteChoiceModal() {
    routeChoiceModal.hidden = true;
    routeChoiceList.innerHTML = "";
  }

  function openRoutePopup(link) {
    const routes = linkRoutes(link);
    if (!routes.length) {
      window.location.href = link.url;
      return;
    }
    ctx.hideAllContextMenus?.();
    routeChoiceTitle.textContent = `Open ${link.title || hostname(link.url)}`;
    routeChoiceList.innerHTML = "";
    for (const route of routes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "route-choice-item";
      btn.setAttribute("role", "menuitem");
      btn.textContent = route.title;
      btn.addEventListener("click", () => {
        window.location.href = route.url;
      });
      routeChoiceList.appendChild(btn);
    }
    routeChoiceModal.hidden = false;
    routeChoiceList.querySelector(".route-choice-item")?.focus();
  }

  routesAddBtn.addEventListener("click", () => {
    const row = addRouteRow();
    row.querySelector(".route-title-input")?.focus();
  });
  routesList.addEventListener("dragover", (e) => {
    if (!draggingRouteRow) return;
    e.preventDefault();
    const after = getRouteDragAfterElement(e.clientY);
    if (after) routesList.insertBefore(draggingRouteRow, after);
    else routesList.appendChild(draggingRouteRow);
  });
  routesModalCloseBtn.addEventListener("click", closeRoutesModal);
  routesCancelBtn.addEventListener("click", closeRoutesModal);
  routesSaveBtn.addEventListener("click", () => {
    void saveRoutesModal().catch(ctx.reportStorageError);
  });
  routesModal.addEventListener("click", (e) => {
    if (e.target === routesModal) closeRoutesModal();
  });
  routeChoiceCloseBtn.addEventListener("click", closeRouteChoiceModal);
  routeChoiceModal.addEventListener("click", (e) => {
    if (e.target === routeChoiceModal) closeRouteChoiceModal();
  });

  Object.assign(ctx, {
    closeRouteChoiceModal,
    closeRoutesModal,
    isRouteChoiceModalOpen: () => !routeChoiceModal.hidden,
    isRoutesModalOpen: () => !routesModal.hidden,
    linkRoutesEnabled: (link) => Boolean(link?.routesEnabled && normalizeRoutes(link.routes).length > 0),
    openRoutePopup,
    openRoutesModal,
  });
}
