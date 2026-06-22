export function initKeyboard(ctx) {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (ctx.isItemContextMenuOpen?.() || ctx.isGridContextMenuOpen?.()) {
        ctx.hideAllContextMenus();
        return;
      }
      if (ctx.isRouteChoiceModalOpen?.()) {
        ctx.closeRouteChoiceModal();
        return;
      }
      if (ctx.isDeleteConfirmOpen?.()) {
        ctx.closeDeleteConfirm();
        return;
      }
      if (ctx.isRoutesModalOpen?.()) {
        ctx.closeRoutesModal();
        return;
      }
      if (ctx.isIconCustomizeModalOpen?.()) {
        ctx.closeIconCustomizeModal();
        return;
      }
      if (ctx.isPowerSearchModalOpen?.()) {
        ctx.closePowerSearchModal();
        return;
      }
      if (ctx.isAiChatModalOpen?.()) {
        ctx.closeAiChatModal();
        return;
      }
      if (ctx.isCalculatorModalOpen?.()) {
        ctx.closeCalculatorModal();
        return;
      }
      if (ctx.isSavesModalOpen?.()) {
        ctx.closeSavesModal();
        return;
      }
      if (ctx.isSettingsModalOpen?.()) {
        if (ctx.isAiProviderDropdownOpen()) {
          ctx.closeAiProviderDropdown();
          return;
        }
        if (ctx.isWallpaperDropdownOpen()) {
          ctx.closeWallpaperDropdown();
          return;
        }
        if (ctx.isSaveArchiveAfterDropdownOpen()) {
          ctx.closeSaveArchiveAfterDropdown();
          return;
        }
        ctx.closeSettingsModal();
        return;
      }
      ctx.closeLinkModal();
      ctx.closeFolderModal();
    }

    if (
      (e.key === "Backspace" || e.key === "ArrowLeft") &&
      !ctx.isLinkModalOpen() &&
      !ctx.isFolderModalOpen() &&
      !ctx.isDeleteConfirmOpen() &&
      !ctx.isIconCustomizeModalOpen() &&
      !ctx.isRoutesModalOpen() &&
      !ctx.isRouteChoiceModalOpen() &&
      !ctx.isPowerSearchModalOpen() &&
      !ctx.isAiChatModalOpen() &&
      !ctx.isCalculatorModalOpen() &&
      !ctx.isSavesModalOpen() &&
      !ctx.isSettingsModalOpen() &&
      document.activeElement === document.body
    ) {
      ctx.goUpFolder();
    }
  });
}
