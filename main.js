/**
 * Main Process Module
 * Handles application lifecycle, window management, and IPC communication.
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
    useCustomCSS: false,
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
      nodeIntegration: false
    }
  });
  
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
    
    logToFile("Loaded data:", "data:" + JSON.stringify(data, null, 4));
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
      useCustomCSS: Boolean(savedSettings.useCustomCSS),
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

    if (!settings.customCSS || settings.customCSS === "") {
      settings.customCSS = fs.readFileSync(path.join(__dirname, 'customCSSTemplate.txt'), 'utf8');
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
    font_size_scale: parseFloat(newSettings.fontSizeScale || 1.0),
    pixels_per_subtick: parseInt(newSettings.pixelsPerSubtick || 20),
    custom_css: newSettings.customCSS || '',
    use_custom_css: newSettings.useCustomCSS ? 1 : 0,
    is_fullscreen: newSettings.isFullscreen ? 1 : 0,
    show_guides: newSettings.showGuides ? 1 : 0,
    window_size_x: parseInt(mainWindow.isMaximized() ? data.size.x : mainWindow.getSize()[0] - 2),
    window_size_y: parseInt(mainWindow.isMaximized() ? data.size.y : mainWindow.getSize()[1] - 1),
    window_position_x: parseInt(mainWindow.getPosition()[0] + 2),
    window_position_y: parseInt(mainWindow.getPosition()[1] + 1)
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
  dbManager.updateUniverseData(universeData);
  
  // Update our settings state
  settings = {
    ...settings,
    ...newSettings
  };
  
  // Send updated settings to renderer
  mainWindow.webContents.send('call-load-settings', settings);
  
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

const logFile = path.join(__dirname, 'app.log');

function logToFile(message, data) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n${data}\n`);
}

