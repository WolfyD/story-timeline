const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const itemManager = require('./itemManager');

const existingItems = [];

let mainWindow;
let lastSize = [800, 600];

function createWindow () {
  mainWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // Highly recommended
      enableRemoteModule: false,
      nodeIntegration: false    // For security, avoid this in production
    }
  });
  
  mainWindow.loadFile('index.html');

  mainWindow.webContents.on("before-input-event", (event, input) => {
    console.log(input.key);
    if (input.key === "F12") {
      mainWindow.webContents.openDevTools();
    }
  })

  mainWindow.on("resize", ()=>{
    mainWindow.webContents.send("window-resized", mainWindow.getSize(), mainWindow.isMaximized());
  })

  mainWindow.on("move", ()=>{
    let displays = screen.getAllDisplays();
    try {
      let display = displays.find(display => display.bounds.x <= mainWindow.getPosition()[0] + 30 && display.bounds.x + display.bounds.width >= mainWindow.getPosition()[0] - 30);
      mainWindow.webContents.send("window-moved", mainWindow.getPosition(), display.scaleFactor);
    } catch (error) {
      mainWindow.webContents.send("window-moved", mainWindow.getPosition());
    }
  })
  
  mainWindow.on("ready-to-show", ()=>{
    const settingsPath = path.join(__dirname, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      mainWindow.webContents.send("window-resized", mainWindow.getSize());
      if(!settings.customCSS || settings.customCSS == ""){
        console.log("No custom CSS found, loading template");
        settings.customCSS = fs.readFileSync(path.join(__dirname, 'customCSSTemplate.txt'), 'utf8');
      }
      mainWindow.webContents.send('call-load-settings', settings);

      mainWindow.setPosition(settings.position.x, settings.position.y);


      console.log("Settings loaded!:", settings);
      mainWindow.show();
      mainWindow.setSize(settings.size.x, settings.size.y);
      
      lastSize = [settings.size.x, settings.size.y];
      if(settings.isFullscreen){
        mainWindow.maximize();
      }

      const dataPath = path.join(__dirname, 'data.json');
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        itemManager.initialize(data.items);
        mainWindow.webContents.send('call-load-data', data);
      }

    } else {
      mainWindow.webContents.send('call-load-settings', false);
      mainWindow.show();
    }
  })
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('save-settings', (event, settings, data) => {
  const settingsPath = path.join(__dirname, 'settings.json');
  const dataPath = path.join(__dirname, 'data.json');
  settings.size = {};
  if(mainWindow.isMaximized()){
    settings.size.x = lastSize[0];
    settings.size.y = lastSize[1];
  } else {
    settings.size.x = mainWindow.getSize()[0] - 2;
    settings.size.y = mainWindow.getSize()[1] - 1;
  }
  settings.position = {};
  settings.position.x = mainWindow.getPosition()[0] + 2;
  settings.position.y = mainWindow.getPosition()[1] + 1;
  
  // Update data with current items from manager
  data.items = itemManager.getAllItems();
  
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 4));
  console.log("Settings saved:", settings);
  event.sender.send('settings-saved', true);
});

ipcMain.on('load-settings', () => {
  const settingsPath = path.join(__dirname, 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if(!settings.customCSS || settings.customCSS == ""){
    settings.customCSS = fs.readFileSync(path.join(__dirname, 'customCSSTemplate.txt'), 'utf8');
  }
  mainWindow.webContents.send("window-resized", mainWindow.getSize());
  mainWindow.webContents.send('call-load-settings', settings);
  mainWindow.setPosition(settings.position.x, settings.position.y);
  mainWindow.setSize(settings.size.x, settings.size.y);
});

ipcMain.on('open-add-item-window', (event, year, subtick) => {
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
    console.log(input.key);
    if (input.key === "F12") {
      newItemWindow.webContents.openDevTools();
    }
  })
  
  newItemWindow.loadFile('addItem.html', {
    query: {
      year: year,
      subtick: subtick
    }
  });
  
  newItemWindow.setPosition(
    mainWindow.getPosition()[0] + 100, 
    mainWindow.getPosition()[1] + 100
  );
  newItemWindow.show();
});

// Handle get story suggestions request
ipcMain.on('getStorySuggestions', (event) => {
    const suggestions = itemManager.getAllStories();
    event.sender.send('storySuggestions', suggestions);
});

// Handle add timeline item from the add item window
ipcMain.on('addTimelineItem', (event, data) => {
    console.log("Received timeline item:", data);
    
    // If no story-id is provided, generate a new one
    if (!data['story-id']) {
        data['story-id'] = `STORY-${uuidv4()}`;
    }
    
    // Add to item manager
    itemManager.addItem(data);
    
    // Notify main window
    mainWindow.webContents.send('add-timeline-item', data);
});

// Handle add item window closing
ipcMain.on('add-item-window-closing', (event) => {
    console.log("Add item window closing, refreshing items...");
    // Send updated items list to main window
    const items = itemManager.getAllItems();
    mainWindow.webContents.send('items', items);
});

// Add new IPC handlers for item management
ipcMain.on('searchItems', (event, criteria) => {
    const results = itemManager.searchItems(criteria);
    event.sender.send('searchResults', results);
});

ipcMain.on('getItemsByTag', (event, tag) => {
    const results = itemManager.getItemsByTag(tag);
    event.sender.send('tagSearchResults', results);
});

ipcMain.on('getItemsByDate', (event, date) => {
    const results = itemManager.getItemsByDate(date);
    event.sender.send('dateSearchResults', results);
});

ipcMain.on('removeItem', (event, storyId) => {
    const success = itemManager.removeItem(storyId);
    event.sender.send('itemRemoved', { success, storyId });
});

ipcMain.on('getAllItems', (event) => {
    const items = itemManager.getAllItems();
    event.sender.send('items', items);
});

