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
