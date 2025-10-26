// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeSearchFilters();
    setupEventListeners();
    loadQuickLinks();
    initializeIconPicker();
    loadSettings();
    loadTheme();
    initializeGreeting();
    startClock();
});

// Available custom icons
const CUSTOM_ICONS = [
    'bookmark-simple.svg',
    'calendar.svg',
    'camera.svg',
    'chart-line.svg',
    'chat.svg',
    'envelope.svg',
    'gear.svg',
    'globe-hemisphere-west.svg',
    'laptop.svg',
    'lightbulb.svg',
    'music-notes-simple.svg',
    'palette.svg',
    'puzzle-piece.svg',
    'rocket-launch.svg',
    'star.svg'
];

const DEFAULT_THEME = {
    mode: 'light',
    accentColor: '#007bff',
    background: 'none',
    backgroundImageOpacity: 100
};

const DEFAULT_SETTINGS = {
    searchEngine: 'google',
    typeAnywhere: true,
    openLinksNewTab: false,
    userName: '',
    showSearchHint: true,
    faviconLoadMode: 'delayed', // 'immediate', 'delayed', or 'manual'
    blockedTerms: [] // Array of blocked search terms
};

const SEARCH_FILTERS = [
    {
        id: 'last-hour',
        label: 'Last hour',
        icon: 'hourglass-medium',
        googleParams: { tbs: 'qdr:h' }
    },
    {
        id: 'past-day',
        label: 'Past day',
        icon: 'calendar-blank',
        googleParams: { tbs: 'qdr:d' }
    },
    {
        id: 'transparent-images',
        label: 'Transparent images',
        icon: 'image',
        googleParams: { udm: '2', tbs: 'ic:trans' }
    },
    {
        id: 'high-res-images',
        label: 'High-res images',
        icon: 'high-definition',
        googleParams: { udm: '2', tbs: 'isz:l' }
    },
    {
        id: 'pdfs',
        label: 'PDFs',
        icon: 'file-pdf',
        appendQuery: 'filetype:pdf'
    },
    {
        id: 'web-results-only',
        label: 'Web results only',
        icon: 'article-ny-times',
        googleParams: { udm: '14' }
    }
];

let activeSearchFilterId = null;
let filterMenuToggle = null;
let filterMenuElement = null;
let filterMenuIconElement = null;
let filterMenuLabelElement = null;

const DEFAULT_FILTER_ICON = 'sliders-horizontal';
const FILTER_TOGGLE_DEFAULT_LABEL = 'Filter search results';

let shortcutMenuVisible = false;
let shortcutMenuSelectedIndex = -1;

let selectedIcon = null; // Will store either favicon URL or custom icon path
let fetchedFavicon = null; // Stores the fetched favicon URL
let draggedQuickLinkId = null; // Tracks the quick link currently being dragged
let draggedQuickLinkElement = null; // The actual element being dragged
let quickLinkContainerListenersAttached = false;

// Helper to check if a string is a valid URL or domain
function isValidUrl(str) {
    try {
        // Accept full URLs first
        new URL(str);
        return true;
    } catch (e) {
        try {
            // Fallback: assume https if protocol missing and validate basic shape
            new URL('https://' + str);
            return /\./.test(str) && !/\s/.test(str);
        } catch (e2) {
            return false;
        }
    }
}

// Set up event listeners
function setupEventListeners() {
    // Search form
    const searchForm = document.getElementById('searchForm');
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const searchInput = document.getElementById('searchInput');

        // If shortcut menu is visible, apply selected filter
        if (shortcutMenuVisible && shortcutMenuSelectedIndex >= 0) {
            const selectedFilter = SEARCH_FILTERS[shortcutMenuSelectedIndex];
            handleSearchFilterSelection(selectedFilter.id);
            searchInput.value = '';
            closeShortcutMenu();
            return;
        }

        const query = searchInput.value.trim();
        if (query) {
            // Check if input is a valid URL
            if (isValidUrl(query)) {
                let url = query;
                // If missing protocol, add https://
                if (!/^https?:\/\//i.test(url)) {
                    url = 'https://' + url;
                }
                window.location.href = url;
                return;
            }

            // Check for blocked terms
            const blockedTermsFound = checkForBlockedTerms(query);
            if (blockedTermsFound.length > 0) {
                showSearchWarning(query, blockedTermsFound);
                return;
            }

            performSearch(query);
        }
    });

    // Search input for "/" shortcut menu
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', handleSearchInputChange);
    searchInput.addEventListener('keydown', handleSearchInputKeydown);

    // Island buttons
    const newLinkBtn = document.getElementById('newLinkBtn');
    const savedLinksBtn = document.getElementById('savedLinksBtn');
    const themeBtn = document.getElementById('themeBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    newLinkBtn.addEventListener('click', () => openModal('linkModal'));
    savedLinksBtn.addEventListener('click', () => openModal('savedLinksModal'));
    themeBtn.addEventListener('click', () => openModal('themeModal'));
    settingsBtn.addEventListener('click', () => openModal('settingsModal'));

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.getAttribute('data-modal');
            closeModal(modalId);
        });
    });

    // Legacy close button for link modal
    const closeModalBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => closeModal('linkModal'));
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModal('linkModal'));
    }
    
    // Close modal when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Handle link form submission
    const linkForm = document.getElementById('linkForm');
    linkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addQuickLink();
    });

    // Listen for URL input changes to fetch favicon
    const linkUrlInput = document.getElementById('linkUrl');
    const linkTitleInput = document.getElementById('linkTitle');
    const urlSuggestion = document.getElementById('urlSuggestion');
    const urlSuggestionBtn = document.getElementById('urlSuggestionBtn');
    let faviconUpdateTimeout = null;
    
    // Form validation - disable submit button until all fields are filled
    function validateForm() {
        const submitBtn = linkForm.querySelector('button[type="submit"]');
        const title = linkTitleInput.value.trim();
        const url = linkUrlInput.value.trim();
        const hasIcon = selectedIcon !== null;
        
        // Enable button only if title, url are filled and icon is selected (or favicon is fetched)
        const isValid = title && url && (hasIcon || fetchedFavicon);
        submitBtn.disabled = !isValid;
    }
    
    // Validate form on input changes
    linkTitleInput.addEventListener('input', validateForm);
    linkUrlInput.addEventListener('input', () => {
        validateForm();
        // Continue with existing input handler...
        handleUrlInputChange();
    });
    
    // Handle Enter key to advance to next field
    linkTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            linkUrlInput.focus();
        }
    });
    
    function handleUrlInputChange() {
        clearTimeout(faviconUpdateTimeout);
        const url = linkUrlInput.value.trim();
        
        // Check if URL has path and show suggestion
        checkAndShowUrlSuggestion(url);
        
        if (!url) {
            resetFaviconSlot();
            return;
        }
        
        const settings = getSettings();
        const mode = settings.faviconLoadMode || 'delayed';
        
        if (mode === 'immediate') {
            faviconUpdateTimeout = setTimeout(async () => {
                await updateFaviconInPicker(url);
            }, 300); // Small debounce to avoid too many requests while typing
        } else if (mode === 'delayed') {
            setFaviconWaiting();
            faviconUpdateTimeout = setTimeout(async () => {
                await updateFaviconInPicker(url);
            }, 1500); // Wait 1.5s after user stops typing
        } else if (mode === 'manual') {
            setFaviconWaiting();
            // Don't auto-fetch, wait for Enter or blur
        }
    }
    
    // Handle URL suggestion click
    if (urlSuggestionBtn) {
        urlSuggestionBtn.addEventListener('click', () => {
            const baseUrl = urlSuggestionBtn.textContent;
            linkUrlInput.value = baseUrl;
            urlSuggestion.style.display = 'none';
            
            // Trigger favicon update immediately after setting base URL
            clearTimeout(faviconUpdateTimeout);
            updateFaviconInPicker(baseUrl);
        });
    }
    
    // Handle paste events - fetch favicon immediately
    linkUrlInput.addEventListener('paste', async (e) => {
        clearTimeout(faviconUpdateTimeout);
        // Wait a tiny bit for the paste to complete
        setTimeout(async () => {
            const url = linkUrlInput.value.trim();
            
            // Check if URL has path and show suggestion
            checkAndShowUrlSuggestion(url);
            
            if (url) await updateFaviconInPicker(url);
            validateForm();
        }, 50);
    });
    
    // Handle Enter key in URL input
    linkUrlInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            clearTimeout(faviconUpdateTimeout);
            const url = linkUrlInput.value.trim();
            if (url) {
                await updateFaviconInPicker(url);
                validateForm();
            }
        }
    });
    
    // Handle blur event - fetch favicon if in manual mode
    linkUrlInput.addEventListener('blur', async () => {
        clearTimeout(faviconUpdateTimeout);
        const url = linkUrlInput.value.trim();
        if (url) {
            const settings = getSettings();
            const mode = settings.faviconLoadMode || 'delayed';
            
            // Only fetch on blur for manual mode, or if not already fetched
            if (mode === 'manual' || !fetchedFavicon) {
                await updateFaviconInPicker(url);
                validateForm();
            }
        }
    });

    // Theme options
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const theme = e.currentTarget.getAttribute('data-theme');
            setTheme(theme);
        });
    });

    // Color options
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const color = e.currentTarget.getAttribute('data-color');
            setAccentColor(color);
        });
    });

    // Background options
    document.querySelectorAll('.background-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const background = e.currentTarget.getAttribute('data-background');
            setBackground(background);
        });
    });

    const backgroundOpacitySlider = document.getElementById('backgroundImageOpacity');
    if (backgroundOpacitySlider) {
        backgroundOpacitySlider.addEventListener('input', (e) => {
            updateBackgroundImageOpacity(Number(e.target.value));
        });
        backgroundOpacitySlider.addEventListener('change', (e) => {
            showToast(`Background clarity ${e.target.value}%`);
        });
    }

    // Settings
    const typeAnywhereCheckbox = document.getElementById('typeAnywhere');
    const openLinksCheckbox = document.getElementById('openLinksNewTab');
    const showSearchHintCheckbox = document.getElementById('showSearchHint');
    const userNameInput = document.getElementById('userName');
    let nameUpdateTimeout = null;

    if (userNameInput) {
        userNameInput.addEventListener('input', (e) => {
            const value = e.target.value;
            clearTimeout(nameUpdateTimeout);
            nameUpdateTimeout = setTimeout(() => {
                updateSetting('userName', value.trim());
                updateGreeting(true);
            }, 300);
        });

        userNameInput.addEventListener('blur', (e) => {
            clearTimeout(nameUpdateTimeout);
            const sanitized = e.target.value.trim();
            e.target.value = sanitized;
            updateSetting('userName', sanitized);
            updateGreeting(true);
        });
    }

    typeAnywhereCheckbox.addEventListener('change', (e) => {
        updateSetting('typeAnywhere', e.target.checked);
        showToast(e.target.checked ? 'Type anywhere enabled' : 'Type anywhere disabled');
        setupTypeAnywhereListeners();
    });

    openLinksCheckbox.addEventListener('change', (e) => {
        updateSetting('openLinksNewTab', e.target.checked);
        showToast(e.target.checked ? 'Links open in new tab' : 'Links open in same tab');
    });

    showSearchHintCheckbox.addEventListener('change', (e) => {
        updateSetting('showSearchHint', e.target.checked);
        updateSearchHintVisibility(e.target.checked);
        showToast(e.target.checked ? 'Search hint shown' : 'Search hint hidden');
    });
    
    // Favicon load mode setting
    const faviconLoadModeSelect = document.getElementById('faviconLoadMode');
    if (faviconLoadModeSelect) {
        faviconLoadModeSelect.addEventListener('change', (e) => {
            const mode = e.target.value;
            updateSetting('faviconLoadMode', mode);
            const messages = {
                'immediate': 'Favicon loads immediately',
                'delayed': 'Favicon loads after 1.5s delay',
                'manual': 'Favicon loads after Enter key'
            };
            showToast(messages[mode] || 'Favicon load mode updated');
        });
    }

    // Blocked terms management
    const blockedTermInput = document.getElementById('blockedTermInput');
    const addBlockedTermBtn = document.getElementById('addBlockedTermBtn');
    
    if (addBlockedTermBtn && blockedTermInput) {
        addBlockedTermBtn.addEventListener('click', () => {
            const term = blockedTermInput.value;
            if (addBlockedTerm(term)) {
                blockedTermInput.value = '';
            }
        });
        
        blockedTermInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const term = blockedTermInput.value;
                if (addBlockedTerm(term)) {
                    blockedTermInput.value = '';
                }
            }
        });
    }

    // Search warning modal buttons
    const warningBackBtn = document.getElementById('warningBackBtn');
    const warningSearchAnywayBtn = document.getElementById('warningSearchAnywayBtn');
    
    if (warningBackBtn) {
        warningBackBtn.addEventListener('click', () => {
            closeModal('searchWarningModal');
            // Focus back on search input
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
        });
    }
    
    if (warningSearchAnywayBtn) {
        warningSearchAnywayBtn.addEventListener('click', () => {
            const modal = document.getElementById('searchWarningModal');
            const query = modal.dataset.pendingQuery;
            closeModal('searchWarningModal');
            if (query) {
                performSearch(query);
            }
        });
    }
    
    // Saved Links functionality
    const saveLinkBtn = document.getElementById('saveLinkBtn');
    const savedLinkUrlInput = document.getElementById('savedLinkUrl');
    
    if (saveLinkBtn && savedLinkUrlInput) {
        saveLinkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const url = savedLinkUrlInput.value.trim();
            if (url) {
                saveLinkForLater(url);
                savedLinkUrlInput.value = '';
            }
        });
        
        savedLinkUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const url = savedLinkUrlInput.value.trim();
                if (url) {
                    saveLinkForLater(url);
                    savedLinkUrlInput.value = '';
                }
            }
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key closes any open modal
        if (e.key === 'Escape') {
            if (isSearchFilterMenuOpen()) {
                closeSearchFilterMenu();
                if (filterMenuToggle) {
                    filterMenuToggle.focus();
                }
                return;
            }
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });
}

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

// Setup type anywhere listeners
function setupTypeAnywhereListeners() {
    const settings = getSettings();
    const searchInput = document.getElementById('searchInput');
    
    // Remove existing listeners if they exist
    document.removeEventListener('keydown', typeAnywhereKeyHandler);
    document.removeEventListener('click', typeAnywhereClickHandler);
    
    if (settings.typeAnywhere !== false) {
        document.addEventListener('keydown', typeAnywhereKeyHandler);
        document.addEventListener('click', typeAnywhereClickHandler);
    }
}

function typeAnywhereKeyHandler(e) {
    const searchInput = document.getElementById('searchInput');
    const target = e.target;
    
    // Don't focus if already in an input field, textarea, or contenteditable element
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')) {
        return;
    }
    
    // Don't focus on modifier keys or special keys
    if (e.ctrlKey || e.metaKey || e.altKey || 
        ['Escape', 'Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
    }
    
    // Focus the search input and let the character be typed
    if (searchInput && searchInput !== document.activeElement) {
        searchInput.focus();
    }
}

function typeAnywhereClickHandler(e) {
    const searchInput = document.getElementById('searchInput');
    const target = e.target;
    
    // Check if clicked on an interactive element
    const isInteractive = target.tagName === 'INPUT' ||
                         target.tagName === 'TEXTAREA' ||
                         target.tagName === 'BUTTON' ||
                         target.tagName === 'A' ||
                         target.tagName === 'SELECT' ||
                         target.isContentEditable ||
                         target.closest('button, a, input, textarea, select, [contenteditable="true"]');
    
    // If clicked on the background (non-interactive element), focus search
    if (!isInteractive && searchInput) {
        searchInput.focus();
    }
}

// Initialize type anywhere on startup
window.addEventListener('load', () => {
    setupTypeAnywhereListeners();
});

// --- Settings Functions ---

function getSettings() {
    const stored = localStorage.getItem('settings');

    if (!stored) {
        return { ...DEFAULT_SETTINGS };
    }

    try {
        const parsed = JSON.parse(stored);
        
        // Migrate old focusSearchOnLoad setting to typeAnywhere
        if ('focusSearchOnLoad' in parsed && !('typeAnywhere' in parsed)) {
            parsed.typeAnywhere = parsed.focusSearchOnLoad;
            delete parsed.focusSearchOnLoad;
            // Save migrated settings
            localStorage.setItem('settings', JSON.stringify(parsed));
        }
        
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (error) {
        console.error('Error parsing settings:', error);
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(settings) {
    localStorage.setItem('settings', JSON.stringify(settings));
}

function updateSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    saveSettings(settings);
}

function updateSearchHintVisibility(show) {
    const searchHint = document.querySelector('.search-hint');
    const searchInput = document.getElementById('searchInput');
    if (searchHint && searchInput) {
        // Only show hint if setting is enabled AND input is empty AND no filter is active
        const shouldShow = show && searchInput.value.length === 0 && activeSearchFilterId === null;
        searchHint.style.display = shouldShow ? 'block' : 'none';
    }
}

function loadSettings() {
    const settings = getSettings();
    const typeAnywhereCheckbox = document.getElementById('typeAnywhere');
    const openLinksCheckbox = document.getElementById('openLinksNewTab');
    const showSearchHintCheckbox = document.getElementById('showSearchHint');
    const userNameInput = document.getElementById('userName');
    const faviconLoadModeSelect = document.getElementById('faviconLoadMode');

    if (typeAnywhereCheckbox) {
        typeAnywhereCheckbox.checked = settings.typeAnywhere !== false;
    }

    if (openLinksCheckbox) {
        openLinksCheckbox.checked = settings.openLinksNewTab === true;
    }

    if (showSearchHintCheckbox) {
        showSearchHintCheckbox.checked = settings.showSearchHint !== false;
        updateSearchHintVisibility(settings.showSearchHint !== false);
    }

    if (userNameInput) {
        userNameInput.value = settings.userName || '';
    }
    
    if (faviconLoadModeSelect) {
        faviconLoadModeSelect.value = settings.faviconLoadMode || 'delayed';
    }

    // Load blocked terms
    loadBlockedTerms();
}

function performSearch(query) {
    const searchEngine = getSettings().searchEngine || 'google';
    const searchUrl = getSearchUrl(searchEngine, query, getActiveSearchFilter());

    if (activeSearchFilterId) {
        // Clear the filter so subsequent new tabs start from the default state
        setActiveSearchFilter(null, { silent: true });
    }

    window.location.href = searchUrl;
}

function checkForBlockedTerms(query) {
    const settings = getSettings();
    const blockedTerms = settings.blockedTerms || [];
    const queryLower = query.toLowerCase();
    
    return blockedTerms.filter(term => {
        return queryLower.includes(term.toLowerCase());
    });
}

function showSearchWarning(query, blockedTerms) {
    const modal = document.getElementById('searchWarningModal');
    const termsList = document.getElementById('warningTermsList');
    
    // Clear and populate blocked terms found
    termsList.innerHTML = '';
    blockedTerms.forEach(term => {
        const tag = document.createElement('span');
        tag.className = 'warning-term-tag';
        tag.textContent = term;
        termsList.appendChild(tag);
    });
    
    // Store query for "Search Anyway" button
    modal.dataset.pendingQuery = query;
    
    openModal('searchWarningModal');
}

function addBlockedTerm(term) {
    const trimmedTerm = term.trim();
    if (!trimmedTerm) return false;
    
    const settings = getSettings();
    const blockedTerms = settings.blockedTerms || [];
    
    // Check if term already exists (case-insensitive)
    if (blockedTerms.some(t => t.toLowerCase() === trimmedTerm.toLowerCase())) {
        showToast('Term already blocked');
        return false;
    }
    
    blockedTerms.push(trimmedTerm);
    updateSetting('blockedTerms', blockedTerms);
    loadBlockedTerms();
    showToast(`Blocked "${trimmedTerm}"`);
    return true;
}

function removeBlockedTerm(term) {
    const settings = getSettings();
    const blockedTerms = settings.blockedTerms || [];
    const filtered = blockedTerms.filter(t => t !== term);
    
    updateSetting('blockedTerms', filtered);
    loadBlockedTerms();
    showToast(`Unblocked "${term}"`);
}

function loadBlockedTerms() {
    const settings = getSettings();
    const blockedTerms = settings.blockedTerms || [];
    const listContainer = document.getElementById('blockedTermsList');
    
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (blockedTerms.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'blocked-terms-empty';
        emptyMsg.textContent = 'No blocked terms yet';
        listContainer.appendChild(emptyMsg);
        return;
    }
    
    blockedTerms.forEach(term => {
        const item = document.createElement('div');
        item.className = 'blocked-term-item';
        
        const text = document.createElement('span');
        text.className = 'blocked-term-text';
        text.textContent = term;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'blocked-term-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove term';
        removeBtn.addEventListener('click', () => removeBlockedTerm(term));
        
        item.appendChild(text);
        item.appendChild(removeBtn);
        listContainer.appendChild(item);
    });
}

function getSearchUrl(engine, query, filter) {
    const resolvedEngine = engine || 'google';

    if (resolvedEngine === 'google') {
        const url = new URL('https://www.google.com/search');
        let finalQuery = query;

        if (filter) {
            if (filter.appendQuery) {
                finalQuery = `${finalQuery} ${filter.appendQuery}`.trim();
            }

            if (filter.googleParams) {
                Object.entries(filter.googleParams).forEach(([key, value]) => {
                    url.searchParams.set(key, value);
                });
            }
        }

        url.searchParams.set('q', finalQuery);
        return url.toString();
    }

    if (resolvedEngine === 'bing') {
        return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    }

    if (resolvedEngine === 'duckduckgo') {
        return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    }

    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// --- Theme Functions ---

function getTheme() {
    const stored = localStorage.getItem('theme');
    if (!stored) {
        return { ...DEFAULT_THEME };
    }

    try {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_THEME, ...parsed };
    } catch (error) {
        console.error('Error parsing theme settings:', error);
        return { ...DEFAULT_THEME };
    }
}

function saveTheme(theme) {
    localStorage.setItem('theme', JSON.stringify(theme));
}

function setTheme(mode) {
    const theme = getTheme();
    theme.mode = mode;
    saveTheme(theme);
    applyTheme();
    updateThemeUI();
    showToast(`Theme set to ${mode}`);
}

function setAccentColor(color) {
    const theme = getTheme();
    theme.accentColor = color;
    saveTheme(theme);
    applyTheme();
    updateThemeUI();
    showToast('Accent color updated');
}

function updateBackgroundImageOpacity(value) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    const theme = getTheme();
    if (theme.backgroundImageOpacity === clamped) {
        updateThemeUI();
        return;
    }

    theme.backgroundImageOpacity = clamped;
    saveTheme(theme);
    applyTheme();
    updateThemeUI();
}

function setBackground(background) {
    const theme = getTheme();
    theme.background = background;
    saveTheme(theme);
    applyTheme();
    updateThemeUI();
    
    // Get a friendly name for the toast
    let name = 'None';
    if (background === 'white') name = 'White';
    else if (background === 'black') name = 'Black';
    else if (background.includes('banannas')) name = 'Bananas';
    else if (background.includes('moon-beach')) name = 'Moon Beach';
    else if (background.includes('office')) name = 'Office';
    else if (background.includes('retro-airport')) name = 'Retro Airport';
    else if (background.includes('underwater-dome')) name = 'Underwater Dome';
    
    showToast(`Background set to ${name}`);
}

function applyTheme() {
    const theme = getTheme();
    let mode = theme.mode;
    
    // Handle auto theme
    if (mode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        mode = prefersDark ? 'dark' : 'light';
    }
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', mode);
    
    // Apply accent color
    const root = document.documentElement;
    root.style.setProperty('--accent-color', theme.accentColor);
    
    // Calculate hover color (slightly darker)
    const accentHover = adjustColor(theme.accentColor, -20);
    root.style.setProperty('--accent-hover', accentHover);
    
    // Calculate light colors
    const accentLight = hexToRgba(theme.accentColor, 0.1);
    const accentLighter = hexToRgba(theme.accentColor, 0.2);
    root.style.setProperty('--accent-light', accentLight);
    root.style.setProperty('--accent-lighter', accentLighter);
    
    // Apply background
    const body = document.body;
    const overlayStrength = 1 - ((theme.backgroundImageOpacity ?? DEFAULT_THEME.backgroundImageOpacity) / 100);
    const hasImageBackground = theme.background && !['none', 'white', 'black'].includes(theme.background);

    body.style.backgroundImage = '';
    body.style.backgroundColor = '';
    body.style.backgroundSize = '';
    body.style.backgroundPosition = '';
    body.style.backgroundRepeat = '';
    body.style.backgroundAttachment = '';

    if (!theme.background || theme.background === 'none') {
        // fall back to stylesheet defaults
        return;
    }

    if (theme.background === 'white' || theme.background === 'black') {
        body.style.backgroundColor = theme.background === 'white' ? '#ffffff' : '#000000';
        return;
    }

    if (hasImageBackground) {
        const layers = [];

        if (overlayStrength > 0) {
            const whiteAlpha = Math.min(1, overlayStrength * 0.6);
            const blackAlpha = Math.min(1, overlayStrength * 0.25);

            if (whiteAlpha > 0.001) {
                const alpha = whiteAlpha.toFixed(3);
                layers.push(`linear-gradient(rgba(255, 255, 255, ${alpha}), rgba(255, 255, 255, ${alpha}))`);
            }

            if (blackAlpha > 0.001) {
                const alpha = blackAlpha.toFixed(3);
                layers.push(`linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha}))`);
            }
        }

        layers.push(`url('${theme.background}')`);

        body.style.backgroundImage = layers.join(', ');
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundAttachment = 'fixed';
        return;
    }

    body.style.backgroundColor = theme.background;
}

// Helper function to adjust color brightness
function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Helper function to convert hex to rgba
function hexToRgba(hex, alpha) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = num >> 16;
    const g = (num >> 8) & 0x00FF;
    const b = num & 0x0000FF;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadTheme() {
    applyTheme();
    updateThemeUI();
    
    // Listen for system theme changes when in auto mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const theme = getTheme();
        if (theme.mode === 'auto') {
            applyTheme();
        }
    });
}

const GREETING_SEGMENTS = [
    {
        key: 'afterMidnight',
        start: 0,
        end: 1,
        messages: [
            "Midnight oil’s burning bright, {{name}}.",
            "You're either a genius or deeply unwell, {{name}}.",
            "Still up? The raccoons are your people, {{name}}.",
            "Midnight musings or just doomscrolling, {{name}}?",
            "Sleep is for mortals, {{name}}.",
            "That 2 AM clarity hitting early tonight, {{name}}."
        ]
    },
    {
        key: 'deepNight',
        start: 2,
        end: 3,
        messages: [
            "It’s suspiciously quiet, {{name}}…",
            "Only owls and coders awake right now, {{name}}.",
            "Time’s fake at this hour, {{name}}.",
            "You’ve entered the weird part of the internet, {{name}}.",
            "Even your shadow’s asleep, {{name}}.",
            "Are you coding, or plotting, {{name}}?"
        ]
    },
    {
        key: 'preDawn',
        start: 4,
        end: 5,
        messages: [
            "The sun’s still buffering, {{name}}.",
            "You’ve unlocked ‘pre-dawn’ mode, {{name}}.",
            "Only legends and bakers wake this early, {{name}}.",
            "This is the ‘quiet chaos’ hour, {{name}}.",
            "You're up before the birds even tweet, {{name}}."
        ]
    },
    {
        key: 'sunrise',
        start: 6,
        end: 7,
        messages: [
            "Sun’s clocked in, {{name}}!",
            "The world’s glowing, and so are you, {{name}}.",
            "Fresh start. Same coffee, {{name}}.",
            "Golden light. New day. Let’s go, {{name}}.",
            "Good morning, early achiever {{name}}.",
            "You beat the snooze button *and* the sun, {{name}}."
        ]
    },
    {
        key: 'morning',
        start: 8,
        end: 9,
        messages: [
            "Good morning, {{name}}!",
            "Fuel up, {{name}} — it’s chaos out there.",
            "Let’s get this bread, {{name}}.",
            "Today’s gonna be your day, {{name}} (probably).",
            "You look awake. Emotionally? Questionable, {{name}}."
        ]
    },
    {
        key: 'midMorning',
        start: 10,
        end: 11,
        messages: [
            "Double espresso time, {{name}}.",
            "Still morning somehow, {{name}}.",
            "You’re doing great. Or at least vertical, {{name}}.",
            "Morning meeting survivor, {{name}}.",
            "Brunch sounds good right about now, {{name}}."
        ]
    },
    {
        key: 'noon',
        start: 12,
        end: 12,
        messages: [
            "High noon, partner {{name}}.",
            "Lunch > life goals, {{name}}.",
            "Sun’s at its peak, motivation isn’t, {{name}}.",
            "Recharge and refuel, {{name}}.",
            "Halfway through the day, {{name}}. You’re winning."
        ]
    },
    {
        key: 'earlyAfternoon',
        start: 13,
        end: 14,
        messages: [
            "That post-lunch sleepiness is creeping in, {{name}}.",
            "Afternoon vibes: 80% chill, 20% chaos, {{name}}.",
            "Hydrate or diedrate, {{name}}.",
            "Don’t trust the clock — it’s lying, {{name}}.",
            "You’ve earned a snack, {{name}}."
        ]
    },
    {
        key: 'midAfternoon',
        start: 15,
        end: 16,
        messages: [
            "The 3PM slump approaches, {{name}}.",
            "Almost there, {{name}}. Eyes open.",
            "Grab water, stretch, survive, {{name}}.",
            "Half-asleep productivity mode activated, {{name}}.",
            "Coffee’s calling again, {{name}}."
        ]
    },
    {
        key: 'goldenHour',
        start: 17,
        end: 18,
        messages: [
            "Golden hour glow-up time, {{name}}.",
            "Sunset’s working overtime for you, {{name}}.",
            "The light’s perfect — take that selfie, {{name}}.",
            "Day’s almost done. You made it, {{name}}.",
            "Hope your evening’s as calm as this sky, {{name}}."
        ]
    },
    {
        key: 'evening',
        start: 19,
        end: 20,
        messages: [
            "Good evening, {{name}}.",
            "Dinner o’clock, {{name}}!",
            "Wrap up and wind down, {{name}}.",
            "You’ve survived another day, {{name}}.",
            "City lights and cozy vibes, {{name}}."
        ]
    },
    {
        key: 'lateEvening',
        start: 21,
        end: 22,
        messages: [
            "The day’s cooling off, {{name}}.",
            "Netflix or deep thoughts tonight, {{name}}?",
            "Late night, low light, max chill, {{name}}.",
            "The world’s slowing down, maybe you should too, {{name}}.",
            "Perfect hour for bad ideas, {{name}}."
        ]
    },
    {
        key: 'midnight',
        start: 23,
        end: 23,
        messages: [
            "It’s technically tomorrow, {{name}}.",
            "New day unlocked — go back to bed, {{name}}.",
            "Midnight thoughts loading… {{name}}.",
            "Still online? Dedication or chaos, {{name}}?",
            "The night’s yours, {{name}}."
        ]
    },
    {
        key: 'weekendMorning',
        start: 8,
        end: 10,
        messages: [
            "Weekend mornings hit different, {{name}}.",
            "No alarms, no rules, {{name}}.",
            "Sleep in? Nah, you’re here — hi {{name}}.",
            "Pancake time, {{name}}.",
            "Take it easy, {{name}} — you earned it."
        ]
    },
    {
        key: 'weekendAfternoon',
        start: 12,
        end: 17,
        messages: [
            "Weekend mode fully activated, {{name}}.",
            "No responsibilities, only vibes, {{name}}.",
            "Sunshine, snacks, serenity, {{name}}.",
            "Treat yourself day, {{name}}.",
            "Time’s fake — live it up, {{name}}."
        ]
    },
    {
        key: 'napZone',
        start: 14,
        end: 15,
        messages: [
            "Prime nap window detected, {{name}}.",
            "Close your eyes for ‘just five minutes’, {{name}}.",
            "Dreams waiting for you, {{name}}.",
            "Nap time is self-care, {{name}}.",
            "Productivity paused, {{name}}."
        ]
    },
    {
        key: 'midSnack',
        start: 22,
        end: 23,
        messages: [
            "Late-night munchies approaching, {{name}}.",
            "Fridge raid protocol activated, {{name}}.",
            "Midnight snacks count as self-care, {{name}}.",
            "Kitchen’s calling your name, {{name}}.",
            "Calories don’t exist after 10PM, {{name}}."
        ]
    },
    {
        key: 'existentialZone',
        start: 3,
        end: 4,
        messages: [
            "The universe is vast, {{name}}. And you’re awake.",
            "You’re thinking about life again, huh {{name}}?",
            "Philosopher hours begin, {{name}}.",
            "Stars out, thoughts loud, {{name}}.",
            "Reality feels optional at this time, {{name}}."
        ]
    }
];


let currentGreetingState = {
    segment: null,
    template: null,
    name: ''
};

let lastGreetingMinute = null;
let clockIntervalId = null;

function initializeGreeting() {
    updateGreeting(true);
}

function startClock() {
    updateClock();

    if (clockIntervalId) {
        clearInterval(clockIntervalId);
    }

    clockIntervalId = setInterval(updateClock, 1000);
}

function updateClock() {
    const clockDisplay = document.getElementById('clock');
    if (!clockDisplay) return;

    const now = new Date();
    clockDisplay.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if (lastGreetingMinute !== now.getMinutes()) {
        lastGreetingMinute = now.getMinutes();
        updateGreeting();
    }
}

function updateGreeting(force = false) {
    const greetingElement = document.getElementById('greeting');
    if (!greetingElement) return;

    const now = new Date();
    const activeSegment = getGreetingSegment(now.getHours());
    const settings = getSettings();
    const name = (settings.userName || '').trim();

    let templateToUse = currentGreetingState.template;

    if (
        force ||
        !templateToUse ||
        currentGreetingState.segment !== activeSegment.key ||
        currentGreetingState.name !== name
    ) {
        templateToUse = pickGreetingTemplate(activeSegment.messages, currentGreetingState.template);
    }

    const message = formatGreeting(templateToUse, name);

    if (greetingElement.textContent !== message) {
        greetingElement.textContent = message;
    }

    currentGreetingState = {
        segment: activeSegment.key,
        template: templateToUse,
        name
    };
}

function getGreetingSegment(hour) {
    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay());

    // Try weekend-specific greetings first
    const weekendSegment = GREETING_SEGMENTS.find(
        segment => isWeekend && segment.key.startsWith('weekend') && hour >= segment.start && hour <= segment.end
    );
    if (weekendSegment) return weekendSegment;

    // Then try weekday-based or time-based
    const segment = GREETING_SEGMENTS.find(segment => hour >= segment.start && hour <= segment.end);
    return segment || GREETING_SEGMENTS[0];
}


function pickGreetingTemplate(messages, previousTemplate) {
    if (!messages || messages.length === 0) {
        return 'Hello{{name}}';
    }

    if (messages.length === 1) {
        return messages[0];
    }

    let template = messages[Math.floor(Math.random() * messages.length)];

    if (previousTemplate && messages.length > 1 && template === previousTemplate) {
        const alternatives = messages.filter(msg => msg !== previousTemplate);
        if (alternatives.length > 0) {
            template = alternatives[Math.floor(Math.random() * alternatives.length)];
        }
    }

    return template;
}

function formatGreeting(template, name) {
    if (!template) {
        return name ? `Hello, ${name}.` : 'Hello.';
    }

    if (name) {
        return template.replace(/{{name}}/g, name);
    }

    let result = template;
    result = result.replace(/\s*,\s*{{name}}/g, '');
    result = result.replace(/\s*{{name}}/g, '');
    result = result.replace(/{{name}}/g, '');
    result = result.replace(/\s{2,}/g, ' ');
    result = result.replace(/\s+([!?.,])/g, '$1');
    return result.trim();
}

function updateThemeUI() {
    const theme = getTheme();
    
    // Update theme buttons
    document.querySelectorAll('.theme-option').forEach(btn => {
        const btnTheme = btn.getAttribute('data-theme');
        if (btnTheme === theme.mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update color buttons
    document.querySelectorAll('.color-option').forEach(btn => {
        const btnColor = btn.getAttribute('data-color');
        if (btnColor === theme.accentColor) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update background buttons
    document.querySelectorAll('.background-option').forEach(btn => {
        const btnBackground = btn.getAttribute('data-background');
        if (btnBackground === theme.background) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const backgroundOpacitySlider = document.getElementById('backgroundImageOpacity');
    const backgroundOpacityValue = document.getElementById('backgroundImageOpacityValue');
    const backgroundOpacityLabel = document.querySelector('.theme-slider .slider-label');
    const sliderValue = theme.backgroundImageOpacity ?? DEFAULT_THEME.backgroundImageOpacity;
    const hasImageBackground = theme.background && !['none', 'white', 'black'].includes(theme.background);

    if (backgroundOpacitySlider) {
        backgroundOpacitySlider.value = String(sliderValue);
        backgroundOpacitySlider.disabled = !hasImageBackground;
    }

    if (backgroundOpacityValue) {
        backgroundOpacityValue.textContent = hasImageBackground ? `${sliderValue}%` : 'N/A';
    }

    if (backgroundOpacityLabel) {
        backgroundOpacityLabel.classList.toggle('disabled', !hasImageBackground);
    }
}


// --- Quick Links Functions ---

// Initialize icon picker
function initializeIconPicker() {
    const iconPicker = document.getElementById('iconPicker');
    
    // Create favicon slot (top-left, initially in loading state)
    const faviconSlot = document.createElement('div');
    faviconSlot.className = 'icon-option favicon-slot loading';
    faviconSlot.id = 'faviconSlot';
    faviconSlot.title = 'Favicon (fetched from URL)';
    
    const faviconImg = document.createElement('img');
    faviconImg.id = 'faviconPreview';
    faviconImg.alt = 'Favicon';
    faviconSlot.appendChild(faviconImg);
    
    faviconSlot.addEventListener('click', () => {
        if (fetchedFavicon) {
            selectIcon(faviconSlot, fetchedFavicon);
        }
    });
    
    iconPicker.appendChild(faviconSlot);
    
    // Create custom icon options
    CUSTOM_ICONS.forEach(iconFile => {
        const iconOption = document.createElement('div');
        iconOption.className = 'icon-option';
        iconOption.title = iconFile.replace('.svg', '').replace(/-/g, ' ');
        
        const img = document.createElement('img');
        img.src = `public/link-icons/${iconFile}`;
        img.alt = iconFile;
        
        iconOption.appendChild(img);
        iconOption.addEventListener('click', () => {
            selectIcon(iconOption, `public/link-icons/${iconFile}`);
        });
        
        iconPicker.appendChild(iconOption);
    });
}

// Update favicon in picker when URL is entered
async function updateFaviconInPicker(url) {
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        normalizedUrl = 'https://' + url;
    }
    
    const faviconSlot = document.getElementById('faviconSlot');
    const faviconPreview = document.getElementById('faviconPreview');
    
    // Show loading state
    faviconSlot.classList.add('loading');
    faviconSlot.classList.remove('has-favicon', 'waiting');
    faviconPreview.src = '';
    
    try {
        const faviconUrl = await getFavicon(normalizedUrl);
        fetchedFavicon = faviconUrl;
        
        faviconPreview.src = faviconUrl;
        faviconSlot.classList.remove('loading', 'waiting');
        faviconSlot.classList.add('has-favicon');
        
        // Auto-select the favicon
        selectIcon(faviconSlot, faviconUrl);
        
        // Validate form after fetching favicon
        const linkForm = document.getElementById('linkForm');
        if (linkForm) {
            const linkTitleInput = document.getElementById('linkTitle');
            const linkUrlInput = document.getElementById('linkUrl');
            const submitBtn = linkForm.querySelector('button[type="submit"]');
            const title = linkTitleInput.value.trim();
            const urlValue = linkUrlInput.value.trim();
            const hasIcon = selectedIcon !== null;
            const isValid = title && urlValue && (hasIcon || fetchedFavicon);
            submitBtn.disabled = !isValid;
        }
    } catch (error) {
        console.error('Error fetching favicon:', error);
        faviconSlot.classList.remove('loading', 'waiting');
    }
}

// Set favicon slot to waiting state
function setFaviconWaiting() {
    const faviconSlot = document.getElementById('faviconSlot');
    const faviconPreview = document.getElementById('faviconPreview');
    
    if (faviconSlot && !faviconSlot.classList.contains('has-favicon')) {
        faviconSlot.classList.add('waiting');
        faviconSlot.classList.remove('loading', 'has-favicon');
        faviconPreview.src = '';
    }
}

// Reset favicon slot
function resetFaviconSlot() {
    const faviconSlot = document.getElementById('faviconSlot');
    const faviconPreview = document.getElementById('faviconPreview');
    
    if (faviconSlot) {
        faviconSlot.classList.remove('has-favicon', 'loading', 'waiting');
        faviconPreview.src = '';
        fetchedFavicon = null;
    }
}

// Check URL and show suggestion if it has a path
function checkAndShowUrlSuggestion(url) {
    const urlSuggestion = document.getElementById('urlSuggestion');
    const urlSuggestionBtn = document.getElementById('urlSuggestionBtn');
    
    if (!urlSuggestion || !urlSuggestionBtn) return;
    
    try {
        // Normalize URL
        let normalizedUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            normalizedUrl = 'https://' + url;
        }
        
        const urlObj = new URL(normalizedUrl);
        const hasPath = urlObj.pathname !== '/' || urlObj.search || urlObj.hash;
        
        if (hasPath) {
            // Extract base URL
            const baseUrl = urlObj.hostname;
            urlSuggestionBtn.textContent = baseUrl;
            urlSuggestion.style.display = 'flex';
        } else {
            urlSuggestion.style.display = 'none';
        }
    } catch (error) {
        // Invalid URL, hide suggestion
        urlSuggestion.style.display = 'none';
    }
}

// Select an icon
function selectIcon(element, iconPath) {
    // Remove selection from all options
    document.querySelectorAll('.icon-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selection to clicked option
    element.classList.add('selected');
    selectedIcon = iconPath;
    
    // Validate form after selecting icon
    const linkForm = document.getElementById('linkForm');
    if (linkForm) {
        const linkTitleInput = document.getElementById('linkTitle');
        const linkUrlInput = document.getElementById('linkUrl');
        const submitBtn = linkForm.querySelector('button[type="submit"]');
        const title = linkTitleInput.value.trim();
        const url = linkUrlInput.value.trim();
        const hasIcon = selectedIcon !== null;
        const isValid = title && url && (hasIcon || fetchedFavicon);
        submitBtn.disabled = !isValid;
    }
}

// Open modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.add('show');
    
    // Special handling for link modal
    if (modalId === 'linkModal') {
        const linkForm = document.getElementById('linkForm');
        
        // Reset form if not editing
        if (!linkForm.dataset.editingId) {
            linkForm.reset();
            
            // Reset modal title and button text
            const modalTitle = document.querySelector('#linkModal .modal-header h3');
            const submitBtn = linkForm.querySelector('button[type="submit"]');
            modalTitle.textContent = 'Add New Link';
            submitBtn.textContent = 'Add Link';
            submitBtn.disabled = true; // Disable button initially
            
            // Reset icon selection
            selectedIcon = null;
            fetchedFavicon = null;
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.remove('selected', 'active');
            });
            
            // Reset favicon slot to default state with blinking cursor
            const faviconSlot = document.getElementById('faviconSlot');
            if (faviconSlot) {
                faviconSlot.classList.remove('has-favicon', 'loading', 'waiting');
                const faviconPreview = document.getElementById('faviconPreview');
                if (faviconPreview) {
                    faviconPreview.src = '';
                }
            }
            
            // Hide URL suggestion
            const urlSuggestion = document.getElementById('urlSuggestion');
            if (urlSuggestion) {
                urlSuggestion.style.display = 'none';
            }
        }
        
        document.getElementById('linkTitle').focus();
    }
    
    // Special handling for saved links modal
    if (modalId === 'savedLinksModal') {
        loadSavedLinks();
        // Focus on input field
        const savedLinkUrlInput = document.getElementById('savedLinkUrl');
        if (savedLinkUrlInput) {
            savedLinkUrlInput.focus();
        }
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('show');
    
    // Special handling for link modal
    if (modalId === 'linkModal') {
        const linkForm = document.getElementById('linkForm');
        if (linkForm) {
            linkForm.reset();
            // Clear editing state
            delete linkForm.dataset.editingId;
        }
        
        // Reset modal title and button text
        const modalTitle = document.querySelector('#linkModal .modal-header h3');
        const submitBtn = linkForm.querySelector('button[type="submit"]');
        if (modalTitle) modalTitle.textContent = 'Add New Link';
        if (submitBtn) submitBtn.textContent = 'Add Link';
        
        // Reset icon selection
        selectedIcon = null;
        fetchedFavicon = null;
        document.querySelectorAll('.icon-option').forEach(opt => {
            opt.classList.remove('selected', 'active');
        });
        
        const faviconSlot = document.getElementById('faviconSlot');
        if (faviconSlot) {
            faviconSlot.classList.remove('has-favicon', 'loading', 'waiting');
            const faviconPreview = document.getElementById('faviconPreview');
            if (faviconPreview) {
                faviconPreview.src = '';
            }
        }
        
        // Hide URL suggestion
        const urlSuggestion = document.getElementById('urlSuggestion');
        if (urlSuggestion) {
            urlSuggestion.style.display = 'none';
        }
    }
}

// Add a new quick link
async function addQuickLink() {
    const title = document.getElementById('linkTitle').value.trim();
    const url = document.getElementById('linkUrl').value.trim();
    const linkForm = document.getElementById('linkForm');
    const editingId = linkForm.dataset.editingId;

    if (!title || !url) return;

    // Normalize URL
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        normalizedUrl = 'https://' + url;
    }

    // Show loading state
    const submitBtn = document.querySelector('#linkForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = editingId ? 'Updating...' : 'Adding...';
    submitBtn.disabled = true;

    // If no icon selected, fetch favicon as fallback
    let iconToUse = selectedIcon;
    if (!iconToUse) {
        iconToUse = await getFavicon(normalizedUrl);
    }

    // Get existing links
    const links = getQuickLinks();

    if (editingId) {
        // Update existing link
        const linkIndex = links.findIndex(link => link.id === editingId);
        if (linkIndex !== -1) {
            links[linkIndex] = {
                id: editingId,
                title,
                url: normalizedUrl,
                favicon: iconToUse
            };
        }
        delete linkForm.dataset.editingId;
    } else {
        // Create new link object
        const link = {
            id: Date.now().toString(),
            title,
            url: normalizedUrl,
            favicon: iconToUse
        };
        links.push(link);
    }

    // Save to storage
    saveQuickLinks(links);

    // Reload display
    loadQuickLinks();

    // Reset button
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    // Close modal
    closeModal('linkModal');
}

// Fetch favicon for a URL
async function getFavicon(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        // Use multiple favicon sources, but don't try to cache as data URL
        // because of CORS restrictions - just store the URL
        const faviconSources = [
            `https://www.google.com/s2/favicons?sz=64&domain=${domain}`,
            `https://icon.horse/icon/${domain}`,
            `https://www.google.com/s2/favicons?sz=32&domain=${domain}`,
            `${urlObj.origin}/favicon.ico`
        ];

        // Return the primary favicon URL directly
        // The browser will handle loading it without CORS issues
        return faviconSources[0];
    } catch (error) {
        console.error('Error generating favicon URL:', error);
        // Return a default icon (globe emoji as fallback)
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🌐</text></svg>';
    }
}

// Get quick links from storage
function getQuickLinks() {
    const stored = localStorage.getItem('quickLinks');
    return stored ? JSON.parse(stored) : [];
}

// Save quick links to storage
function saveQuickLinks(links) {
    localStorage.setItem('quickLinks', JSON.stringify(links));
}

// Load and display quick links
function loadQuickLinks() {
    const links = getQuickLinks();
    const container = document.getElementById('quickLinksContainer');
    
    // Clear container
    container.innerHTML = '';

    // Add each link
    links.forEach(link => {
        const linkElement = createQuickLinkElement(link);
        container.appendChild(linkElement);
    });

    attachQuickLinkDragHandlers(container);
}

// Create a quick link element
function createQuickLinkElement(link) {
    const settings = getSettings();
    
    const linkEl = document.createElement('a');
    linkEl.className = 'quick-link';
    linkEl.href = link.url;
    linkEl.dataset.linkId = link.id;
    linkEl.setAttribute('draggable', 'true');
    
    if (settings.openLinksNewTab !== false) {
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
    }

    const favicon = document.createElement('img');
    favicon.className = 'quick-link-favicon';
    favicon.src = link.favicon;
    favicon.alt = link.title;
    
    // Fallback chain if favicon fails to load
    let fallbackAttempt = 0;
    favicon.onerror = () => {
        fallbackAttempt++;
        try {
            const urlObj = new URL(link.url);
            const domain = urlObj.hostname;
            
            if (fallbackAttempt === 1) {
                // Try icon.horse as first fallback
                favicon.src = `https://icon.horse/icon/${domain}`;
            } else if (fallbackAttempt === 2) {
                // Try smaller Google favicon
                favicon.src = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
            } else if (fallbackAttempt === 3) {
                // Try direct favicon.ico
                favicon.src = `${urlObj.origin}/favicon.ico`;
            } else {
                // Final fallback: globe emoji
                favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🌐</text></svg>';
            }
        } catch (e) {
            favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🌐</text></svg>';
        }
    };

    const title = document.createElement('div');
    title.className = 'quick-link-title';
    title.textContent = link.title;

    // Add right-click context menu
    linkEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showQuickLinkContextMenu(e, link);
    });

    linkEl.addEventListener('dragstart', handleQuickLinkDragStart);
    linkEl.addEventListener('dragenter', handleQuickLinkDragEnter);
    linkEl.addEventListener('dragover', handleQuickLinkDragOverItem);
    linkEl.addEventListener('dragleave', handleQuickLinkDragLeave);
    linkEl.addEventListener('drop', handleQuickLinkDropOnItem);
    linkEl.addEventListener('dragend', handleQuickLinkDragEnd);

    linkEl.appendChild(favicon);
    linkEl.appendChild(title);

    return linkEl;
}

function attachQuickLinkDragHandlers(container) {
    if (!container) {
        return;
    }

    if (!quickLinkContainerListenersAttached) {
        container.addEventListener('dragover', handleQuickLinksContainerDragOver);
        container.addEventListener('drop', handleQuickLinksContainerDrop);
        quickLinkContainerListenersAttached = true;
    }
}

function handleQuickLinkDragStart(event) {
    const target = event.currentTarget;
    draggedQuickLinkId = target.dataset.linkId || null;
    draggedQuickLinkElement = target;
    target.classList.add('dragging');

    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedQuickLinkId || '');
    }
}

function handleQuickLinkDragEnter(event) {
    if (!draggedQuickLinkId || !draggedQuickLinkElement) {
        return;
    }

    const target = event.currentTarget;
    if (target.dataset.linkId === draggedQuickLinkId) {
        return;
    }

    // Immediately reorder in DOM for smooth animation
    const container = target.parentElement;
    if (!container || !container.contains(draggedQuickLinkElement)) {
        return;
    }

    const allLinks = Array.from(container.querySelectorAll('.quick-link'));
    const draggedIndex = allLinks.indexOf(draggedQuickLinkElement);
    const targetIndex = allLinks.indexOf(target);

    if (draggedIndex === -1 || targetIndex === -1) {
        return;
    }

    // Insert before or after based on direction
    if (draggedIndex < targetIndex) {
        container.insertBefore(draggedQuickLinkElement, target.nextSibling);
    } else {
        container.insertBefore(draggedQuickLinkElement, target);
    }
}

function handleQuickLinkDragOverItem(event) {
    if (!draggedQuickLinkId) {
        return;
    }

    const target = event.currentTarget;
    if (target.dataset.linkId === draggedQuickLinkId) {
        return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
}

function handleQuickLinkDragLeave(event) {
    // No need to show drag-over state since we're repositioning live
}

function handleQuickLinkDropOnItem(event) {
    if (!draggedQuickLinkId) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const container = event.currentTarget.parentElement;
    if (!container) {
        return;
    }

    persistQuickLinkOrder(container);
}

function handleQuickLinksContainerDragOver(event) {
    if (!draggedQuickLinkId) {
        return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
}

function handleQuickLinksContainerDrop(event) {
    if (!draggedQuickLinkId) {
        return;
    }

    event.preventDefault();

    const container = event.currentTarget;
    persistQuickLinkOrder(container);
}

function performQuickLinkDrop(container, referenceElement, event) {
    // This function is no longer needed with live reordering
    // Keeping for potential future use
}

function findClosestQuickLink(container, x, y) {
    // No longer needed with live reordering
    // Keeping for potential future use
}

function persistQuickLinkOrder(container) {
    const orderedIds = Array.from(container.querySelectorAll('.quick-link'))
        .map((element) => element.dataset.linkId)
        .filter(Boolean);

    const existingLinks = getQuickLinks();
    const linkById = new Map(existingLinks.map((link) => [link.id, link]));
    const reorderedLinks = orderedIds
        .map((id) => linkById.get(id))
        .filter(Boolean);

    if (reorderedLinks.length !== existingLinks.length) {
        resetQuickLinkDragState();
        loadQuickLinks();
        return;
    }

    saveQuickLinks(reorderedLinks);
    resetQuickLinkDragState();
}

function handleQuickLinkDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    event.currentTarget.classList.remove('drag-over');
    resetQuickLinkDragState();
}

function resetQuickLinkDragState() {
    draggedQuickLinkId = null;
    draggedQuickLinkElement = null;

    const container = document.getElementById('quickLinksContainer');
    if (!container) {
        return;
    }

    container.querySelectorAll('.quick-link.drag-over').forEach((element) => {
        element.classList.remove('drag-over');
    });
}

// Show context menu for quick link
function showQuickLinkContextMenu(e, link) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.quick-link-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'quick-link-context-menu';
    
    // Edit option
    const editOption = document.createElement('div');
    editOption.className = 'context-menu-item';
    const editIcon = document.createElement('img');
    editIcon.src = 'public/icons/pencil-simple.svg';
    editIcon.className = 'context-menu-icon';
    const editText = document.createElement('span');
    editText.textContent = 'Edit';
    editOption.appendChild(editIcon);
    editOption.appendChild(editText);
    editOption.addEventListener('click', () => {
        editQuickLink(link);
        menu.remove();
    });
    
    // Delete option
    const deleteOption = document.createElement('div');
    deleteOption.className = 'context-menu-item context-menu-item-danger';
    const deleteIcon = document.createElement('img');
    deleteIcon.src = 'public/icons/trash.svg';
    deleteIcon.className = 'context-menu-icon';
    const deleteText = document.createElement('span');
    deleteText.textContent = 'Delete';
    deleteOption.appendChild(deleteIcon);
    deleteOption.appendChild(deleteText);
    deleteOption.addEventListener('click', () => {
        deleteQuickLink(link.id);
        menu.remove();
    });
    
    menu.appendChild(editOption);
    menu.appendChild(deleteOption);
    
    // Position the menu
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    document.body.appendChild(menu);
    
    // Close menu when clicking anywhere else
    const closeMenu = (event) => {
        if (!menu.contains(event.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('contextmenu', closeMenu);
        }
    };
    
    // Delay adding the click listener to prevent immediate close
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('contextmenu', closeMenu);
    }, 10);
}

// Edit a quick link
function editQuickLink(link) {
    // Pre-fill the form with existing link data
    document.getElementById('linkTitle').value = link.title;
    document.getElementById('linkUrl').value = link.url;
    
    // Update the favicon in the picker
    fetchedFavicon = link.favicon;
    const faviconSlot = document.getElementById('faviconSlot');
    const faviconPreview = document.getElementById('faviconPreview');
    faviconPreview.src = link.favicon;
    faviconSlot.classList.remove('loading');
    faviconSlot.classList.add('has-favicon');
    
    // Auto-select the favicon
    selectIcon(faviconSlot, link.favicon);
    
    // Update form submission to edit instead of add
    const linkForm = document.getElementById('linkForm');
    const submitBtn = linkForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Link';
    
    // Store the link ID for updating
    linkForm.dataset.editingId = link.id;
    
    // Update modal title
    const modalTitle = document.querySelector('#linkModal .modal-header h3');
    modalTitle.textContent = 'Edit Link';
    
    openModal('linkModal');
}

// Delete a quick link
function deleteQuickLink(id) {
    if (confirm('Are you sure you want to delete this link?')) {
        const links = getQuickLinks();
        const filtered = links.filter(link => link.id !== id);
        saveQuickLinks(filtered);
        loadQuickLinks();
    }
}

// --- Toast Notification ---

let toastTimeout;

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // Auto-hide after duration
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// --- Saved Links for Later ---

function getSavedLinks() {
    const stored = localStorage.getItem('savedLinks');
    return stored ? JSON.parse(stored) : [];
}

function setSavedLinks(links) {
    localStorage.setItem('savedLinks', JSON.stringify(links));
}

function saveLinkForLater(url) {
    // Validate URL
    if (!isValidUrl(url)) {
        // Try adding https:// if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        // Validate again
        if (!isValidUrl(url)) {
            showToast('Please enter a valid URL');
            return;
        }
    }
    
    const savedLinks = getSavedLinks();
    
    // Check if link already exists
    if (savedLinks.some(link => link.url === url)) {
        showToast('Link already saved');
        return;
    }
    
    // Create new saved link
    const newLink = {
        id: Date.now().toString(),
        url: url,
        title: extractDomain(url),
        savedAt: new Date().toISOString()
    };
    
    // Fetch favicon and title
    fetchLinkMetadata(newLink);
    
    // Add to beginning of array
    savedLinks.unshift(newLink);
    setSavedLinks(savedLinks);
    
    // Reload the list
    loadSavedLinks();
    
    showToast('Link saved');
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

function fetchLinkMetadata(link) {
    // Try to fetch the page title and favicon
    fetch(link.url)
        .then(response => response.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const title = doc.querySelector('title')?.textContent || extractDomain(link.url);
            
            // Update the link with the fetched title
            const savedLinks = getSavedLinks();
            const linkToUpdate = savedLinks.find(l => l.id === link.id);
            if (linkToUpdate) {
                linkToUpdate.title = title;
                setSavedLinks(savedLinks);
                loadSavedLinks();
            }
        })
        .catch(() => {
            // If fetch fails, just use the domain name
        });
}

function loadSavedLinks() {
    const savedLinks = getSavedLinks();
    const savedLinksList = document.getElementById('savedLinksList');
    const savedLinksEmpty = document.getElementById('savedLinksEmpty');
    
    if (!savedLinksList || !savedLinksEmpty) return;
    
    // Clear existing list
    savedLinksList.innerHTML = '';
    
    if (savedLinks.length === 0) {
        savedLinksEmpty.classList.add('show');
        savedLinksList.style.display = 'none';
    } else {
        savedLinksEmpty.classList.remove('show');
        savedLinksList.style.display = 'flex';
        
        savedLinks.forEach(link => {
            const linkItem = createSavedLinkItem(link);
            savedLinksList.appendChild(linkItem);
        });
    }
}

function createSavedLinkItem(link) {
    const item = document.createElement('div');
    item.className = 'saved-link-item';
    
    // Get favicon URL
    const faviconUrl = getFaviconUrl(link.url);
    const displayTitle = escapeHtml(getSavedLinkDisplayTitle(link));
    const displayUrl = escapeHtml(link.url);
    const timeAgoText = formatSavedLinkTimeAgo(link.savedAt);
    
    item.innerHTML = `
        <img src="${faviconUrl}" alt="" class="saved-link-favicon" onerror="this.src='public/icons/globe-hemisphere-west.svg'" />
        <div class="saved-link-info">
            <div class="saved-link-title">${displayTitle}</div>
            <div class="saved-link-url">${displayUrl}</div>
            <div class="saved-link-meta">${escapeHtml(timeAgoText)}</div>
        </div>
        <div class="saved-link-actions">
            <button class="saved-link-action-btn delete-btn" title="Delete">
                <img src="public/icons/trash.svg" alt="Delete" />
            </button>
        </div>
    `;
    
    // Click on item to open
    item.addEventListener('click', (e) => {
        if (!e.target.closest('.saved-link-actions')) {
            openSavedLink(link);
        }
    });
    
    // Delete button
    const deleteBtn = item.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSavedLink(link.id);
    });
    
    return item;
}

function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
        return 'public/icons/globe-hemisphere-west.svg';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getSavedLinkDisplayTitle(link) {
    const rawTitle = sanitizeSavedLinkTitle(link?.title);
    const fallbackName = deriveSiteNameFromUrl(link?.url || '');

    if (rawTitle && !isDomainLikeTitle(rawTitle, link?.url || '', fallbackName)) {
        return rawTitle;
    }

    return fallbackName;
}

function formatSavedLinkTimeAgo(savedAt) {
    if (!savedAt) {
        return 'Saved just now';
    }

    const savedDate = new Date(savedAt);
    if (Number.isNaN(savedDate.getTime())) {
        return 'Saved just now';
    }

    const diffInSeconds = Math.max(0, Math.floor((Date.now() - savedDate.getTime()) / 1000));
    const intervals = [
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 }
    ];

    for (const { label, seconds } of intervals) {
        const value = Math.floor(diffInSeconds / seconds);
        if (value >= 1) {
            const suffix = value === 1 ? label : `${label}s`;
            return `Saved ${value} ${suffix} ago`;
        }
    }

    return 'Saved just now';
}

function sanitizeSavedLinkTitle(title) {
    return (title || '').replace(/\s+/g, ' ').trim();
}

function isDomainLikeTitle(title, url, fallbackName) {
    const normalizedTitle = normalizeComparableValue(title);
    const normalizedDomain = normalizeComparableValue(extractDomain(url));
    const normalizedFallback = normalizeComparableValue(fallbackName);
    const normalizedUrl = normalizeComparableValue(url);

    return normalizedTitle === normalizedDomain ||
        (normalizedFallback && normalizedTitle === normalizedFallback) ||
        (normalizedUrl && normalizedTitle === normalizedUrl);
}

function normalizeComparableValue(value) {
    return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function deriveSiteNameFromUrl(url) {
    try {
        const { hostname } = new URL(url);
        if (!hostname) {
            return url || 'Unknown site';
        }

        const trimmed = hostname.replace(/^www\./i, '');
        if (!trimmed) {
            return 'Unknown site';
        }

        const segments = trimmed.split('.').filter(Boolean);
        if (segments.length === 0) {
            return 'Unknown site';
        }

        const core = extractPrimaryDomainSegment(segments);
        const words = core.split(/[-_]+/).filter(Boolean);

        const readable = words
            .map(segment => segment.toUpperCase() === segment
                ? segment
                : segment.charAt(0).toUpperCase() + segment.slice(1))
            .join(' ');

        return readable || core || trimmed;
    } catch (error) {
        console.warn('Unable to derive site name from URL', url, error);
        return url || 'Unknown site';
    }
}

const GENERIC_SECOND_LEVEL_DOMAINS = new Set([
    'ac', 'co', 'com', 'edu', 'gov', 'ltd', 'me', 'net', 'org', 'plc'
]);

function extractPrimaryDomainSegment(segments) {
    if (segments.length === 1) {
        return segments[0];
    }

    const last = segments[segments.length - 1];
    const secondLast = segments[segments.length - 2];

    if (GENERIC_SECOND_LEVEL_DOMAINS.has(secondLast.toLowerCase())) {
        return segments[segments.length - 3] || secondLast;
    }

    return secondLast;
}

function openSavedLink(link) {
    // Open the link
    const settings = getSettings();
    if (settings.openLinksNewTab) {
        window.open(link.url, '_blank');
    } else {
        window.location.href = link.url;
    }
    
    // Note: We don't remove the link automatically anymore
    // Users can manually delete links they no longer need
}

function deleteSavedLink(id, silent = false) {
    const savedLinks = getSavedLinks();
    const filtered = savedLinks.filter(link => link.id !== id);
    setSavedLinks(filtered);
    loadSavedLinks();
    
    if (!silent) {
        showToast('Link deleted');
    }
}

function getSettings() {
    const stored = localStorage.getItem('settings');
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
}

