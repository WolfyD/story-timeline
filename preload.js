const { contextBridge, ipcRenderer } = require('electron');

// Expose DEV_VERSION to renderer
let DEV_VERSION = false;
ipcRenderer.on('set-dev-version', (event, value) => {
    DEV_VERSION = value;
});

contextBridge.exposeInMainWorld('api', {
    send: (channel, ...args) => {
        // console.log("preload.js: send called with channel:", channel, "and args:", args);  
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
            'update-timeline-item-with-range',
            'timeline-updated',
            'open-archive-window',
            'getAllStories',
            'getAllStoryReferences',
            'getAllMedia',
            'getAllTags',
            'itemRemoved',
            'updateTimeline',
            'force-timeline-refresh',
            'refresh-timeline',
            'jumpToYear',
            'jumpToDate',
            'duplicate-timeline',
            'reset-timeline-css',
            'set-window-scale',
            // Character system channels
            'open-add-character-window',
            'open-edit-character-window',
            'open-character-manager-window',
            'getAllCharacters',
            'getAllCharacterRelationships',
            'getAllCharacterReferences',
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
            'save-new-image',
            'get-timeline-data',
            'get-all-items',
            'removeStory',
            'removeTag',
            'get-picture-usage',
            'cleanup-orphaned-images',
            'add-image-reference',
            'remove-image-reference',
            'removeMedia',
            'save-timeline-export',
            'convert-image-to-base64',
            'open-exported-file',
            'consolidate-duplicate-images',
            'consolidate-visual-duplicate-images',
            'get-all-pictures-debug',
            'analyze-filesystem-vs-database',
            'get-current-timeline-id',
            'read-file',
            // Character system invoke channels
            'add-character',
            'get-character',
            'get-all-characters',
            'update-character',
            'delete-character',
            'search-characters',
            'add-character-relationship',
            'get-character-relationships',
            'get-all-character-relationships',
            'update-character-relationship',
            'delete-character-relationship',
            'add-character-references-to-item',
            'get-item-character-references',
            'get-all-character-references',
            'get-items-referencing-character',
            'get-character-stats',
            'validate-relationship-type'
        ];
        if (validChannels.includes(channel)) {
            return await ipcRenderer.invoke(channel, ...args);
        }
    },
    receive: (channel, func) => {
        // console.log("preload.js: receive called with channel:", channel);
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
            'log-message',
            'timeline-updated',
            'archive-items',
            'stories',
            'storyReferences',
            'media',
            'tags',
            'force-timeline-refresh',
            'refresh-timeline',
            'jumpToYear',
            'jumpToDate',
            'timeline-duplicated',
            'window-scale-changed',
            // Character system receive channels
            'characters',
            'characterRelationships',
            'characterReferences',
            'character-data',
            'timeline-id'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    readFile: (filename) => ipcRenderer.invoke('read-file', filename),
    getDevVersion: () => DEV_VERSION,
    getCurrentTimelineId: () => ipcRenderer.invoke('get-current-timeline-id'),
    getCurrentTimelineGranularity: () => ipcRenderer.invoke('get-current-timeline-granularity'),
    log: {
        error: (message) => ipcRenderer.send('log-message', { level: 'error', message }),
        warn: (message) => ipcRenderer.send('log-message', { level: 'warn', message }),
        info: (message) => ipcRenderer.send('log-message', { level: 'info', message }),
        debug: (message) => ipcRenderer.send('log-message', { level: 'debug', message })
    }
});