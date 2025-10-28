// --- Settings Functions ---

function saveSettings(settings) {
    localStorage.setItem('settings', JSON.stringify(settings));
}

function updateSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    saveSettings(settings);
}

function setUpdateToggleAvailability(checkbox, enabled) {
    if (!checkbox) {
        return;
    }

    const toggleSwitch = checkbox.closest('.toggle-switch');
    const toggleLabel = checkbox.closest('.setting-toggle-label');

    if (enabled) {
        checkbox.disabled = false;
        checkbox.setAttribute('aria-disabled', 'false');
        toggleSwitch?.classList.remove('toggle-switch-disabled');
        toggleLabel?.classList.remove('setting-toggle-disabled');
    } else {
        checkbox.checked = false;
        checkbox.disabled = true;
        checkbox.setAttribute('aria-disabled', 'true');
        toggleSwitch?.classList.add('toggle-switch-disabled');
        toggleLabel?.classList.add('setting-toggle-disabled');
    }
}

function updateSearchHintVisibility(show) {
    const searchHint = document.querySelector('.search-hint');
    const searchInput = document.getElementById('searchInput');
    if (searchHint && searchInput) {
        // Only show hint if setting is enabled AND input is empty AND no filter is active
        const shouldShow = show && searchInput.value.length === 0 && activeSearchFilterId === null;
        searchHint.style.display = shouldShow ? 'block' : 'none';
    }
}

function loadSettings() {
    const settings = getSettings();
    const typeAnywhereCheckbox = document.getElementById('typeAnywhere');
    const openLinksCheckbox = document.getElementById('openLinksNewTab');
    const showSearchHintCheckbox = document.getElementById('showSearchHint');
    const checkForUpdatesCheckbox = document.getElementById('checkForUpdates');
    const userNameInput = document.getElementById('userName');
    const faviconLoadModeSelect = document.getElementById('faviconLoadMode');

    if (typeAnywhereCheckbox) {
        typeAnywhereCheckbox.checked = settings.typeAnywhere !== false;
    }

    if (openLinksCheckbox) {
        openLinksCheckbox.checked = settings.openLinksNewTab === true;
    }

    if (showSearchHintCheckbox) {
        showSearchHintCheckbox.checked = settings.showSearchHint !== false;
        updateSearchHintVisibility(settings.showSearchHint !== false);
    }

    if (checkForUpdatesCheckbox) {
        setUpdateToggleAvailability(checkForUpdatesCheckbox, UPDATE_CHECKER_ENABLED);
        if (UPDATE_CHECKER_ENABLED) {
            checkForUpdatesCheckbox.checked = settings.checkForUpdates !== false;
        } else {
            checkForUpdatesCheckbox.checked = false;
        }
    }

    if (userNameInput) {
        userNameInput.value = settings.userName || '';
    }
    
    if (faviconLoadModeSelect) {
        faviconLoadModeSelect.value = settings.faviconLoadMode || 'delayed';
    }

    // Load blocked terms
    loadBlockedTerms();
}

function getSettings() {
    const stored = localStorage.getItem('settings');

    if (!stored) {
        return { ...DEFAULT_SETTINGS };
    }

    try {
        const parsed = JSON.parse(stored) || {};

        if ('focusSearchOnLoad' in parsed && !('typeAnywhere' in parsed)) {
            parsed.typeAnywhere = parsed.focusSearchOnLoad;
            delete parsed.focusSearchOnLoad;
            localStorage.setItem('settings', JSON.stringify(parsed));
        }

        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (error) {
        console.error('Error parsing settings:', error);
        return { ...DEFAULT_SETTINGS };
    }
}
