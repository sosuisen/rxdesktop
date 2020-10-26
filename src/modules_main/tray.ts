/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */
import path from 'path';
import prompt from 'electron-prompt';
import { app, dialog, Menu, MenuItemConstructorOptions, Tray } from 'electron';
import { closeSettings, openSettings, settingsDialog } from './settings';
import { getSettings, MESSAGE } from './store_settings';
import { avatars, createCard } from './card';
import { emitter } from './event';
import {
  CardAvatars,
  CardProp,
  CardPropSerializable,
  DEFAULT_CARD_GEOMETRY,
  TransformableFeature,
} from '../modules_common/cardprop';
import { getRandomInt } from '../modules_common/utils';
import { cardColors, ColorName, darkenHexColor } from '../modules_common/color';
import {
  addAvatarToWorkspace,
  getCurrentWorkspace,
  getCurrentWorkspaceId,
  getCurrentWorkspaceUrl,
  getNextWorkspaceId,
  setChangingToWorkspaceId,
  Workspace,
  workspaces,
} from './store_workspaces';
import { appIcon } from '../modules_common/const';

/**
 * Task tray
 */

// Ensure a reference to Tray object is retained, or it will be GC'ed.
let tray: Tray;
export const destroyTray = () => {
  if (tray !== undefined && !tray.isDestroyed()) {
    tray.destroy();
  }
};

let currentLanguage: string;
let color = { ...cardColors };
delete color.transparent;

const createNewCard = async () => {
  const geometry = { ...DEFAULT_CARD_GEOMETRY };
  geometry.x += getRandomInt(30, 100);
  geometry.y += getRandomInt(30, 100);

  let colorList = Object.entries(color);
  if (colorList.length === 0) {
    color = { ...cardColors };
    delete color.transparent;
    colorList = Object.entries(color);
  }
  const newColor: ColorName = colorList[getRandomInt(0, colorList.length)][0] as ColorName;
  delete color[newColor];

  const bgColor: string = cardColors[newColor];

  const newAvatars: CardAvatars = {};
  newAvatars[getCurrentWorkspaceUrl()] = new TransformableFeature(
    {
      x: geometry.x,
      y: geometry.y,
      z: geometry.z,
      width: geometry.width,
      height: geometry.height,
    },
    {
      uiColor: darkenHexColor(bgColor),
      backgroundColor: bgColor,
      opacity: 1.0,
      zoom: 1.0,
    }
  );

  const id = await createCard(
    CardProp.fromObject(({
      avatars: newAvatars,
    } as unknown) as CardPropSerializable)
  );
  const newAvatar = avatars.get(getCurrentWorkspaceUrl() + id);
  if (newAvatar) {
    newAvatar.window.focus();
  }
};

export const setTrayContextMenu = () => {
  if (!tray) {
    return;
  }
  const changeWorkspaces: MenuItemConstructorOptions[] = [...workspaces.keys()]
    .sort()
    .map(id => {
      return {
        label: `${workspaces.get(id)?.name}`,
        type: 'radio',
        checked: id === getCurrentWorkspaceId(),
        click: () => {
          if (id !== getCurrentWorkspaceId()) {
            const workspace = workspaces.get(id);
            if (!workspace) {
              return;
            }
            closeSettings();
            if (avatars.size === 0) {
              emitter.emit('change-workspace', id);
            }
            else {
              setChangingToWorkspaceId(id);
              try {
                // Remove listeners firstly to avoid focus another card in closing process
                avatars.forEach(avatar => avatar.removeWindowListenersExceptClosedEvent());
                avatars.forEach(avatar => avatar.window.webContents.send('card-close'));
              } catch (e) {
                console.error(e);
              }
              // wait 'window-all-closed' event
            }
          }
        },
      };
    });
  if (changeWorkspaces.length > 0) {
    changeWorkspaces.unshift({
      type: 'separator',
    } as MenuItemConstructorOptions);
  }

  const contextMenu = Menu.buildFromTemplate([
    /*
    {
      label: MESSAGE('newCard'),
      click: () => {
        createNewCard();
      },
    },
    {
      type: 'separator',
    },
    {
      label: MESSAGE('workspaceNew'),
      click: async () => {
        const newId = getNextWorkspaceId();
        const newName: string | void | null = await prompt({
          title: MESSAGE('workspace'),
          label: MESSAGE('workspaceNewName'),
          value: `${MESSAGE('workspaceName', String(workspaces.size + 1))}`,
          inputAttrs: {
            type: 'text',
            required: true,
          },
          height: 200,
        }).catch(e => console.error(e.message));

        if (
          newName === null ||
          newName === undefined ||
          newName === '' ||
          (newName as string).match(/^\s+$/)
        ) {
          return;
        }
        const workspace: Workspace = {
          name: newName as string,
          avatars: [],
        };
        workspaces.set(newId, workspace);
        await CardIO.createWorkspace(newId, workspace).catch((e: Error) =>
          console.error(e.message)
        );
        closeSettings();
        if (avatars.size === 0) {
          emitter.emit('change-workspace', newId);
        }
        else {
          setChangingToWorkspaceId(newId);
          avatars.forEach(avatar => avatar.window.webContents.send('card-close'));
        }
      },
    },
    {
      label: MESSAGE('workspaceRename'),
      click: async () => {
        const newName: string | void | null = await prompt({
          title: MESSAGE('workspace'),
          label: MESSAGE('workspaceNewName'),
          value: getCurrentWorkspace().name,
          inputAttrs: {
            type: 'text',
            required: true,
          },
          height: 200,
        }).catch(e => console.error(e.message));

        if (
          newName === null ||
          newName === undefined ||
          newName === '' ||
          (newName as string).match(/^\s+$/)
        ) {
          return;
        }

        const workspace = getCurrentWorkspace();
        workspace.name = newName as string;
        await CardIO.updateWorkspace(getCurrentWorkspaceId(), workspace).catch((e: Error) =>
          console.error(e.message)
        );
        setTrayContextMenu();
        avatars.forEach(avatar => avatar.resetContextMenu());
      },
    },
    {
      label: MESSAGE('workspaceDelete'),
      enabled: workspaces.size > 1,
      click: async () => {
        if (workspaces.size <= 1) {
          return;
        }
        if (getCurrentWorkspace().avatars.length > 0) {
          dialog.showMessageBox({
            type: 'info',
            buttons: ['OK'],
            message: MESSAGE('workspaceCannotDelete'),
          });
          return;
        }
        workspaces.delete(getCurrentWorkspaceId());
        await CardIO.deleteWorkspace(getCurrentWorkspaceId()).catch((e: Error) =>
          console.error(`Error in workspaceDelete: ${e.message}`)
        );
        setTrayContextMenu();
        emitter.emit('change-workspace', '0');
      },
    },
    ...changeWorkspaces,
    {
      type: 'separator',
    },
    */
    {
      label: MESSAGE('settings'),
      click: () => {
        openSettings();
      },
    },
    {
      label: MESSAGE('exit'),
      click: () => {
        if (settingsDialog && !settingsDialog.isDestroyed()) {
          settingsDialog.close();
        }
        setChangingToWorkspaceId('exit');
        closeSettings();
        if (avatars.size === 0) {
          emitter.emit('exit');
        }
        else {
          try {
            avatars.forEach(avatar => avatar.window.webContents.send('card-close'));
          } catch (e) {
            console.error(e);
          }
        }
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  // const version = process.env.npm_package_version; // It is only available when the app is started by 'npm start'
  let taskTrayToolTip = `${app.getName()}  ${app.getVersion()}`;
  if (!app.isPackaged) {
    taskTrayToolTip += ' (Development)';
  }
  tray.setToolTip(taskTrayToolTip);
};

export const initializeTaskTray = () => {
  tray = new Tray(path.join(__dirname, '../assets/' + appIcon));
  currentLanguage = getSettings().persistent.language;
  setTrayContextMenu();
  /*
  tray.on('click', () => {
    createNewCard();
  });
  */
};

emitter.on('updateTrayContextMenu', () => {
  const newLanguage = getSettings().persistent.language;
  if (currentLanguage !== newLanguage) {
    currentLanguage = newLanguage;
    setTrayContextMenu();
  }
});
