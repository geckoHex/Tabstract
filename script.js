// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
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
    focusSearchOnLoad: true,
    openLinksNewTab: true,
    userName: ''
};

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
    const searchEngineSelect = document.getElementById('searchEngine');
    const focusSearchCheckbox = document.getElementById('focusSearchOnLoad');
    const openLinksCheckbox = document.getElementById('openLinksNewTab');
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

    if (!stored) {
        return { ...DEFAULT_SETTINGS };
    }

    try {
        const parsed = JSON.parse(stored);
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

function loadSettings() {
    const settings = getSettings();
    const searchEngineSelect = document.getElementById('searchEngine');
    const focusSearchCheckbox = document.getElementById('focusSearchOnLoad');
    const openLinksCheckbox = document.getElementById('openLinksNewTab');
    const userNameInput = document.getElementById('userName');

    if (searchEngineSelect) {
        searchEngineSelect.value = settings.searchEngine || DEFAULT_SETTINGS.searchEngine;
    }

    if (focusSearchCheckbox) {
        focusSearchCheckbox.checked = settings.focusSearchOnLoad !== false;
    }

    if (openLinksCheckbox) {
        openLinksCheckbox.checked = settings.openLinksNewTab !== false;
    }

    if (userNameInput) {
        userNameInput.value = settings.userName || '';
    }
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
        key: 'midnight',
        start: 0,
        end: 3,
        messages: [
            "Still up, {{name}}? The moon's impressed.",
            'Midnight mission in progress, {{name}}.',
            "Shouldn't you be asleep, {{name}}?",
            'Night owl mode activated, {{name}}.'
        ]
    },
    {
        key: 'sunrise',
        start: 4,
        end: 7,
        messages: [
            'Up early, {{name}}?',
            'Early bird gets the worm, {{name}}.',
            'Sunrise squad assemble, {{name}}!',
            'You beat the snooze button again, {{name}}.'
        ]
    },
    {
        key: 'morning',
        start: 8,
        end: 11,
        messages: [
            'Good morning, {{name}}.',
            'Rise and shine, {{name}}!',
            'Coffee break yet, {{name}}?',
            "Let's make today awesome, {{name}}."
        ]
    },
    {
        key: 'afternoon',
        start: 12,
        end: 16,
        messages: [
            'Good afternoon, {{name}}.',
            'Hope your day is cruising, {{name}}.',
            'Need a stretch break, {{name}}?',
            'Another victory lap, {{name}}?'
        ]
    },
    {
        key: 'evening',
        start: 17,
        end: 20,
        messages: [
            'Good evening, {{name}}.',
            'Still rolling, {{name}}?',
            'Golden hour hero, {{name}}.',
            'Dinner plans, {{name}}?'
        ]
    },
    {
        key: 'lateNight',
        start: 21,
        end: 23,
        messages: [
            'Working late, {{name}}?',
            'Night shift vibes, {{name}}.',
            'Screens look brighter at night, {{name}}.',
            'Time to wind down, {{name}}.'
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
    return GREETING_SEGMENTS.find(segment => hour >= segment.start && hour <= segment.end)
        || GREETING_SEGMENTS[0];
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
