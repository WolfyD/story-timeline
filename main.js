/**
 * Main Process Module
 * 
 * This is the main Electron process file that handles the core application functionality.
 * It manages the application lifecycle, window creation, IPC communication, and database operations.
 * 
 * Key Responsibilities:
 * - Application initialization and lifecycle management
 * - Window creation and management (main window, add/edit item windows)
 * - IPC communication between main and renderer processes
 * - File system operations (import/export)
 * - Database operations through dbManager
 * 
 * Main Functions:
 * - createWindow(): Creates and configures the main application window
 * - createAddItemWindow(year, subtick, granularity): Creates window for adding new timeline items
 * - createEditItemWindow(item): Creates window for editing existing timeline items
 * - setupIpcHandlers(): Sets up all IPC communication handlers
 * - loadSettings(): Loads application settings from database
 * - saveSettings(newSettings): Saves application settings to database
 * - loadData(): Loads timeline data from database
 * - saveData(newData): Saves timeline data to database
 * 
 * IPC Handlers:
 * - 'save-settings': Handles saving application settings
 * - 'addTimelineItem': Handles adding new timeline items
 * - 'updateTimelineItem': Handles updating existing timeline items
 * - 'removeItem': Handles removing timeline items
 * - 'import-timeline-data': Handles importing timeline data from JSON
 * - 'export-timeline-data': Handles exporting timeline data to JSON
 */

// ===== Imports =====
const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dbManager = require('./dbManager');

// ===== Constants =====
/**
 * Application constants
 * @type {string} SETTINGS_FILE - Path to settings file
 * @type {string} DATA_FILE - Path to data file
 * @type {Object} DEFAULT_SETTINGS - Default application settings
 */
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const DATA_FILE = path.join(app.getPath('userData'), 'data.json');
const DEFAULT_SETTINGS = {
    font: 0,
    fontSizeScale: 1,
    isFullscreen: false,
    customCSS: '',
    customMainCSS: '',
    customItemsCSS: '',
    useTimelineCSS: false,
    useMainCSS: false,
    useItemsCSS: false,
    pixelsPerSubtick: 20,
    showGuides: true
};

// ===== State Management =====
/**
 * Application state
 * @type {BrowserWindow} mainWindow - Main application window
 * @type {BrowserWindow} addItemWindow - Add item window
 * @type {BrowserWindow} editItemWindow - Edit item window
 * @type {Object} settings - Current application settings
 * @type {Object} data - Current timeline data
 */
let mainWindow;
let addItemWindow;
let editItemWindow;
let settings = DEFAULT_SETTINGS;
let data = {
    title: '',
    author: '',
    description: '',
    start: 0,
    granularity: 4,
    items: [],
    size: {
        x: 800,
        y: 600
    }
};

// ===== Window Management =====
/**
 * Creates the main application window
 * 
 * How it works:
 * 1. Creates BrowserWindow instance
 * 2. Loads index.html
 * 3. Sets up window events
 * 
 * Possible errors:
 * - Window creation failure
 * - File load failure
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    width: data.size.x,
    height: data.size.y,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
      defaultEncoding: 'utf-8',
      webgl: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  
  mainWindow.loadFile('index.html');

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on("resize", () => {
    mainWindow.webContents.send("window-resized", mainWindow.getSize(), mainWindow.isMaximized());
  });

  mainWindow.on("move", () => {
    let displays = screen.getAllDisplays();
    try {
      let display = displays.find(display => display.bounds.x <= mainWindow.getPosition()[0] + 30 && display.bounds.x + display.bounds.width >= mainWindow.getPosition()[0] - 30);
      mainWindow.webContents.send("window-moved", mainWindow.getPosition(), display.scaleFactor);
    } catch (error) {
      mainWindow.webContents.send("window-moved", mainWindow.getPosition());
    }
  });
  
  mainWindow.on("ready-to-show", () => {
    // Load settings from database
    const settings = dbManager.getSettings();
    const universeData = dbManager.getUniverseData();
    
    // Always show the window first
    mainWindow.show();

    // Send app version to renderer
    mainWindow.webContents.send('app-version', app.getVersion());

    if (settings) {
      mainWindow.webContents.send("window-resized", mainWindow.getSize());
      
      // Handle custom CSS
      if (!settings.customCSS || settings.customCSS === "") {
        console.log("No custom CSS found, loading template");
        settings.customCSS = fs.readFileSync(path.join(__dirname, 'customCSSTemplate.txt'), 'utf8');
      }
      
      // Send settings to renderer
      mainWindow.webContents.send('call-load-settings', settings);

      // Set window position and size if they exist
      if (settings.position && settings.size) {
        mainWindow.setPosition(settings.position.x, settings.position.y);
        mainWindow.setSize(settings.size.x, settings.size.y);
        
        // Update data size
        data.size = {
          x: settings.size.x,
          y: settings.size.y
        };
        
        if (settings.isFullscreen) {
          mainWindow.maximize();
        }
      }
    } else {
      // Send default settings to renderer
      mainWindow.webContents.send('call-load-settings', false);
    }

    // Load and send data
    const items = dbManager.getAllItems();
    const updatedData = {
      ...(universeData || {
        title: 'New Timeline',
        author: '',
        description: '',
        start: 0,
        granularity: 4
      }),
      items: items || []
    };
    
    // Update our data state
    data = {
      ...data,
      ...updatedData
    };
    
    mainWindow.webContents.send('call-load-data', data);
  });
}

/**
 * Creates the add item window
 * @param {number} year - Year position
 * @param {number} subtick - Subtick position
 * @param {number} granularity - Granularity of the timeline
 * 
 * How it works:
 * 1. Creates BrowserWindow instance
 * 2. Loads add-item.html
 * 3. Sets position via IPC
 * 
 * Possible errors:
 * - Window creation failure
 * - File load failure
 * - IPC communication failure
 */
function createAddItemWindow(year, subtick, granularity) {
  let newItemWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      parent: mainWindow,
      contextIsolation: true,
      nodeIntegration: false,
      modal: true,
      show: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      title: "Add Item"
    }
  });

  newItemWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      newItemWindow.webContents.openDevTools();
    }
  });

  newItemWindow.loadFile('addItem.html', {
    query: {
      year: year,
      subtick: subtick,
      granularity: granularity
    }
  });
  
  newItemWindow.setPosition(
    mainWindow.getPosition()[0] + 100, 
    mainWindow.getPosition()[1] + 100
  );
  newItemWindow.show();
}

/**
 * Creates the edit item window
 * @param {Object} item - Item to edit
 * 
 * How it works:
 * 1. Creates BrowserWindow instance
 * 2. Loads add-item.html
 * 3. Sets item via IPC
 * 
 * Possible errors:
 * - Window creation failure
 * - File load failure
 * - IPC communication failure
 */
function createEditItemWindow(item) {
  let editItemWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      parent: mainWindow,
      contextIsolation: true,
      nodeIntegration: false,
      modal: true,
      show: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      title: "Edit Item"
    }
  });

  editItemWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      editItemWindow.webContents.openDevTools();
    }
  });
  
  editItemWindow.loadFile('addItem.html', {
    query: {
      year: item.year,
      subtick: item.subtick,
      edit: true,
      itemId: item.id || item['story-id']
    }
  });
  
  editItemWindow.setPosition(
    mainWindow.getPosition()[0] + 100, 
    mainWindow.getPosition()[1] + 100
  );
  editItemWindow.show();
}

// ===== File Management =====
/**
 * Loads application settings
 * 
 * How it works:
 * 1. Reads settings file
 * 2. Parses JSON
 * 3. Merges with defaults
 * 
 * Possible errors:
 * - File read failure
 * - Invalid JSON
 * - Main window not initialized
 */
function loadSettings() {
  if (!mainWindow) {
    console.error('Main window not initialized');
    return;
  }

  const savedSettings = dbManager.getSettings();
  if (savedSettings) {
    // Ensure we have default values for all settings
    settings = {
      font: savedSettings.font || 'Arial',
      fontSizeScale: parseFloat(savedSettings.fontSizeScale || 1.0),
      pixelsPerSubtick: parseInt(savedSettings.pixelsPerSubtick || 20),
      customCSS: savedSettings.customCSS || '',
      customMainCSS: savedSettings.customMainCSS || '',
      customItemsCSS: savedSettings.customItemsCSS || '',
      useTimelineCSS: Boolean(savedSettings.useTimelineCSS),
      useMainCSS: Boolean(savedSettings.useMainCSS),
      useItemsCSS: Boolean(savedSettings.useItemsCSS),
      isFullscreen: Boolean(savedSettings.isFullscreen),
      showGuides: Boolean(savedSettings.showGuides),
      size: {
        x: parseInt(savedSettings.size?.x || 800),
        y: parseInt(savedSettings.size?.y || 600)
      },
      position: {
        x: parseInt(savedSettings.position?.x || 100),
        y: parseInt(savedSettings.position?.y || 100)
      }
    };

    // Load templates if CSS fields are empty
    if (!settings.customCSS || settings.customCSS === "") {
      settings.customCSS = fs.readFileSync(path.join(__dirname, 'customCSSTemplate.txt'), 'utf8');
    }
    if (!settings.customMainCSS || settings.customMainCSS === "") {
      settings.customMainCSS = fs.readFileSync(path.join(__dirname, 'customMainCSSTemplate.txt'), 'utf8');
    }
    if (!settings.customItemsCSS || settings.customItemsCSS === "") {
      settings.customItemsCSS = fs.readFileSync(path.join(__dirname, 'customItemsCSSTemplate.txt'), 'utf8');
    }
    
    mainWindow.webContents.send("window-resized", mainWindow.getSize());
    mainWindow.webContents.send('call-load-settings', settings);
    mainWindow.setPosition(settings.position.x, settings.position.y);
    mainWindow.setSize(settings.size.x, settings.size.y);
  }
}

/**
 * Saves application settings
 * @param {Object} newSettings - Settings to save
 * 
 * How it works:
 * 1. Merges with current settings
 * 2. Writes to file
 * 3. Sends to renderer
 * 
 * Possible errors:
 * - Invalid settings
 * - File write failure
 * - IPC communication failure
 */
function saveSettings(newSettings) {
  if (!mainWindow) {
    console.error('Main window not initialized');
    return false;
  }

  // Save settings to database
  const dbSettings = {
    font: newSettings.font || 'Arial',
    fontSizeScale: parseFloat(newSettings.fontSizeScale || 1.0),
    pixelsPerSubtick: parseInt(newSettings.pixelsPerSubtick || 20),
    customCSS: newSettings.customCSS || '',
    customMainCSS: newSettings.customMainCSS || '',
    customItemsCSS: newSettings.customItemsCSS || '',
    useTimelineCSS: newSettings.useTimelineCSS ? 1 : 0,
    useMainCSS: newSettings.useMainCSS ? 1 : 0,
    useItemsCSS: newSettings.useItemsCSS ? 1 : 0,
    isFullscreen: newSettings.isFullscreen ? 1 : 0,
    showGuides: newSettings.showGuides ? 1 : 0,
    windowSizeX: parseInt(mainWindow.isMaximized() ? data.size.x : mainWindow.getSize()[0] - 2),
    windowSizeY: parseInt(mainWindow.isMaximized() ? data.size.y : mainWindow.getSize()[1] - 1),
    windowPositionX: parseInt(mainWindow.getPosition()[0] + 2),
    windowPositionY: parseInt(mainWindow.getPosition()[1] + 1)
  };
  
  dbManager.updateSettings(dbSettings);

  // Save universe data
  const universeData = {
    title: data.title || 'New Timeline',
    author: data.author || '',
    description: data.description || '',
    start_year: parseInt(data.start || 0),
    granularity: parseInt(data.granularity || 4)
  };
  
  console.log("Saving universe data:", universeData);
  const result = dbManager.updateUniverseData(universeData);
  
  // Update our settings state
  settings = {
    ...settings,
    ...newSettings
  };
  
  // Send updated settings to renderer
  mainWindow.webContents.send('call-load-settings', settings);
  
  // If items were updated due to granularity change, reload them
  if (result.itemsUpdated) {
    const items = dbManager.getAllItems();
    mainWindow.webContents.send('items', items);
  }
  
  console.log("Settings saved:", dbSettings);
  return true;
}

/**
 * Loads timeline data
 * 
 * How it works:
 * 1. Reads data file
 * 2. Parses JSON
 * 3. Updates state
 * 
 * Possible errors:
 * - File read failure
 * - Invalid JSON
 */
function loadData() {
  if (!mainWindow) {
    console.error('Main window not initialized');
    return;
  }

  const savedData = dbManager.getUniverseData();
  if (savedData) {
    data = {
      ...data,
      ...savedData,
      items: dbManager.getAllItems() || []
    };
    mainWindow.webContents.send('call-load-data', data);
  }
}

/**
 * Saves timeline data
 * @param {Object} newData - Data to save
 * 
 * How it works:
 * 1. Updates state
 * 2. Writes to file
 * 3. Sends to renderer
 * 
 * Possible errors:
 * - Invalid data
 * - File write failure
 * - IPC communication failure
 */
function saveData(newData) {
  // Save data to database
  const dbData = {
    title: newData.title || 'New Timeline',
    author: newData.author || '',
    description: newData.description || '',
    start_year: parseInt(newData.start || 0),
    granularity: parseInt(newData.granularity || 4)
  };
  
  dbManager.updateUniverseData(dbData);
  
  // Save items
  const items = newData.items || [];
  for (const item of items) {
    dbManager.addItem(item);
  }
  
  // Send updated data to renderer
  mainWindow.webContents.send('call-load-data', newData);
  
  console.log("Data saved:", dbData);
  return true;
}

// ===== IPC Handlers =====
/**
 * IPC event handlers setup
 * 
 * How it works:
 * - Sets up handlers for all IPC events
 * 
 * Possible errors:
 * - IPC setup failure
 */
function setupIpcHandlers() {
  ipcMain.on('save-settings', (event, settings, newData) => {
    console.log("Received new data:", newData);
    
    // Update our data state with the new data
    data = {
      ...data,
      title: newData.title || data.title,
      author: newData.author || data.author,
      description: newData.description || data.description,
      start: parseInt(newData.start || data.start || 0),
      granularity: parseInt(newData.granularity || data.granularity || 4),
      items: newData.items || data.items || []
    };
    
    console.log("Updated data state:", data);
    
    if (saveSettings(settings)) {
      // Get all items from database to ensure we have the latest data
      const allItems = dbManager.getAllItems();
      data.items = allItems;
      
      // Send the updated data to renderer
      mainWindow.webContents.send('call-load-data', data);
      event.sender.send('settings-saved', true);
    } else {
      event.sender.send('settings-saved', false);
    }
  });

  ipcMain.on('load-settings', (event, settings) => {
    // Don't reload settings from database, use current settings
    if (mainWindow) {
      mainWindow.webContents.send('call-load-settings', settings);
    }
  });

  ipcMain.on('open-add-item-window', (event, year, subtick, granularity) => {
    console.log('[main.js:509] opening add item window at year:', year, 'and subtick:', subtick, 'with granularity:', granularity);
    createAddItemWindow(year, subtick, granularity);
  });

  ipcMain.on('getStorySuggestions', (event) => {
    const suggestions = dbManager.getAllStories();
    event.sender.send('storySuggestions', suggestions);
  });

  ipcMain.on('addTimelineItem', (event, data) => {
    console.log("Received timeline item:", data);
    dbManager.addItem(data);
    const items = dbManager.getAllItems();
    mainWindow.webContents.send('items', items);
  });

  ipcMain.on('add-item-window-closing', (event) => {
    console.log("Add item window closing, refreshing items...");
    const items = dbManager.getAllItems();
    mainWindow.webContents.send('items', items);
  });

  ipcMain.on('searchItems', (event, criteria) => {
    const results = dbManager.searchItems(criteria);
    event.sender.send('searchResults', results);
  });

  ipcMain.on('getItemsByTag', (event, tag) => {
    const results = dbManager.searchItems({ tags: [tag] });
    event.sender.send('tagSearchResults', results);
  });

  ipcMain.on('getItemsByDate', (event, date) => {
    const results = dbManager.searchItems({ 
        startDate: date,
        endDate: date
    });
    event.sender.send('dateSearchResults', results);
  });

  ipcMain.on('removeItem', (event, storyId) => {
    const success = dbManager.deleteItem(storyId);
    event.sender.send('itemRemoved', { success, storyId });
  });

  ipcMain.on('getAllItems', (event) => {
    // Always fetch the latest items from the database
    const items = dbManager.getAllItems();
    event.sender.send('items', items);
  });

  ipcMain.on('addNote', (event, note) => {
    const result = dbManager.addNote(note);
    event.sender.send('noteAdded', result);
  });

  ipcMain.on('getNotes', (event, year, subtick) => {
    const notes = dbManager.getNotes(year, subtick);
    event.sender.send('notes', notes);
  });

  ipcMain.on('open-edit-item-window', (event, item) => {
    console.log('[main.js] open-edit-item-window called with item:', item);
    createEditItemWindow(item);
  });

  ipcMain.on('getItem', (event, itemId) => {
    const item = dbManager.getItem(itemId);
    event.sender.send('itemData', item);
  });

  ipcMain.on('updateTimelineItem', (event, data) => {
    try {
      // Use dbManager to update the item (id, data)
      const updatedItem = dbManager.updateItem(data.id || data['story-id'], data);
      // Get all updated items
      const allItems = dbManager.getAllItems();
      // Send updated items only to the main window
      if (mainWindow) {
        mainWindow.webContents.send('items', allItems);
      }
      event.reply('itemUpdated', { success: true });
    } catch (error) {
      console.error('Error updating timeline item:', error);
      event.reply('itemUpdated', { success: false, error: error.message });
    }
  });

  ipcMain.on('removeTimelineItem', (event, data) => {
    try {
      // Use dbManager to delete the item
      const success = dbManager.deleteItem(data.id || data['story-id']);
      // Get all updated items
      const allItems = dbManager.getAllItems();
      // Send updated items to renderer
      mainWindow.webContents.send('items', allItems);
      event.reply('itemRemoved', { success: !!success });
    } catch (error) {
      console.error('Error removing timeline item:', error);
      event.reply('itemRemoved', { success: false, error: error.message });
    }
  });

  // ===== Export/Import Handlers =====
  ipcMain.handle('export-timeline-data', async (event, loaded_data) => {
    console.log("Exporting timeline data...", loaded_data);
    try {
        // Get the directory where the executable is located
        const exportDir = path.join(process.resourcesPath, 'export');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir);
        }

        // Sanitize title and author for filename
        const sanitizeForFilename = (str) => {
            return (str || 'untitled')
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase();
        };

        // Create filename with timestamp
        const now = new Date();
        const timestamp = now.getFullYear() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + 'T' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        const filename = `${sanitizeForFilename(data.title)}_by_${sanitizeForFilename(data.author)}_timeline_export_${timestamp}.json`;
        const filePath = path.join(exportDir, filename);

        // Write the file
        await fs.promises.writeFile(filePath, JSON.stringify(loaded_data, null, 2));
        
        // Open the folder containing the exported file
        require('electron').shell.openPath(exportDir);
        
        event.sender.send('export-timeline-data-success', filePath);
    } catch (error) {
        console.error('Export error:', error);
        event.sender.send('export-timeline-data-error', error.message);
    }
  });

  ipcMain.handle('import-timeline-data', async (event) => {
    console.log("Importing timeline data...");
    try {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Timeline Data',
            filters: [
                { name: 'JSON Files', extensions: ['json'] }
            ],
            properties: ['openFile']
        });

        if (!filePaths || filePaths.length === 0) return; // User cancelled

        const fileContent = await fs.promises.readFile(filePaths[0], 'utf8');
        const importedData = JSON.parse(fileContent);

        // Validate the imported data structure
        if (!importedData.items || !importedData.storyReferences) {
            throw new Error('Invalid import file format');
        }

        // Count items to be imported
        const itemCount = importedData.items.length;
        
        // Send confirmation request to renderer
        event.sender.send('import-timeline-data-confirm', {
            itemCount,
            filePath: filePaths[0],
            data: importedData
        });
    } catch (error) {
        console.error('Import error:', error);
        event.sender.send('import-timeline-data-error', error.message);
    }
  });

  // Add new handler for confirmed imports
  ipcMain.on('confirm-import-timeline-data', async (event, { filePath, data }) => {
    console.log("NOW Importing timeline data...", data, filePath);
    try {
        // Get current universe data for granularity
        const universeData = dbManager.getUniverseData();
        const currentGranularity = universeData ? universeData.granularity : 4;

        // Import story references first
        for (const [id, story] of Object.entries(data.storyReferences)) {
            await dbManager.addStory({ id, title: story.title, description: '' });
        }

        // Then import items
        for (const item of data.items) {
            // Set creation_granularity if not present
            if (item.creation_granularity === undefined) {
                item.creation_granularity = currentGranularity;
            }
            await dbManager.addItem(item);
        }

        // Get all updated items and send to renderer
        const allItems = dbManager.getAllItems();
        mainWindow.webContents.send('items', allItems);
        
        event.sender.send('import-timeline-data-success', data);
    } catch (error) {
        console.error('Import error:', error);
        event.sender.send('import-timeline-data-error', error.message);
    }
  });

  ipcMain.on('quit-app', () => {
    app.quit();
  });

  // Add handler for reading template files
  ipcMain.handle('read-file', async (event, filename) => {
    try {
      const filePath = path.join(__dirname, filename);
      const content = await fs.promises.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });
}

// ===== Application Lifecycle =====
app.whenReady().then(() => {
  // Initialize data first
  data = {
    title: '',
    author: '',
    description: '',
    start: 0,
    granularity: 4,
    items: [],
    size: {
      x: 800,
      y: 600
    }
  };

  // Create window first
  createWindow();
  
  // Then load settings and data
  loadSettings();
  loadData();
  
  // Finally set up IPC handlers
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});