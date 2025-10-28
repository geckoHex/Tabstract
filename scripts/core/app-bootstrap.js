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
    if (UPDATE_CHECKER_ENABLED) {
        initializeUpdateChecker();
    } else {
        disableUpdateCheckerUI();
    }
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
    checkForUpdates: false,
    faviconLoadMode: 'delayed', // 'immediate', 'delayed', or 'manual'
    blockedTerms: [] // Array of blocked search terms
};

const UPDATE_CHECKER_ENABLED = false;

const UPDATE_CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
const UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/geckoHex/Tabstract/refs/heads/main/manifest.json';
const UPDATE_CHECK_STATE_KEY = 'updateCheckState';
const CONFIG_EXPORT_VERSION = 1;

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
