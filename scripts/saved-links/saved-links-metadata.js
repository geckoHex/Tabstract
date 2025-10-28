function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

function fetchLinkMetadata(link) {
    fetch(link.url)
        .then((response) => response.text())
        .then((html) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const title = doc.querySelector('title')?.textContent || extractDomain(link.url);

            const savedLinks = getSavedLinks();
            const linkToUpdate = savedLinks.find((savedLink) => savedLink.id === link.id);
            if (linkToUpdate) {
                linkToUpdate.title = title;
                setSavedLinks(savedLinks);
                loadSavedLinks();
            }
        })
        .catch(() => {});
}

function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch {
        return 'public/icons/globe-hemisphere-west.svg';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getSavedLinkDisplayTitle(link) {
    const rawTitle = sanitizeSavedLinkTitle(link?.title);
    const fallbackName = deriveSiteNameFromUrl(link?.url || '');

    if (rawTitle && !isDomainLikeTitle(rawTitle, link?.url || '', fallbackName)) {
        return rawTitle;
    }

    return fallbackName;
}

function formatSavedLinkTimeAgo(savedAt) {
    if (!savedAt) {
        return 'Saved just now';
    }

    const savedDate = new Date(savedAt);
    if (Number.isNaN(savedDate.getTime())) {
        return 'Saved just now';
    }

    const diffInSeconds = Math.max(0, Math.floor((Date.now() - savedDate.getTime()) / 1000));
    const intervals = [
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 },
        { label: 'second', seconds: 1 }
    ];

    for (const { label, seconds } of intervals) {
        const value = Math.floor(diffInSeconds / seconds);
        if (value >= 1) {
            const suffix = value === 1 ? label : `${label}s`;
            return `Saved ${value} ${suffix} ago`;
        }
    }

    return 'Saved just now';
}

function sanitizeSavedLinkTitle(title) {
    return (title || '').replace(/\s+/g, ' ').trim();
}

function isDomainLikeTitle(title, url, fallbackName) {
    const normalizedTitle = normalizeComparableValue(title);
    const normalizedDomain = normalizeComparableValue(extractDomain(url));
    const normalizedFallback = normalizeComparableValue(fallbackName);
    const normalizedUrl = normalizeComparableValue(url);

    return (
        normalizedTitle === normalizedDomain ||
        (normalizedFallback && normalizedTitle === normalizedFallback) ||
        (normalizedUrl && normalizedTitle === normalizedUrl)
    );
}

function normalizeComparableValue(value) {
    return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function deriveSiteNameFromUrl(url) {
    try {
        const { hostname } = new URL(url);
        if (!hostname) {
            return url || 'Unknown site';
        }

        const trimmed = hostname.replace(/^www\./i, '');
        if (!trimmed) {
            return 'Unknown site';
        }

        const segments = trimmed.split('.').filter(Boolean);
        if (segments.length === 0) {
            return 'Unknown site';
        }

        const core = extractPrimaryDomainSegment(segments);
        const words = core.split(/[-_]+/).filter(Boolean);

        const readable = words
            .map((segment) =>
                segment.toUpperCase() === segment ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)
            )
            .join(' ');

        return readable || core || trimmed;
    } catch (error) {
        console.warn('Unable to derive site name from URL', url, error);
        return url || 'Unknown site';
    }
}

const GENERIC_SECOND_LEVEL_DOMAINS = new Set([
    'ac',
    'co',
    'com',
    'edu',
    'gov',
    'ltd',
    'me',
    'net',
    'org',
    'plc'
]);

function extractPrimaryDomainSegment(segments) {
    if (segments.length === 1) {
        return segments[0];
    }

    const last = segments[segments.length - 1];
    const secondLast = segments[segments.length - 2];

    if (GENERIC_SECOND_LEVEL_DOMAINS.has(secondLast.toLowerCase())) {
        return segments[segments.length - 3] || secondLast;
    }

    return secondLast;
}
