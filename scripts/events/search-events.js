function setupSearchFormListeners() {
    const searchForm = document.getElementById('searchForm');
    if (!searchForm) {
        return;
    }

    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const searchInput = document.getElementById('searchInput');
        if (!searchInput) {
            return;
        }

        if (shortcutMenuVisible && shortcutMenuSelectedIndex >= 0) {
            const selectedFilter = SEARCH_FILTERS[shortcutMenuSelectedIndex];
            handleSearchFilterSelection(selectedFilter.id);
            searchInput.value = '';
            closeShortcutMenu();
            return;
        }

        const query = searchInput.value.trim();
        if (!query) {
            return;
        }

        if (isValidUrl(query)) {
            let url = query;
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }
            window.location.href = url;
            return;
        }

        const blockedTermsFound = checkForBlockedTerms(query);
        if (blockedTermsFound.length > 0) {
            showSearchWarning(query, blockedTermsFound);
            return;
        }

        performSearch(query);
    });
}

function setupSearchInputListeners() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) {
        return;
    }

    searchInput.addEventListener('input', handleSearchInputChange);
    searchInput.addEventListener('keydown', handleSearchInputKeydown);
}
