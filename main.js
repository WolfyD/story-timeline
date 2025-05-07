const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

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

  //TODO: add full screen size

  // data.title = settings.title || "";
  // data.author = settings.author || "";
  // data.description = settings.description || "";
  // data.start = settings.start || 0;
  // data.granularity = settings.granularity || 4;

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 4));
  console.log("Settings saved:", settings);
  event.sender.send('settings-saved', true);

});

ipcMain.on('load-settings', () => {
  const settingsPath = path.join(__dirname, 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  mainWindow.webContents.send("window-resized", mainWindow.getSize());
  mainWindow.webContents.send('call-load-settings', settings);
  mainWindow.setPosition(settings.position.x, settings.position.y);
  mainWindow.setSize(settings.size.x, settings.size.y);
  console.log("Settings loaded!!:", settings);
});

