function loadQuickLinks() {
    const links = getQuickLinks();
    const container = document.getElementById('quickLinksContainer');
    
    // Clear container
    container.innerHTML = '';

    // Add each link
    links.forEach(link => {
        const linkElement = createQuickLinkElement(link);
        container.appendChild(linkElement);
    });

    attachQuickLinkDragHandlers(container);
}

// Create a quick link element
function createQuickLinkElement(link) {
    const settings = getSettings();
    
    const linkEl = document.createElement('a');
    linkEl.className = 'quick-link';
    linkEl.href = link.url;
    linkEl.dataset.linkId = link.id;
    linkEl.setAttribute('draggable', 'true');
    
    if (settings.openLinksNewTab !== false) {
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
    }

    const favicon = document.createElement('img');
    favicon.className = 'quick-link-favicon';
    favicon.src = link.favicon;
    favicon.alt = link.title;
    
    // Fallback chain if favicon fails to load
    let fallbackAttempt = 0;
    favicon.onerror = () => {
        fallbackAttempt++;
        try {
            const urlObj = new URL(link.url);
            const domain = urlObj.hostname;
            
            if (fallbackAttempt === 1) {
                // Try icon.horse as first fallback
                favicon.src = `https://icon.horse/icon/${domain}`;
            } else if (fallbackAttempt === 2) {
                // Try smaller Google favicon
                favicon.src = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
            } else if (fallbackAttempt === 3) {
                // Try direct favicon.ico
                favicon.src = `${urlObj.origin}/favicon.ico`;
            } else {
                // Final fallback: globe emoji
                favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🌐</text></svg>';
            }
        } catch (e) {
            favicon.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🌐</text></svg>';
        }
    };

    const title = document.createElement('div');
    title.className = 'quick-link-title';
    title.textContent = link.title;

    // Add right-click context menu
    linkEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showQuickLinkContextMenu(e, link);
    });

    linkEl.addEventListener('dragstart', handleQuickLinkDragStart);
    linkEl.addEventListener('dragenter', handleQuickLinkDragEnter);
    linkEl.addEventListener('dragover', handleQuickLinkDragOverItem);
    linkEl.addEventListener('dragleave', handleQuickLinkDragLeave);
    linkEl.addEventListener('drop', handleQuickLinkDropOnItem);
    linkEl.addEventListener('dragend', handleQuickLinkDragEnd);

    linkEl.appendChild(favicon);
    linkEl.appendChild(title);

    return linkEl;
}

