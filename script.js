// Update time and date
function updateTime() {
    const now = new Date();
    const timeElement = document.getElementById('time');
    const dateElement = document.getElementById('date');
    
    // Format time (12-hour format)
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const timeString = `${hours}:${minutes.toString().padStart(2, '0')}`;
    
    // Format date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('en-US', options);
    
    timeElement.textContent = timeString;
    dateElement.textContent = dateString;
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                // Check if it looks like a URL
                const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
                if (urlPattern.test(query)) {
                    // Navigate to URL
                    const url = query.startsWith('http') ? query : 'https://' + query;
                    window.location.href = url;
                } else {
                    // Search with Google
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                    window.location.href = searchUrl;
                }
            }
        }
    });
    
    // Focus search input when typing
    document.addEventListener('keydown', (e) => {
        // Ignore if already focused or if special keys are pressed
        if (document.activeElement === searchInput) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length === 1) {
            searchInput.focus();
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000); // Update every second
    setupSearch();
    
    // Focus search input on load
    setTimeout(() => {
        document.getElementById('searchInput').focus();
    }, 100);
});
