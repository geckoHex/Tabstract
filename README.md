# Tabstract - Chrome New Tab Extension

A beautiful and functional new tab page extension for Chrome with a search bar and quick shortcuts.

## Features

✨ **Clean Interface** - A modern, distraction-free design with a gradient background
🔍 **Search Bar** - Quick access to Google search from the new tab page
⚡ **Quick Shortcuts** - Access your favorite websites with one click
🎯 **Customizable** - Add, remove, and manage your shortcuts
💾 **Cloud Sync** - Your shortcuts sync across Chrome devices
⏰ **Time-based Greeting** - Dynamic greeting that changes based on time of day

## Installation

1. **Download/Clone the repository:**
   ```bash
   git clone <repository-url>
   cd tabstract
   ```

2. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `tabstract` folder
   - The extension should now appear in your extensions list

3. **Set as New Tab Page:**
   - The extension automatically overrides the new tab page
   - Open a new tab to see your new tab page!

## How to Use

### Search
- Click on the search bar or simply start typing when you open a new tab
- Press Enter to search with Google

### Add Shortcuts
- Click the "+ Add Shortcut" button
- Enter the website title and URL
- Click "Add Shortcut"
- Your shortcuts are automatically saved to Chrome Cloud Sync

### Delete Shortcuts
- Hover over any shortcut
- Click the "✕" button that appears

### Settings
- Click the gear icon in the bottom right to access settings (extensible for future features)

## File Structure

```
tabstract/
├── manifest.json      # Extension configuration
├── newtab.html       # Main HTML page
├── styles.css        # Styling and animations
├── script.js         # Functionality and interactions
└── README.md         # This file
```

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Storage**: Chrome Sync Storage (syncs across your Chrome devices)
- **APIs Used**: 
  - chrome.storage.sync
  - chrome.runtime.openOptionsPage
  - chrome.url_overrides

## Browser Compatibility

- ✅ Chrome 88+
- ✅ Edge 88+
- ⚠️ Other Chromium-based browsers may work but are not officially tested

## Future Features

- [ ] Options page for customization
- [ ] Theme selection
- [ ] Clock widget
- [ ] Weather widget
- [ ] To-do list
- [ ] Keyboard shortcuts
- [ ] Import/Export settings

## License

MIT License

## Support

For issues or feature requests, please open an issue on the repository.
