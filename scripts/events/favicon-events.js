function setupFaviconLoadModeControl() {
    const faviconLoadModeSelect = document.getElementById('faviconLoadMode');
    if (!faviconLoadModeSelect) {
        return;
    }

    faviconLoadModeSelect.addEventListener('change', (event) => {
        const mode = event.target.value;
        updateSetting('faviconLoadMode', mode);
        const messages = {
            immediate: 'Favicon loads immediately',
            delayed: 'Favicon loads after 1.5s delay',
            manual: 'Favicon loads after Enter key'
        };
        showToast(messages[mode] || 'Favicon load mode updated');
    });
}
