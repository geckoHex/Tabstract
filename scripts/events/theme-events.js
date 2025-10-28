function setupThemeControls() {
    document.querySelectorAll('.theme-option').forEach((button) => {
        button.addEventListener('click', (event) => {
            const theme = event.currentTarget.getAttribute('data-theme');
            if (theme) {
                setTheme(theme);
            }
        });
    });

    document.querySelectorAll('.color-option').forEach((button) => {
        button.addEventListener('click', (event) => {
            const color = event.currentTarget.getAttribute('data-color');
            if (color) {
                setAccentColor(color);
            }
        });
    });

    document.querySelectorAll('.background-option').forEach((button) => {
        button.addEventListener('click', (event) => {
            const background = event.currentTarget.getAttribute('data-background');
            if (background) {
                setBackground(background);
            }
        });
    });

    const backgroundOpacitySlider = document.getElementById('backgroundImageOpacity');
    if (!backgroundOpacitySlider) {
        return;
    }

    backgroundOpacitySlider.addEventListener('input', (event) => {
        updateBackgroundImageOpacity(Number(event.target.value));
    });

    backgroundOpacitySlider.addEventListener('change', (event) => {
        showToast(`Background clarity ${event.target.value}%`);
    });
}
