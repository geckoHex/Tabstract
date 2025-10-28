function setupSearchWarningControls() {
    const warningBackBtn = document.getElementById('warningBackBtn');
    const warningSearchAnywayBtn = document.getElementById('warningSearchAnywayBtn');

    warningBackBtn?.addEventListener('click', () => {
        closeModal('searchWarningModal');
        const searchInput = document.getElementById('searchInput');
        searchInput?.focus();
    });

    warningSearchAnywayBtn?.addEventListener('click', () => {
        const modal = document.getElementById('searchWarningModal');
        if (!modal) {
            return;
        }
        const query = modal.dataset.pendingQuery;
        closeModal('searchWarningModal');
        if (query) {
            performSearch(query);
        }
    });
}
