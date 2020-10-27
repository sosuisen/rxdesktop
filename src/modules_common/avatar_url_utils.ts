/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */
import { scheme } from './const';

export const getLocationFromUrl = (avatarUrl: string): string => {
  /*
  const rex = new RegExp(`^(${scheme}:\\/\\/.+/)[^/]+?$`);
  const result = avatarUrl.match(rex);
  if (result && result.length === 2) {
    return result[1];
  }
  */
  return '';
};

export const getWorkspaceIdFromUrl = (avatarUrl: string): string => {
  const rex = new RegExp(`^${scheme}:\\/\\/[^/]+?\\/.+?\\/ws\\/([^/]+?)\\/`);
  const result = avatarUrl.match(rex);
  if (result && result.length === 2) {
    return result[1];
  }
  return '';
};

export const getIdFromUrl = (avatarUrl: string): string => {
  const paths = avatarUrl.split('/');
  return paths[paths.length - 2];
};
