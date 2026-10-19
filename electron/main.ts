import { app, BrowserWindow, shell, session } from 'electron';
import path from 'node:path';
import { VaultIpcController } from './ipcHandlers.ts';

// In CommonJS bundle, __dirname is already available
const appDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// Request single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow: BrowserWindow | null = null;
const ipcController = new VaultIpcController();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'FamilyVault',
    backgroundColor: '#0a0d14',
    show: false, // Wait until ready-to-show to prevent flash of white
    webPreferences: {
      preload: path.join(appDir, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  ipcController.setWindow(mainWindow);

  // Set strict Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' file:; " +
          "script-src 'self' file:; " +
          "style-src 'self' file: 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' file: https://fonts.gstatic.com data:; " +
          "img-src 'self' file: data: blob:; " +
          "connect-src 'self' file: data:; " +
          "object-src 'none'; " +
          "base-uri 'self'; " +
          "form-action 'self';"
        ]
      }
    });
  });

  // Block popup windows and open external URLs in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Prevent navigation outside of the local application
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const isLocalApp =
      navigationUrl.startsWith('file://') ||
      navigationUrl.startsWith('http://localhost') ||
      navigationUrl.startsWith('http://127.0.0.1');

    if (!isLocalApp) {
      event.preventDefault();
      if (navigationUrl.startsWith('https:') || navigationUrl.startsWith('http:')) {
        shell.openExternal(navigationUrl);
      }
    }
  });

  // Show window smoothly when ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Load production bundle or local dev server
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    // In production build, dist/index.html is adjacent to dist-electron/
    const indexPath = path.join(appDir, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers before app is ready
ipcController.registerHandlers();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
