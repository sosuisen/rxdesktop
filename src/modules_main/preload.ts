/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import { contextBridge, ipcRenderer, MouseInputEvent } from 'electron';

contextBridge.exposeInMainWorld('api', {
  /**
   * Command from Renderer process
   */
  alertDialog: (url: string, message: string) => {
    return ipcRenderer.invoke('alert-dialog', url, message);
  },
  blurAndFocusWithSuppressEvents: (url: string) => {
    return ipcRenderer.invoke('blur-and-focus-with-suppress-events', url);
  },
  blurAndFocusWithSuppressFocusEvents: (url: string) => {
    return ipcRenderer.invoke('blur-and-focus-with-suppress-focus-events', url);
  },
  bringToFront: (url: string) => {
    return ipcRenderer.invoke('bring-to-front', url);
  },
  createCard: (subsetOfCardPropSerializable: Record<string, any>) => {
    return ipcRenderer.invoke('create-card', subsetOfCardPropSerializable);
  },
  confirmDialog: (url: string, buttonLabels: string[], message: string) => {
    return ipcRenderer.invoke('confirm-dialog', url, buttonLabels, message);
  },
  deleteAvatar: (url: string) => {
    return ipcRenderer.invoke('delete-avatar', url);
  },
  deleteCard: (url: string) => {
    return ipcRenderer.invoke('delete-card', url);
  },
  finishLoad: (url: string) => {
    return ipcRenderer.invoke('finish-load-' + url);
  },
  finishRenderCard: (url: string) => {
    return ipcRenderer.invoke('finish-render-card', url);
  },
  focus: (url: string) => {
    return ipcRenderer.invoke('focus', url);
  },
  getUuid: () => {
    return ipcRenderer.invoke('get-uuid');
  },
  updateAvatar: (avatarPropSerializable: Record<string, any>) => {
    return ipcRenderer.invoke('update-avatar', avatarPropSerializable);
  },
  sendLeftMouseDown: (url: string, x: number, y: number) => {
    const leftMouseDown: MouseInputEvent = {
      button: 'left',
      type: 'mouseDown',
      x: x,
      y: y,
    };
    return ipcRenderer.invoke('send-mouse-input', url, leftMouseDown);
  },
  sendToBack: (url: string) => {
    return ipcRenderer.invoke('send-to-back', url);
  },
  setWindowSize: (url: string, width: number, height: number) => {
    return ipcRenderer.invoke('set-window-size', url, width, height);
  },
  setWindowPosition: (url: string, x: number, y: number) => {
    return ipcRenderer.invoke('set-window-position', url, x, y);
  },
  setTitle: (url: string, title: string) => {
    return ipcRenderer.invoke('set-title', url, title);
  },
});

/**
 * Command from Main process
 */
ipcRenderer.on('card-blurred', () =>
  window.postMessage({ command: 'card-blurred' }, 'file://')
);
ipcRenderer.on('card-close', () =>
  window.postMessage({ command: 'card-close' }, 'file://')
);
ipcRenderer.on('card-focused', () =>
  window.postMessage({ command: 'card-focused' }, 'file://')
);
ipcRenderer.on(
  'change-card-color',
  (event: Electron.IpcRendererEvent, _backgroundColor: string, _opacity: number) =>
    window.postMessage(
      {
        command: 'change-card-color',
        backgroundColor: _backgroundColor,
        opacity: _opacity,
      },
      'file://'
    )
);

ipcRenderer.on(
  'move-by-hand',
  (event: Electron.IpcRendererEvent, _bounds: Electron.Rectangle) =>
    window.postMessage({ command: 'move-by-hand', bounds: _bounds }, 'file://')
);
ipcRenderer.on(
  'render-card',
  (event: Electron.IpcRendererEvent, _card: any, _avatar: any) =>
    window.postMessage({ command: 'render-card', card: _card, avatar: _avatar }, 'file://')
);
ipcRenderer.on(
  'resize-by-hand',
  (event: Electron.IpcRendererEvent, _bounds: Electron.Rectangle) =>
    window.postMessage({ command: 'resize-by-hand', bounds: _bounds }, 'file://')
);
ipcRenderer.on('send-to-back', () =>
  window.postMessage({ command: 'send-to-back' }, 'file://')
);
ipcRenderer.on('set-lock', (event: Electron.IpcRendererEvent, locked: boolean) => {
  window.postMessage({ command: 'set-lock', locked: locked }, 'file://');
});
ipcRenderer.on('zoom-in', () => window.postMessage({ command: 'zoom-in' }, 'file://'));
ipcRenderer.on('zoom-out', () => window.postMessage({ command: 'zoom-out' }, 'file://'));
