/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

import { getCurrentWorkspace, getCurrentWorkspaceId } from './store_workspaces';
import { Avatar, avatars, Card, cards, getAvatarProp, getCardData } from './card';
import { CardIO } from './store';
import { AvatarProp } from '../modules_common/cardprop';
import { getIdFromUrl } from '../modules_common/avatar_url_utils';

export const loadCurrentWorkspace = async () => {
  // load cards
  let avatarIdArray: string[] = getCurrentWorkspace().avatars;

  if (avatarIdArray.length === 0) {
    const card = new Card('New');
    await card.loadOrCreateCardData().catch(e => {
      throw e;
    });
    const avatarLocs = Object.keys(card.prop.avatars);
    // eslint-disable-next-line require-atomic-updates
    avatarIdArray = [];
    avatarLocs.forEach(loc => {
      const _url = loc + card.prop.id;
      avatarIdArray.push(_url);
      getCurrentWorkspace()!.avatars.push(_url);
      CardIO.addAvatarUrl(getCurrentWorkspaceId(), _url);
    });

    cards.set(card.prop.id, card);
    await CardIO.updateOrCreateCardData(card.prop).catch((e: Error) => {
      console.error(e.message);
    });
  }
  else {
    const cardIdArray = avatarIdArray.map(avatarUrl => getIdFromUrl(avatarUrl));
    // Be unique
    const uniqueCardIdArray = [...new Set(cardIdArray)];
    const loadCard = async (card: Card) => {
      await card.loadOrCreateCardData().catch((e: Error) => {
        console.error(e.message);
      });
      cards.set(card.prop.id, card);
    };
    const loaders = uniqueCardIdArray.map(id => loadCard(new Card('Load', id)));
    await Promise.all(loaders).catch(e => {
      console.error(`Error while loading cards in ready event: ${e.message}`);
    });
  }

  /**
   * TODO: カードをRxJS か Observable-hooks + Redux で保存
   */
  const setAvatarEntry = (avatar: Avatar) => avatars.set(avatar.prop.url, avatar);
  avatarIdArray.forEach(avatarUrl =>
    setAvatarEntry(
      new Avatar(
        new AvatarProp(avatarUrl, getCardData(avatarUrl), getAvatarProp(avatarUrl))
      )
    )
  );

  const renderers = [...avatars.values()].map(avatar => avatar.render());

  await Promise.all(renderers).catch(e => {
    console.error(`Error while rendering cards in ready event: ${e.message}`);
  });

  const backToFront = [...avatars.keys()].sort((a, b) => {
    if (avatars.get(a)!.prop.geometry.z < avatars.get(b)!.prop.geometry.z) {
      return -1;
    }
    else if (avatars.get(a)!.prop.geometry.z > avatars.get(b)!.prop.geometry.z) {
      return 1;
    }
    return 0;
  });

  for (const key of backToFront) {
    const avatar = avatars.get(key);
    if (avatar) {
      if (!avatar.window.isDestroyed()) {
        avatar.window.moveTop();
      }
    }
  }
  console.debug(`Completed to load ${renderers.length} cards`);
};
