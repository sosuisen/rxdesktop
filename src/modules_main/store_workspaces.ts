/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import { scheme } from '../modules_common/const';

let currentWorkspaceId = '0'; // string expression of positive number
let changingToWorkspaceId = 'none'; // changingToWorkspaceId stores next id while workspace is changing, 'none' or 'exit'

export type Workspace = {
  name: string;
  avatars: string[];
};

export const workspaces = new Map<string, Workspace>();

export const getWorkspaceUrl = (workspaceId: string) => {
  return `${scheme}://local/avatar/${workspaceId}/`;
};

export const getCurrentWorkspaceUrl = () => {
  return getWorkspaceUrl(currentWorkspaceId);
};

export const getCurrentWorkspace = () => {
  const workspace = workspaces.get(currentWorkspaceId);
  if (!workspace) {
    throw new Error(
      `Error in getCurrentWorkspace: workspace does not exist: ${currentWorkspaceId}`
    );
  }
  return workspace;
};

export const getCurrentWorkspaceId = () => {
  return currentWorkspaceId;
};
export const setCurrentWorkspaceId = (id: string) => {
  currentWorkspaceId = id;
};

export const addAvatarToWorkspace = (workspaceId: string, avatarUrl: string) => {
  const ws = workspaces.get(workspaceId);
  if (ws) {
    ws.avatars.push(avatarUrl);
  }
};

export const removeAvatarFromWorkspace = (workspaceId: string, avatarUrl: string) => {
  const ws = workspaces.get(workspaceId);
  if (ws) {
    ws.avatars = ws.avatars.filter(_url => _url !== avatarUrl);
  }
};

export const getNextWorkspaceId = () => {
  const idArray = [...workspaces.keys()].map(id => parseInt(id, 0)).sort();
  let lastId = idArray[idArray.length - 1];
  return `${++lastId}`;
};

export const setChangingToWorkspaceId = (workspaceId: string) => {
  changingToWorkspaceId = workspaceId;
};

export const getChangingToWorkspaceId = () => {
  return changingToWorkspaceId;
};
