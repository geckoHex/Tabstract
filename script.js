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

// Edit Mode State
let isEditMode = false;
let deleteIndex = null;
let editIndex = null;
let contextMenuTargetIndex = null;

// Settings State
const DEFAULT_SETTINGS = {
    openInNewTab: false
};

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('settings');
    return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
}

// Save settings to localStorage
function saveSettings(settings) {
    localStorage.setItem('settings', JSON.stringify(settings));
}

// Quick Links Management
function loadQuickLinks() {
    const quickLinksContainer = document.getElementById('quickLinks');
    const links = JSON.parse(localStorage.getItem('quickLinks') || '[]');
    const settings = loadSettings();
    
    // Store reference to add button before clearing
    const addLinkBtn = document.getElementById('addLinkBtn');
    
    quickLinksContainer.innerHTML = '';
    
    links.forEach((link, index) => {
        const linkElement = document.createElement('a');
        linkElement.href = link.url;
        linkElement.className = 'quick-link';
        linkElement.dataset.index = index;
        
        // Apply target setting
        if (settings.openInNewTab) {
            linkElement.target = '_blank';
            linkElement.rel = 'noopener noreferrer';
        }
        
        linkElement.innerHTML = `
            <button class="delete-link-btn" data-index="${index}" title="Delete">
                <img src="public/ext-icons/trash.svg" alt="Delete" width="14" height="14">
            </button>
            <div class="link-icon">
                <img src="public/icon-options/${link.icon}" alt="${link.name}">
            </div>
            <span>${link.name}</span>
        `;
        quickLinksContainer.appendChild(linkElement);
        
        // Add context menu event listener
        linkElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.pageX, e.pageY, index);
        });
    });
    
    // Re-append the add button at the end
    if (addLinkBtn) {
        quickLinksContainer.appendChild(addLinkBtn);
    }
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            showDeleteConfirmation(index);
        });
    });
}

function saveQuickLink(name, url, icon, index = null) {
    const links = JSON.parse(localStorage.getItem('quickLinks') || '[]');
    
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    if (index !== null && index >= 0 && index < links.length) {
        // Edit existing link
        links[index] = { name, url, icon: icon || 'star.svg' };
    } else {
        // Add new link
        links.push({ name, url, icon: icon || 'star.svg' });
    }
    
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
    
    // Open modal for adding/editing
    window.openLinkModal = function(index = null) {
        editIndex = index;
        
        if (index !== null) {
            // Edit mode - populate with existing data
            const links = JSON.parse(localStorage.getItem('quickLinks') || '[]');
            const link = links[index];
            if (link) {
                linkName.value = link.name;
                linkUrl.value = link.url;
                selectedIcon = link.icon;
                
                // Select the corresponding icon
                iconSelector.querySelectorAll('.icon-option').forEach(btn => {
                    btn.classList.remove('selected');
                    if (btn.dataset.icon === link.icon) {
                        btn.classList.add('selected');
                    }
                });
            }
        } else {
            // Add mode - reset fields
            linkName.value = '';
            linkUrl.value = '';
            selectedIcon = 'star.svg';
            iconSelector.querySelector('.icon-option').classList.add('selected');
        }
        
        modal.classList.add('show');
        linkName.focus();
    };
    
    addLinkBtn.addEventListener('click', () => {
        openLinkModal();
    });
    
    // Close modal
    function closeModal() {
        modal.classList.remove('show');
        linkName.value = '';
        linkUrl.value = '';
        iconSelector.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
        selectedIcon = 'star.svg';
        editIndex = null;
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
            saveQuickLink(name, url, selectedIcon, editIndex);
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

// Delete Confirmation Modal
function showDeleteConfirmation(index) {
    deleteIndex = index;
    const modal = document.getElementById('deleteConfirmModal');
    modal.classList.add('show');
}

function setupDeleteConfirmation() {
    const modal = document.getElementById('deleteConfirmModal');
    const cancelBtn = document.getElementById('deleteCancelBtn');
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    
    function closeModal() {
        modal.classList.remove('show');
        deleteIndex = null;
    }
    
    cancelBtn.addEventListener('click', closeModal);
    
    confirmBtn.addEventListener('click', () => {
        if (deleteIndex !== null) {
            deleteQuickLink(deleteIndex);
            closeModal();
        }
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeModal();
        }
    });
}

// Edit Mode Toggle
function setupEditMode() {
    const editModeBtn = document.getElementById('editModeBtn');
    const addLinkBtn = document.getElementById('addLinkBtn');
    const quickLinksSection = document.querySelector('.quick-links-section');
    
    editModeBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;
        
        if (isEditMode) {
            editModeBtn.classList.add('active');
            addLinkBtn.classList.remove('hidden');
            quickLinksSection.classList.add('edit-mode');
        } else {
            editModeBtn.classList.remove('active');
            addLinkBtn.classList.add('hidden');
            quickLinksSection.classList.remove('edit-mode');
        }
    });
}

// Settings Modal
function setupSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const settingsCloseBtn = document.getElementById('settingsCloseBtn');
    const openInNewTabToggle = document.getElementById('openInNewTabToggle');
    
    // Load current settings
    const settings = loadSettings();
    
    // Set initial toggle states
    openInNewTabToggle.checked = settings.openInNewTab;
    
    // Open settings modal
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('show');
    });
    
    // Close settings modal
    function closeSettings() {
        settingsModal.classList.remove('show');
    }
    
    settingsCloseBtn.addEventListener('click', closeSettings);
    
    // Close on background click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettings();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal.classList.contains('show')) {
            closeSettings();
        }
    });
    
    // Open in new tab toggle
    openInNewTabToggle.addEventListener('change', (e) => {
        const settings = loadSettings();
        settings.openInNewTab = e.target.checked;
        saveSettings(settings);
        loadQuickLinks(); // Reload links to apply new target setting
    });
}

// Context Menu
function showContextMenu(x, y, index) {
    const contextMenu = document.getElementById('contextMenu');
    contextMenuTargetIndex = index;
    
    // Position the menu
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    contextMenu.classList.add('show');
    
    // Adjust position if menu goes off screen
    setTimeout(() => {
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = (y - rect.height) + 'px';
        }
    }, 0);
}

function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.classList.remove('show');
    contextMenuTargetIndex = null;
}

function setupContextMenu() {
    const contextEditBtn = document.getElementById('contextEditLink');
    const contextDeleteBtn = document.getElementById('contextDeleteLink');
    const contextAddBtn = document.getElementById('contextAddLink');
    
    // Edit link
    contextEditBtn.addEventListener('click', () => {
        if (contextMenuTargetIndex !== null) {
            openLinkModal(contextMenuTargetIndex);
            hideContextMenu();
        }
    });
    
    // Delete link
    contextDeleteBtn.addEventListener('click', () => {
        if (contextMenuTargetIndex !== null) {
            showDeleteConfirmation(contextMenuTargetIndex);
            hideContextMenu();
        }
    });
    
    // Add new link
    contextAddBtn.addEventListener('click', () => {
        openLinkModal();
        hideContextMenu();
    });
    
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
    
    // Hide context menu on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContextMenu();
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000); // Update every second
    setupSearch();
    loadQuickLinks();
    setupQuickLinksUI();
    setupDeleteConfirmation();
    setupEditMode();
    setupSettings();
    setupContextMenu();
    
    // Focus search input on load
    setTimeout(() => {
        document.getElementById('searchInput').focus();
    }, 100);
});
