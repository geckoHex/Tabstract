// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadQuickLinks();
});

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
}

// Focus search input on startup
window.addEventListener('load', () => {
    document.getElementById('searchInput').focus();
});

// --- Quick Links Functions ---

// Open modal
function openModal() {
    const modal = document.getElementById('linkModal');
    modal.classList.add('show');
    document.getElementById('linkTitle').focus();
}

// Close modal
function closeModal() {
    const modal = document.getElementById('linkModal');
    modal.classList.remove('show');
    document.getElementById('linkForm').reset();
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
    submitBtn.textContent = 'Loading...';
    submitBtn.disabled = true;

    // Fetch and cache favicon
    const favicon = await getFavicon(normalizedUrl);

    // Create link object
    const link = {
        id: Date.now().toString(),
        title,
        url: normalizedUrl,
        favicon
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
