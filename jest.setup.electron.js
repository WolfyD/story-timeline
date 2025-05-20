// Mock electron app
const electron = require('electron');
jest.mock('electron', () => ({
    app: {
        on: jest.fn(),
        emit: jest.fn(),
        getPath: jest.fn(),
        quit: jest.fn()
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
        loadURL: jest.fn(),
        webContents: {
            executeJavaScript: jest.fn(),
            on: jest.fn()
        },
        on: jest.fn(),
        isVisible: jest.fn().mockReturnValue(true),
        isResizable: jest.fn().mockReturnValue(false),
        getTitle: jest.fn().mockReturnValue('Story Timeline'),
        getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }),
        getDisplay: jest.fn().mockReturnValue({
            bounds: { width: 1920, height: 1080 }
        }),
        close: jest.fn()
    })),
    screen: {
        getPrimaryDisplay: jest.fn().mockReturnValue({
            bounds: { width: 1920, height: 1080 }
        })
    }
}));

// Mock fs
jest.mock('fs', () => ({
    readFileSync: jest.fn().mockReturnValue(JSON.stringify({
        version: '0.2.1'
    }))
}));

// Mock path
jest.mock('path', () => ({
    join: jest.fn().mockReturnValue('/mock/path')
})); 