export const DB_NAME = "TabstractDB";
export const DB_VERSION = 3;
export const ITEMS_STORE = "items";
export const FAVORITES_STORE = "favorites";
export const SETTINGS_STORE = "settings";
export const SAVES_STORE = "saves";
export const FAVICONS_STORE = "favicons";

export const HOUR_MS = 60 * 60 * 1000;
export const SAVE_ARCHIVE_OPTIONS = {
  21600000: { value: 6 * HOUR_MS, label: "6 hours" },
  43200000: { value: 12 * HOUR_MS, label: "12 hours" },
  86400000: { value: 24 * HOUR_MS, label: "24 hours" },
  604800000: { value: 7 * 24 * HOUR_MS, label: "1 week" },
};
export const DEFAULT_SAVE_ARCHIVE_AFTER_MS = 12 * HOUR_MS;
export const RECENT_FOLDER_RESTORE_MS = 10 * 1000;
export const OPENAI_CHAT_MODEL = "gpt-5.5";
export const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
export const MAX_FAVORITES = 16;

export const AI_PROVIDERS = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    urlPrefix: "https://chatgpt.com/?q=",
    icon: "openai.svg",
    placeholder: "Ask ChatGPT...",
    inputAria: "ChatGPT prompt",
    clearAria: "Clear ChatGPT prompt",
  },
  claude: {
    id: "claude",
    label: "Claude",
    urlPrefix: "https://claude.ai/new?q=",
    icon: "claude.svg",
    placeholder: "Ask Claude...",
    inputAria: "Claude prompt",
    clearAria: "Clear Claude prompt",
  },
};

export const WALLPAPERS = {
  off: { id: "off", label: "Off" },
  city: { id: "city", label: "City", image: "backgrounds/City.png" },
  farm: { id: "farm", label: "Farm", image: "backgrounds/Farm.png" },
  mountains: { id: "mountains", label: "Mountains", image: "backgrounds/Mountains.png" },
  ponds: { id: "ponds", label: "Ponds", image: "backgrounds/Ponds.png" },
};

export const iconSrc = (file) => chrome.runtime.getURL(`icons/${file}`);
