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
 * - createAddItemWithRangeWindow(year, subtick, granularity): Creates window for adding new timeline items with a range
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
const { migrate } = require('./migrate');

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
    showGuides: true,
    useCustomScaling: false,
    customScale: 1.0
};

// Epic title generation
const EPIC_ADJECTIVES = [
    'Ancient', 'Mystical', 'Eternal', 'Forgotten', 'Legendary', 'Mythical',
    'Enchanted', 'Celestial', 'Cosmic', 'Divine', 'Sacred', 'Primal',
    'Arcane', 'Ethereal', 'Mysterious', 'Timeless', 'Infinite', 'Boundless',
    'Majestic', 'Noble', 'Radiant', 'Splendid', 'Glorious', 'Magnificent'
];

const EPIC_NOUNS = [
    'Chronicles', 'Saga', 'Legacy', 'Destiny', 'Odyssey', 'Voyage',
    'Journey', 'Quest', 'Tale', 'Epic', 'Legend', 'Myth',
    'Realm', 'Domain', 'Empire', 'Kingdom', 'Dynasty', 'Era',
    'Epoch', 'Age', 'Time', 'World', 'Universe', 'Cosmos'
];

function generateEpicTitle() {
    const adjective = EPIC_ADJECTIVES[Math.floor(Math.random() * EPIC_ADJECTIVES.length)];
    const noun = EPIC_NOUNS[Math.floor(Math.random() * EPIC_NOUNS.length)];
    return `The ${adjective} ${noun}`;
}

// ===== State Management =====
/**
 * Application state
 * @type {BrowserWindow} mainWindow - Main application window
 * @type {BrowserWindow} addItemWindow - Add item window
 * @type {BrowserWindow} editItemWindow - Edit item window
 * @type {Object} settings - Current application settings
 * @type {Object} data - Current timeline data
 */
let mainWindow = null;
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
        x: 1000,
        y: 700
    }
};

let splashWindow = null;

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
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        backgroundColor: '#f5f0e6'
    });

    splashWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12") {
        splashWindow.webContents.openDevTools();
      }
    });

    splashWindow.loadFile('splash.html');
    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
    });

    splashWindow.on('closed', () => {
        splashWindow = null;
        // Close the app when splash screen is closed
        //app.quit();
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        x: 300,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        backgroundColor: '#f5f0e6'
    });

    mainWindow.loadFile('index.html');
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        // Reopen splash screen when main window is closed
        createSplashWindow();
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12") {
        mainWindow.webContents.openDevTools();
      }
    });
}

/**
 * Creates the add item window
 * @param {number} year - Year position
 * @param {number} subtick - Subtick position
 * @param {number} granularity - Granularity of the timeline
 * @param {string} type - Type of the item
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
function createAddItemWindow(year, subtick, granularity, type) {
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
      granularity: granularity,
      type: type
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

/**
 * Creates the add item with range window
 * @param {number} year - Year position
 * @param {number} subtick - Subtick position
 * @param {number} granularity - Granularity of the timeline
 * @param {string} type - Type of the item
 * @param {string} color - Color for the item
 */
function createAddItemWithRangeWindow(year, subtick, granularity, type, color) {
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
      title: "Add Item with Range"
    }
  });

  newItemWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      newItemWindow.webContents.openDevTools();
    }
  });

  newItemWindow.loadFile('addItemWithRange.html', {
    query: {
      year: year,
      subtick: subtick,
      granularity: granularity,
      type: type,
      color: color
    }
  });
  
  newItemWindow.setPosition(
    mainWindow.getPosition()[0] + 100, 
    mainWindow.getPosition()[1] + 100
  );
  newItemWindow.show();
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
    windowPositionY: parseInt(mainWindow.getPosition()[1] + 1),
    useCustomScaling: newSettings.useCustomScaling ? 1 : 0,
    customScale: parseFloat(newSettings.customScale || 1.0),
    timeline_id: data.timeline_id
  };
  
  dbManager.updateSettings(dbSettings);

  // Apply window scaling if enabled
  if (newSettings.useCustomScaling) {
    mainWindow.webContents.setZoomFactor(parseFloat(newSettings.customScale));
  } else {
    mainWindow.webContents.setZoomFactor(1.0);
  }

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

    console.log("loadData", data);

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
  ipcMain.on('save-settings', (event, newSettings, newData) => {
    // Merge new settings with current settings
    const updatedSettings = {
      ...data.settings,
      ...newSettings
    };

    // Update the data state
    data = {
      ...data,
      settings: updatedSettings,
      title: newData.title,
      author: newData.author,
      description: newData.description,
      start: newData.start,
      granularity: newData.granularity
    };

    // Save settings to database
    const dbSettings = {
      font: updatedSettings.font || 'Arial',
      font_size_scale: parseFloat(updatedSettings.font_size_scale || 1.0),
      pixels_per_subtick: parseInt(updatedSettings.pixels_per_subtick || 20),
      custom_css: updatedSettings.customCSS || '',
      custom_main_css: updatedSettings.customMainCSS || '',
      custom_items_css: updatedSettings.customItemsCSS || '',
      use_timeline_css: updatedSettings.useTimelineCSS ? 1 : 0,
      use_main_css: updatedSettings.useMainCSS ? 1 : 0,
      use_items_css: updatedSettings.useItemsCSS ? 1 : 0,
      is_fullscreen: updatedSettings.isFullscreen ? 1 : 0,
      show_guides: updatedSettings.showGuides ? 1 : 0,
      window_size_x: parseInt(mainWindow.isMaximized() ? data.size.x : mainWindow.getSize()[0] - 2),
      window_size_y: parseInt(mainWindow.isMaximized() ? data.size.y : mainWindow.getSize()[1] - 1),
      window_position_x: parseInt(mainWindow.getPosition()[0] + 2),
      window_position_y: parseInt(mainWindow.getPosition()[1] + 1),
      use_custom_scaling: updatedSettings.useCustomScaling ? 1 : 0,
      custom_scale: parseFloat(updatedSettings.customScale || 1.0),
      timeline_id: data.timeline_id
    };

    // Update settings in database
    dbManager.updateSettings(dbSettings);

    // Save timeline data
    const timelineData = {
      timeline_id: data.timeline_id,
      title: newData.title,
      author: newData.author,
      description: newData.description,
      start: newData.start,
      granularity: newData.granularity
    };
    dbManager.updateUniverseData(timelineData);

    // Send updated settings back to renderer
    mainWindow.webContents.send('call-load-settings', updatedSettings);
    
    // Send updated timeline data to renderer
    mainWindow.webContents.send('timeline-data', {
      id: data.timeline_id,
      title: newData.title,
      author: newData.author,
      description: newData.description,
      start_year: newData.start,
      granularity: newData.granularity
    });
  });

  ipcMain.on('set-window-scale', (event, scale) => {
    if (mainWindow) {
      mainWindow.webContents.setZoomFactor(scale);
    }
  });

  ipcMain.on('load-settings', (event, settings) => {
    // Don't reload settings from database, use current settings
    if (mainWindow) {
      mainWindow.webContents.send('call-load-settings', settings);
    }
  });

  ipcMain.on('open-add-item-window', (event, year, subtick, granularity, type) => {
    console.log('[main.js:509] opening add item window at year:', year, 'and subtick:', subtick, 'with granularity:', granularity, 'and type:', type);
    createAddItemWindow(year, subtick, granularity, type);
  });

  ipcMain.on('open-add-item-with-range-window', (event, year, subtick, granularity, type, color) => {
    console.log('[main.js] opening add item with range window at year:', year, 'and subtick:', subtick, 'with granularity:', granularity, 'and type:', type, 'and color:', color);
    createAddItemWithRangeWindow(year, subtick, granularity, type, color);
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
    //app.exit(0);  // Use exit(0) instead of quit() to ensure immediate closure
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

  // Handle getting all timelines
  ipcMain.on('get-all-timelines', (event) => {
    const timelines = dbManager.getAllTimelines();
    event.reply('timelines-list', timelines);
  });

  // Handle opening a timeline
  ipcMain.on('open-timeline', (event, timelineId) => {
    const timeline = dbManager.getTimelineWithSettings(timelineId);
    if (!timeline) {
        event.reply('error', 'Timeline not found');
        return;
    }

    // Update the data state with the timeline ID
    data = {
        ...data,
        timeline_id: timelineId,
        title: timeline.title,
        author: timeline.author,
        description: timeline.description,
        start: timeline.start_year,
        granularity: timeline.granularity,
        settings: timeline.settings
    };

    // If main window doesn't exist, create it
    if (!mainWindow) {
        createWindow();
        mainWindow.webContents.on('did-finish-load', () => {
            // Send the timeline data to the main window
            mainWindow.webContents.send('timeline-data', {
                id: timeline.id,
                title: timeline.title,
                author: timeline.author,
                description: timeline.description,
                start_year: timeline.start_year,
                granularity: timeline.granularity,
                settings: timeline.settings
            });

            // Send the data to load
            mainWindow.webContents.send('call-load-data', {
                title: timeline.title,
                author: timeline.author,
                description: timeline.description,
                start: timeline.start_year,
                granularity: timeline.granularity,
                items: dbManager.getItemsByTimeline(timelineId)
            });

            // Load all items for this timeline
            const items = dbManager.getItemsByTimeline(timelineId);
            mainWindow.webContents.send('items', items);

            // Apply window settings
            if (timeline.settings) {
                // Set window size
                mainWindow.setSize(
                    timeline.settings.size.x || 1000,
                    timeline.settings.size.y || 700
                );

                // Set window position
                mainWindow.setPosition(
                    timeline.settings.position.x || 300,
                    timeline.settings.position.y || 100
                );

                // Apply custom scaling if enabled
                if (timeline.settings.useCustomScaling) {
                    mainWindow.webContents.setZoomFactor(timeline.settings.customScale || 1.0);
                } else {
                    mainWindow.webContents.setZoomFactor(1.0);
                }

                // Send settings to renderer
                mainWindow.webContents.send('call-load-settings', timeline.settings);
            }
        });
    } else {
        // Main window exists, send data directly
        mainWindow.webContents.send('timeline-data', {
            id: timeline.id,
            title: timeline.title,
            author: timeline.author,
            description: timeline.description,
            start_year: timeline.start_year,
            granularity: timeline.granularity,
            settings: timeline.settings
        });

        // Send the data to load
        mainWindow.webContents.send('call-load-data', {
            title: timeline.title,
            author: timeline.author,
            description: timeline.description,
            start: timeline.start_year,
            granularity: timeline.granularity,
            items: dbManager.getItemsByTimeline(timelineId)
        });

        // Load all items for this timeline
        const items = dbManager.getItemsByTimeline(timelineId);
        mainWindow.webContents.send('items', items);

        // Apply window settings
        if (timeline.settings) {
            // Set window size
            mainWindow.setSize(
                timeline.settings.size.x || 1000,
                timeline.settings.size.y || 700
            );

            // Set window position
            mainWindow.setPosition(
                timeline.settings.position.x || 300,
                timeline.settings.position.y || 100
            );

            // Apply custom scaling if enabled
            if (timeline.settings.useCustomScaling) {
                mainWindow.webContents.setZoomFactor(timeline.settings.customScale || 1.0);
            } else {
                mainWindow.webContents.setZoomFactor(1.0);
            }

            // Send settings to renderer
            mainWindow.webContents.send('call-load-settings', timeline.settings);
        }
    }

    // Close splash window if it exists
    if (splashWindow) {
        splashWindow.close();
    }
  });

  // Handle getting timeline info before deletion
  ipcMain.on('get-timeline-info', (event, timelineId) => {
    try {
      console.log('Getting timeline info for ID:', timelineId);
      const timeline = dbManager.getTimelineWithSettings(timelineId);
      if (!timeline) {
        console.error('Timeline not found:', timelineId);
        event.reply('timeline-info', { error: 'Timeline not found' });
        return;
      }

      const items = dbManager.getItemsByTimeline(timelineId);
      console.log('Found timeline:', timeline.title, 'with', items.length, 'items');
      
      event.reply('timeline-info', {
        title: timeline.title,
        item_count: items.length
      });
    } catch (error) {
      console.error('Error getting timeline info:', error);
      event.reply('timeline-info', { error: error.message });
    }
  });

  // Handle deleting a timeline
  ipcMain.on('delete-timeline', (event, timelineId) => {
    try {
      dbManager.deleteTimeline(timelineId);
      event.reply('timeline-deleted', timelineId);
      // Refresh the timelines list
      const timelines = dbManager.getAllTimelines();
      event.reply('timelines-list', timelines);
    } catch (error) {
      console.error('Error deleting timeline:', error);
      event.reply('timeline-delete-error', error.message);
    }
  });

  // Handle new timeline creation
  ipcMain.on('new-timeline', (event) => {
    // Create the timeline in the database
    const timeline = {
        title: dbManager.constructor.generateEpicTitle(),
        author: '',
        description: '',
        start_year: 0,
        granularity: 4
    };
    const newTimelineId = dbManager.addTimeline(timeline);
    
    // Create a dedicated folder for this timeline's images
    const timelineMediaDir = path.join(app.getPath('userData'), 'media', 'pictures', newTimelineId.toString());
    if (!fs.existsSync(timelineMediaDir)) {
        fs.mkdirSync(timelineMediaDir, { recursive: true });
    }

    // Get the default settings for this timeline
    const defaultSettings = {
        font: 'Arial',
        fontSizeScale: 1.0,
        pixelsPerSubtick: 20,
        customCSS: '',
        customMainCSS: '',
        customItemsCSS: '',
        useTimelineCSS: false,
        useMainCSS: false,
        useItemsCSS: false,
        isFullscreen: false,
        showGuides: true,
        size: {
            x: 1000,
            y: 700
        },
        position: {
            x: 300,
            y: 100
        },
        useCustomScaling: false,
        customScale: 1.0
    };

    // Update the data state with the new timeline ID and settings
    data = {
        ...data,
        timeline_id: newTimelineId,
        title: timeline.title,
        author: timeline.author,
        description: timeline.description,
        start: timeline.start_year,
        granularity: timeline.granularity,
        items: [],
        settings: defaultSettings
    };

    if (mainWindow) {
        mainWindow.loadFile('index.html').then(() => {
            // Send the timeline data to the main window
            mainWindow.webContents.send('timeline-data', {
                id: newTimelineId,
                title: timeline.title,
                author: timeline.author,
                description: timeline.description,
                start_year: timeline.start_year,
                granularity: timeline.granularity
            });

            // Send the data to load
            mainWindow.webContents.send('call-load-data', {
                title: timeline.title,
                author: timeline.author,
                description: timeline.description,
                start: timeline.start_year,
                granularity: timeline.granularity,
                items: []
            });

            // Send the default settings to the renderer
            mainWindow.webContents.send('call-load-settings', defaultSettings);

            // Apply window settings
            mainWindow.setSize(defaultSettings.size.x, defaultSettings.size.y);
            mainWindow.setPosition(defaultSettings.position.x, defaultSettings.position.y);
            mainWindow.webContents.setZoomFactor(1.0);
        });
    } else {
        createWindow();
        mainWindow.webContents.on('did-finish-load', () => {
            // Send the timeline data to the main window
            mainWindow.webContents.send('timeline-data', {
                id: newTimelineId,
                title: timeline.title,
                author: timeline.author,
                description: timeline.description,
                start_year: timeline.start_year,
                granularity: timeline.granularity
            });

            // Send the data to load
            mainWindow.webContents.send('call-load-data', {
                title: timeline.title,
                author: timeline.author,
                description: timeline.description,
                start: timeline.start_year,
                granularity: timeline.granularity,
                items: []
            });

            // Send the default settings to the renderer
            mainWindow.webContents.send('call-load-settings', defaultSettings);

            // Apply window settings
            mainWindow.setSize(defaultSettings.size.x, defaultSettings.size.y);
            mainWindow.setPosition(defaultSettings.position.x, defaultSettings.position.y);
            mainWindow.webContents.setZoomFactor(1.0);
        });
    }
    if (splashWindow) {
        splashWindow.close();
    }
  });

  // Handle opening timeline images directory
  ipcMain.on('open-timeline-images', (event, timelineId) => {
    const timelineMediaDir = path.join(app.getPath('userData'), 'media', 'pictures', timelineId);
    // Create the directory if it doesn't exist
    if (!fs.existsSync(timelineMediaDir)) {
      fs.mkdirSync(timelineMediaDir, { recursive: true });
    }
    require('electron').shell.openPath(timelineMediaDir);
  });

  // Handle new image uploads
  ipcMain.on('save-new-image', async (event, fileInfo) => {
    try {
        const result = await dbManager.saveNewImage(fileInfo);
        event.reply('new-image-saved', result);
    } catch (error) {
        event.reply('new-image-saved', { error: error.message });
    }
  });

  // Handle saving temporary files
  ipcMain.handle('save-temp-file', async (event, fileInfo) => {
    try {
        const tempDir = path.join(app.getPath('temp'), 'story-timeline');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempPath = path.join(tempDir, `${Date.now()}-${fileInfo.name}`);
        await fs.promises.writeFile(tempPath, Buffer.from(fileInfo.data));
        return tempPath;
    } catch (error) {
        console.error('Error saving temporary file:', error);
        throw error;
    }
  });
}

// ===== Application Lifecycle =====
app.whenReady().then(() => {
  createSplashWindow();
  setupIpcHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});