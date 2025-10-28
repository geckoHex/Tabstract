function setupIslandButtons() {
    const newLinkBtn = document.getElementById('newLinkBtn');
    const savedLinksBtn = document.getElementById('savedLinksBtn');
    const themeBtn = document.getElementById('themeBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    newLinkBtn?.addEventListener('click', () => openModal('linkModal'));
    savedLinksBtn?.addEventListener('click', () => openModal('savedLinksModal'));
    themeBtn?.addEventListener('click', () => openModal('themeModal'));
    settingsBtn?.addEventListener('click', () => openModal('settingsModal'));
}

function setupModalCloseButtons() {
    document.querySelectorAll('.modal-close').forEach((button) => {
        button.addEventListener('click', (event) => {
            const modalId = event.currentTarget.getAttribute('data-modal');
            if (modalId) {
                closeModal(modalId);
            }
        });
    });
}

function setupLegacyLinkModalButtons() {
    const closeModalBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');

    closeModalBtn?.addEventListener('click', () => closeModal('linkModal'));
    cancelBtn?.addEventListener('click', () => closeModal('linkModal'));
}

function setupModalBackdropClose() {
    document.querySelectorAll('.modal').forEach((modal) => {
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}
