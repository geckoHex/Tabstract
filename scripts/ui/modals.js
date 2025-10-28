// Open modal
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.add('show');
    
    // Special handling for link modal
    if (modalId === 'linkModal') {
        const linkForm = document.getElementById('linkForm');
        
        // Reset form if not editing
        if (!linkForm.dataset.editingId) {
            linkForm.reset();
            
            // Reset modal title and button text
            const modalTitle = document.querySelector('#linkModal .modal-header h3');
            const submitBtn = linkForm.querySelector('button[type="submit"]');
            modalTitle.textContent = 'Add New Link';
            submitBtn.textContent = 'Add Link';
            submitBtn.disabled = true; // Disable button initially
            
            // Reset icon selection
            selectedIcon = null;
            fetchedFavicon = null;
            document.querySelectorAll('.icon-option').forEach(opt => {
                opt.classList.remove('selected', 'active');
            });
            
            // Reset favicon slot to default state with blinking cursor
            const faviconSlot = document.getElementById('faviconSlot');
            if (faviconSlot) {
                faviconSlot.classList.remove('has-favicon', 'loading', 'waiting');
                const faviconPreview = document.getElementById('faviconPreview');
                if (faviconPreview) {
                    faviconPreview.src = '';
                }
            }
            
            // Hide URL suggestion
            const urlSuggestion = document.getElementById('urlSuggestion');
            if (urlSuggestion) {
                urlSuggestion.style.display = 'none';
            }
        }
        
        document.getElementById('linkTitle').focus();
    }
    
    // Special handling for saved links modal
    if (modalId === 'savedLinksModal') {
        loadSavedLinks();
        // Focus on input field
        const savedLinkUrlInput = document.getElementById('savedLinkUrl');
        if (savedLinkUrlInput) {
            savedLinkUrlInput.focus();
        }
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('show');
    
    // Special handling for link modal
    if (modalId === 'linkModal') {
        const linkForm = document.getElementById('linkForm');
        if (linkForm) {
            linkForm.reset();
            // Clear editing state
            delete linkForm.dataset.editingId;
        }
        
        // Reset modal title and button text
        const modalTitle = document.querySelector('#linkModal .modal-header h3');
        const submitBtn = linkForm.querySelector('button[type="submit"]');
        if (modalTitle) modalTitle.textContent = 'Add New Link';
        if (submitBtn) submitBtn.textContent = 'Add Link';
        
        // Reset icon selection
        selectedIcon = null;
        fetchedFavicon = null;
        document.querySelectorAll('.icon-option').forEach(opt => {
            opt.classList.remove('selected', 'active');
        });
        
        const faviconSlot = document.getElementById('faviconSlot');
        if (faviconSlot) {
            faviconSlot.classList.remove('has-favicon', 'loading', 'waiting');
            const faviconPreview = document.getElementById('faviconPreview');
            if (faviconPreview) {
                faviconPreview.src = '';
            }
        }
        
        // Hide URL suggestion
        const urlSuggestion = document.getElementById('urlSuggestion');
        if (urlSuggestion) {
            urlSuggestion.style.display = 'none';
        }
    }
}

// Add a new quick link
