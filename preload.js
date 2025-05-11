const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, ...args) => {
        console.log("preload.js: send called with channel:", channel, "and args:", args);  
        const validChannels = [
            'save-settings', 
            'load-settings', 
            'open-add-item-window',
            'open-add-item-with-range-window',
            'getStorySuggestions',
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
            'confirm-import-timeline-data'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        }
    },
    invoke: async (channel, ...args) => {
        console.log("preload.js: invoke called with channel:", channel, "and args:", args);
        const validChannels = [
            'export-timeline-data',
            'import-timeline-data'
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
            'storySuggestions',
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
            'import-timeline-data-error'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    readFile: (filename) => ipcRenderer.invoke('read-file', filename)
});