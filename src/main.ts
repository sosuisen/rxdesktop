/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';
import { app, BrowserWindow, dialog, ipcMain, MouseInputEvent } from 'electron';
import { CardIO } from './modules_main/store';
import { DialogButton } from './modules_common/const';
import { AvatarPropSerializable, CardPropSerializable } from './modules_common/cardprop';
import { availableLanguages, defaultLanguage, MessageLabel } from './modules_common/i18n';
import {
  avatars,
  cards,
  createCard,
  deleteAvatar,
  deleteCardWithRetry,
  setGlobalFocusEventListenerPermission,
  updateAvatar,
} from './modules_main/card';
import { initializeGlobalStore, MESSAGE } from './modules_main/store_settings';
import { destroyTray, initializeTaskTray, setTrayContextMenu } from './modules_main/tray';
import { openSettings, settingsDialog } from './modules_main/settings';
import { loadCurrentWorkspace } from './modules_main/workspace';
import {
  getChangingToWorkspaceId,
  setChangingToWorkspaceId,
  setCurrentWorkspaceId,
} from './modules_main/store_workspaces';
import { emitter, handlers } from './modules_main/event';
import { getIdFromUrl } from './modules_common/avatar_url_utils';

// process.on('unhandledRejection', console.dir);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-line global-require
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Increase max listeners
ipcMain.setMaxListeners(1000);

/**
 * This method will be called when Electron has finished
 * initialization and is ready to create browser windows.
 * Some APIs can only be used after this event occurs.
 */
app.on('ready', async () => {
  // locale can be got after 'ready'
  const myLocale = app.getLocale();
  console.debug(`locale: ${myLocale}`);
  let preferredLanguage: string = defaultLanguage;
  if (availableLanguages.includes(myLocale)) {
    preferredLanguage = myLocale;
  }
  initializeGlobalStore(preferredLanguage as string);

  // for debug
  if (!app.isPackaged && process.env.NODE_ENV === 'development') {
    openSettings();
  }

  // load workspaces
  await CardIO.loadOrCreateWorkspaces().catch(e => console.error(e.message));

  await loadCurrentWorkspace();

  /**
   * Add task tray
   **/
  initializeTaskTray();
});

/**
 * Exit app
 */
emitter.on('exit', () => {
  CardIO.close();
  destroyTray();
  app.quit();
});

emitter.on('change-workspace', (nextWorkspaceId: string) => {
  handlers.forEach(channel => ipcMain.removeHandler(channel));
  handlers.length = 0; // empty
  avatars.clear();
  cards.clear();
  setCurrentWorkspaceId(nextWorkspaceId);
  setTrayContextMenu();
  CardIO.updateWorkspaceStatus();
  loadCurrentWorkspace();
});

app.on('window-all-closed', () => {
  const nextWorkspaceId = getChangingToWorkspaceId();
  if (nextWorkspaceId === 'exit') {
    emitter.emit('exit');
  }
  else if (nextWorkspaceId !== 'none') {
    emitter.emit('change-workspace', nextWorkspaceId);
  }
  setChangingToWorkspaceId('none');
});

/**
 * ipcMain handles
 */

ipcMain.handle('update-avatar', async (event, avatarPropObj: AvatarPropSerializable) => {
  await updateAvatar(avatarPropObj);
});

ipcMain.handle('delete-avatar', async (event, url: string) => {
  await deleteAvatar(url);
});

ipcMain.handle('delete-card', async (event, url: string) => {
  await deleteCardWithRetry(getIdFromUrl(url));
});

ipcMain.handle('finish-render-card', (event, url: string) => {
  const avatar = avatars.get(url);
  if (avatar) {
    avatar.renderingCompleted = true;
  }
});

ipcMain.handle('create-card', async (event, propObject: CardPropSerializable) => {
  const id = await createCard(propObject);
  return id;
});

ipcMain.handle('blur-and-focus-with-suppress-events', (event, url: string) => {
  const avatar = avatars.get(url);
  if (avatar) {
    console.debug(`blurAndFocus: ${url}`);
    /**
     * When a card is blurred, another card will be focused automatically by OS.
     * Set suppressGlobalFocusEvent to suppress to focus another card.
     */
    setGlobalFocusEventListenerPermission(false);
    avatar.suppressBlurEventOnce = true;
    avatar.window.blur();
    avatar.suppressFocusEventOnce = true;
    avatar.recaptureGlobalFocusEventAfterLocalFocusEvent = true;
    avatar.window.focus();
  }
});

ipcMain.handle('blur-and-focus-with-suppress-focus-event', (event, url: string) => {
  const avatar = avatars.get(url);
  if (avatar) {
    console.debug(`blurAndFocus: ${url}`);
    /**
     * When a card is blurred, another card will be focused automatically by OS.
     * Set suppressGlobalFocusEvent to suppress to focus another card.
     */
    setGlobalFocusEventListenerPermission(false);
    avatar.window.blur();
    avatar.recaptureGlobalFocusEventAfterLocalFocusEvent = true;
    avatar.window.focus();
  }
});

ipcMain.handle('blur', (event, url: string) => {
  const avatar = avatars.get(url);
  if (avatar) {
    console.debug(`blur: ${url}`);
    avatar.window.blur();
  }
});

ipcMain.handle('focus', (event, url: string) => {
  const avatar = avatars.get(url);
  if (avatar) {
    console.debug(`focus: ${url}`);
    avatar.window.focus();
  }
});

ipcMain.handle('set-title', (event, url: string, title: string) => {
  const avatar = avatars.get(url);
  if (avatar) {
    avatar.window.setTitle(title);
  }
});

ipcMain.handle('alert-dialog', (event, url: string, label: MessageLabel) => {
  let win: BrowserWindow;
  if (url === 'settingsDialog') {
    win = settingsDialog;
  }
  else {
    const avatar = avatars.get(url);
    if (!avatar) {
      return;
    }
    win = avatar.window;
  }

  dialog.showMessageBoxSync(win, {
    type: 'question',
    buttons: ['OK'],
    message: MESSAGE(label),
  });
});

ipcMain.handle(
  'confirm-dialog',
  (event, url: string, buttonLabels: MessageLabel[], label: MessageLabel) => {
    let win: BrowserWindow;
    if (url === 'settingsDialog') {
      win = settingsDialog;
    }
    else {
      const avatar = avatars.get(url);
      if (!avatar) {
        return;
      }
      win = avatar.window;
    }

    const buttons: string[] = buttonLabels.map(buttonLabel => MESSAGE(buttonLabel));
    return dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: buttons,
      defaultId: DialogButton.Default,
      cancelId: DialogButton.Cancel,
      message: MESSAGE(label),
    });
  }
);

ipcMain.handle('set-window-size', (event, url: string, width: number, height: number) => {
  const avatar = avatars.get(url);
  // eslint-disable-next-line no-unused-expressions
  avatar?.window.setSize(width, height);
  return avatar?.window.getBounds();
});

ipcMain.handle('set-window-position', (event, url: string, x: number, y: number) => {
  const avatar = avatars.get(url);
  // eslint-disable-next-line no-unused-expressions
  avatar?.window.setPosition(x, y);
  return avatar?.window.getBounds();
});

ipcMain.handle('get-uuid', () => {
  return uuidv4();
});

ipcMain.handle('bring-to-front', (event, url: string, rearrange = false) => {
  const avatar = avatars.get(url);
  if (!avatar) {
    return;
  }

  const backToFront = [...avatars.keys()].sort((a, b) => {
    if (avatars.get(a)!.prop.geometry.z < avatars.get(b)!.prop.geometry.z) {
      return -1;
    }
    else if (avatars.get(a)!.prop.geometry.z > avatars.get(b)!.prop.geometry.z) {
      return 1;
    }
    return 0;
  });

  const newZ = avatars.get(backToFront[backToFront.length - 1])!.prop.geometry.z + 1;
  backToFront.splice(backToFront.indexOf(url), 1);
  backToFront.push(url);

  // NOTE: When bring-to-front is invoked by focus event, the card has been already brought to front.
  if (rearrange) {
    for (const key of backToFront) {
      avatars.get(key)!.suppressFocusEventOnce = true;
      avatars.get(key)!.window.focus();
    }
  }

  return newZ;
});

ipcMain.handle('send-to-back', (event, url: string) => {
  const avatar = avatars.get(url);
  if (!avatar) {
    return;
  }

  const backToFront = [...avatars.keys()].sort((a, b) => {
    if (avatars.get(a)!.prop.geometry.z < avatars.get(b)!.prop.geometry.z) {
      return -1;
    }
    else if (avatars.get(a)!.prop.geometry.z > avatars.get(b)!.prop.geometry.z) {
      return 1;
    }
    return 0;
  });

  const newZ = avatars.get(backToFront[0])!.prop.geometry.z - 1;
  backToFront.splice(backToFront.indexOf(url), 1);
  backToFront.unshift(url);

  for (const key of backToFront) {
    avatars.get(key)!.suppressFocusEventOnce = true;
    avatars.get(key)!.window.focus();
  }
  return newZ;
});

ipcMain.handle(
  'send-mouse-input',
  (event, url: string, mouseInputEvent: MouseInputEvent) => {
    const avatar = avatars.get(url);
    if (!avatar) {
      return;
    }
    avatar.window.webContents.sendInputEvent(mouseInputEvent);
  }
);
