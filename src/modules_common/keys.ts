/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

let shiftDown = false;
let ctrlDown = false;
let altDown = false;
let metaDown = false;

export const setShiftDown = (flag: boolean) => {
  shiftDown = flag;
};
export const setCtrlDown = (flag: boolean) => {
  ctrlDown = flag;
};
export const setAltDown = (flag: boolean) => {
  altDown = flag;
};
export const setMetaDown = (flag: boolean) => {
  metaDown = flag;
};

export const getShiftDown = () => shiftDown;
export const getCtrlDown = () => ctrlDown;
export const getAltDown = () => altDown;
export const getMetaDown = () => metaDown;
