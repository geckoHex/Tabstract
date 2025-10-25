// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadQuickLinks();
    initializeIconPicker();
    loadSettings();
    loadTheme();
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

let selectedIcon = null; // Will store either favicon URL or custom icon path
let fetchedFavicon = null; // Stores the fetched favicon URL

// Set up event listeners
function setupEventListeners() {
    // Search form
    const searchForm = document.getElementById('searchForm');
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('searchInput').value;
        if (query) {
            const searchEngine = getSettings().searchEngine || 'google';
            const searchUrl = getSearchUrl(searchEngine, query);
            window.location.href = searchUrl;
        }
    });

    // Island buttons
    const newLinkBtn = document.getElementById('newLinkBtn');
    const themeBtn = document.getElementById('themeBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    newLinkBtn.addEventListener('click', () => openModal('linkModal'));
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
    linkUrlInput.addEventListener('blur', async () => {
        const url = linkUrlInput.value.trim();
        if (url) {
            await updateFaviconInPicker(url);
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

    // Settings
    const searchEngineSelect = document.getElementById('searchEngine');
    const focusSearchCheckbox = document.getElementById('focusSearchOnLoad');
    const openLinksCheckbox = document.getElementById('openLinksNewTab');

    searchEngineSelect.addEventListener('change', (e) => {
        updateSetting('searchEngine', e.target.value);
        showToast(`Search engine set to ${e.target.value}`);
    });

    focusSearchCheckbox.addEventListener('change', (e) => {
        updateSetting('focusSearchOnLoad', e.target.checked);
        showToast(e.target.checked ? 'Auto-focus enabled' : 'Auto-focus disabled');
    });

    openLinksCheckbox.addEventListener('change', (e) => {
        updateSetting('openLinksNewTab', e.target.checked);
        showToast(e.target.checked ? 'Links open in new tab' : 'Links open in same tab');
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key closes any open modal
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });
}

// Focus search input on startup
window.addEventListener('load', () => {
    const settings = getSettings();
    if (settings.focusSearchOnLoad !== false) {
        document.getElementById('searchInput').focus();
    }
});

// --- Settings Functions ---

function getSettings() {
    const stored = localStorage.getItem('settings');
    return stored ? JSON.parse(stored) : {
        searchEngine: 'google',
        focusSearchOnLoad: true,
        openLinksNewTab: true
    };
}

function saveSettings(settings) {
    localStorage.setItem('settings', JSON.stringify(settings));
}

function updateSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    saveSettings(settings);
}

function loadSettings() {
    const settings = getSettings();
    document.getElementById('searchEngine').value = settings.searchEngine || 'google';
    document.getElementById('focusSearchOnLoad').checked = settings.focusSearchOnLoad !== false;
    document.getElementById('openLinksNewTab').checked = settings.openLinksNewTab !== false;
}

function getSearchUrl(engine, query) {
    const urls = {
        google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
        duckduckgo: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    };
    return urls[engine] || urls.google;
}

// --- Theme Functions ---

function getTheme() {
    const stored = localStorage.getItem('theme');
    return stored ? JSON.parse(stored) : {
        mode: 'light',
        accentColor: '#007bff'
    };
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
    faviconSlot.classList.remove('has-favicon');
    faviconPreview.src = '';
    
    try {
        const faviconUrl = await getFavicon(normalizedUrl);
        fetchedFavicon = faviconUrl;
        
        faviconPreview.src = faviconUrl;
        faviconSlot.classList.remove('loading');
        faviconSlot.classList.add('has-favicon');
        
        // Auto-select the favicon
        selectIcon(faviconSlot, faviconUrl);
    } catch (error) {
        console.error('Error fetching favicon:', error);
        faviconSlot.classList.remove('loading');
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
            
            // Reset icon selection
            selectedIcon = null;
            fetchedFavicon = null;
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.remove('selected', 'active');
            });
            
            // Reset favicon slot to loading state
            const faviconSlot = document.getElementById('faviconSlot');
            if (faviconSlot) {
                faviconSlot.classList.remove('has-favicon');
                faviconSlot.classList.add('loading');
                document.getElementById('faviconPreview').src = '';
            }
        }
        
        document.getElementById('linkTitle').focus();
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
            faviconSlot.classList.remove('has-favicon', 'loading');
            const faviconPreview = document.getElementById('faviconPreview');
            if (faviconPreview) {
                faviconPreview.src = '';
            }
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
}

// Create a quick link element
function createQuickLinkElement(link) {
    const settings = getSettings();
    
    const linkEl = document.createElement('a');
    linkEl.className = 'quick-link';
    linkEl.href = link.url;
    
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

    linkEl.appendChild(favicon);
    linkEl.appendChild(title);

    return linkEl;
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
    faviconSlot.classList.add('active');
    selectedIcon = link.favicon;
    
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
