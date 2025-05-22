const { contextBridge, ipcRenderer } = require('electron');

// Expose DEV_VERSION to renderer
let DEV_VERSION = false;
ipcRenderer.on('set-dev-version', (event, value) => {
    DEV_VERSION = value;
});

contextBridge.exposeInMainWorld('api', {
    send: (channel, ...args) => {
        console.log("preload.js: send called with channel:", channel, "and args:", args);  
        const validChannels = [
            'save-settings', 
            'load-settings', 
            'open-add-item-window',
            'open-add-item-with-range-window',
            'getStorySuggestions',
            'getTagSuggestions',
            'searchItems',
            'getItemsByTag',
            'getItemsByDate',
            'removeItem',
            'getAllItems',
            'addTimelineItem',
            'add-item-window-closing',
            'updateTimelineItem',
            'getItem',
            'open-edit-item-window',
            'open-edit-item-with-range-window',
            'confirm-import-timeline-data',
            'new-timeline',
            'quit-app',
            'get-all-timelines',
            'open-timeline',
            'delete-timeline',
            'get-timeline-info',
            'call-load-data', 
            'open-timeline-images',
            'save-new-image',
            'get-item-data',
            'renderer-ready',
            'generate-test-items',
            'recalculate-period-stacks',
            'edit-item-window-closing',
            'edit-item-with-range-window-closing',
            'update-timeline-item-with-range'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        }
    },
    invoke: async (channel, ...args) => {
        console.log("preload.js: invoke called with channel:", channel, "and args:", args);
        const validChannels = [
            'export-timeline-data',
            'import-timeline-data',
            'save-temp-file',
            'save-new-image'
        ];
        if (validChannels.includes(channel)) {
            return await ipcRenderer.invoke(channel, ...args);
        }
    },
    receive: (channel, func) => {
        console.log("preload.js: receive called with channel:", channel);
        const validChannels = [
            'settings-saved', 
            'window-resized', 
            'call-load-settings', 
            'call-load-data', 
            'window-moved', 
            'window-fullscreen-true', 
            'window-fullscreen-false', 
            'open-add-item-window', 
            'add-timeline-item',
            'item-created',
            'itemUpdated',
            'storySuggestions',
            'tagSuggestions',
            'searchResults',
            'tagSearchResults',
            'dateSearchResults',
            'itemRemoved',
            'items',
            'itemData',
            'export-timeline-data-success',
            'export-timeline-data-error',
            'import-timeline-data-confirm',
            'import-timeline-data-success',
            'import-timeline-data-error',
            'new-timeline',
            'quit-app',
            'timelines-list',
            'timeline-deleted',
            'timeline-delete-error',
            'timeline-info',
            'new-image-saved',
            'item-data',
            'data-ready',
            'test-items-generated',
            'recalculate-period-stacks',
            'log-message'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    readFile: (filename) => ipcRenderer.invoke('read-file', filename),
    getDevVersion: () => DEV_VERSION,
    getCurrentTimelineId: () => ipcRenderer.invoke('get-current-timeline-id'),
    log: {
        error: (message) => ipcRenderer.send('log-message', { level: 'error', message }),
        warn: (message) => ipcRenderer.send('log-message', { level: 'warn', message }),
        info: (message) => ipcRenderer.send('log-message', { level: 'info', message }),
        debug: (message) => ipcRenderer.send('log-message', { level: 'debug', message })
    }
});