// TODO: add new screen for handling miscellaneous things

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

const CLOSE_SPLASH_WINDOW = true;

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
  'Majestic', 'Noble', 'Radiant', 'Splendid', 'Glorious', 'Magnificent',
  'Astral', 'Eldritch', 'Transcendent', 'Immortal', 'Venerable', 'Sovereign',
  'Mystic', 'Ethereal', 'Astral', 'Cosmic', 'Celestial', 'Divine',
  'Primal', 'Ancient', 'Eternal', 'Infinite', 'Timeless', 'Immortal',
  'Mystical', 'Enchanted', 'Arcane', 'Sacred', 'Legendary', 'Mythical',
  'Majestic', 'Noble', 'Radiant', 'Splendid', 'Glorious', 'Magnificent',
  'Transcendent', 'Venerable', 'Sovereign', 'Eldritch', 'Astral', 'Ethereal',
  'Cosmic', 'Celestial', 'Divine', 'Primal', 'Ancient', 'Eternal',
  'Infinite', 'Timeless', 'Immortal', 'Mystical', 'Enchanted', 'Arcane',
  'Sacred', 'Legendary', 'Mythical', 'Majestic', 'Noble', 'Radiant',
  'Splendid', 'Glorious', 'Magnificent', 'Transcendent', 'Venerable', 'Sovereign'
];

const EPIC_NOUNS = [
  'Chronicles', 'Saga', 'Legacy', 'Destiny', 'Odyssey', 'Voyage',
  'Journey', 'Quest', 'Tale', 'Epic', 'Legend', 'Myth',
  'Realm', 'Domain', 'Empire', 'Kingdom', 'Dynasty', 'Era',
  'Epoch', 'Age', 'Time', 'World', 'Universe', 'Cosmos',
  'Nexus', 'Vortex', 'Abyss', 'Horizon', 'Voyage', 'Expedition',
  'Pilgrimage', 'Crusade', 'Conquest', 'Ascension', 'Transcendence', 'Awakening',
  'Genesis', 'Apocalypse', 'Revelation', 'Prophecy', 'Oracle', 'Vision',
  'Dream', 'Nightmare', 'Fantasy', 'Reality', 'Dimension', 'Existence',
  'Creation', 'Destruction', 'Rebirth', 'Evolution', 'Revolution', 'Transformation',
  'Harmony', 'Chaos', 'Order', 'Balance', 'Equilibrium', 'Paradox',
  'Mystery', 'Enigma', 'Riddle', 'Puzzle', 'Conundrum', 'Maze',
  'Labyrinth', 'Sanctuary', 'Temple', 'Shrine', 'Altar', 'Throne',
  'Crown', 'Scepter', 'Orb', 'Crystal', 'Gem', 'Jewel',
  'Artifact', 'Relic', 'Talisman', 'Amulet', 'Charm', 'Token',
  'Scroll', 'Tome', 'Grimoire', 'Codex', 'Manuscript', 'Archive',
  'Library', 'Repository', 'Vault', 'Treasury', 'Hoard', 'Cache'
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
 * @type {BrowserWindow} editItemWithRangeWindow - Edit item with range window
 * @type {BrowserWindow} archiveWindow - Archive window
 * @type {Object} settings - Current application settings
 * @type {Object} data - Current timeline data
 */
let mainWindow = null;
let addItemWindow;
let editItemWindow;
let editItemWithRangeWindow;
let archiveWindow;
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

    const windowWidth = 900;
    const windowHeight = 700;

    splashWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        show: false,
        backgroundColor: '#f5f0e6',
        frame: true,
        autoHideMenuBar: true,
        center: true
    });

    splashWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12") {
        splashWindow.webContents.openDevTools();
      }
    });

    splashWindow.loadFile('./markdown/splash.html');
    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
    });

    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 750,
        x: 300,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        show: false,  // Keep window hidden initially
        autoHideMenuBar: true,
        menuBarVisible: false
    });

    mainWindow.loadFile('./markdown/index.html');

    // Wait for the page to load
    mainWindow.webContents.on('did-finish-load', () => {
        // Load settings and data
        loadSettings();
        loadData().then(() => {
            // Send a message to the renderer that data is ready
            mainWindow.webContents.send('data-ready');
        });
    });

    // Listen for the renderer's confirmation that it's ready to display
    ipcMain.once('renderer-ready', () => {
        // Apply window position and size from settings

        if (settings) {
            // Set window size
            mainWindow.setSize(
                settings.size?.x || 1000,
                settings.size?.y || 750
            );

            // Set window position
            mainWindow.setPosition(
                settings.position?.x || 300,
                settings.position?.y || 100
            );

            // Apply maximized state if needed
            if (settings.isFullscreen) {
                mainWindow.maximize();
            }

            // Apply custom scaling if enabled
            if (settings.useCustomScaling) {
                mainWindow.webContents.setZoomFactor(parseFloat(settings.customScale || 1.0));
            } else {
                mainWindow.webContents.setZoomFactor(1.0);
            }
        }

        // Now we can safely show the window
        mainWindow.show();

        // Close the splash window if it exists
        if (splashWindow && CLOSE_SPLASH_WINDOW) {
            splashWindow.close();
        }
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
    width: mainWindow.getSize()[0] * 0.8,
    height: mainWindow.getSize()[1] * 0.8,
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
    },
    alwaysOnTop: true,
    autoHideMenuBar: true,
    parent: mainWindow
  });

  newItemWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      newItemWindow.webContents.openDevTools();
    }
  });

  newItemWindow.loadFile('./markdown/addItem.html', {
    query: {
      year: year,
      subtick: subtick,
      granularity: granularity,
      type: type,
      timeline_id: data.timeline_id
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
 * 2. Loads editItem.html
 * 3. Sets item via IPC
 * 
 * Possible errors:
 * - Window creation failure
 * - File load failure
 * - IPC communication failure
 */
function createEditItemWindow(item) {
  let editItemWindow = new BrowserWindow({
    width: mainWindow.getSize()[0] * 0.8,
    height: mainWindow.getSize()[1] * 0.8,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      show: false,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: "Edit Item"
    },
    alwaysOnTop: true,
    autoHideMenuBar: true,
    parent: mainWindow,
    modal: true
  });

  editItemWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      editItemWindow.webContents.openDevTools();
    }
  });

  console.log('[main.js] editItemWindow query:', {
    itemId: item.id,
    year: item.year,
    subtick: item.subtick,
    granularity: data.granularity,
    type: item.type,
    color: item.color
  });
  
  editItemWindow.loadFile('./markdown/editItem.html', {
    query: {
      itemId: item.id,
      year: item.year,
      subtick: item.subtick,
      granularity: data.granularity,
      type: item.type,
      color: item.color
    }
  });

  editItemWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      editItemWindow.webContents.openDevTools();
    }
  });
  
  editItemWindow.setPosition(
    mainWindow.getPosition()[0] + 100, 
    mainWindow.getPosition()[1] + 100
  );

  editItemWindow.once('ready-to-show', () => {
    editItemWindow.show();
  });

  editItemWindow.on('closed', () => {
    editItemWindow = null;
  });

  // Handle window close
  editItemWindow.on('close', () => {
    // Notify main window that edit window is closing
    mainWindow.webContents.send('edit-item-window-closing');
  });
}

/**
 * Creates the add item with range window
 * @param {number} year - Year position
 * @param {number} subtick - Subtick position
 * @param {number} granularity - Granularity of the timeline
 * @param {string} type - Type of the item
 * @param {string|Object} colorOrData - Either a color string or an itemData object
 */
function createAddItemWithRangeWindow(year, subtick, granularity, type, colorOrData) {
  console.log('[main.js] createAddItemWithRangeWindow called with:', {
    year,
    subtick,
    granularity,
    type,
    colorOrData
  });

  let newItemWindow = new BrowserWindow({
    width: mainWindow.getSize()[0] * 0.8,
    height: mainWindow.getSize()[1] * 0.8,
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
    },
    alwaysOnTop: true,
    autoHideMenuBar: true,
    parent: mainWindow
  });

  newItemWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      newItemWindow.webContents.openDevTools();
    }
  });

  // Determine if colorOrData is an itemData object or just a color
  const isItemData = typeof colorOrData === 'object' && colorOrData !== null;
  const color = isItemData ? colorOrData.color : colorOrData;

  console.log('[main.js] Window parameters:', {
    isItemData,
    color,
    year,
    subtick,
    granularity,
    type
  });

  newItemWindow.loadFile('./markdown/addItemWithRange.html', {
    query: {
      year: year,
      subtick: subtick,
      granularity: granularity,
      type: type,
      color: color,
      timeline_id: data.timeline_id
    }
  });
  
  newItemWindow.setPosition(
    mainWindow.getPosition()[0] + 100, 
    mainWindow.getPosition()[1] + 100
  );

  // If we have itemData, send it to the window after it's loaded
  if (isItemData) {
    newItemWindow.webContents.on('did-finish-load', () => {
      newItemWindow.webContents.send('item-data', colorOrData);
    });
  }

  newItemWindow.show();
}

function createEditItemWithRangeWindow(item) {
    if (editItemWithRangeWindow) {
        editItemWithRangeWindow.focus();
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 800;
    const windowHeight = 900;

    editItemWithRangeWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: Math.floor((width - windowWidth) / 2),
        y: Math.floor((height - windowHeight) / 2),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        show: false,
        autoHideMenuBar: true,
        parent: mainWindow,
        modal: true
    });

    editItemWithRangeWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12") {
        editItemWithRangeWindow.webContents.openDevTools();
      }
    });

    // Load the edit item window HTML file
    editItemWithRangeWindow.loadFile('./markdown/editItem.html', {
        query: {
            itemId: item.id,
            year: item.year,
            subtick: item.subtick,
            granularity: data.granularity,
            type: item.type,
            color: item.color
        }
    });

    editItemWithRangeWindow.once('ready-to-show', () => {
        editItemWithRangeWindow.show();
    });

    editItemWithRangeWindow.on('closed', () => {
        editItemWithRangeWindow = null;
    });

    // Handle window close
    editItemWithRangeWindow.on('close', () => {
        // Notify main window that edit window is closing
        mainWindow.webContents.send('edit-item-window-closing');
    });
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
      useCustomScaling: savedSettings.useCustomScaling,
      customScale: savedSettings.customScale,
      displayRadius: parseInt(savedSettings.displayRadius || 10),
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
      settings.customCSS = "";
    }
    
    // Send settings to renderer
    mainWindow.webContents.send('call-load-settings', settings);
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
  console.log("SAVING NEW SETTINGS", newSettings);
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
    use_timeline_css: newSettings.useCustomCSS ? 1 : 0,
    is_fullscreen: mainWindow.isMaximized() ? 1 : 0,
    show_guides: newSettings.showGuides ? 1 : 0,
    window_size_x: parseInt(mainWindow.isMaximized() ? data.size.x : mainWindow.getSize()[0] - 2),
    window_size_y: parseInt(mainWindow.isMaximized() ? data.size.y : mainWindow.getSize()[1] - 1),
    window_position_x: parseInt(mainWindow.getPosition()[0] + 2),
    window_position_y: parseInt(mainWindow.getPosition()[1] + 1),
    use_custom_scaling: newSettings.useCustomScaling ? 1 : 0,
    custom_scale: parseFloat(newSettings.customScale || 1.0),
    timeline_id: data.timeline_id,
    display_radius: parseInt(newSettings.displayRadius || 10)
  };
  
  const result = dbManager.updateSettings(dbSettings);

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
  
  const universeResult = dbManager.updateUniverseData(universeData);
  
  // Update our settings state
  settings = {
    ...settings,
    ...newSettings
  };
  
  // Send updated settings to renderer
  mainWindow.webContents.send('call-load-settings', settings);
  
  // If items were updated due to granularity change, reload them
  if (universeResult.itemsUpdated) {
    const items = dbManager.getAllItems();
    mainWindow.webContents.send('items', items);
  }
  
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
    return new Promise((resolve) => {
        if (!mainWindow) {
            console.error('Main window not initialized');
            resolve();
            return;
        }

        const savedData = dbManager.getUniverseData();
        if (savedData) {
            data = {
                ...data,
                ...savedData,
                items: dbManager.getAllItems() || []
            };

            console.log("[main.js] Timeline data loaded:", {
                timeline_id: data.timeline_id,
                title: data.title,
                author: data.author,
                description: data.description,
                start: data.start,
                granularity: data.granularity
            });
            mainWindow.webContents.send('call-load-data', data);
        }
        resolve();
    });
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
async function saveData(newData) {
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
    await dbManager.addItem(item);
  }
  
  // Send updated data to renderer
  mainWindow.webContents.send('call-load-data', newData);
  
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
// Function to duplicate a complete timeline with all its data
async function duplicateTimelineComplete(sourceTimelineId, newName) {
  try {
    // Get the source timeline data
    const sourceTimeline = dbManager.getTimelineWithSettings(sourceTimelineId);
    if (!sourceTimeline) {
      throw new Error('Source timeline not found');
    }

    // Create a new timeline with the new name
    const newTimeline = {
      title: newName,
      author: sourceTimeline.author,
      description: sourceTimeline.description,
      start_year: sourceTimeline.start_year,
      granularity: sourceTimeline.granularity
    };

    const newTimelineId = dbManager.addTimeline(newTimeline);
    console.log(`Created new timeline with ID: ${newTimelineId}`);

    // Copy settings
    const sourceSettings = sourceTimeline.settings;
    const newSettings = {
      timeline_id: newTimelineId,
      font: sourceSettings.font,
      font_size_scale: sourceSettings.fontSizeScale,
      pixels_per_subtick: sourceSettings.pixelsPerSubtick,
      custom_css: sourceSettings.customCSS,
      use_custom_css: sourceSettings.useCustomCSS ? 1 : 0,
      is_fullscreen: sourceSettings.isFullscreen ? 1 : 0,
      show_guides: sourceSettings.showGuides ? 1 : 0,
      window_size_x: sourceSettings.size.x,
      window_size_y: sourceSettings.size.y,
      window_position_x: sourceSettings.position.x,
      window_position_y: sourceSettings.position.y,
      use_custom_scaling: sourceSettings.useCustomScaling ? 1 : 0,
      custom_scale: sourceSettings.customScale,
      display_radius: sourceSettings.displayRadius
    };

    dbManager.updateTimelineSettings(newTimelineId, newSettings);
    console.log(`Copied settings for timeline ${newTimelineId}`);

    // Get all items from the source timeline
    const sourceItems = dbManager.getItemsByTimeline(sourceTimelineId);
    console.log(`Found ${sourceItems.length} items to copy`);

    // Create a map to track old picture ID to new picture ID mappings
    const pictureIdMap = new Map();

    // Copy each item
    for (const sourceItem of sourceItems) {
      const newItemId = require('uuid').v4();
      
      // Copy item data
      const newItem = {
        id: newItemId,
        title: sourceItem.title,
        description: sourceItem.description,
        content: sourceItem.content,
        type: sourceItem.type,
        year: sourceItem.year,
        subtick: sourceItem.subtick,
        original_subtick: sourceItem.original_subtick,
        end_year: sourceItem.end_year,
        end_subtick: sourceItem.end_subtick,
        original_end_subtick: sourceItem.original_end_subtick,
        creation_granularity: sourceItem.creation_granularity,
        book_title: sourceItem.book_title,
        chapter: sourceItem.chapter,
        page: sourceItem.page,
        color: sourceItem.color,
        timeline_id: newTimelineId,
        show_in_notes: sourceItem.show_in_notes,
        tags: sourceItem.tags,
        story_refs: sourceItem.story_refs
      };

      // Handle pictures - we need to copy the actual image files and create new picture records
      if (sourceItem.pictures && sourceItem.pictures.length > 0) {
        const newPictures = [];
        
        for (const sourcePicture of sourceItem.pictures) {
          let newPictureId = pictureIdMap.get(sourcePicture.id);
          
          if (!newPictureId) {
            // Copy the physical image file
            const sourceImagePath = sourcePicture.file_path;
            if (fs.existsSync(sourceImagePath)) {
              const newImageDir = path.join(app.getPath('userData'), 'media', 'pictures', newTimelineId.toString());
              if (!fs.existsSync(newImageDir)) {
                fs.mkdirSync(newImageDir, { recursive: true });
              }

              const timestamp = Date.now();
              const randomStr = Math.random().toString(36).substring(7);
              const extension = path.extname(sourcePicture.file_name);
              const newFileName = `img_${timestamp}_${randomStr}${extension}`;
              const newImagePath = path.join(newImageDir, newFileName);

              // Copy the file
              await fs.promises.copyFile(sourceImagePath, newImagePath);

              // Create new picture record
              const newPictureData = await dbManager.saveNewImage({
                file_path: newImagePath,
                file_name: newFileName,
                file_size: sourcePicture.file_size,
                file_type: sourcePicture.file_type,
                description: sourcePicture.description || ''
              });

              newPictureId = newPictureData.id;
              pictureIdMap.set(sourcePicture.id, newPictureId);
            }
          }

          if (newPictureId) {
            newPictures.push({
              id: newPictureId,
              isReference: true
            });
          }
        }

        newItem.pictures = newPictures;
      }

      // Add the new item
      await dbManager.addItem(newItem);
    }

    console.log(`Successfully duplicated timeline ${sourceTimelineId} to ${newTimelineId} with name "${newName}"`);
    return newTimelineId;

  } catch (error) {
    console.error('Error in duplicateTimelineComplete:', error);
    throw error;
  }
}

function setupIpcHandlers() {
  ipcMain.handle('get-current-timeline-id', () => {
    return data.timeline_id;
  });

  ipcMain.on('save-settings', (event, newSettings, newData) => {
    // Merge new settings with current settings
    console.log("NEW SETTINGS", newSettings);
    const updatedSettings = {
        ...settings,
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
        granularity: newData.granularity,
        displayRadius: newData.displayRadius
    };

    // Save settings to database
    const dbSettings = {
        font: updatedSettings.font || 'Arial',
        font_size_scale: parseFloat(updatedSettings.fontSizeScale || 1.0),
        pixels_per_subtick: parseInt(updatedSettings.pixelsPerSubtick || 20),
        custom_css: updatedSettings.customCSS || '',
        use_timeline_css: updatedSettings.useCustomCSS ? 1 : 0,
        is_fullscreen: mainWindow.isMaximized() ? 1 : 0,
        show_guides: updatedSettings.showGuides ? 1 : 0,
        window_size_x: parseInt(mainWindow.isMaximized() ? data.size.x : mainWindow.getSize()[0] - 2),
        window_size_y: parseInt(mainWindow.isMaximized() ? data.size.y : mainWindow.getSize()[1] - 1),
        window_position_x: parseInt(mainWindow.getPosition()[0] + 2),
        window_position_y: parseInt(mainWindow.getPosition()[1] + 1),
        use_custom_scaling: updatedSettings.useCustomScaling ? 1 : 0,
        custom_scale: parseFloat(updatedSettings.customScale || 1.0),
        timeline_id: data.timeline_id,
        display_radius: parseInt(updatedSettings.displayRadius || 10)
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

    // Apply window scaling if enabled
    if (updatedSettings.useCustomScaling) {
        mainWindow.webContents.setZoomFactor(parseFloat(updatedSettings.customScale));
    } else {
        mainWindow.webContents.setZoomFactor(1.0);
    }

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
    createAddItemWindow(year, subtick, granularity, type);
  });

  ipcMain.on('open-add-item-with-range-window', (event, year, subtick, granularity, type, colorOrData) => {
    createAddItemWithRangeWindow(year, subtick, granularity, type, colorOrData);
  });

  ipcMain.on('getStorySuggestions', (event) => {
    const suggestions = dbManager.getAllStories();
    event.sender.send('storySuggestions', suggestions);
  });

  ipcMain.on('getTagSuggestions', (event) => {
    const suggestions = dbManager.getAllTags();
    event.sender.send('tagSuggestions', suggestions);
  });

  ipcMain.on('addTimelineItem', async (event, data) => {
    try {
      const newItem = await dbManager.addItem(data);
      const items = dbManager.getItemsByTimeline(data.timeline_id);
      mainWindow.webContents.send('items', items);
      event.sender.send('item-created', { id: newItem.id });
    } catch (error) {
      logToRenderer('error', `Error adding timeline item: ${error.message}`);
      event.sender.send('item-created', { error: error.message });
    }
  });

  ipcMain.on('add-item-window-closing', (event) => {
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

    // Set the current timeline in dbManager
    dbManager.setCurrentTimeline(timelineId);

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
                    timeline.settings.size.y || 750
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
                timeline.settings.size.y || 750
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
    if (splashWindow && CLOSE_SPLASH_WINDOW) {
        splashWindow.close();
    }
  });

  // Handle getting timeline info before deletion
  ipcMain.on('get-timeline-info', (event, timelineId) => {
    try {
      const timeline = dbManager.getTimelineWithSettings(timelineId);
      if (!timeline) {
        console.error('Timeline not found:', timelineId);
        event.reply('timeline-info', { error: 'Timeline not found' });
        return;
      }

      const items = dbManager.getItemsByTimeline(timelineId);
      
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
        mainWindow.loadFile('./markdown/index.html').then(() => {
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
    if (splashWindow && CLOSE_SPLASH_WINDOW) {
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

  // Handle timeline duplication
  ipcMain.on('duplicate-timeline', async (event, { timelineId, newName }) => {
    try {
      // Duplicate the timeline in the database
      const duplicatedTimelineId = await duplicateTimelineComplete(timelineId, newName);
      
      event.reply('timeline-duplicated', { 
        success: true, 
        newTimelineId: duplicatedTimelineId 
      });
      
      // Refresh the timelines list
      const timelines = dbManager.getAllTimelines();
      event.reply('timelines-list', timelines);
    } catch (error) {
      console.error('Error duplicating timeline:', error);
      event.reply('timeline-duplicated', { 
        success: false, 
        error: error.message 
      });
    }
  });

  // Handle resetting timeline CSS
  ipcMain.on('reset-timeline-css', (event, timelineId) => {
    try {
      // Reset the custom CSS for this timeline
      const settings = dbManager.getTimelineSettings(timelineId);
      if (settings) {
        dbManager.updateTimelineSettings(timelineId, {
          ...settings,
          use_custom_css: 0
        });
        console.log(`Custom CSS disabled for timeline ${timelineId}`);
      }
    } catch (error) {
      console.error('Error resetting timeline CSS:', error);
    }
  });

  // Handle new image uploads
  ipcMain.handle('save-new-image', async (event, fileInfo) => {
    try {
        const result = await dbManager.saveNewImage(fileInfo);
        return result;
    } catch (error) {
        console.error('Error saving new image:', error);
        throw error;
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

  ipcMain.on('recalculate-period-stacks', (event) => {
    if (mainWindow) {
      mainWindow.webContents.send('recalculate-period-stacks');
    }
  });

  // Add error logging handler
  ipcMain.on('log-message', (event, { level, message }) => {
    logToRenderer(level, message);
  });

  ipcMain.on('open-edit-item-with-range-window', (event, item) => {
    createEditItemWithRangeWindow(item);
  });

  ipcMain.on('edit-item-with-range-window-closing', (event) => {
    if (editItemWithRangeWindow) {
      editItemWithRangeWindow.destroy();
      editItemWithRangeWindow = null;
    }
  });

  ipcMain.on('update-timeline-item-with-range', (event, item) => {
    try {
      // Use dbManager to update the item
      const updatedItem = dbManager.updateItem(item.id, item);
      // Get all updated items
      const allItems = dbManager.getAllItems();
      // Send updated items to the main window
      if (mainWindow) {
        mainWindow.webContents.send('items', allItems);
      }
      // Send success response back to the edit window
      event.sender.send('itemUpdated', { success: true });
    } catch (error) {
      console.error('Error updating timeline item:', error);
      event.sender.send('itemUpdated', { success: false, error: error.message });
    }
  });

  // Handle timeline updates
  ipcMain.on('timeline-updated', (event, state) => {
    if (mainWindow) {
      mainWindow.webContents.send('timeline-updated', state);
    }
  });

  ipcMain.on('open-archive', () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 1000;
    const windowHeight = 900;

    const archiveWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: Math.floor((width - windowWidth) / 2),
      y: Math.floor((height - windowHeight) / 2),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      show: false,
      autoHideMenuBar: true,
      parent: mainWindow,
      modal: true
    });

    archiveWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12") {
        archiveWindow.webContents.openDevTools();
      }
    });

    archiveWindow.loadFile('./markdown/archive.html');

    archiveWindow.once('ready-to-show', () => {
      archiveWindow.show();
    });

    archiveWindow.on('closed', () => {
      archiveWindow = null;
    });
  });

  // Handle opening archive window
  ipcMain.on('open-archive-window', (event) => {
    createArchiveWindow();
  });

  ipcMain.on('getAllStories', (event) => {
    const stories = dbManager.getAllStories();
    event.sender.send('stories', stories);
  });

  ipcMain.on('getAllStoryReferences', (event) => {
    const storyReferences = dbManager.getAllStoryReferences();
    event.sender.send('storyReferences', storyReferences);
  });

  ipcMain.on('jumpToYear', (event, item) => {
    // send jumpToYear to timeline.js
    mainWindow.webContents.send('jumpToYear', item);
  });

  ipcMain.on('getAllMedia', (event) => {
    // Fetch all pictures from the database
    const media = dbManager.getAllPictures();
    event.sender.send('media', media);
  });

  ipcMain.on('getAllTags', (event) => {
    const tags = dbManager.getAllTagsWithCounts();
    event.sender.send('tags', tags);
  });

  // Add handler for removing stories
  ipcMain.handle('removeStory', async (event, storyId) => {
    try {
      const success = dbManager.deleteStory(storyId);
      // Refresh the stories list
      const stories = dbManager.getAllStories();
      mainWindow.webContents.send('stories', stories);
      return success;
    } catch (error) {
      console.error('Error removing story:', error);
      throw error;
    }
  });

  // Add handler for removing tags
  ipcMain.handle('removeTag', async (event, tagId) => {
    try {
      const success = dbManager.deleteTag(tagId);
      // Refresh the tags list
      const tags = dbManager.getAllTagsWithCounts();
      mainWindow.webContents.send('tags', tags);
      return success;
    } catch (error) {
      console.error('Error removing tag:', error);
      throw error;
    }
  });

  ipcMain.handle('removeMedia', async (event, mediaId) => {
    try {
      const mediaFile = dbManager.getMedia(mediaId);
      const success = dbManager.deleteMedia(mediaId, mediaFile.file_path);
      // Listen for the deletion confirmation
      mainWindow.webContents.send('mediaRemoved', { success: true });
      return success;
    } catch (error) {
      console.error('Error removing media:', error);
      throw error;
    }
  });

  // Add handlers for image library functionality
  ipcMain.handle('get-picture-usage', async (event, pictureId) => {
    try {
      return dbManager.getPictureUsageCount(pictureId);
    } catch (error) {
      console.error('Error getting picture usage:', error);
      throw error;
    }
  });

  ipcMain.handle('cleanup-orphaned-images', async (event) => {
    try {
      return dbManager.cleanupOrphanedImages();
    } catch (error) {
      console.error('Error cleaning up orphaned images:', error);
      throw error;
    }
  });

  ipcMain.handle('add-image-reference', async (event, itemId, pictureId) => {
    try {
      return dbManager.addImageReference(itemId, pictureId);
    } catch (error) {
      console.error('Error adding image reference:', error);
      throw error;
    }
  });

  ipcMain.handle('remove-image-reference', async (event, itemId, pictureId) => {
    try {
      return dbManager.removeImageReference(itemId, pictureId);
    } catch (error) {
      console.error('Error removing image reference:', error);
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

// Add this near the top of the file, after the imports
function logToRenderer(level, message) {
    if (mainWindow) {
        mainWindow.webContents.send('log-message', { level, message });
    }
}

// return timeline data
ipcMain.handle('get-timeline-data', async (event) => {
  return dbManager.getAllTimelineData();
});

// return all items
ipcMain.handle('get-all-items', async (event) => {
  return dbManager.getAllItems();
});

/**
 * Creates the archive window
 * 
 * How it works:
 * 1. Creates BrowserWindow instance
 * 2. Loads archive.html
 * 3. Sets up window events
 * 
 * Possible errors:
 * - Window creation failure
 * - File load failure
 */
function createArchiveWindow() {
    if (archiveWindow) {
        archiveWindow.focus();
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 1050;
    const windowHeight = 900;

    archiveWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: Math.floor((width - windowWidth) / 2),
        y: Math.floor((height - windowHeight) / 2),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        show: false,
        autoHideMenuBar: true,
        parent: mainWindow,
        modal: true
    });

    archiveWindow.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
            archiveWindow.webContents.openDevTools();
        }
    });

    archiveWindow.loadFile('./markdown/archive.html');

    archiveWindow.once('ready-to-show', () => {
        archiveWindow.show();
    });

    archiveWindow.on('closed', () => {
        archiveWindow = null;
    });

    archiveWindow.webContents.on('removeStory', (event, storyId) => {
        console.log('removeStory', storyId);
        dbManager.deleteStory(storyId);
        initializeArchive();
    });
}