// --- Shortcut Menu Functions ---

function handleSearchInputChange(e) {
    const input = e.target;
    const value = input.value;
    
    // Hide search hint when user starts typing or when a filter is active
    const searchHint = document.querySelector('.search-hint');
    if (searchHint) {
        const shouldHide = value.length > 0 || activeSearchFilterId !== null;
        searchHint.style.display = shouldHide ? 'none' : 'block';
    }
    
    if (value === '/') {
        openShortcutMenu();
    } else if (shortcutMenuVisible) {
        closeShortcutMenu();
    }
}

function handleSearchInputKeydown(e) {
    // Handle Command+Enter for ChatGPT search
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const input = e.target;
        const query = input.value.trim();
        
        if (query) {
            const chatGptUrl = `https://chat.openai.com/?q=${encodeURIComponent(query)}`;
            window.location.href = chatGptUrl;
        }
        return;
    }
    
    if (!shortcutMenuVisible) return;
    
    const input = e.target;
    const value = input.value;
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        shortcutMenuSelectedIndex = Math.min(shortcutMenuSelectedIndex + 1, SEARCH_FILTERS.length - 1);
        updateShortcutMenuSelection();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        shortcutMenuSelectedIndex = Math.max(shortcutMenuSelectedIndex - 1, 0);
        updateShortcutMenuSelection();
    } else if (e.key === 'Enter' && shortcutMenuSelectedIndex >= 0) {
        e.preventDefault();
        const selectedFilter = SEARCH_FILTERS[shortcutMenuSelectedIndex];
        handleSearchFilterSelection(selectedFilter.id);
        closeShortcutMenu();
        input.value = '';
        input.focus();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        closeShortcutMenu();
        input.value = '';
    } else if (value === '/' && e.key.length === 1 && e.key !== '/') {
        // If user types anything after "/", close the menu
        closeShortcutMenu();
    }
}

function openShortcutMenu() {
    if (shortcutMenuVisible) return;
    
    const filterMenu = document.getElementById('searchFilterMenu');
    if (!filterMenu) return;
    
    shortcutMenuVisible = true;
    shortcutMenuSelectedIndex = 0;
    
    // Show the menu (reuse existing filter menu)
    filterMenu.removeAttribute('hidden');
    filterMenu.classList.add('show');
    
    // Update visual selection
    updateShortcutMenuSelection();
    
    // Add click listener to close on outside click
    setTimeout(() => {
        document.addEventListener('click', handleShortcutMenuOutsideClick);
    }, 0);
}

function closeShortcutMenu() {
    if (!shortcutMenuVisible) return;
    
    const filterMenu = document.getElementById('searchFilterMenu');
    if (filterMenu) {
        filterMenu.classList.remove('show');
        filterMenu.setAttribute('hidden', '');
    }
    
    shortcutMenuVisible = false;
    shortcutMenuSelectedIndex = -1;
    
    // Remove outside click listener
    document.removeEventListener('click', handleShortcutMenuOutsideClick);
    
    // Clear any active highlighting from shortcut navigation
    const menuItems = filterMenu?.querySelectorAll('.search-filter-menu-item');
    menuItems?.forEach(item => {
        const filterId = item.dataset.filterId;
        // Only keep active class if this is the actual active filter
        if (filterId !== activeSearchFilterId) {
            item.classList.remove('active');
        }
    });
}

function handleShortcutMenuOutsideClick(e) {
    const filterMenu = document.getElementById('searchFilterMenu');
    const searchInput = document.getElementById('searchInput');
    
    if (!filterMenu.contains(e.target) && e.target !== searchInput) {
        closeShortcutMenu();
        if (searchInput.value === '/') {
            searchInput.value = '';
        }
    }
}

function updateShortcutMenuSelection() {
    const filterMenu = document.getElementById('searchFilterMenu');
    if (!filterMenu) return;
    
    const menuItems = filterMenu.querySelectorAll('.search-filter-menu-item:not([disabled])');
    
    menuItems.forEach((item, index) => {
        if (index === shortcutMenuSelectedIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            // Don't remove 'active' if it's the actual active filter
            const filterId = item.dataset.filterId;
            if (filterId !== activeSearchFilterId) {
                item.classList.remove('active');
            }
        }
    });
}
