function getSavedLinks() {
    const stored = localStorage.getItem('savedLinks');
    return stored ? JSON.parse(stored) : [];
}

function setSavedLinks(links) {
    localStorage.setItem('savedLinks', JSON.stringify(links));
}

function saveLinkForLater(url) {
    if (!isValidUrl(url)) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        if (!isValidUrl(url)) {
            showToast('Please enter a valid URL');
            return;
        }
    }

    const savedLinks = getSavedLinks();

    if (savedLinks.some((link) => link.url === url)) {
        showToast('Link already saved');
        return;
    }

    const newLink = {
        id: Date.now().toString(),
        url,
        title: extractDomain(url),
        savedAt: new Date().toISOString()
    };

    fetchLinkMetadata(newLink);

    savedLinks.unshift(newLink);
    setSavedLinks(savedLinks);
    loadSavedLinks();
    showToast('Link saved');
}

function openSavedLink(link) {
    const settings = getSettings();
    if (settings.openLinksNewTab) {
        window.open(link.url, '_blank');
    } else {
        window.location.href = link.url;
    }
}

function deleteSavedLink(id, silent = false) {
    const savedLinks = getSavedLinks();
    const filtered = savedLinks.filter((link) => link.id !== id);
    setSavedLinks(filtered);
    loadSavedLinks();

    if (!silent) {
        showToast('Link deleted');
    }
}
