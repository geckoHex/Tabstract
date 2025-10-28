// --- Toast Notification ---

let toastTimeout;

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    // Clear any existing timeout
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    
    // Auto-hide after duration
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

