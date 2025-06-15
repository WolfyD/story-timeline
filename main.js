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
const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dbManager = require('./dbManager');

const CLOSE_SPLASH_WINDOW = false;

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
let mainWindow;
let addItemWindow;
let editItemWindow;
let editItemWithRangeWindow;
let archiveWindow;
let loadingWindow;
let addCharacterWindow;
let editCharacterWindow;
let characterManagerWindow;
let relationshipEditorWindow;
let relationshipEditorData = null;
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

/**
 * Creates the main window
 * 
 * This function creates the main BrowserWindow and sets up event handlers.
 * The window shows the timeline interface with all items and controls.
 * 
 * @param {number} width - Window width (optional)
 * @param {number} height - Window height (optional)
 * @param {number} x - Window x position (optional)
 * @param {number} y - Window y position (optional)
 */
function createWindow(width = null, height = null, x = null, y = null) {
  // Prevent creating multiple main windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[main.js] Main window already exists, not creating new one');
    return mainWindow;
  }
  
  // Start loading process
  updateLoadingProgress('Creating main window...', 10);
  
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const windowWidth = width || 1000;
  const windowHeight = height || 700;
  const windowX = x !== null ? x : Math.floor((screenWidth - windowWidth) / 2);
  const windowY = y !== null ? y : Math.floor((screenHeight - windowHeight) / 2);

  updateLoadingProgress('Configuring window settings...', 20);

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // Don't show until everything is loaded
    autoHideMenuBar: true
  });

  updateLoadingProgress('Loading interface...', 30);

  // Load the index.html of the app.
  mainWindow.loadFile('./markdown/index.html');

  updateLoadingProgress('Setting up window events...', 40);

  // Open the DevTools when F12 is pressed.
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      mainWindow.webContents.openDevTools();
    }
  });

  // Window event handlers
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getBounds();
    settings.size = { x: bounds.width, y: bounds.height };
    mainWindow.webContents.send('window-resized', bounds);
  });

  mainWindow.on('move', () => {
    const bounds = mainWindow.getBounds();
    settings.position = { x: bounds.x, y: bounds.y };
    mainWindow.webContents.send('window-moved', bounds);
  });

  mainWindow.on('maximize', () => {
    settings.isFullscreen = true;
    mainWindow.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    settings.isFullscreen = false;
    mainWindow.webContents.send('window-unmaximized');
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    mainWindow = null;
    
    // Show splash screen again when main window closes
    if (!splashWindow || splashWindow.isDestroyed()) {
      createSplashWindow();
    } else {
      splashWindow.show();
      splashWindow.focus();
    }
  });

  updateLoadingProgress('Initializing database...', 50);

  // Database is already initialized at module level
  try {
    // Just verify database is working
    if (dbManager) {
      updateLoadingProgress('Database initialized successfully', 70);
    } else {
      throw new Error('Database manager not available');
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    updateLoadingProgress('Database initialization failed', 70);
  }

  updateLoadingProgress('Loading timeline data...', 80);

  // Increase max listeners to prevent warnings
  mainWindow.webContents.setMaxListeners(20);
  
  // Add error handling for the main window
  mainWindow.webContents.on('crashed', (event) => {
    console.error('[main.js] Main window crashed:', event);
  });
  
  mainWindow.webContents.on('unresponsive', () => {
    console.error('[main.js] Main window became unresponsive');
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[main.js] Render process gone:', details);
  });
  
  // Wait for the window to be ready, then load data and show
  mainWindow.webContents.once('did-finish-load', async () => {
    try {
      updateLoadingProgress('Loading settings...', 85);
      await loadSettings();
      
      updateLoadingProgress('Loading timeline data...', 90);
      await loadData();
      
      updateLoadingProgress('Finalizing...', 95);
      
      // Small delay to show the final progress
      setTimeout(() => {
        updateLoadingProgress('Ready!', 100);
        
        // Another small delay before showing the main window
        setTimeout(() => {
          closeLoadingWindow();
          mainWindow.show();
          mainWindow.focus();
        }, 300);
      }, 200);
      
    } catch (error) {
      console.error('Error during initialization:', error);
      updateLoadingProgress('Initialization failed', 100);
      
      setTimeout(() => {
        closeLoadingWindow();
        mainWindow.show();
        mainWindow.focus();
      }, 1000);
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
      canvasSettings: savedSettings.canvasSettings || {},
      size: {
        x: parseInt(savedSettings.size?.x || 1000),
        y: parseInt(savedSettings.size?.y || 700)
      },
      position: {
        x: parseInt(savedSettings.position?.x || 300),
        y: parseInt(savedSettings.position?.y || 100)
      }
    };

    // Apply saved window size and position
    console.log('[main.js] Applying saved window settings:', {
      size: settings.size,
      position: settings.position
    });

    try {
      // Set window size
      if (settings.size.x > 100 && settings.size.y > 100) {
        mainWindow.setSize(settings.size.x, settings.size.y);
      }

      // Set window position (check all displays for multi-monitor support)
      let x = settings.position.x;
      let y = settings.position.y;

      // Get all available displays
      const displays = screen.getAllDisplays();
      let positionValid = false;

      // Check if the saved position is within any display
      for (const display of displays) {
        const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = display.workArea;
        
        // Check if the window would be at least partially visible on this display
        if (x + settings.size.x > displayX && 
            x < displayX + displayWidth &&
            y + settings.size.y > displayY && 
            y < displayY + displayHeight) {
          positionValid = true;
          break;
        }
      }

      // If position is not valid on any display, center on primary display
      if (!positionValid) {
        console.log('[main.js] Saved position not valid on any display, centering on primary');
        const primaryDisplay = screen.getPrimaryDisplay().workArea;
        x = primaryDisplay.x + Math.floor((primaryDisplay.width - settings.size.x) / 2);
        y = primaryDisplay.y + Math.floor((primaryDisplay.height - settings.size.y) / 2);
      }

      console.log('[main.js] Setting window position to:', { x, y });
      mainWindow.setPosition(x, y);

      // Apply maximized state if saved (not fullscreen)
      if (settings.isFullscreen) {
        mainWindow.maximize();
      }

      // Apply custom scaling if enabled
      if (settings.useCustomScaling && settings.customScale) {
        mainWindow.webContents.setZoomFactor(parseFloat(settings.customScale));
      }

    } catch (error) {
      console.error('[main.js] Error applying window settings:', error);
    }

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

        console.log(`[main.js] loadData() called - current timeline: ${dbManager.currentTimelineId || 'undefined'}`);
        const savedData = dbManager.getUniverseData();
        if (savedData) {
            const items = dbManager.getAllItems() || [];
            console.log(`[main.js] loadData() fetched ${items.length} items from database`);
            
            data = {
                ...data,
                ...savedData,
                items: items
            };

            console.log("[main.js] Timeline data loaded:", {
                timeline_id: data.timeline_id,
                title: data.title,
                author: data.author,
                description: data.description,
                start: data.start,
                granularity: data.granularity,
                itemCount: data.items.length
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

  ipcMain.handle('get-current-timeline-granularity', () => {
    return data.granularity;
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
        display_radius: parseInt(updatedSettings.displayRadius || 10),
        canvasSettings: updatedSettings.canvasSettings || {}
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
    console.log(`[main.js] getAllItems called - current timeline: ${dbManager.currentTimelineId || 'undefined'}`);
    const items = dbManager.getAllItems();
    console.log(`[main.js] getAllItems returning ${items ? items.length : 0} items`);
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
    // Show loading window when opening a timeline
    createLoadingWindow();
    updateLoadingProgress('Loading timeline...', 10);
    
    const timeline = dbManager.getTimelineWithSettings(timelineId);
    if (!timeline) {
        updateLoadingProgress('Timeline not found', 100);
        setTimeout(() => {
          closeLoadingWindow();
        }, 1000);
        event.reply('error', 'Timeline not found');
        return;
    }

    updateLoadingProgress('Setting up timeline...', 20);

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

    updateLoadingProgress('Creating main window...', 30);

    // If main window doesn't exist, create it (this will handle its own loading progress)
    if (!mainWindow) {
        createWindow();
    } else {
        // Main window already exists, load timeline data directly
        updateLoadingProgress('Loading timeline data...', 60);
        
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

        updateLoadingProgress('Loading items...', 80);

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

        updateLoadingProgress('Applying settings...', 90);

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
        
        updateLoadingProgress('Ready!', 100);
        setTimeout(() => {
          closeLoadingWindow();
        }, 300);
    }

    // Close splash window if it exists
    if (splashWindow && !splashWindow.isDestroyed()) {
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
    console.log('[main.js] Creating new timeline...');
    
    // Create the timeline in the database
    const timeline = {
        title: dbManager.constructor.generateEpicTitle(),
        author: '',
        description: '',
        start_year: 0,
        granularity: 4
    };
    const newTimelineId = dbManager.addTimeline(timeline);
    console.log(`[main.js] New timeline created with ID: ${newTimelineId}`);
    
    // CRITICAL: Set the current timeline context in dbManager
    dbManager.setCurrentTimeline(newTimelineId);
    console.log(`[main.js] Database manager timeline context set to: ${newTimelineId}`);
    
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
    console.log(`[main.js] Data state updated for new timeline: ${newTimelineId}`);

    if (mainWindow) {
        console.log(`[main.js] Main window exists, reloading with new timeline: ${newTimelineId}`);
        mainWindow.loadFile('./markdown/index.html').then(() => {
            console.log(`[main.js] Main window reloaded, sending timeline data for: ${newTimelineId}`);
            
            // Send the timeline data to the main window
            mainWindow.webContents.send('timeline-data', {
                id: newTimelineId,
                title: timeline.title,
                author: timeline.author,
                description: timeline.description,
                start_year: timeline.start_year,
                granularity: timeline.granularity
            });

            // Send the data to load (explicitly empty items for new timeline)
            console.log(`[main.js] Sending empty timeline data for new timeline: ${newTimelineId}`);
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
        console.log(`[main.js] Main window doesn't exist, creating new window for timeline: ${newTimelineId}`);
        createWindow();
        mainWindow.webContents.once('did-finish-load', () => {
            console.log(`[main.js] New main window loaded, sending timeline data for: ${newTimelineId}`);
            
            // Send the timeline data to the main window
            mainWindow.webContents.send('timeline-data', {
                id: newTimelineId,
                title: timeline.title,
                author: timeline.author,
                description: timeline.description,
                start_year: timeline.start_year,
                granularity: timeline.granularity
            });

            // Send the data to load (explicitly empty items for new timeline)
            console.log(`[main.js] Sending empty timeline data for new timeline: ${newTimelineId}`);
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
        if (CLOSE_SPLASH_WINDOW) {
            splashWindow.close();
        } else {
            // Hide splash window instead of closing it so we can show it again later
            splashWindow.hide();
        }
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



  // return timeline data
  ipcMain.handle('get-timeline-data', async (event) => {
    try {
      console.log('[main.js] get-timeline-data called');
      const timelineData = dbManager.getAllTimelineData();
      console.log('[main.js] Timeline data retrieved:', timelineData);
      return timelineData;
    } catch (error) {
      console.error('[main.js] Error getting timeline data:', error);
      throw error;
    }
  });

  // return all items
  ipcMain.handle('get-all-items', async (event) => {
    try {
      console.log('[main.js] get-all-items called');
      const items = dbManager.getAllItems();
      console.log('[main.js] Items retrieved:', items ? items.length : 'undefined', 'items');
      return items;
    } catch (error) {
      console.error('[main.js] Error getting all items:', error);
      throw error;
    }
  });

  // Handle timeline export save dialog
  ipcMain.handle('save-timeline-export', async (event, data) => {
    try {
      console.log('[main.js] save-timeline-export called with data:', data);
      
      const { dialog } = require('electron');
      const fs = require('fs');
      const path = require('path');

      // Validate input data
      if (!data || typeof data !== 'object') {
        console.error('[main.js] Invalid data received:', data);
        return { success: false, error: 'Invalid export data received' };
      }

      if (!data.htmlContent || typeof data.htmlContent !== 'string') {
        console.error('[main.js] Invalid HTML content:', typeof data.htmlContent);
        return { success: false, error: 'Invalid HTML content provided' };
      }

      // Safely generate filename
      const safeTitle = (data.title && typeof data.title === 'string') 
        ? data.title.replace(/[^a-zA-Z0-9\-_]/g, '_') 
        : 'Timeline_Export';
      
      const defaultFileName = `${safeTitle}_timeline_export.html`;
      console.log('[main.js] Using default filename:', defaultFileName);

      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Timeline',
        defaultPath: defaultFileName,
        filters: [
          { name: 'HTML Files', extensions: ['html'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      console.log('[main.js] Save dialog result:', result);

      if (result.canceled || !result.filePath) {
        console.log('[main.js] Export canceled by user');
        return { success: false, error: 'Export canceled by user' };
      }

      // Write the HTML content to the file
      console.log('[main.js] Writing file to:', result.filePath);
      await fs.promises.writeFile(result.filePath, data.htmlContent, 'utf8');
      console.log('[main.js] File written successfully');

      return { 
        success: true, 
        filePath: result.filePath 
      };

    } catch (error) {
      console.error('[main.js] Error saving timeline export:', error);
      console.error('[main.js] Error stack:', error.stack);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Handle opening exported file
  ipcMain.handle('open-exported-file', async (event, filePath) => {
    try {
      const { shell } = require('electron');
      const fs = require('fs');
      const path = require('path');
      
      console.log(`[main.js] Attempting to open file: ${filePath}`);
      
      // Check if file exists first
      if (!fs.existsSync(filePath)) {
        console.error(`[main.js] File does not exist: ${filePath}`);
        return { 
          success: false, 
          error: 'File does not exist' 
        };
      }
      
      // Try to open with system default application
      try {
        console.log(`[main.js] Using shell.openPath to open: ${filePath}`);
        const result = await shell.openPath(filePath);
        
        if (result) {
          // shell.openPath returns an error string if it fails
          console.error(`[main.js] shell.openPath failed: ${result}`);
          
          // Try fallback method using shell.openExternal with file:// protocol
          console.log(`[main.js] Trying fallback method with file:// protocol`);
          const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
          await shell.openExternal(fileUrl);
          
          return { success: true, method: 'openExternal' };
        } else {
          console.log(`[main.js] File opened successfully with shell.openPath`);
          return { success: true, method: 'openPath' };
        }
      } catch (openError) {
        console.error(`[main.js] Error with shell.openPath:`, openError);
        
        // Try fallback method
        try {
          console.log(`[main.js] Trying fallback method with shell.openExternal`);
          const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
          await shell.openExternal(fileUrl);
          
          return { success: true, method: 'openExternal' };
        } catch (fallbackError) {
          console.error(`[main.js] Fallback method also failed:`, fallbackError);
          throw fallbackError;
        }
      }
      
    } catch (error) {
      console.error(`[main.js] Error opening exported file: ${filePath}`, error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Handle image to base64 conversion for export
  ipcMain.handle('convert-image-to-base64', async (event, filePath) => {
    try {
      const fs = require('fs');
      const path = require('path');
      
      console.log(`[main.js] Converting image to base64: ${filePath}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn(`[main.js] Image file not found: ${filePath}`);
        return { success: false, error: 'File not found' };
      }

      // Read the file
      const imageBuffer = fs.readFileSync(filePath);
      
      // Determine MIME type from file extension
      const ext = path.extname(filePath).toLowerCase();
      let mimeType;
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        case '.webp':
          mimeType = 'image/webp';
          break;
        case '.svg':
          mimeType = 'image/svg+xml';
          break;
        default:
          // Default to jpeg for unknown extensions
          mimeType = 'image/jpeg';
      }

      // Convert to base64
      const base64Data = imageBuffer.toString('base64');
      const dataUri = `data:${mimeType};base64,${base64Data}`;
      
      console.log(`[main.js] Converted image to data URI: ${filePath} (${(base64Data.length / 1024).toFixed(1)}KB)`);
      
      return { 
        success: true, 
        dataUri: dataUri,
        size: base64Data.length
      };
      
    } catch (error) {
      console.error(`[main.js] Error converting image to data URI: ${filePath}`, error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });

  // Handle duplicate image consolidation
  ipcMain.handle('consolidate-duplicate-images', async (event) => {
    try {
      console.log('[main.js] Starting duplicate image consolidation...');
      const stats = await dbManager.consolidateDuplicateImages();
      
      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      console.error('[main.js] Error consolidating duplicate images:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handle visual duplicate image consolidation
  ipcMain.handle('consolidate-visual-duplicate-images', async (event) => {
    try {
      console.log('[main.js] Starting visual duplicate image consolidation...');
      const stats = await dbManager.consolidateVisuallyDuplicateImages();
      
      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      console.error('[main.js] Error consolidating visual duplicate images:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Handle getting all pictures for debug analysis
  ipcMain.handle('get-all-pictures-debug', async (event) => {
    try {
      console.log('[main.js] Getting all pictures for debug analysis...');
      const pictures = dbManager.getAllPictures();
      
      console.log(`[main.js] Found ${pictures.length} pictures for debug analysis`);
      return pictures;
    } catch (error) {
      console.error('[main.js] Error getting pictures for debug:', error);
      return [];
    }
  });

  // Handle file system vs database analysis
  ipcMain.handle('analyze-filesystem-vs-database', async (event) => {
    try {
      console.log('[main.js] Analyzing file system vs database...');
      
      const fs = require('fs');
      const path = require('path');
      
      // Get all pictures from database
      const picturesInDatabase = dbManager.getAllPictures();
      
      // Get the current timeline to determine the correct folder
      const currentTimelineId = dbManager.currentTimelineId;
      
      // Get the pictures directory for this timeline
      let baseDir;
      if (app) {
        baseDir = path.join(app.getPath('userData'), 'media', 'pictures');
      } else {
        baseDir = path.join(__dirname, 'test_data', 'media', 'pictures');
      }
      
      const timelinePicturesDir = path.join(baseDir, currentTimelineId.toString());
      
      // Get all files actually on disk
      let filesOnDisk = [];
      if (fs.existsSync(timelinePicturesDir)) {
        const files = fs.readdirSync(timelinePicturesDir);
        filesOnDisk = files
          .filter(file => file.match(/\.(png|jpg|jpeg|gif|webp)$/i))
          .map(file => {
            const filePath = path.join(timelinePicturesDir, file);
            const stats = fs.statSync(filePath);
            return {
              name: file,
              path: filePath,
              size: stats.size
            };
          });
      }
      
      console.log(`[main.js] Found ${filesOnDisk.length} files on disk in ${timelinePicturesDir}`);
      console.log(`[main.js] Found ${picturesInDatabase.length} pictures in database`);
      
      // Analyze differences
      const filesOnDiskNames = new Set(filesOnDisk.map(f => f.name));
      const dbFileNames = new Set(picturesInDatabase.map(p => path.basename(p.file_path || '')));
      
      const filesOnlyOnDisk = filesOnDisk.filter(f => !dbFileNames.has(f.name));
      const dbRecordsWithoutFiles = picturesInDatabase.filter(p => {
        const fileName = path.basename(p.file_path || '');
        return !filesOnDiskNames.has(fileName) || !fs.existsSync(p.file_path);
      });
      
      const analysis = {
        filesOnDisk,
        picturesInDatabase,
        filesOnlyOnDisk,
        dbRecordsWithoutFiles,
        timelinePicturesDir
      };
      
      console.log(`[main.js] Files only on disk: ${filesOnlyOnDisk.length}`);
      console.log(`[main.js] DB records without files: ${dbRecordsWithoutFiles.length}`);
      
      return {
        success: true,
        analysis: analysis
      };
    } catch (error) {
      console.error('[main.js] Error analyzing file system vs database:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ==================== CHARACTER SYSTEM IPC HANDLERS ====================

  // Character CRUD operations
  ipcMain.handle('add-character', async (event, character) => {
    try {
      const newCharacter = await dbManager.addCharacter(character);
      
      // Notify character manager to refresh if it's open
      if (characterManagerWindow && !characterManagerWindow.isDestroyed()) {
        characterManagerWindow.webContents.send('refresh-data');
      }
      
      // Notify relationship editor if it's open
      if (relationshipEditorWindow && !relationshipEditorWindow.isDestroyed()) {
        relationshipEditorWindow.webContents.send('character-created');
      }
      
      return { success: true, character: newCharacter };
    } catch (error) {
      console.error('[main.js] Error adding character:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-character', async (event, characterId) => {
    try {
      const character = dbManager.getCharacter(characterId);
      return { success: true, character };
    } catch (error) {
      console.error('[main.js] Error getting character:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-all-characters', async (event, timelineId = null) => {
    try {
      const characters = dbManager.getAllCharacters(timelineId);
      return { success: true, characters };
    } catch (error) {
      console.error('[main.js] Error getting all characters:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-character', async (event, characterId, character) => {
    try {
      const success = dbManager.updateCharacter(characterId, character);
      if (success) {
        // Notify character manager to refresh if it's open
        if (characterManagerWindow && !characterManagerWindow.isDestroyed()) {
          characterManagerWindow.webContents.send('refresh-data');
        }
        
        // Notify relationship editor if it's open
        if (relationshipEditorWindow && !relationshipEditorWindow.isDestroyed()) {
          relationshipEditorWindow.webContents.send('character-updated');
        }
        
        return { success: true };
      } else {
        return { success: false, error: 'Character not found or update failed' };
      }
    } catch (error) {
      console.error('[main.js] Error updating character:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-character', async (event, characterId) => {
    try {
      const success = dbManager.deleteCharacter(characterId);
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: 'Character not found or deletion failed' };
      }
    } catch (error) {
      console.error('[main.js] Error deleting character:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('search-characters', async (event, criteria) => {
    try {
      const characters = dbManager.searchCharacters(criteria);
      return { success: true, characters };
    } catch (error) {
      console.error('[main.js] Error searching characters:', error);
      return { success: false, error: error.message };
    }
  });

  // Character relationship operations
  ipcMain.handle('add-character-relationship', async (event, relationship) => {
    try {
      const relationshipId = dbManager.addCharacterRelationship(relationship);
      return { success: true, relationshipId };
    } catch (error) {
      console.error('[main.js] Error adding character relationship:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-character-relationships', async (event, characterId) => {
    try {
      const relationships = dbManager.getCharacterRelationships(characterId);
      return { success: true, relationships };
    } catch (error) {
      console.error('[main.js] Error getting character relationships:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-all-character-relationships', async (event, timelineId = null) => {
    try {
      const relationships = dbManager.getAllCharacterRelationships(timelineId);
      return { success: true, relationships };
    } catch (error) {
      console.error('[main.js] Error getting all character relationships:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('update-character-relationship', async (event, { id, relationship }) => {
    try {
      const success = dbManager.updateCharacterRelationship(id, relationship);
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: 'Relationship not found or update failed' };
      }
    } catch (error) {
      console.error('[main.js] Error updating character relationship:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-character-relationship', async (event, relationshipId) => {
    try {
      const success = dbManager.deleteCharacterRelationship(relationshipId);
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: 'Relationship not found or deletion failed' };
      }
    } catch (error) {
      console.error('[main.js] Error deleting character relationship:', error);
      return { success: false, error: error.message };
    }
  });

  // Get relationships between two specific characters
  ipcMain.handle('get-character-relationships-between', async (event, { character1Id, character2Id, timelineId }) => {
    try {
      // Get all relationships for both characters and filter for connections between them
      const relationships1 = dbManager.getCharacterRelationships(character1Id);
      const relationships2 = dbManager.getCharacterRelationships(character2Id);
      
      // Find relationships between these two characters
      const betweenRelationships = [];
      
      // Check relationships where character1 is the source
      relationships1.forEach(rel => {
        if (rel.character_2_id === character2Id && rel.timeline_id === timelineId) {
          betweenRelationships.push(rel);
        }
      });
      
      // Check relationships where character2 is the source
      relationships2.forEach(rel => {
        if (rel.character_2_id === character1Id && rel.timeline_id === timelineId) {
          betweenRelationships.push(rel);
        }
      });
      
      return { success: true, relationships: betweenRelationships };
    } catch (error) {
      console.error('[main.js] Error getting relationships between characters:', error);
      return { success: false, error: error.message };
    }
  });

  // Get a single character relationship by ID
  ipcMain.handle('get-character-relationship', async (event, relationshipId) => {
    try {
      // Since we don't have a direct method, we'll need to get all relationships and find the one
      const allRelationships = dbManager.getAllCharacterRelationships();
      const relationship = allRelationships.find(rel => rel.id === relationshipId);
      
      if (relationship) {
        return { success: true, relationship };
      } else {
        return { success: false, error: 'Relationship not found' };
      }
    } catch (error) {
      console.error('[main.js] Error getting character relationship:', error);
      return { success: false, error: error.message };
    }
  });

  // Character-item reference operations
  ipcMain.handle('add-character-references-to-item', async (event, itemId, characterRefs) => {
    try {
      dbManager.addCharacterReferencesToItem(itemId, characterRefs);
      return { success: true };
    } catch (error) {
      console.error('[main.js] Error adding character references to item:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-item-character-references', async (event, itemId) => {
    try {
      const references = dbManager.getItemCharacterReferences(itemId);
      return { success: true, references };
    } catch (error) {
      console.error('[main.js] Error getting item character references:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-all-character-references', async (event, timelineId = null) => {
    try {
      const references = dbManager.getAllCharacterReferences(timelineId);
      return { success: true, references };
    } catch (error) {
      console.error('[main.js] Error getting all character references:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-items-referencing-character', async (event, characterId) => {
    try {
      const items = dbManager.getItemsReferencingCharacter(characterId);
      return { success: true, items };
    } catch (error) {
      console.error('[main.js] Error getting items referencing character:', error);
      return { success: false, error: error.message };
    }
  });

  // Character statistics and utility operations
  ipcMain.handle('get-character-stats', async (event, timelineId = null) => {
    try {
      const stats = dbManager.getCharacterStats(timelineId);
      return { success: true, stats };
    } catch (error) {
      console.error('[main.js] Error getting character stats:', error);
      return { success: false, error: error.message };
    }
  });

  // Archive window character data handlers (for compatibility with existing archive system)
  ipcMain.on('getAllCharacters', (event) => {
    try {
      const characters = dbManager.getAllCharacters();
      event.sender.send('characters', characters);
    } catch (error) {
      console.error('[main.js] Error getting all characters for archive:', error);
      event.sender.send('characters', []);
    }
  });

  ipcMain.on('getAllCharacterRelationships', (event) => {
    try {
      const relationships = dbManager.getAllCharacterRelationships();
      event.sender.send('characterRelationships', relationships);
    } catch (error) {
      console.error('[main.js] Error getting all character relationships for archive:', error);
      event.sender.send('characterRelationships', []);
    }
  });

  ipcMain.on('getAllCharacterReferences', (event) => {
    try {
      const references = dbManager.getAllCharacterReferences();
      event.sender.send('characterReferences', references);
    } catch (error) {
      console.error('[main.js] Error getting all character references for archive:', error);
      event.sender.send('characterReferences', []);
    }
  });

  // Character window creation handlers
  ipcMain.on('open-add-character-window', (event, timelineId) => {
    createAddCharacterWindow(timelineId);
  });

  ipcMain.on('open-edit-character-window', (event, character) => {
    createEditCharacterWindow(character);
  });

  ipcMain.on('open-character-manager-window', (event, timelineId) => {
    createCharacterManagerWindow(timelineId);
  });

  ipcMain.on('open-relationship-editor-window', (event, relationshipData) => {
    createRelationshipEditorWindow(relationshipData);
  });

  // Character validation handlers
  ipcMain.handle('validate-relationship-type', async (event, relationshipType) => {
    try {
      const isValid = dbManager.validateRelationshipType(relationshipType);
      return { success: true, isValid };
    } catch (error) {
      console.error('[main.js] Error validating relationship type:', error);
      return { success: false, error: error.message };
    }
  });

  // Relationship editor data handler
  ipcMain.handle('get-relationship-editor-data', async (event) => {
    try {
      // This will be set by the character manager when opening the relationship editor
      return relationshipEditorData || null;
    } catch (error) {
      console.error('[main.js] Error getting relationship editor data:', error);
      return null;
    }
  });

  // Create character relationship handler
  ipcMain.handle('create-character-relationship', async (event, relationshipData) => {
    try {
      const relationshipId = dbManager.addCharacterRelationship(relationshipData);
      
      // Notify character manager to refresh if it's open
      if (characterManagerWindow && !characterManagerWindow.isDestroyed()) {
        characterManagerWindow.webContents.send('refresh-data');
      }
      
      return { success: true, relationshipId };
    } catch (error) {
      console.error('[main.js] Error creating character relationship:', error);
      return { success: false, error: error.message };
    }
  });

  // Refresh character manager handler
  ipcMain.handle('refresh-character-manager', async (event) => {
    try {
      if (characterManagerWindow && !characterManagerWindow.isDestroyed()) {
        characterManagerWindow.webContents.send('refresh-data');
      }
      return { success: true };
    } catch (error) {
      console.error('[main.js] Error refreshing character manager:', error);
      return { success: false, error: error.message };
    }
  });
}

// ===== Application Lifecycle =====
app.whenReady().then(() => {
  // Set up IPC handlers first
  setupIpcHandlers();
  
  // Create splash window directly
  createSplashWindow();
});

app.on('window-all-closed', () => {
  // Only quit if we're not on macOS and there are truly no windows left
  // This allows the splash screen to keep the app running
  if (process.platform !== 'darwin') {
    // Check if splash window still exists
    if (!splashWindow || splashWindow.isDestroyed()) {
      app.quit();
    }
  }
});

// Add this near the top of the file, after the imports
function logToRenderer(level, message) {
    if (mainWindow) {
        mainWindow.webContents.send('log-message', { level, message });
    }
}



// ==================== CHARACTER WINDOW CREATION FUNCTIONS ====================

/**
 * Creates the add character window
 * @param {string} timelineId - Timeline ID to add character to
 */
function createAddCharacterWindow(timelineId) {
    if (addCharacterWindow) {
        addCharacterWindow.focus();
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 800;
    const windowHeight = 900;

    addCharacterWindow = new BrowserWindow({
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

    addCharacterWindow.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
            addCharacterWindow.webContents.openDevTools();
        }
    });

    addCharacterWindow.loadFile('./markdown/addCharacter.html');

    addCharacterWindow.once('ready-to-show', () => {
        addCharacterWindow.show();
        // Send timeline ID to the window
        addCharacterWindow.webContents.send('timeline-id', timelineId);
    });

    addCharacterWindow.on('closed', () => {
        addCharacterWindow = null;
    });
}

/**
 * Creates the edit character window
 * @param {Object} character - Character data to edit
 */
function createEditCharacterWindow(character) {
    if (editCharacterWindow) {
        editCharacterWindow.focus();
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 800;
    const windowHeight = 900;

    editCharacterWindow = new BrowserWindow({
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

    editCharacterWindow.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
            editCharacterWindow.webContents.openDevTools();
        }
    });

    editCharacterWindow.loadFile('./markdown/editCharacter.html');

    editCharacterWindow.once('ready-to-show', () => {
        editCharacterWindow.show();
        // Send character data to the window
        editCharacterWindow.webContents.send('character-data', character);
    });

    editCharacterWindow.on('closed', () => {
        editCharacterWindow = null;
    });
}

/**
 * Creates the character manager window
 * @param {string} timelineId - Timeline ID to manage characters for
 */
function createCharacterManagerWindow(timelineId) {
    if (characterManagerWindow) {
        characterManagerWindow.focus();
        return;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const { left, top } = mainWindow.getBounds();
    const windowWidth = 1200;
    const windowHeight = 800;
    const x = left + (width - windowWidth) / 2;
    const y = top + (height - windowHeight) / 2;

    characterManagerWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: x,
        y: y,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        show: false,
        autoHideMenuBar: true,
        parent: mainWindow,
        modal: false
    });

    characterManagerWindow.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
            characterManagerWindow.webContents.openDevTools();
        }
    });

    characterManagerWindow.loadFile('./markdown/characterManager.html');

    characterManagerWindow.once('ready-to-show', () => {
        characterManagerWindow.show();
        // Send timeline ID to the window
        characterManagerWindow.webContents.send('timeline-id', timelineId);
    });

    characterManagerWindow.on('closed', () => {
        characterManagerWindow = null;
    });
}

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

/**
 * Creates the loading window that shows during initialization
 */
function createLoadingWindow() {
  // Prevent creating multiple loading windows
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    console.log('[main.js] Loading window already exists, not creating new one');
    return loadingWindow;
  }
  
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 400;
  const windowHeight = 300;

  loadingWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((width - windowWidth) / 2),
    y: Math.floor((height - windowHeight) / 2),
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#1a1a1a'
  });

  // Create loading HTML content directly
  const loadingHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          overflow: hidden;
        }
        .loading-container {
          text-align: center;
          padding: 2rem;
        }
        .app-title {
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          background: linear-gradient(45deg, #4f9cf9, #7dd3fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .app-subtitle {
          font-size: 0.9rem;
          color: #888;
          margin-bottom: 2rem;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #333;
          border-top: 3px solid #4f9cf9;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }
        .loading-text {
          font-size: 0.9rem;
          color: #ccc;
          margin-bottom: 0.5rem;
        }
        .loading-progress {
          width: 200px;
          height: 4px;
          background: #333;
          border-radius: 2px;
          overflow: hidden;
          margin: 1rem auto;
        }
        .loading-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #4f9cf9, #7dd3fc);
          border-radius: 2px;
          transition: width 0.3s ease;
          width: 0%;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="loading-container">
        <div class="app-title">Story Timeline</div>
        <div class="app-subtitle">Organize your stories in time</div>
        <div class="loading-spinner"></div>
        <div class="loading-text" id="loading-text">Initializing...</div>
        <div class="loading-progress">
          <div class="loading-progress-bar" id="progress-bar"></div>
        </div>
      </div>
    </body>
    </html>
  `;

  loadingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHTML)}`);

  loadingWindow.once('ready-to-show', () => {
    loadingWindow.show();
  });

  loadingWindow.on('closed', () => {
    loadingWindow = null;
  });

  return loadingWindow;
}

/**
 * Updates the loading window with progress information
 */
function updateLoadingProgress(text, progress = 0) {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.webContents.executeJavaScript(`
      const textEl = document.getElementById('loading-text');
      const progressEl = document.getElementById('progress-bar');
      if (textEl) textEl.textContent = '${text}';
      if (progressEl) progressEl.style.width = '${Math.min(100, Math.max(0, progress))}%';
    `);
  }
}

/**
 * Closes the loading window
 */
function closeLoadingWindow() {
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.close();
    loadingWindow = null;
  }
}

/**
 * Creates the relationship editor window
 * @param {Object} relationshipData - Relationship data (for editing) or character pair data (for creating)
 */
function createRelationshipEditorWindow(relationshipData) {
    if (relationshipEditorWindow) {
        relationshipEditorWindow.focus();
        return;
    }

    // Store the relationship data for the IPC handler
    relationshipEditorData = relationshipData;

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 600;
    const windowHeight = 700;

    relationshipEditorWindow = new BrowserWindow({
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
        parent: characterManagerWindow || mainWindow,
        modal: true
    });

    relationshipEditorWindow.webContents.on("before-input-event", (event, input) => {
        if (input.key === "F12") {
            relationshipEditorWindow.webContents.openDevTools();
        }
    });

    relationshipEditorWindow.loadFile('./markdown/relationshipEditor.html');

    relationshipEditorWindow.once('ready-to-show', () => {
        relationshipEditorWindow.show();
    });

    relationshipEditorWindow.on('closed', () => {
        relationshipEditorWindow = null;
        relationshipEditorData = null; // Clear the data when window closes
    });
}

/**
 * Creates the splash window for timeline selection
 */