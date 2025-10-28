function setupBlockedTermsControls() {
    const blockedTermInput = document.getElementById('blockedTermInput');
    const addBlockedTermBtn = document.getElementById('addBlockedTermBtn');

    if (!blockedTermInput || !addBlockedTermBtn) {
        return;
    }

    addBlockedTermBtn.addEventListener('click', () => {
        const term = blockedTermInput.value;
        if (addBlockedTerm(term)) {
            blockedTermInput.value = '';
        }
    });

    blockedTermInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        const term = blockedTermInput.value;
        if (addBlockedTerm(term)) {
            blockedTermInput.value = '';
        }
    });
}
