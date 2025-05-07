const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data, data2) => {
        console.log("preload.js: send called with channel:", channel);
        const validChannels = ['save-settings', 'window-resized', 'load-settings', 'window-fullscreen-true', 'window-fullscreen-false'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data, data2);
        }
    },
    receive: (channel, func) => {
        console.log("preload.js: receive called with channel:", channel);
        const validChannels = ['settings-saved', 'window-resized', 'call-load-settings', 'call-load-data', 'window-moved', 'window-fullscreen-true', 'window-fullscreen-false'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    }
});