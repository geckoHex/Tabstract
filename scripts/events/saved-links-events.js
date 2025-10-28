function setupSavedLinksControls() {
    const saveLinkBtn = document.getElementById('saveLinkBtn');
    const savedLinkUrlInput = document.getElementById('savedLinkUrl');

    if (!saveLinkBtn || !savedLinkUrlInput) {
        return;
    }

    saveLinkBtn.addEventListener('click', (event) => {
        event.preventDefault();
        const url = savedLinkUrlInput.value.trim();
        if (url) {
            saveLinkForLater(url);
            savedLinkUrlInput.value = '';
        }
    });

    savedLinkUrlInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        const url = savedLinkUrlInput.value.trim();
        if (url) {
            saveLinkForLater(url);
            savedLinkUrlInput.value = '';
        }
    });
}
