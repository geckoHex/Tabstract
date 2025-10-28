function setupLinkFormHandlers() {
    const linkForm = document.getElementById('linkForm');
    const linkUrlInput = document.getElementById('linkUrl');
    const linkTitleInput = document.getElementById('linkTitle');
    const urlSuggestion = document.getElementById('urlSuggestion');
    const urlSuggestionBtn = document.getElementById('urlSuggestionBtn');

    if (!linkForm || !linkUrlInput || !linkTitleInput) {
        return;
    }

    let faviconUpdateTimeout = null;

    const validateForm = () => {
        const submitBtn = linkForm.querySelector('button[type=\"submit\"]');
        if (!submitBtn) {
            return;
        }

        const title = linkTitleInput.value.trim();
        const url = linkUrlInput.value.trim();
        const hasIcon = selectedIcon !== null;
        submitBtn.disabled = !(title && url && (hasIcon || fetchedFavicon));
    };

    const handleUrlInputChange = () => {
        clearTimeout(faviconUpdateTimeout);
        const url = linkUrlInput.value.trim();
        checkAndShowUrlSuggestion(url);

        if (!url) {
            resetFaviconSlot();
            return;
        }

        const settings = getSettings();
        const mode = settings.faviconLoadMode || 'delayed';

        if (mode === 'immediate') {
            faviconUpdateTimeout = setTimeout(async () => {
                await updateFaviconInPicker(url);
            }, 300);
        } else if (mode === 'delayed') {
            setFaviconWaiting();
            faviconUpdateTimeout = setTimeout(async () => {
                await updateFaviconInPicker(url);
            }, 1500);
        } else if (mode === 'manual') {
            setFaviconWaiting();
        }
    };

    linkForm.addEventListener('submit', (event) => {
        event.preventDefault();
        addQuickLink();
    });

    linkTitleInput.addEventListener('input', validateForm);

    linkTitleInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            linkUrlInput.focus();
        }
    });

    linkUrlInput.addEventListener('input', () => {
        validateForm();
        handleUrlInputChange();
    });

    urlSuggestionBtn?.addEventListener('click', () => {
        const baseUrl = urlSuggestionBtn.textContent;
        if (!baseUrl) {
            return;
        }
        linkUrlInput.value = baseUrl;
        if (urlSuggestion) {
            urlSuggestion.style.display = 'none';
        }
        clearTimeout(faviconUpdateTimeout);
        updateFaviconInPicker(baseUrl);
        validateForm();
    });

    linkUrlInput.addEventListener('paste', () => {
        clearTimeout(faviconUpdateTimeout);
        setTimeout(async () => {
            const url = linkUrlInput.value.trim();
            checkAndShowUrlSuggestion(url);
            if (url) {
                await updateFaviconInPicker(url);
            }
            validateForm();
        }, 50);
    });

    linkUrlInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        clearTimeout(faviconUpdateTimeout);
        const url = linkUrlInput.value.trim();
        if (url) {
            await updateFaviconInPicker(url);
            validateForm();
        }
    });

    linkUrlInput.addEventListener('blur', async () => {
        clearTimeout(faviconUpdateTimeout);
        const url = linkUrlInput.value.trim();
        if (!url) {
            return;
        }

        const settings = getSettings();
        const mode = settings.faviconLoadMode || 'delayed';
        if (mode === 'manual' || !fetchedFavicon) {
            await updateFaviconInPicker(url);
            validateForm();
        }
    });
}
