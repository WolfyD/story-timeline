const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

describe('Application Launch', () => {
    let mainWindow;

    beforeEach(() => {
        // Clear any existing windows
        BrowserWindow.getAllWindows().forEach(window => window.close());
    });

    afterEach(() => {
        if (mainWindow) {
            mainWindow.close();
        }
    });

    test('App starts successfully', async () => {
        const appReady = new Promise(resolve => {
            app.on('ready', () => {
                mainWindow = BrowserWindow.getAllWindows()[0];
                resolve();
            });
        });

        // Start the app
        app.emit('ready');

        await appReady;
        expect(mainWindow).not.toBeNull();
    });

    test('Main window opens with correct properties', async () => {
        const appReady = new Promise(resolve => {
            app.on('ready', () => {
                mainWindow = BrowserWindow.getAllWindows()[0];
                resolve();
            });
        });

        app.emit('ready');
        await appReady;

        // Check window properties
        expect(mainWindow.isVisible()).toBe(true);
        expect(mainWindow.isResizable()).toBe(false);
        expect(mainWindow.getTitle()).toBe('Story Timeline');
    });

    test('Window is centered on screen', async () => {
        const appReady = new Promise(resolve => {
            app.on('ready', () => {
                mainWindow = BrowserWindow.getAllWindows()[0];
                resolve();
            });
        });

        app.emit('ready');
        await appReady;

        const bounds = mainWindow.getBounds();
        const screenBounds = mainWindow.getDisplay().bounds;

        // Check if window is centered
        const expectedX = (screenBounds.width - bounds.width) / 2;
        const expectedY = (screenBounds.height - bounds.height) / 2;

        expect(Math.abs(bounds.x - expectedX)).toBeLessThan(10); // Allow small margin of error
        expect(Math.abs(bounds.y - expectedY)).toBeLessThan(10);
    });
});

describe('Splash Screen', () => {
    let mainWindow;

    beforeEach(() => {
        BrowserWindow.getAllWindows().forEach(window => window.close());
    });

    afterEach(() => {
        if (mainWindow) {
            mainWindow.close();
        }
    });

    test('Splash screen appears on startup', async () => {
        const appReady = new Promise(resolve => {
            app.on('ready', () => {
                mainWindow = BrowserWindow.getAllWindows()[0];
                resolve();
            });
        });

        app.emit('ready');
        await appReady;

        // Check if splash screen elements exist
        const splashScreen = await mainWindow.webContents.executeJavaScript(`
            document.getElementById('splash-screen') !== null
        `);
        expect(splashScreen).toBe(true);
    });

    test('Splash screen shows correct version', async () => {
        const appReady = new Promise(resolve => {
            app.on('ready', () => {
                mainWindow = BrowserWindow.getAllWindows()[0];
                resolve();
            });
        });

        app.emit('ready');
        await appReady;

        // Get version from package.json
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
        const expectedVersion = packageJson.version;

        // Check if version is displayed correctly
        const displayedVersion = await mainWindow.webContents.executeJavaScript(`
            document.getElementById('version-number').textContent
        `);
        expect(displayedVersion).toContain(expectedVersion);
    });

    test('Splash screen shows loading animation', async () => {
        const appReady = new Promise(resolve => {
            app.on('ready', () => {
                mainWindow = BrowserWindow.getAllWindows()[0];
                resolve();
            });
        });

        app.emit('ready');
        await appReady;

        // Check if loading animation exists
        const loadingAnimation = await mainWindow.webContents.executeJavaScript(`
            document.getElementById('loading-animation') !== null
        `);
        expect(loadingAnimation).toBe(true);

        // Check if animation is running
        const isAnimating = await mainWindow.webContents.executeJavaScript(`
            window.getComputedStyle(document.getElementById('loading-animation')).animationName !== 'none'
        `);
        expect(isAnimating).toBe(true);
    });
}); 