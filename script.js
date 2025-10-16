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
        
        // Ignore if modal is open or user is typing in an input field
        const modal = document.getElementById('addLinkModal');
        if (modal && modal.classList.contains('show')) return;
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        
        if (e.key.length === 1) {
            searchInput.focus();
        }
    });
}

// Quick Links Management
function loadQuickLinks() {
    const quickLinksContainer = document.getElementById('quickLinks');
    const links = JSON.parse(localStorage.getItem('quickLinks') || '[]');
    
    quickLinksContainer.innerHTML = '';
    
    links.forEach((link, index) => {
        const linkElement = document.createElement('a');
        linkElement.href = link.url;
        linkElement.className = 'quick-link';
        linkElement.target = '_blank';
        linkElement.innerHTML = `
            <div class="link-icon">
                <img src="public/icon-options/${link.icon}" alt="${link.name}">
            </div>
            <span>${link.name}</span>
            <button class="delete-link-btn" data-index="${index}" title="Delete">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 4.94L9.53 1.41L10.59 2.47L7.06 6L10.59 9.53L9.53 10.59L6 7.06L2.47 10.59L1.41 9.53L4.94 6L1.41 2.47L2.47 1.41L6 4.94Z" fill="currentColor"/>
                </svg>
            </button>
        `;
        quickLinksContainer.appendChild(linkElement);
    });
    
    // Add delete button event listeners
    document.querySelectorAll('.delete-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteQuickLink(parseInt(btn.dataset.index));
        });
    });
}

function saveQuickLink(name, url, icon) {
    const links = JSON.parse(localStorage.getItem('quickLinks') || '[]');
    
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    links.push({ name, url, icon: icon || 'star.svg' });
    localStorage.setItem('quickLinks', JSON.stringify(links));
    loadQuickLinks();
}

function deleteQuickLink(index) {
    const links = JSON.parse(localStorage.getItem('quickLinks') || '[]');
    links.splice(index, 1);
    localStorage.setItem('quickLinks', JSON.stringify(links));
    loadQuickLinks();
}

function setupQuickLinksUI() {
    const addLinkBtn = document.getElementById('addLinkBtn');
    const modal = document.getElementById('addLinkModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const saveBtn = document.getElementById('saveBtn');
    const linkName = document.getElementById('linkName');
    const linkUrl = document.getElementById('linkUrl');
    const iconSelector = document.getElementById('iconSelector');
    let selectedIcon = 'star.svg'; // Default icon
    
    // Icon selection
    iconSelector.querySelectorAll('.icon-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            iconSelector.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedIcon = btn.dataset.icon;
        });
    });
    
    // Open modal
    addLinkBtn.addEventListener('click', () => {
        modal.classList.add('show');
        // Select first icon by default
        iconSelector.querySelector('.icon-option').classList.add('selected');
        selectedIcon = 'star.svg';
        linkName.focus();
    });
    
    // Close modal
    function closeModal() {
        modal.classList.remove('show');
        linkName.value = '';
        linkUrl.value = '';
        iconSelector.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
        selectedIcon = 'star.svg';
    }
    
    cancelBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeModal();
        }
    });
    
    // Save link
    saveBtn.addEventListener('click', () => {
        const name = linkName.value.trim();
        const url = linkUrl.value.trim();
        
        if (name && url && selectedIcon) {
            saveQuickLink(name, url, selectedIcon);
            closeModal();
        } else {
            // Simple validation feedback
            if (!name) linkName.style.borderColor = 'red';
            if (!url) linkUrl.style.borderColor = 'red';
            
            setTimeout(() => {
                linkName.style.borderColor = '';
                linkUrl.style.borderColor = '';
            }, 2000);
        }
    });
    
    // Allow Enter key to save
    [linkName, linkUrl].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000); // Update every second
    setupSearch();
    loadQuickLinks();
    setupQuickLinksUI();
    
    // Focus search input on load
    setTimeout(() => {
        document.getElementById('searchInput').focus();
    }, 100);
});
