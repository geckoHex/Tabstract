function setupGlobalKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }

        if (isSearchFilterMenuOpen()) {
            closeSearchFilterMenu();
            filterMenuToggle?.focus();
            return;
        }

        const openModalElement = document.querySelector('.modal.show');
        if (openModalElement) {
            closeModal(openModalElement.id);
        }
    });
}
