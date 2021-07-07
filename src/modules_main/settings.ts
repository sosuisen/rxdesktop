/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */
import path from 'path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { subscribeStoreFromSettings } from './store';
import { CardIO } from './io';

// eslint-disable-next-line import/no-mutable-exports
export let settingsDialog: BrowserWindow;

export const closeSettings = () => {
  if (settingsDialog !== undefined && !settingsDialog.isDestroyed()) {
    settingsDialog.close();
  }
};

export const openSettings = () => {
  if (settingsDialog !== undefined && !settingsDialog.isDestroyed()) {
    return;
  }

  settingsDialog = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      sandbox: false,
    },
    width: 800,
    height: 360,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    icon: path.join(__dirname, '../../assets/media_stickies_grad_icon.ico'),
  });

  // hot reload
  if (!app.isPackaged && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('electron-connect').client.create(settingsDialog);
    settingsDialog.webContents.openDevTools();
  }

  settingsDialog.loadURL(path.join(__dirname, '../settings/settings.html'));
  settingsDialog.webContents.on('did-finish-load', () => {
    const unsubscribe = subscribeStoreFromSettings(settingsDialog);
    settingsDialog.on('close', () => {
      unsubscribe();
    });
  });
  settingsDialog.webContents.on('new-window', (e, _url) => {
    e.preventDefault();
    shell.openExternal(_url);
  });
};

// Request from settings dialog
ipcMain.handle('open-directory-selector-dialog', (event, message: string) => {
  return openDirectorySelectorDialog(message);
});

ipcMain.handle('close-cardio', async event => {
  await CardIO.close();
});

ipcMain.handle('export-data-to', async (event, filepath: string) => {
  await CardIO.export(filepath);
});

ipcMain.handle('export-data-to-gitddb', async (event, filepath: string) => {
  await CardIO.exportToGitDDB(filepath);
});

const openDirectorySelectorDialog = (message: string) => {
  const file: string[] | undefined = dialog.showOpenDialogSync(settingsDialog, {
    properties: ['openDirectory'],
    title: message,
    message: message, // macOS only
  });
  return file;
};
