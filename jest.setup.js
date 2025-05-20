// Add custom jest matchers from jest-dom
require('@testing-library/jest-dom');

// Mock window.api
window.api = {
    send: jest.fn(),
    receive: jest.fn((channel, callback) => {
        // Store callback for later use in tests
        window.api._callbacks = window.api._callbacks || {};
        window.api._callbacks[channel] = callback;
    }),
    _callbacks: {},
    _trigger: function(channel, ...args) {
        if (this._callbacks[channel]) {
            this._callbacks[channel](...args);
        }
    }
};

// Mock electron
window.require = jest.fn(() => ({
    ipcRenderer: {
        send: jest.fn()
    }
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock timeline state and functions
window.timelineState = {
    focusYear: 0,
    granularity: 22,
    items: [],
    pixelsPerSubtick: 1
};

window.setInitialSettings = jest.fn((settings) => {
    window.timelineState = {
        ...window.timelineState,
        ...settings
    };
});

// Mock boundary checking
window.isWithinTimelineBoundaries = jest.fn((year, subtick) => {
    const startMarker = window.timelineState.items.find(item => item.type === 'Timeline_start');
    const endMarker = window.timelineState.items.find(item => item.type === 'Timeline_end');
    
    if (startMarker && (year < startMarker.year || (year === startMarker.year && subtick < startMarker.subtick))) {
        return false;
    }
    if (endMarker && (year > endMarker.year || (year === endMarker.year && subtick > endMarker.subtick))) {
        return false;
    }
    return true;
});

window.jumpToYear = jest.fn((year) => {
    const subtick = 0; // Default subtick for simplicity
    if (window.isWithinTimelineBoundaries(year, subtick)) {
        window.timelineState.focusYear = year;
    }
});

// Mock context menu
window.showContextMenu = jest.fn((x, y) => {
    const year = window.calculateYearFromPosition(x);
    const subtick = window.calculateSubtickFromPosition(x);
    
    if (window.isWithinTimelineBoundaries(year, subtick)) {
        const menu = document.createElement('div');
        menu.id = 'timeline-context-menu';
        document.body.appendChild(menu);
    }
});

// Mock timeline calculation functions
window.calculateYearFromPosition = jest.fn((x) => {
    const containerRect = document.getElementById('timeline-container').getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const pixelsPerYear = window.timelineState.granularity;
    return Math.floor((x - centerX) / pixelsPerYear);
});

window.calculateSubtickFromPosition = jest.fn((x) => {
    const containerRect = document.getElementById('timeline-container').getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const pixelsPerYear = window.timelineState.granularity;
    const yearOffset = (x - centerX) % pixelsPerYear;
    return Math.floor(yearOffset);
});

// Mock event handlers
window.handleContextMenu = jest.fn((event) => {
    event.preventDefault();
    window.showContextMenu(event.clientX, event.clientY);
}); 