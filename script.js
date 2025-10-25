// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
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
}

// Focus search input on startup
window.addEventListener('load', () => {
    document.getElementById('searchInput').focus();
});
