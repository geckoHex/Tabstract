// --- Theme Functions ---

function getTheme() {
    const stored = localStorage.getItem('theme');
    if (!stored) {
        return { ...DEFAULT_THEME };
    }

    try {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_THEME, ...parsed };
    } catch (error) {
        console.error('Error parsing theme settings:', error);
        return { ...DEFAULT_THEME };
    }
}

function saveTheme(theme) {
    localStorage.setItem('theme', JSON.stringify(theme));
}

function setTheme(mode) {
    const theme = getTheme();
    theme.mode = mode;
    saveTheme(theme);
    applyTheme();
    updateThemeUI();
    showToast(`Theme set to ${mode}`);
}

function setAccentColor(color) {
    const theme = getTheme();
    theme.accentColor = color;
    saveTheme(theme);
    applyTheme();
    updateThemeUI();
    showToast('Accent color updated');
}

function updateBackgroundImageOpacity(value) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    const theme = getTheme();
    if (theme.backgroundImageOpacity === clamped) {
        updateThemeUI();
        return;
    }

    theme.backgroundImageOpacity = clamped;
    saveTheme(theme);
    applyTheme();
    updateThemeUI();
}

function setBackground(background) {
    const theme = getTheme();
    theme.background = background;
    saveTheme(theme);
    applyTheme();
    updateThemeUI();
    
    // Get a friendly name for the toast
    let name = 'None';
    if (background === 'white') name = 'White';
    else if (background === 'black') name = 'Black';
    else if (background.includes('banannas')) name = 'Bananas';
    else if (background.includes('moon-beach')) name = 'Moon Beach';
    else if (background.includes('office')) name = 'Office';
    else if (background.includes('retro-airport')) name = 'Retro Airport';
    else if (background.includes('underwater-dome')) name = 'Underwater Dome';
    
    showToast(`Background set to ${name}`);
}

function applyTheme() {
    const theme = getTheme();
    let mode = theme.mode;
    
    // Handle auto theme
    if (mode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        mode = prefersDark ? 'dark' : 'light';
    }
    
    // Apply theme
    document.documentElement.setAttribute('data-theme', mode);
    
    // Apply accent color
    const root = document.documentElement;
    root.style.setProperty('--accent-color', theme.accentColor);
    
    // Calculate hover color (slightly darker)
    const accentHover = adjustColor(theme.accentColor, -20);
    root.style.setProperty('--accent-hover', accentHover);
    
    // Calculate light colors
    const accentLight = hexToRgba(theme.accentColor, 0.1);
    const accentLighter = hexToRgba(theme.accentColor, 0.2);
    root.style.setProperty('--accent-light', accentLight);
    root.style.setProperty('--accent-lighter', accentLighter);
    
    // Apply background
    const body = document.body;
    const overlayStrength = 1 - ((theme.backgroundImageOpacity ?? DEFAULT_THEME.backgroundImageOpacity) / 100);
    const hasImageBackground = theme.background && !['none', 'white', 'black'].includes(theme.background);

    body.style.backgroundImage = '';
    body.style.backgroundColor = '';
    body.style.backgroundSize = '';
    body.style.backgroundPosition = '';
    body.style.backgroundRepeat = '';
    body.style.backgroundAttachment = '';

    if (!theme.background || theme.background === 'none') {
        // fall back to stylesheet defaults
        return;
    }

    if (theme.background === 'white' || theme.background === 'black') {
        body.style.backgroundColor = theme.background === 'white' ? '#ffffff' : '#000000';
        return;
    }

    if (hasImageBackground) {
        const layers = [];

        if (overlayStrength > 0) {
            const whiteAlpha = Math.min(1, overlayStrength * 0.6);
            const blackAlpha = Math.min(1, overlayStrength * 0.25);

            if (whiteAlpha > 0.001) {
                const alpha = whiteAlpha.toFixed(3);
                layers.push(`linear-gradient(rgba(255, 255, 255, ${alpha}), rgba(255, 255, 255, ${alpha}))`);
            }

            if (blackAlpha > 0.001) {
                const alpha = blackAlpha.toFixed(3);
                layers.push(`linear-gradient(rgba(0, 0, 0, ${alpha}), rgba(0, 0, 0, ${alpha}))`);
            }
        }

        layers.push(`url('${theme.background}')`);

        body.style.backgroundImage = layers.join(', ');
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundAttachment = 'fixed';
        return;
    }

    body.style.backgroundColor = theme.background;
}

// Helper function to adjust color brightness
function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// Helper function to convert hex to rgba
function hexToRgba(hex, alpha) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = num >> 16;
    const g = (num >> 8) & 0x00FF;
    const b = num & 0x0000FF;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

