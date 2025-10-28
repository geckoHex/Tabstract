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

