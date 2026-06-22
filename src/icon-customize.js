import { linkHasCustomIcon } from "./model.js";
import { state } from "./state.js";
import { saveData } from "./storage.js";

export function initIconCustomize(ctx) {
  const iconCustomizeModal = document.getElementById("icon-customize-modal");
  const iconCustomizeCloseBtn = document.getElementById("icon-customize-close");
  const iconCustomizeCancelBtn = document.getElementById("icon-customize-cancel");
  const iconCustomizeSaveBtn = document.getElementById("icon-customize-save");
  const iconUploadBtn = document.getElementById("icon-upload-btn");
  const iconUploadInput = document.getElementById("icon-upload-input");
  const iconRemoveBtn = document.getElementById("icon-remove-btn");
  const iconCustomizeHelp = document.getElementById("icon-customize-help");
  const iconCropStage = document.getElementById("icon-crop-stage");
  const iconCropCanvas = document.getElementById("icon-crop-canvas");
  const iconZoomInput = document.getElementById("icon-zoom");
  const iconCropCtx = iconCropCanvas.getContext("2d");
  let customizingLinkId = null;
  let removeCustomIconOnSave = false;
  let iconUploadDragDepth = 0;
  const iconCropState = {
    image: null,
    imageSrc: "",
    baseScale: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0,
  };

  function resetIconCropState() {
    Object.assign(iconCropState, {
      image: null,
      imageSrc: "",
      baseScale: 1,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      dragging: false,
    });
    iconZoomInput.value = "1";
    drawIconCropPreview();
    syncIconCustomizeControls();
  }

  function resetIconUploadDragState() {
    iconUploadDragDepth = 0;
    iconCropStage.classList.remove("is-drag-over");
  }

  function getIconCropMetrics(outputSize = iconCropCanvas.width) {
    const image = iconCropState.image;
    if (!image) return null;
    const previewSize = iconCropCanvas.width;
    const finalScale = iconCropState.baseScale * iconCropState.zoom;
    const ratio = outputSize / previewSize;
    return {
      image,
      drawnWidth: image.width * finalScale * ratio,
      drawnHeight: image.height * finalScale * ratio,
      x: ((previewSize - image.width * finalScale) / 2 + iconCropState.offsetX) * ratio,
      y: ((previewSize - image.height * finalScale) / 2 + iconCropState.offsetY) * ratio,
    };
  }

  function clampIconCropOffsets() {
    const metrics = getIconCropMetrics();
    if (!metrics) return;
    const maxX = Math.max(0, (metrics.drawnWidth - iconCropCanvas.width) / 2);
    const maxY = Math.max(0, (metrics.drawnHeight - iconCropCanvas.height) / 2);
    iconCropState.offsetX = Math.min(maxX, Math.max(-maxX, iconCropState.offsetX));
    iconCropState.offsetY = Math.min(maxY, Math.max(-maxY, iconCropState.offsetY));
  }

  function drawIconCropPreview() {
    iconCropCtx.clearRect(0, 0, iconCropCanvas.width, iconCropCanvas.height);
    if (!iconCropState.image) return;
    const metrics = getIconCropMetrics();
    if (metrics) iconCropCtx.drawImage(metrics.image, metrics.x, metrics.y, metrics.drawnWidth, metrics.drawnHeight);
  }

  function syncIconCustomizeControls() {
    const active = Boolean(iconCropState.image);
    iconZoomInput.disabled = !active;
    iconCustomizeSaveBtn.disabled = !active && !removeCustomIconOnSave;
    iconCropStage.classList.toggle("is-empty", !active);
    iconUploadBtn.hidden = active;
    iconRemoveBtn.hidden = !active;
    if (removeCustomIconOnSave) iconCustomizeHelp.textContent = "The custom icon will be removed when you save.";
    else if (active) iconCustomizeHelp.textContent = "Upload an image, then drag to reposition and use the slider to zoom.";
    else iconCustomizeHelp.textContent = "Upload an image to replace the default favicon.";
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load image."));
      image.src = src;
    });
  }

  async function setIconCropImage(src) {
    const image = await loadImageElement(src);
    iconCropState.image = image;
    iconCropState.imageSrc = src;
    iconCropState.baseScale = Math.max(iconCropCanvas.width / image.width, iconCropCanvas.height / image.height);
    iconCropState.zoom = 1;
    iconCropState.offsetX = 0;
    iconCropState.offsetY = 0;
    iconZoomInput.value = "1";
    removeCustomIconOnSave = false;
    clampIconCropOffsets();
    drawIconCropPreview();
    syncIconCustomizeControls();
  }

  function renderCroppedIconDataUrl() {
    const metrics = getIconCropMetrics(128);
    if (!metrics) return null;
    const out = document.createElement("canvas");
    out.width = 128;
    out.height = 128;
    const ctx2d = out.getContext("2d");
    ctx2d.clearRect(0, 0, out.width, out.height);
    ctx2d.drawImage(metrics.image, metrics.x, metrics.y, metrics.drawnWidth, metrics.drawnHeight);
    return out.toDataURL("image/png");
  }

  function closeIconCustomizeModal() {
    iconCustomizeModal.hidden = true;
    customizingLinkId = null;
    removeCustomIconOnSave = false;
    resetIconUploadDragState();
    resetIconCropState();
  }

  function openIconCustomizeModal(link) {
    customizingLinkId = link.id;
    removeCustomIconOnSave = false;
    iconCustomizeModal.hidden = false;
    if (linkHasCustomIcon(link)) {
      void setIconCropImage(link.customIcon).catch((error) => {
        console.error(error);
        resetIconCropState();
      });
    } else resetIconCropState();
  }

  async function saveIconCustomizeModal() {
    if (!customizingLinkId) return;
    const r = ctx.findItem(state.data.items, customizingLinkId);
    if (!r || r.item.type !== "link") {
      closeIconCustomizeModal();
      return;
    }
    if (removeCustomIconOnSave) r.item.customIcon = null;
    else {
      const croppedIcon = renderCroppedIconDataUrl();
      if (!croppedIcon) return;
      r.item.customIcon = croppedIcon;
    }
    await saveData();
    closeIconCustomizeModal();
    ctx.render();
  }

  function readIconUploadFile(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Selected file is not an image."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
  }

  async function handleIconUploadFile(file) {
    if (!file) return;
    await setIconCropImage(await readIconUploadFile(file));
  }

  const eventHasFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
  const iconUploadFileFromDragEvent = (e) => [...(e.dataTransfer?.files || [])].find((file) => file.type.startsWith("image/")) || null;

  iconUploadBtn.addEventListener("click", () => {
    iconUploadInput.value = "";
    iconUploadInput.click();
  });
  iconUploadInput.addEventListener("change", () => {
    const file = iconUploadInput.files?.[0];
    if (!file) return;
    void handleIconUploadFile(file)
      .catch(() => alert("Could not read that image. Try a different file."))
      .finally(() => { iconUploadInput.value = ""; });
  });
  iconCropStage.addEventListener("dragenter", (e) => {
    if (!eventHasFileDrag(e)) return;
    e.preventDefault();
    iconUploadDragDepth += 1;
    iconCropStage.classList.add("is-drag-over");
  });
  iconCropStage.addEventListener("dragover", (e) => {
    if (!eventHasFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    iconCropStage.classList.add("is-drag-over");
  });
  iconCropStage.addEventListener("dragleave", (e) => {
    if (!eventHasFileDrag(e)) return;
    e.preventDefault();
    iconUploadDragDepth = Math.max(0, iconUploadDragDepth - 1);
    if (iconUploadDragDepth === 0) iconCropStage.classList.remove("is-drag-over");
  });
  iconCropStage.addEventListener("drop", (e) => {
    if (!eventHasFileDrag(e)) return;
    e.preventDefault();
    resetIconUploadDragState();
    const file = iconUploadFileFromDragEvent(e);
    if (!file) {
      alert("Drop an image file to customize this icon.");
      return;
    }
    void handleIconUploadFile(file).catch(() => alert("Could not read that image. Try a different file."));
  });
  iconRemoveBtn.addEventListener("click", () => {
    resetIconCropState();
    removeCustomIconOnSave = true;
    syncIconCustomizeControls();
  });
  iconRemoveBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  iconRemoveBtn.addEventListener("click", (e) => e.stopPropagation());
  iconZoomInput.addEventListener("input", () => {
    iconCropState.zoom = Number(iconZoomInput.value);
    clampIconCropOffsets();
    drawIconCropPreview();
  });
  iconCropStage.addEventListener("pointerdown", (e) => {
    if (!iconCropState.image) return;
    iconCropState.dragging = true;
    iconCropState.dragStartX = e.clientX;
    iconCropState.dragStartY = e.clientY;
    iconCropState.dragOriginX = iconCropState.offsetX;
    iconCropState.dragOriginY = iconCropState.offsetY;
    iconCropStage.classList.add("is-dragging");
    iconCropStage.setPointerCapture(e.pointerId);
  });
  iconCropStage.addEventListener("pointermove", (e) => {
    if (!iconCropState.dragging) return;
    iconCropState.offsetX = iconCropState.dragOriginX + (e.clientX - iconCropState.dragStartX);
    iconCropState.offsetY = iconCropState.dragOriginY + (e.clientY - iconCropState.dragStartY);
    clampIconCropOffsets();
    drawIconCropPreview();
  });
  function endIconCropDrag(e) {
    if (!iconCropState.dragging) return;
    iconCropState.dragging = false;
    iconCropStage.classList.remove("is-dragging");
    if (typeof e.pointerId === "number" && iconCropStage.hasPointerCapture(e.pointerId)) {
      iconCropStage.releasePointerCapture(e.pointerId);
    }
  }
  iconCropStage.addEventListener("pointerup", endIconCropDrag);
  iconCropStage.addEventListener("pointercancel", endIconCropDrag);
  iconCustomizeCloseBtn.addEventListener("click", closeIconCustomizeModal);
  iconCustomizeCancelBtn.addEventListener("click", closeIconCustomizeModal);
  iconCustomizeSaveBtn.addEventListener("click", () => {
    void saveIconCustomizeModal().catch(ctx.reportStorageError);
  });
  iconCustomizeModal.addEventListener("click", (e) => {
    if (e.target === iconCustomizeModal) closeIconCustomizeModal();
  });

  Object.assign(ctx, {
    closeIconCustomizeModal,
    isIconCustomizeModalOpen: () => !iconCustomizeModal.hidden,
    openIconCustomizeModal,
  });
}
