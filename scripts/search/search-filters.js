function initializeSearchFilters() {
    filterMenuToggle = document.getElementById('searchFilterToggle');
    filterMenuElement = document.getElementById('searchFilterMenu');
    filterMenuIconElement = filterMenuToggle ? filterMenuToggle.querySelector('.search-filter-toggle-icon') : null;
    filterMenuLabelElement = filterMenuToggle ? filterMenuToggle.querySelector('.search-filter-toggle-label') : null;

    if (!filterMenuToggle || !filterMenuElement) {
        return;
    }

    if (filterMenuIconElement) {
        filterMenuIconElement.dataset.icon = DEFAULT_FILTER_ICON;
    }

    if (filterMenuToggle) {
        filterMenuToggle.setAttribute('aria-label', FILTER_TOGGLE_DEFAULT_LABEL);
        filterMenuToggle.setAttribute('title', FILTER_TOGGLE_DEFAULT_LABEL);
    }

    renderSearchFilterMenu();

    filterMenuToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (isSearchFilterMenuOpen()) {
            closeSearchFilterMenu();
        } else {
            openSearchFilterMenu();
            focusFirstFilterMenuItem();
        }
    });

    filterMenuToggle.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowDown') {
            event.preventDefault();
            if (!isSearchFilterMenuOpen()) {
                openSearchFilterMenu();
            }
            focusFirstFilterMenuItem();
        }
    });

    filterMenuElement.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', (event) => {
        if (!filterMenuElement || !filterMenuToggle) {
            return;
        }

        if (!isSearchFilterMenuOpen()) {
            return;
        }

        const isToggle = filterMenuToggle.contains(event.target);
        const isMenu = filterMenuElement.contains(event.target);

        if (!isToggle && !isMenu) {
            closeSearchFilterMenu();
        }
    });

    const storedFilter = localStorage.getItem('activeSearchFilter');
    if (storedFilter) {
        setActiveSearchFilter(storedFilter, { persist: false, silent: true });
    }

    updateSearchFilterUI();
}

function renderSearchFilterMenu() {
    if (!filterMenuElement) {
        return;
    }

    filterMenuElement.innerHTML = '';

    SEARCH_FILTERS.forEach((filter) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'search-filter-menu-item';
        item.dataset.filterId = filter.id;
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', 'false');

        const icon = document.createElement('span');
        icon.className = 'filter-icon';
        icon.setAttribute('aria-hidden', 'true');
        if (filter.icon) {
            icon.dataset.icon = filter.icon;
        }

        const label = document.createElement('span');
        label.className = 'filter-label';
        label.textContent = filter.label;

        const checkmark = document.createElement('span');
        checkmark.className = 'checkmark';
        checkmark.textContent = '✓';
        checkmark.setAttribute('aria-hidden', 'true');

        item.append(icon, label, checkmark);

        item.addEventListener('click', () => {
            handleSearchFilterSelection(filter.id);
        });

        item.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeSearchFilterMenu();
                if (filterMenuToggle) {
                    filterMenuToggle.focus();
                }
            }
        });

        filterMenuElement.appendChild(item);
    });

    const divider = document.createElement('div');
    divider.className = 'search-filter-menu-divider';
    filterMenuElement.appendChild(divider);

    const clearItem = document.createElement('button');
    clearItem.type = 'button';
    clearItem.className = 'search-filter-menu-item clear-filter';
    clearItem.setAttribute('role', 'menuitem');
    const clearIcon = document.createElement('span');
    clearIcon.className = 'filter-icon';
    clearIcon.setAttribute('aria-hidden', 'true');
    clearIcon.dataset.icon = 'x-circle';

    const clearLabel = document.createElement('span');
    clearLabel.className = 'filter-label';
    clearLabel.textContent = 'Clear filter';

    clearItem.append(clearIcon, clearLabel);
    clearItem.addEventListener('click', () => {
        setActiveSearchFilter(null);
        closeSearchFilterMenu();
        if (filterMenuToggle) {
            filterMenuToggle.focus();
        }
    });

    filterMenuElement.appendChild(clearItem);
}

function handleSearchFilterSelection(filterId) {
    if (activeSearchFilterId === filterId) {
        setActiveSearchFilter(null);
        closeSearchFilterMenu();
        closeShortcutMenu();
        if (filterMenuToggle) {
            filterMenuToggle.focus();
        }
        return;
    }

    setActiveSearchFilter(filterId);

    const engine = (getSettings().searchEngine || 'google');
    if (engine !== 'google') {
        showToast('Filters apply when Google is the selected search engine');
    }

    closeSearchFilterMenu();
    
    // If called from shortcut menu, clear the "/" from input and return focus
    if (shortcutMenuVisible) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value === '/') {
            searchInput.value = '';
        }
        closeShortcutMenu();
        // Return focus to search input after selection
        if (searchInput) {
            searchInput.focus();
        }
        return;
    }
    
    closeShortcutMenu();
    if (filterMenuToggle) {
        filterMenuToggle.focus();
    }
}

function setActiveSearchFilter(filterId, options = {}) {
    const { persist = true, silent = false } = options;
    const filter = SEARCH_FILTERS.find((item) => item.id === filterId) || null;

    activeSearchFilterId = filter ? filter.id : null;
    updateSearchFilterUI();

    if (persist) {
        if (activeSearchFilterId) {
            localStorage.setItem('activeSearchFilter', activeSearchFilterId);
        } else {
            localStorage.removeItem('activeSearchFilter');
        }
    }

    if (!silent) {
        if (filter) {
            showToast(`Filter: ${filter.label}`);
        } else {
            showToast('Filter cleared');
        }
    }

    // Update search hint visibility based on filter state
    const settings = getSettings();
    updateSearchHintVisibility(settings.showSearchHint !== false);
}

function updateSearchFilterUI() {
    if (filterMenuElement) {
        filterMenuElement.querySelectorAll('[data-filter-id]').forEach((button) => {
            const { filterId } = button.dataset;
            const isActive = filterId === activeSearchFilterId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });

        const clearItem = filterMenuElement.querySelector('.clear-filter');
        if (clearItem) {
            clearItem.disabled = !activeSearchFilterId;
        }
    }

    if (filterMenuToggle) {
        const activeFilter = getActiveSearchFilter();
        const hasActive = Boolean(activeFilter);
        filterMenuToggle.classList.toggle('active', hasActive);

        const label = hasActive ? `Filter: ${activeFilter.label}` : FILTER_TOGGLE_DEFAULT_LABEL;
        filterMenuToggle.setAttribute('aria-label', label);
        filterMenuToggle.setAttribute('title', label);

        if (filterMenuIconElement) {
            const icon = hasActive && activeFilter && activeFilter.icon ? activeFilter.icon : DEFAULT_FILTER_ICON;
            filterMenuIconElement.dataset.icon = icon;
        }

        if (filterMenuLabelElement) {
            if (hasActive && activeFilter) {
                filterMenuLabelElement.textContent = activeFilter.label;
                filterMenuLabelElement.hidden = false;
            } else {
                filterMenuLabelElement.textContent = '';
                filterMenuLabelElement.hidden = true;
            }
        }
    }
}

function getActiveSearchFilter() {
    if (!activeSearchFilterId) {
        return null;
    }

    return SEARCH_FILTERS.find((filter) => filter.id === activeSearchFilterId) || null;
}

function openSearchFilterMenu() {
    if (!filterMenuElement || !filterMenuToggle) {
        return;
    }

    filterMenuElement.classList.add('show');
    filterMenuElement.removeAttribute('hidden');
    filterMenuToggle.setAttribute('aria-expanded', 'true');
}

function closeSearchFilterMenu() {
    if (!filterMenuElement || !filterMenuToggle) {
        return;
    }

    filterMenuElement.classList.remove('show');
    filterMenuElement.setAttribute('hidden', '');
    filterMenuToggle.setAttribute('aria-expanded', 'false');
}

function isSearchFilterMenuOpen() {
    return Boolean(filterMenuElement && filterMenuElement.classList.contains('show'));
}

function focusFirstFilterMenuItem() {
    if (!filterMenuElement) {
        return;
    }

    const firstItem = filterMenuElement.querySelector('.search-filter-menu-item');
    if (firstItem) {
        firstItem.focus();
    }
}
