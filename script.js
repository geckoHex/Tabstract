// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadQuickLinks();
    initializeIconPicker();
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
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
        }
    });

    // Quick Links - New Link Button
    const newLinkBtn = document.getElementById('newLinkBtn');
    newLinkBtn.addEventListener('click', openModal);

    // Modal Controls
    const closeModalBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const linkForm = document.getElementById('linkForm');
    const modal = document.getElementById('linkModal');

    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Handle form submission
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
}

// Focus search input on startup
window.addEventListener('load', () => {
    document.getElementById('searchInput').focus();
});

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
function openModal() {
    const modal = document.getElementById('linkModal');
    modal.classList.add('show');
    document.getElementById('linkTitle').focus();
    
    // Reset icon selection
    selectedIcon = null;
    fetchedFavicon = null;
    document.querySelectorAll('.icon-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Reset favicon slot to loading state
    const faviconSlot = document.getElementById('faviconSlot');
    faviconSlot.classList.remove('has-favicon');
    faviconSlot.classList.add('loading');
    document.getElementById('faviconPreview').src = '';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('linkModal');
    modal.classList.remove('show');
    document.getElementById('linkForm').reset();
    
    // Reset icon selection
    selectedIcon = null;
    fetchedFavicon = null;
    document.querySelectorAll('.icon-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    const faviconSlot = document.getElementById('faviconSlot');
    faviconSlot.classList.remove('has-favicon', 'loading');
    document.getElementById('faviconPreview').src = '';
}

// Add a new quick link
async function addQuickLink() {
    const title = document.getElementById('linkTitle').value.trim();
    const url = document.getElementById('linkUrl').value.trim();

    if (!title || !url) return;

    // Normalize URL
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        normalizedUrl = 'https://' + url;
    }

    // Show loading state
    const submitBtn = document.querySelector('#linkForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;

    // If no icon selected, fetch favicon as fallback
    let iconToUse = selectedIcon;
    if (!iconToUse) {
        iconToUse = await getFavicon(normalizedUrl);
    }

    // Create link object
    const link = {
        id: Date.now().toString(),
        title,
        url: normalizedUrl,
        favicon: iconToUse
    };

    // Get existing links
    const links = getQuickLinks();
    links.push(link);

    // Save to storage
    saveQuickLinks(links);

    // Reload display
    loadQuickLinks();

    // Reset button
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    // Close modal
    closeModal();
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
    const linkEl = document.createElement('a');
    linkEl.className = 'quick-link';
    linkEl.href = link.url;
    linkEl.target = '_blank';
    linkEl.rel = 'noopener noreferrer';

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

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'quick-link-delete';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Delete link';
    deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteQuickLink(link.id);
    });

    linkEl.appendChild(deleteBtn);
    linkEl.appendChild(favicon);
    linkEl.appendChild(title);

    return linkEl;
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
