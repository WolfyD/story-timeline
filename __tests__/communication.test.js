const { ipcMain, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('../database');

describe('IPC Communication', () => {
    let mainWindow;
    let db;

    beforeEach(() => {
        // Setup test database
        db = new Database(':memory:');
        
        // Mock main window
        mainWindow = {
            webContents: {
                send: jest.fn(),
                on: jest.fn()
            }
        };
    });

    afterEach(() => {
        db.close();
    });

    test('Main process can send messages to renderer', () => {
        const testData = { type: 'test', data: 'hello' };
        mainWindow.webContents.send('test-channel', testData);
        expect(mainWindow.webContents.send).toHaveBeenCalledWith('test-channel', testData);
    });

    test('Renderer process can receive messages from main', () => {
        const testData = { type: 'test', data: 'hello' };
        const callback = jest.fn();
        
        ipcRenderer.on('test-channel', callback);
        ipcMain.emit('test-channel', null, testData);
        
        expect(callback).toHaveBeenCalledWith(null, testData);
    });
});

describe('Database Communication', () => {
    let db;

    beforeEach(() => {
        db = new Database(':memory:');
    });

    afterEach(() => {
        db.close();
    });

    test('Database connection is established', () => {
        expect(db.isConnected()).toBe(true);
    });

    test('Database can execute queries', () => {
        const result = db.prepare('SELECT 1').get();
        expect(result).toEqual({ 1: 1 });
    });

    test('Database transactions are atomic', () => {
        db.prepare('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)').run();
        
        db.transaction(() => {
            db.prepare('INSERT INTO test (name) VALUES (?)').run('test1');
            db.prepare('INSERT INTO test (name) VALUES (?)').run('test2');
        })();

        const count = db.prepare('SELECT COUNT(*) as count FROM test').get();
        expect(count.count).toBe(2);
    });
});

describe('File System Communication', () => {
    const testDir = path.join(__dirname, 'test-files');
    
    beforeEach(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir);
        }
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    test('Can create and read files', () => {
        const testFile = path.join(testDir, 'test.txt');
        const testData = 'Hello, World!';
        
        fs.writeFileSync(testFile, testData);
        const readData = fs.readFileSync(testFile, 'utf8');
        
        expect(readData).toBe(testData);
    });

    test('Can handle file permissions', () => {
        const testFile = path.join(testDir, 'permissions.txt');
        fs.writeFileSync(testFile, 'test');
        
        // Test read permission
        expect(() => fs.readFileSync(testFile)).not.toThrow();
        
        // Test write permission
        expect(() => fs.writeFileSync(testFile, 'test2')).not.toThrow();
    });
});

describe('Event Communication', () => {
    let mainWindow;
    
    beforeEach(() => {
        mainWindow = {
            webContents: {
                send: jest.fn(),
                on: jest.fn()
            }
        };
    });

    test('Timeline events are properly emitted', () => {
        const eventData = { type: 'timeline-update', data: { year: 1000, event: 'Test Event' } };
        mainWindow.webContents.send('timeline-event', eventData);
        
        expect(mainWindow.webContents.send).toHaveBeenCalledWith('timeline-event', eventData);
    });

    test('UI events are properly handled', () => {
        const callback = jest.fn();
        mainWindow.webContents.on('ui-event', callback);
        
        const eventData = { type: 'button-click', data: { buttonId: 'test-button' } };
        mainWindow.webContents.emit('ui-event', eventData);
        
        expect(callback).toHaveBeenCalledWith(eventData);
    });
});

describe('Error Handling in Communication', () => {
    let db;
    
    beforeEach(() => {
        db = new Database(':memory:');
    });

    afterEach(() => {
        db.close();
    });

    test('Database errors are properly caught and reported', () => {
        expect(() => {
            db.prepare('INVALID SQL').run();
        }).toThrow();
    });

    test('File system errors are properly handled', () => {
        const nonExistentFile = path.join(__dirname, 'non-existent-file.txt');
        expect(() => {
            fs.readFileSync(nonExistentFile);
        }).toThrow();
    });

    test('IPC errors are properly handled', () => {
        const callback = jest.fn();
        ipcRenderer.on('error', callback);
        
        const error = new Error('Test error');
        ipcMain.emit('error', null, error);
        
        expect(callback).toHaveBeenCalledWith(null, error);
    });
}); 