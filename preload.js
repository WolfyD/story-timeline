const { contextBridge, ipcRenderer } = require('electron');

console.warn('[preload] loaded into newItemWindow');

contextBridge.exposeInMainWorld('api', {
    send: (channel, ...args) => {
        const validChannels = [
            'save-settings', 
            'load-settings', 
            'open-add-item-window',
            'getStorySuggestions',
            'searchItems',
            'getItemsByTag',
            'getItemsByDate',
            'removeItem',
            'getAllItems',
            'addTimelineItem',
            'add-item-window-closing'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, ...args);
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
            'items'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});