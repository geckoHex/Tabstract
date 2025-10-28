// --- Update Checker ---

function disableUpdateCheckerUI() {
    const checkbox = document.getElementById('checkForUpdates');
    setUpdateToggleAvailability(checkbox, false);

    const settings = getSettings();
    if (settings.checkForUpdates !== false) {
        updateSetting('checkForUpdates', false);
    }

    hideUpdateAvailableToast();
    updateUpdateCheckState({
        availableVersion: undefined,
        lastError: undefined,
        lastCheckStatus: 'disabled'
    });
}

let cachedExtensionVersion = null;

function getCurrentExtensionVersion() {
    if (cachedExtensionVersion) {
        return cachedExtensionVersion;
    }

    if (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest) {
        cachedExtensionVersion = chrome.runtime.getManifest().version;
        return cachedExtensionVersion;
    }

    const versionMeta = document.querySelector('meta[name="tabstract-version"]');
    if (versionMeta) {
        cachedExtensionVersion = versionMeta.content;
        return cachedExtensionVersion;
    }

    return null;
}

function getUpdateCheckState() {
    const stored = localStorage.getItem(UPDATE_CHECK_STATE_KEY);
    if (!stored) {
        return {};
    }

    try {
        return JSON.parse(stored) || {};
    } catch (error) {
        console.error('Failed to parse update check state:', error);
        return {};
    }
}

function setUpdateCheckState(state) {
    localStorage.setItem(UPDATE_CHECK_STATE_KEY, JSON.stringify(state));
}

function updateUpdateCheckState(partial) {
    const current = getUpdateCheckState();
    const next = { ...current, ...partial };

    // Remove nullish fields to keep storage tidy
    Object.keys(next).forEach((key) => {
        if (next[key] === undefined) {
            delete next[key];
        }
    });

    setUpdateCheckState(next);
    return next;
}

async function initializeUpdateChecker() {
    if (!UPDATE_CHECKER_ENABLED) {
        hideUpdateAvailableToast();
        return;
    }

    const settings = getSettings();
    if (settings.checkForUpdates === false) {
        hideUpdateAvailableToast();
        return;
    }

    maybeShowPersistedUpdateNotice();
    await runUpdateCheck();
}

function handleUpdateCheckToggleChange(enabled) {
    if (!UPDATE_CHECKER_ENABLED) {
        return;
    }

    if (enabled) {
        maybeShowPersistedUpdateNotice();
        runUpdateCheck({ skipThrottle: true });
    } else {
        hideUpdateAvailableToast();
    }
}

function maybeShowPersistedUpdateNotice() {
    if (!UPDATE_CHECKER_ENABLED) {
        return;
    }

    const currentVersion = getCurrentExtensionVersion();
    if (!currentVersion) return;

    const state = getUpdateCheckState();
    if (state.availableVersion && isVersionNewer(state.availableVersion, currentVersion)) {
        showUpdateAvailableToast(state.availableVersion);
    }
}

async function runUpdateCheck({ skipThrottle = false } = {}) {
    if (!UPDATE_CHECKER_ENABLED) {
        return;
    }

    const settings = getSettings();
    if (settings.checkForUpdates === false) {
        return;
    }

    const currentVersion = getCurrentExtensionVersion();
    if (!currentVersion) {
        return;
    }

    const now = Date.now();
    const state = getUpdateCheckState();

    if (
        !skipThrottle &&
        state.lastCheck &&
        now - state.lastCheck < UPDATE_CHECK_INTERVAL_MS
    ) {
        // Check if a previously detected update should still be shown
        if (state.availableVersion && isVersionNewer(state.availableVersion, currentVersion)) {
            showUpdateAvailableToast(state.availableVersion);
        }
        return;
    }

    let lastCheckStatus = 'success';
    let lastError;

    try {
        const response = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Update check failed with status ${response.status}`);
        }

        const remoteManifest = await response.json();
        const remoteVersion = remoteManifest?.version;

        if (remoteVersion && isVersionNewer(remoteVersion, currentVersion)) {
            updateUpdateCheckState({
                availableVersion: remoteVersion,
                lastRemoteVersion: remoteVersion
            });
            showUpdateAvailableToast(remoteVersion);
        } else {
            updateUpdateCheckState({
                availableVersion: undefined,
                lastRemoteVersion: remoteVersion
            });
            hideUpdateAvailableToast();
        }
    } catch (error) {
        lastCheckStatus = 'error';
        lastError = error.message;
        console.error('Unable to check for updates:', error);
    } finally {
        updateUpdateCheckState({
            lastCheck: now,
            lastCheckStatus,
            lastError
        });
    }
}

function showUpdateAvailableToast(version) {
    const toast = document.getElementById('updateToast');
    const text = document.querySelector('#updateToast .update-toast-text');
    if (!toast || !text) return;

    text.textContent = 'Updates available';
    toast.hidden = false;
    toast.classList.add('visible');
}

function hideUpdateAvailableToast() {
    const toast = document.getElementById('updateToast');
    if (!toast) return;

    toast.classList.remove('visible');
    toast.hidden = true;
}

function isVersionNewer(candidate, baseline) {
    if (!candidate || !baseline) return false;

    const candidateParts = candidate.split('.').map((part) => parseInt(part, 10) || 0);
    const baselineParts = baseline.split('.').map((part) => parseInt(part, 10) || 0);
    const length = Math.max(candidateParts.length, baselineParts.length);

    for (let i = 0; i < length; i++) {
        const cand = candidateParts[i] || 0;
        const base = baselineParts[i] || 0;
        if (cand > base) return true;
        if (cand < base) return false;
    }

    return false;
}

