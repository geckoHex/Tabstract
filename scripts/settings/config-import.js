function handleConfigImportFileSelection(event) {
    const input = event?.target;
    const file = input?.files?.[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
        try {
            const content = loadEvent?.target?.result;
            if (typeof content !== 'string') {
                throw new Error('Invalid config file');
            }

            const parsed = JSON.parse(content);
            const sanitized = sanitizeImportedConfiguration(parsed);

            const confirmed = confirm('Importing this configuration will overwrite your current settings, quick links, and saved links. Continue?');
            if (!confirmed) {
                return;
            }

            applyImportedConfiguration(sanitized);
            showToast('Config imported');
        } catch (error) {
            console.error('Failed to import configuration:', error);
            const message = (error && error.message) ? error.message : 'Failed to import config';
            showToast(message);
        } finally {
            if (input) {
                input.value = '';
            }
        }
    };

    reader.onerror = () => {
        showToast('Failed to read file');
        if (input) {
            input.value = '';
        }
    };

    reader.readAsText(file);
}

function sanitizeImportedConfiguration(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object') {
        throw new Error('Invalid config file');
    }

    if (!rawConfig.settings || typeof rawConfig.settings !== 'object') {
        throw new Error('Config missing settings');
    }

    if (!rawConfig.theme || typeof rawConfig.theme !== 'object') {
        throw new Error('Config missing theme');
    }

    const sanitized = {
        settings: sanitizeConfigSettings(rawConfig.settings),
        theme: sanitizeConfigTheme(rawConfig.theme),
        quickLinks: sanitizeConfigQuickLinks(rawConfig.quickLinks),
        savedLinks: sanitizeConfigSavedLinks(rawConfig.savedLinks)
    };

    if (rawConfig.activeSearchFilter && typeof rawConfig.activeSearchFilter === 'string') {
        sanitized.activeSearchFilter = rawConfig.activeSearchFilter;
    }

    if (rawConfig.updateCheckState && typeof rawConfig.updateCheckState === 'object') {
        sanitized.updateCheckState = rawConfig.updateCheckState;
    }

    return sanitized;
}

function sanitizeConfigSettings(candidate) {
    const sanitized = { ...DEFAULT_SETTINGS };
    const source = candidate && typeof candidate === 'object' ? candidate : {};
    const validEngines = new Set(['google', 'bing', 'duckduckgo']);

    if (typeof source.searchEngine === 'string' && validEngines.has(source.searchEngine)) {
        sanitized.searchEngine = source.searchEngine;
    }

    if (source.typeAnywhere !== undefined) {
        sanitized.typeAnywhere = Boolean(source.typeAnywhere);
    }

    if (source.openLinksNewTab !== undefined) {
        sanitized.openLinksNewTab = Boolean(source.openLinksNewTab);
    }

    if (typeof source.userName === 'string') {
        sanitized.userName = source.userName.trim().slice(0, 40);
    }

    if (source.showSearchHint !== undefined) {
        sanitized.showSearchHint = Boolean(source.showSearchHint);
    }

    if (source.checkForUpdates !== undefined) {
        sanitized.checkForUpdates = Boolean(source.checkForUpdates);
    }

    if (typeof source.faviconLoadMode === 'string') {
        const validModes = new Set(['immediate', 'delayed', 'manual']);
        if (validModes.has(source.faviconLoadMode)) {
            sanitized.faviconLoadMode = source.faviconLoadMode;
        }
    }

    if (Array.isArray(source.blockedTerms)) {
        const trimmed = source.blockedTerms
            .filter(term => typeof term === 'string')
            .map(term => term.trim())
            .filter(term => term.length > 0);
        sanitized.blockedTerms = Array.from(new Set(trimmed));
    }

    return sanitized;
}

function sanitizeConfigTheme(candidate) {
    const sanitized = { ...DEFAULT_THEME };
    const source = candidate && typeof candidate === 'object' ? candidate : {};
    const validModes = new Set(['light', 'dark', 'auto']);

    if (typeof source.mode === 'string' && validModes.has(source.mode)) {
        sanitized.mode = source.mode;
    }

    if (typeof source.accentColor === 'string') {
        const color = source.accentColor.trim();
        if (/^#[0-9A-Fa-f]{3,8}$/.test(color)) {
            sanitized.accentColor = color;
        }
    }

    if (typeof source.background === 'string') {
        sanitized.background = source.background;
    }

    const opacity = Number(source.backgroundImageOpacity);
    if (!Number.isNaN(opacity)) {
        sanitized.backgroundImageOpacity = Math.min(100, Math.max(0, Math.round(opacity)));
    }

    return sanitized;
}

function sanitizeConfigQuickLinks(candidate) {
    if (!Array.isArray(candidate)) {
        return [];
    }

    const baseTimestamp = Date.now();

    return candidate.map((item, index) => {
        if (!item || typeof item !== 'object') {
            return null;
        }

        const title = typeof item.title === 'string' ? item.title.trim() : '';
        let url = typeof item.url === 'string' ? item.url.trim() : '';

        if (!title || !url) {
            return null;
        }

        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }

        if (!isValidUrl(url)) {
            return null;
        }

        const favicon = (typeof item.favicon === 'string' && item.favicon.trim())
            ? item.favicon
            : getFaviconUrl(url);

        const id = (typeof item.id === 'string' && item.id.trim())
            ? item.id
            : `imported-quick-link-${baseTimestamp}-${index}`;

        return {
            id,
            title,
            url,
            favicon
        };
    }).filter(Boolean);
}

function sanitizeConfigSavedLinks(candidate) {
    if (!Array.isArray(candidate)) {
        return [];
    }

    const baseTimestamp = Date.now();

    return candidate.map((item, index) => {
        if (!item || typeof item !== 'object') {
            return null;
        }

        let url = typeof item.url === 'string' ? item.url.trim() : '';
        if (!url) {
            return null;
        }

        if (!/^https?:\/\//i.test(url)) {
            url = `https://${url}`;
        }

        if (!isValidUrl(url)) {
            return null;
        }

        const title = typeof item.title === 'string' && item.title.trim()
            ? item.title.trim().slice(0, 140)
            : extractDomain(url);

        const savedAt = typeof item.savedAt === 'string' && !Number.isNaN(new Date(item.savedAt).getTime())
            ? item.savedAt
            : new Date().toISOString();

        const id = (typeof item.id === 'string' && item.id.trim())
            ? item.id
            : `imported-saved-link-${baseTimestamp}-${index}`;

        const sanitizedLink = {
            id,
            url,
            title,
            savedAt
        };

        if (typeof item.favicon === 'string' && item.favicon.trim()) {
            sanitizedLink.favicon = item.favicon.trim();
        }

        if (typeof item.notes === 'string' && item.notes.trim()) {
            sanitizedLink.notes = item.notes.trim();
        }

        return sanitizedLink;
    }).filter(Boolean);
}

function applyImportedConfiguration(config) {
    if (!config) {
        return;
    }

    localStorage.setItem('settings', JSON.stringify(config.settings));
    localStorage.setItem('theme', JSON.stringify(config.theme));
    localStorage.setItem('quickLinks', JSON.stringify(config.quickLinks));
    localStorage.setItem('savedLinks', JSON.stringify(config.savedLinks));

    if (config.activeSearchFilter) {
        localStorage.setItem('activeSearchFilter', config.activeSearchFilter);
    } else {
        localStorage.removeItem('activeSearchFilter');
    }

    if (config.updateCheckState) {
        setUpdateCheckState(config.updateCheckState);
    } else {
        localStorage.removeItem(UPDATE_CHECK_STATE_KEY);
    }

    loadSettings();
    loadTheme();
    loadQuickLinks();
    loadSavedLinks();
    setupTypeAnywhereListeners();
    updateGreeting(true);
}

