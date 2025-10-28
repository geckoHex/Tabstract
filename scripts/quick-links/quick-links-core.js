async function addQuickLink() {
    const title = document.getElementById('linkTitle').value.trim();
    const url = document.getElementById('linkUrl').value.trim();
    const linkForm = document.getElementById('linkForm');
    const editingId = linkForm.dataset.editingId;

    if (!title || !url) return;

    // Normalize URL
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        normalizedUrl = 'https://' + url;
    }

    // Show loading state
    const submitBtn = document.querySelector('#linkForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = editingId ? 'Updating...' : 'Adding...';
    submitBtn.disabled = true;

    // If no icon selected, fetch favicon as fallback
    let iconToUse = selectedIcon;
    if (!iconToUse) {
        iconToUse = await getFavicon(normalizedUrl);
    }

    // Get existing links
    const links = getQuickLinks();

    if (editingId) {
        // Update existing link
        const linkIndex = links.findIndex(link => link.id === editingId);
        if (linkIndex !== -1) {
            links[linkIndex] = {
                id: editingId,
                title,
                url: normalizedUrl,
                favicon: iconToUse
            };
        }
        delete linkForm.dataset.editingId;
    } else {
        // Create new link object
        const link = {
            id: Date.now().toString(),
            title,
            url: normalizedUrl,
            favicon: iconToUse
        };
        links.push(link);
    }

    // Save to storage
    saveQuickLinks(links);

    // Reload display
    loadQuickLinks();

    // Reset button
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;

    // Close modal
    closeModal('linkModal');
}

// Fetch favicon for a URL
async function getFavicon(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        // Use multiple favicon sources, but don't try to cache as data URL
        // because of CORS restrictions - just store the URL
        const faviconSources = [
            `https://www.google.com/s2/favicons?sz=64&domain=${domain}`,
            `https://icon.horse/icon/${domain}`,
            `https://www.google.com/s2/favicons?sz=32&domain=${domain}`,
            `${urlObj.origin}/favicon.ico`
        ];

        // Return the primary favicon URL directly
        // The browser will handle loading it without CORS issues
        return faviconSources[0];
    } catch (error) {
        console.error('Error generating favicon URL:', error);
        // Return a default icon (globe emoji as fallback)
        return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🌐</text></svg>';
    }
}

