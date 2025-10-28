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
