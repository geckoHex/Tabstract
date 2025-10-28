function setupSettingsControls() {
    const typeAnywhereCheckbox = document.getElementById('typeAnywhere');
    const openLinksCheckbox = document.getElementById('openLinksNewTab');
    const showSearchHintCheckbox = document.getElementById('showSearchHint');
    const checkForUpdatesCheckbox = document.getElementById('checkForUpdates');
    const userNameInput = document.getElementById('userName');
    const updateToastButton = document.getElementById('updateToastButton');
    const exportConfigBtn = document.getElementById('exportConfigBtn');
    const importConfigBtn = document.getElementById('importConfigBtn');
    const configImportInput = document.getElementById('configImportInput');

    let nameUpdateTimeout = null;

    userNameInput?.addEventListener('input', (event) => {
        const value = event.target.value;
        clearTimeout(nameUpdateTimeout);
        nameUpdateTimeout = setTimeout(() => {
            updateSetting('userName', value.trim());
            updateGreeting(true);
        }, 300);
    });

    userNameInput?.addEventListener('blur', (event) => {
        clearTimeout(nameUpdateTimeout);
        const sanitized = event.target.value.trim();
        event.target.value = sanitized;
        updateSetting('userName', sanitized);
        updateGreeting(true);
    });

    typeAnywhereCheckbox?.addEventListener('change', (event) => {
        const enabled = event.target.checked;
        updateSetting('typeAnywhere', enabled);
        showToast(enabled ? 'Type anywhere enabled' : 'Type anywhere disabled');
        setupTypeAnywhereListeners();
    });

    openLinksCheckbox?.addEventListener('change', (event) => {
        const enabled = event.target.checked;
        updateSetting('openLinksNewTab', enabled);
        showToast(enabled ? 'Links open in new tab' : 'Links open in same tab');
    });

    showSearchHintCheckbox?.addEventListener('change', (event) => {
        const enabled = event.target.checked;
        updateSetting('showSearchHint', enabled);
        updateSearchHintVisibility(enabled);
        showToast(enabled ? 'Search hint shown' : 'Search hint hidden');
    });

    if (checkForUpdatesCheckbox) {
        if (UPDATE_CHECKER_ENABLED) {
            checkForUpdatesCheckbox.addEventListener('change', (event) => {
                const enabled = event.target.checked;
                updateSetting('checkForUpdates', enabled);
                handleUpdateCheckToggleChange(enabled);
                showToast(enabled ? 'Automatic update checks enabled' : 'Automatic update checks disabled');
            });
        } else {
            setUpdateToggleAvailability(checkForUpdatesCheckbox, false);
        }
    }

    updateToastButton?.addEventListener('click', () => {
        openModal('updateInstructionsModal');
    });

    exportConfigBtn?.addEventListener('click', exportUserConfiguration);

    if (importConfigBtn && configImportInput) {
        importConfigBtn.addEventListener('click', () => {
            configImportInput.value = '';
            configImportInput.click();
        });

        configImportInput.addEventListener('change', handleConfigImportFileSelection);
    }
}
