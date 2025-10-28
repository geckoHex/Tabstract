function loadTheme() {
    applyTheme();
    updateThemeUI();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const theme = getTheme();
        if (theme.mode === 'auto') {
            applyTheme();
        }
    });
}

function updateThemeUI() {
    const theme = getTheme();

    document.querySelectorAll('.theme-option').forEach((button) => {
        const btnTheme = button.getAttribute('data-theme');
        if (btnTheme === theme.mode) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    document.querySelectorAll('.color-option').forEach((button) => {
        const btnColor = button.getAttribute('data-color');
        if (btnColor === theme.accentColor) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    document.querySelectorAll('.background-option').forEach((button) => {
        const btnBackground = button.getAttribute('data-background');
        if (btnBackground === theme.background) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    const backgroundOpacitySlider = document.getElementById('backgroundImageOpacity');
    const backgroundOpacityValue = document.getElementById('backgroundImageOpacityValue');
    const backgroundOpacityLabel = document.querySelector('.theme-slider .slider-label');
    const sliderValue = theme.backgroundImageOpacity ?? DEFAULT_THEME.backgroundImageOpacity;
    const hasImageBackground = theme.background && !['none', 'white', 'black'].includes(theme.background);

    if (backgroundOpacitySlider) {
        backgroundOpacitySlider.value = String(sliderValue);
        backgroundOpacitySlider.disabled = !hasImageBackground;
    }

    if (backgroundOpacityValue) {
        backgroundOpacityValue.textContent = hasImageBackground ? `${sliderValue}%` : 'N/A';
    }

    if (backgroundOpacityLabel) {
        backgroundOpacityLabel.classList.toggle('disabled', !hasImageBackground);
    }
}
