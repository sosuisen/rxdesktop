/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * ATTENTION: Only types can be import for type checking in iframe.
 */
import { ContentsFrameMessage } from '../modules_common/types';

window.addEventListener('message', (event: MessageEvent) => {
  const msg: ContentsFrameMessage = event.data;
  switch (msg.command) {
    case 'check-initializing':
      // eslint-disable-next-line no-case-declarations
      const res: ContentsFrameMessage = { command: 'contents-frame-initialized', arg: '' };
      window.parent.postMessage(res, '*');
      break;

    default:
      break;
  }
});

window.addEventListener('load', () => {
  /**
   * Remove APIs
   **/
  // eslint-disable-next-line prefer-const
  let disableAPIList = ['open', 'alert', 'confirm', 'prompt', 'print'];
  disableAPIList.forEach(prop => {
    // @ts-ignore
    window[prop] = () => {
      console.error(prop + ' is disabled.');
    };
  });
});
