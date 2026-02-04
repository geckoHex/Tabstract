// Get quick links from storage
function getQuickLinks() {
    const stored = localStorage.getItem('quickLinks');
    return stored ? JSON.parse(stored) : [];
}

// Save quick links to storage
function saveQuickLinks(links) {
    localStorage.setItem('quickLinks', JSON.stringify(links));
}

// Delete a quick link by id
function deleteQuickLink(id) {
    const links = getQuickLinks();
    const filtered = links.filter((link) => link.id !== id);
    saveQuickLinks(filtered);
    loadQuickLinks();
    showToast('Link deleted');
}

// Load and display quick links
