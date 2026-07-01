const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'color-remover';
const APP_HOST = 'app';

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = false;

let latestUpdateInfo = null;
let updateDownloaded = false;
let updateCheckInFlight = null;
let updateDownloadInFlight = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const getDistPath = () => path.join(app.getAppPath(), 'dist');

const getSafeDistFilePath = (requestUrl) => {
  const distPath = getDistPath();
  const url = new URL(requestUrl);
  const rawPathname = decodeURIComponent(url.pathname);
  const normalizedPathname = rawPathname === '/' || rawPathname === '' ? '/index.html' : rawPathname;
  const requestedPath = path.normalize(path.join(distPath, normalizedPathname));
  const relativePath = path.relative(distPath, requestedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  if (!fs.existsSync(requestedPath) || fs.statSync(requestedPath).isDirectory()) {
    return null;
  }

  return requestedPath;
};

const registerAppProtocol = () => {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = getSafeDistFilePath(request.url);

    if (!filePath) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
};

const isExternalUrl = (targetUrl) => {
  try {
    const parsedUrl = new URL(targetUrl);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#f5f5f5',
    title: 'Color Remover',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();

    if (url !== currentUrl && isExternalUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);
};

const compareVersions = (leftVersion, rightVersion) => {
  const leftParts = String(leftVersion || '0').replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(rightVersion || '0').replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;

    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
};

const sendUpdaterEvent = (payload) => {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('desktop-updater:event', payload);
  });
};

const toUpdatePayload = (updateInfo, overrides = {}) => {
  const currentVersion = app.getVersion();
  const latestVersion = updateInfo?.version || currentVersion;

  return {
    ok: true,
    source: 'release',
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    canUpdate: app.isPackaged,
    downloaded: updateDownloaded,
    releaseDate: updateInfo?.releaseDate || '',
    releaseName: updateInfo?.releaseName || '',
    ...overrides,
  };
};

autoUpdater.on('update-available', (updateInfo) => {
  latestUpdateInfo = updateInfo;
  updateDownloaded = false;
  sendUpdaterEvent(toUpdatePayload(updateInfo, { type: 'available' }));
});

autoUpdater.on('update-not-available', (updateInfo) => {
  latestUpdateInfo = updateInfo;
  updateDownloaded = false;
  sendUpdaterEvent(toUpdatePayload(updateInfo, { type: 'current', updateAvailable: false }));
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdaterEvent({
    ok: true,
    source: 'release',
    type: 'download-progress',
    percent: Math.round(progress.percent || 0),
    transferred: progress.transferred || 0,
    total: progress.total || 0,
  });
});

autoUpdater.on('update-downloaded', (updateInfo) => {
  latestUpdateInfo = updateInfo;
  updateDownloaded = true;
  sendUpdaterEvent(toUpdatePayload(updateInfo, { type: 'downloaded' }));
});

autoUpdater.on('error', (error) => {
  sendUpdaterEvent({
    ok: false,
    source: 'release',
    type: 'error',
    error: error.message || 'Unable to update from the latest release.',
  });
});

const registerUpdateHandlers = () => {
  ipcMain.handle('desktop-updater:check', async () => {
    if (!app.isPackaged) {
      return toUpdatePayload(null, {
        updateAvailable: false,
        canUpdate: false,
        message: 'Release updates are available in the packaged Windows app.',
      });
    }

    if (!updateCheckInFlight) {
      updateCheckInFlight = autoUpdater.checkForUpdates()
        .then((result) => toUpdatePayload(result?.updateInfo || latestUpdateInfo))
        .finally(() => {
          updateCheckInFlight = null;
        });
    }

    return updateCheckInFlight;
  });

  ipcMain.handle('desktop-updater:install', async () => {
    if (!app.isPackaged) {
      return {
        ok: false,
        source: 'release',
        error: 'Release updates are available in the packaged Windows app.',
      };
    }

    if (updateDownloaded) {
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 250);
      return toUpdatePayload(latestUpdateInfo, { type: 'installing' });
    }

    if (!updateDownloadInFlight) {
      updateDownloadInFlight = autoUpdater.downloadUpdate()
        .then(() => {
          setTimeout(() => autoUpdater.quitAndInstall(false, true), 250);
          return toUpdatePayload(latestUpdateInfo, { type: 'installing', downloaded: true });
        })
        .finally(() => {
          updateDownloadInFlight = null;
        });
    }

    return updateDownloadInFlight;
  });
};

app.whenReady().then(() => {
  registerAppProtocol();
  registerUpdateHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
