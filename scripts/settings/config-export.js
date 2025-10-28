// --- Configuration Import / Export ---

function exportUserConfiguration() {
    try {
        const payload = buildConfigurationExportPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/[:]/g, '-');
        const link = document.createElement('a');
        link.href = url;
        link.download = `tabstract-config-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Config exported');
    } catch (error) {
        console.error('Failed to export configuration:', error);
        showToast('Failed to export config');
    }
}

function buildConfigurationExportPayload() {
    const payload = {
        version: CONFIG_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        settings: getSettings(),
        theme: getTheme(),
        quickLinks: getQuickLinks(),
        savedLinks: getSavedLinks()
    };

    const activeSearchFilter = localStorage.getItem('activeSearchFilter');
    if (activeSearchFilter) {
        payload.activeSearchFilter = activeSearchFilter;
    }

    if (typeof getUpdateCheckState === 'function') {
        const updateState = getUpdateCheckState();
        if (updateState && Object.keys(updateState).length > 0) {
            payload.updateCheckState = updateState;
        }
    }

    return payload;
}

