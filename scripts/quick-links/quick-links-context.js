// Show context menu for quick link
function showQuickLinkContextMenu(e, link) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.quick-link-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'quick-link-context-menu';
    
    // Edit option
    const editOption = document.createElement('div');
    editOption.className = 'context-menu-item';
    const editIcon = document.createElement('img');
    editIcon.src = 'public/icons/pencil-simple.svg';
    editIcon.className = 'context-menu-icon';
    const editText = document.createElement('span');
    editText.textContent = 'Edit';
    editOption.appendChild(editIcon);
    editOption.appendChild(editText);
    editOption.addEventListener('click', () => {
        editQuickLink(link);
        menu.remove();
    });
    
    // Delete option
    const deleteOption = document.createElement('div');
    deleteOption.className = 'context-menu-item context-menu-item-danger';
    const deleteIcon = document.createElement('img');
    deleteIcon.src = 'public/icons/trash.svg';
    deleteIcon.className = 'context-menu-icon';
    const deleteText = document.createElement('span');
    deleteText.textContent = 'Delete';
    deleteOption.appendChild(deleteIcon);
    deleteOption.appendChild(deleteText);
    deleteOption.addEventListener('click', () => {
        deleteQuickLink(link.id);
        menu.remove();
    });
    
    menu.appendChild(editOption);
    menu.appendChild(deleteOption);
    
    // Position the menu
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    document.body.appendChild(menu);
    
    // Close menu when clicking anywhere else
    const closeMenu = (event) => {
        if (!menu.contains(event.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('contextmenu', closeMenu);
        }
    };
    
    // Delay adding the click listener to prevent immediate close
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('contextmenu', closeMenu);
    }, 10);
}

// Edit a quick link
function editQuickLink(link) {
    // Pre-fill the form with existing link data
    document.getElementById('linkTitle').value = link.title;
    document.getElementById('linkUrl').value = link.url;
    
    // Update the favicon in the picker
    fetchedFavicon = link.favicon;
    const faviconSlot = document.getElementById('faviconSlot');
    const faviconPreview = document.getElementById('faviconPreview');
    faviconPreview.src = link.favicon;
    faviconSlot.classList.remove('loading');
    faviconSlot.classList.add('has-favicon');
    
    // Auto-select the favicon
    selectIcon(faviconSlot, link.favicon);
    
    // Update form submission to edit instead of add
    const linkForm = document.getElementById('linkForm');
    const submitBtn = linkForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Link';
    
    // Store the link ID for updating
    linkForm.dataset.editingId = link.id;
    
    // Update modal title
    const modalTitle = document.querySelector('#linkModal .modal-header h3');
    modalTitle.textContent = 'Edit Link';
    
    openModal('linkModal');
}

// Delete a quick link
