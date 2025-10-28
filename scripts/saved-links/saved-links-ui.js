function loadSavedLinks() {
    const savedLinks = getSavedLinks();
    const savedLinksList = document.getElementById('savedLinksList');
    const savedLinksEmpty = document.getElementById('savedLinksEmpty');

    if (!savedLinksList || !savedLinksEmpty) {
        return;
    }

    savedLinksList.innerHTML = '';

    if (savedLinks.length === 0) {
        savedLinksEmpty.classList.add('show');
        savedLinksList.style.display = 'none';
        return;
    }

    savedLinksEmpty.classList.remove('show');
    savedLinksList.style.display = 'flex';

    savedLinks.forEach((link) => {
        const linkItem = createSavedLinkItem(link);
        savedLinksList.appendChild(linkItem);
    });
}

function createSavedLinkItem(link) {
    const item = document.createElement('div');
    item.className = 'saved-link-item';

    const faviconUrl = getFaviconUrl(link.url);
    const displayTitle = escapeHtml(getSavedLinkDisplayTitle(link));
    const displayUrl = escapeHtml(link.url);
    const timeAgoText = escapeHtml(formatSavedLinkTimeAgo(link.savedAt));

    item.innerHTML = `
        <img src="${faviconUrl}" alt="" class="saved-link-favicon" onerror="this.src='public/icons/globe-hemisphere-west.svg'" />
        <div class="saved-link-info">
            <div class="saved-link-header">
                <div class="saved-link-title" title="Click to rename">${displayTitle}</div>
                <div class="saved-link-meta">${timeAgoText}</div>
            </div>
            <div class="saved-link-url">${displayUrl}</div>
        </div>
        <div class="saved-link-actions">
            <button class="saved-link-action-btn delete-btn" title="Delete">
                <img src="public/icons/trash.svg" alt="Delete" />
            </button>
        </div>
    `;

    const titleElement = item.querySelector('.saved-link-title');
    enableSavedLinkTitleEditing(titleElement, link);

    item.addEventListener('click', (event) => {
        if (!event.target.closest('.saved-link-actions')) {
            openSavedLink(link);
        }
    });

    const deleteBtn = item.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteSavedLink(link.id);
    });

    return item;
}

function enableSavedLinkTitleEditing(titleElement, link) {
    if (!titleElement) {
        return;
    }

    titleElement.setAttribute('role', 'button');
    titleElement.setAttribute('tabindex', '0');

    const beginEditing = (event) => {
        event.stopPropagation();
        startSavedLinkTitleEditing(titleElement, link);
    };

    titleElement.addEventListener('click', beginEditing);
    titleElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            beginEditing(event);
        }
    });
}

function startSavedLinkTitleEditing(titleElement, link) {
    if (!titleElement || titleElement.dataset.editing === 'true') {
        return;
    }

    titleElement.dataset.editing = 'true';

    const currentStoredTitle = sanitizeSavedLinkTitle(link.title);
    const initialValue = currentStoredTitle || getSavedLinkDisplayTitle(link);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue;
    input.className = 'saved-link-title-input';
    input.maxLength = 140;

    const cleanup = () => {
        delete titleElement.dataset.editing;
    };

    const commitChanges = () => {
        const sanitizedValue = sanitizeSavedLinkTitle(input.value);
        if (sanitizedValue === currentStoredTitle) {
            cleanup();
            loadSavedLinks();
            return;
        }

        cleanup();
        updateSavedLinkTitle(link.id, sanitizedValue);
    };

    const cancelEditing = () => {
        input.dataset.cancelled = 'true';
        cleanup();
        loadSavedLinks();
    };

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            commitChanges();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelEditing();
        }
    });

    input.addEventListener('blur', () => {
        if (input.dataset.cancelled === 'true') {
            return;
        }
        commitChanges();
    });

    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('mousedown', (event) => event.stopPropagation());

    titleElement.replaceChildren(input);

    requestAnimationFrame(() => {
        input.focus();
        input.select();
    });
}

function updateSavedLinkTitle(id, sanitizedTitle) {
    const savedLinks = getSavedLinks();
    const linkToUpdate = savedLinks.find((entry) => entry.id === id);

    if (!linkToUpdate) {
        return;
    }

    if (sanitizedTitle) {
        linkToUpdate.title = sanitizedTitle;
    } else {
        delete linkToUpdate.title;
    }

    setSavedLinks(savedLinks);
    loadSavedLinks();
}
