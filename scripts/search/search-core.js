function performSearch(query) {
    const searchEngine = getSettings().searchEngine || 'google';
    const searchUrl = getSearchUrl(searchEngine, query, getActiveSearchFilter());

    if (activeSearchFilterId) {
        // Clear the filter so subsequent new tabs start from the default state
        setActiveSearchFilter(null, { silent: true });
    }

    window.location.href = searchUrl;
}

function checkForBlockedTerms(query) {
    const settings = getSettings();
    const blockedTerms = settings.blockedTerms || [];
    const queryLower = query.toLowerCase();
    
    return blockedTerms.filter(term => {
        return queryLower.includes(term.toLowerCase());
    });
}

function showSearchWarning(query, blockedTerms) {
    const modal = document.getElementById('searchWarningModal');
    const termsList = document.getElementById('warningTermsList');
    
    // Clear and populate blocked terms found
    termsList.innerHTML = '';
    blockedTerms.forEach(term => {
        const tag = document.createElement('span');
        tag.className = 'warning-term-tag';
        tag.textContent = term;
        termsList.appendChild(tag);
    });
    
    // Store query for "Search Anyway" button
    modal.dataset.pendingQuery = query;
    
    openModal('searchWarningModal');
}

function addBlockedTerm(term) {
    const trimmedTerm = term.trim();
    if (!trimmedTerm) return false;
    
    const settings = getSettings();
    const blockedTerms = settings.blockedTerms || [];
    
    // Check if term already exists (case-insensitive)
    if (blockedTerms.some(t => t.toLowerCase() === trimmedTerm.toLowerCase())) {
        showToast('Term already blocked');
        return false;
    }
    
    blockedTerms.push(trimmedTerm);
    updateSetting('blockedTerms', blockedTerms);
    loadBlockedTerms();
    showToast(`Blocked "${trimmedTerm}"`);
    return true;
}

function removeBlockedTerm(term) {
    const settings = getSettings();
    const blockedTerms = settings.blockedTerms || [];
    const filtered = blockedTerms.filter(t => t !== term);
    
    updateSetting('blockedTerms', filtered);
    loadBlockedTerms();
    showToast(`Unblocked "${term}"`);
}

function loadBlockedTerms() {
    const settings = getSettings();
    const blockedTerms = settings.blockedTerms || [];
    const listContainer = document.getElementById('blockedTermsList');
    
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (blockedTerms.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'blocked-terms-empty';
        emptyMsg.textContent = 'No blocked terms yet';
        listContainer.appendChild(emptyMsg);
        return;
    }
    
    blockedTerms.forEach(term => {
        const item = document.createElement('div');
        item.className = 'blocked-term-item';
        
        const text = document.createElement('span');
        text.className = 'blocked-term-text';
        text.textContent = term;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'blocked-term-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove term';
        removeBtn.addEventListener('click', () => removeBlockedTerm(term));
        
        item.appendChild(text);
        item.appendChild(removeBtn);
        listContainer.appendChild(item);
    });
}

function getSearchUrl(engine, query, filter) {
    const resolvedEngine = engine || 'google';

    if (resolvedEngine === 'google') {
        const url = new URL('https://www.google.com/search');
        let finalQuery = query;

        if (filter) {
            if (filter.appendQuery) {
                finalQuery = `${finalQuery} ${filter.appendQuery}`.trim();
            }

            if (filter.googleParams) {
                Object.entries(filter.googleParams).forEach(([key, value]) => {
                    url.searchParams.set(key, value);
                });
            }
        }

        url.searchParams.set('q', finalQuery);
        return url.toString();
    }

    if (resolvedEngine === 'bing') {
        return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    }

    if (resolvedEngine === 'duckduckgo') {
        return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    }

    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

