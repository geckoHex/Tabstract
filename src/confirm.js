let pendingConfirmAction = null;

export function initConfirm(ctx) {
  const deleteConfirmModal = document.getElementById("delete-confirm-modal");
  const deleteModalTitle = document.getElementById("delete-modal-title");
  const deleteModalMessage = document.getElementById("delete-modal-message");
  const deleteConfirmBtn = document.getElementById("delete-confirm");

  function openDestructiveConfirm({ title, message, confirmLabel = "Confirm", action }) {
    pendingConfirmAction = action;
    deleteModalTitle.textContent = title;
    deleteModalMessage.textContent = message;
    deleteConfirmBtn.textContent = confirmLabel;
    deleteConfirmModal.hidden = false;
  }

  function closeDeleteConfirm() {
    deleteConfirmModal.hidden = true;
    pendingConfirmAction = null;
  }

  async function runPendingConfirmAction() {
    const action = pendingConfirmAction;
    closeDeleteConfirm();
    if (action) await action();
  }

  document.getElementById("delete-modal-close").addEventListener("click", closeDeleteConfirm);
  document.getElementById("delete-cancel").addEventListener("click", closeDeleteConfirm);
  deleteConfirmBtn.addEventListener("click", () => {
    void runPendingConfirmAction().catch(ctx.reportStorageError);
  });
  deleteConfirmModal.addEventListener("click", (e) => {
    if (e.target === deleteConfirmModal) closeDeleteConfirm();
  });

  Object.assign(ctx, {
    closeDeleteConfirm,
    isDeleteConfirmOpen: () => !deleteConfirmModal.hidden,
    openDestructiveConfirm,
  });
}
