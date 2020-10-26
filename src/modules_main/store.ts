/* eslint-disable dot-notation */
/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla const License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Common part
 */
import { readFileSync } from 'fs';
import { nanoid } from 'nanoid';
import {
  addRxPlugin,
  createRxDatabase,
  RxCollectionCreator,
  RxDatabase,
  RxDocument,
} from 'rxdb';
import leveldown from 'leveldown';
import { AvatarPropSerializable, CardProp } from '../modules_common/cardprop';
import { getSettings, MESSAGE } from './store_settings';
import { getIdFromUrl } from '../modules_common/avatar_url_utils';
import { getCurrentDateAndTime } from '../modules_common/utils';
import { Workspace, workspaceSchema } from '../modules_common/schema_workspace';
import { Card, cardSchema } from '../modules_common/schema_card';
import { appStateSchema } from '../modules_common/schema_appstate';
/**
 * Module specific part
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
addRxPlugin(require('pouchdb-adapter-leveldb'));

const APP_STATE_VERSION = 0;
const WORKSPACE_VERSION = 0;

let syncType = 'coudbDB';
syncType = 'GitHub';

type CartaCollection = RxCollectionCreator & { sync: boolean };

let rxdb: RxDatabase;
const syncURL = '';
let dbIsOpened = false;

const openDB = async () => {
  if (dbIsOpened) {
    return;
  }
  dbIsOpened = true;

  const collections: CartaCollection[] = [
    {
      name: 'workspace',
      schema: workspaceSchema,
      sync: true,
    },
    {
      name: 'card',
      schema: cardSchema,
      sync: true,
    },
    {
      name: 'appstate',
      schema: appStateSchema,
      sync: false,
    },
  ];

  rxdb = await createRxDatabase({
    name: getSettings().persistent.storage.path + '/cartadb',
    adapter: leveldown,
  }).catch(err => {
    console.error(err);
    dbIsOpened = false;
    throw err;
  });

  // Create all collections by one line
  await Promise.all(collections.map(collection => rxdb.collection(collection))).catch(
    err => {
      console.error(err);
      dbIsOpened = false;
      throw err;
    }
  );

  // hooks
  rxdb.collections.workspace.$.subscribe(changeEvent => {
    /*
    // insert, update, delete
    if (changeEvent.operation === 'INSERT') {
      const payload = changeEvent.documentData;
      mainWindow.webContents.send('persistent-store-updated', payload);
    }
    else if (changeEvent.operation === 'DELETE') {
      mainWindow.webContents.send(
        'persistent-store-deleted',
        changeEvent.documentData.id
      );
    }
  */
  });

  if (syncType === 'couchDB') {
    // sync
    console.log('DatabaseService: sync');
    // Set sync() to all collections by one line
    collections
      .filter(col => col.sync)
      .map(col => col.name)
      .map(colName => {
        const remoteURL = syncURL + colName + '/';
        console.debug(remoteURL);
        const state = rxdb[colName].sync({
          remote: remoteURL,
        });
        state.change$.subscribe(change => console.dir(change, 3));
        state.docs$.subscribe(docData => console.dir(docData, 3));
        state.active$.subscribe(active => console.debug(`[${colName}] active: ${active}`));
        state.alive$.subscribe(alive => console.debug(`[${colName}] alive: ${alive}`));
        state.error$.subscribe(error => console.dir(error));
      });
  }
  else if (syncType === 'GitHub') {
  }
};

export const closeDB = () => {
  if (!rxdb) {
    return Promise.resolve();
  }
  return rxdb.destroy();
};

const addNewAvatar = () => {
  /*
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
    */
};

export const loadCurrentWorkspace = async () => {
  // load cards
  const currentWorkspace = await getCurrentWorkspace().catch(err => {
    throw err;
  });

  const avatars: AvatarPropSerializable[] = currentWorkspace.avatars;

  const cardIds = avatars.map(avatar => getIdFromUrl(avatar.url));
  // Be unique
  const uniqueCardIds = [...new Set(cardIds)];
  const cards = getCards(uniqueCardIds);

  // TODO: Render avatars
  /*
  const renderers = [...avatars.values()].map(avatar => avatar.render());
  await Promise.all(renderers).catch(e => {
    console.error(`Error while rendering cards in ready event: ${e.message}`);
  });
  */
  // TODO: Arrange avatars
  /*
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
  */
  console.debug(`Completed to load ${avatars.length} cards`);

  if (avatars.length === 0) {
    addNewAvatar();
    console.debug(`Added initial card`);
  }
};

const createWorkspace = async (name?: string): Promise<Workspace> => {
  if (!name) {
    const workspaces = getWorkspaces();
    name = MESSAGE('workspaceName', ((await workspaces).length + 1).toString());
  }
  const newID = 'w' + nanoid();
  const current = getCurrentDateAndTime();
  const newDoc: RxDocument = ((await rxdb.collections.workspace.insert({
    id: newID,
    name: name,
    date: {
      createdDate: current,
      modifiedDate: current,
    },
    version: WORKSPACE_VERSION,
    avatars: [],
  })) as unknown) as RxDocument;
  return newDoc.toJSON() as Workspace;
};

const getCards = async (cardIds: string[]): Promise<Card[]> => {
  const cardDocsMap = (await rxdb.collections.card.findByIds(cardIds)) as Map<
    string,
    RxDocument
  >;
  return [...cardDocsMap.values()].map(cardDoc => cardDoc.toJSON() as Card);
};

const getWorkspaces = async (): Promise<Workspace[]> => {
  return ((await rxdb.collections.workspace.dump()).docs as unknown) as Workspace[];
};

const getCurrentWorkspace = async (): Promise<Workspace> => {
  const currentWorkspaceId = await getCurrentWorkspaceId().catch(err => {
    console.error(err);
    return '';
  });
  const workspace: RxDocument = ((await rxdb.collections.workspace
    .findOne(currentWorkspaceId)
    .exec()) as unknown) as RxDocument;
  if (!workspace) {
    throw new Error('No workspace exist');
  }

  return workspace.toJSON() as Workspace;
};

const getCurrentWorkspaceId = async (): Promise<string> => {
  let currentWorkspaceId = await rxdb.collections.appstate
    .findOne('currentWorkspaceId')
    .exec();
  if (currentWorkspaceId === null) {
    const workspaces = await getWorkspaces();
    if (workspaces.length === 0) {
      throw new Error('No workspace exist.');
    }
    currentWorkspaceId = workspaces[0].id;

    await rxdb.collections.appstate.insert({
      key: 'currentWorkspaceId',
      value: currentWorkspaceId,
      version: APP_STATE_VERSION,
    });
  }
  return currentWorkspaceId;
};

const updateWorkspace = async (workspaceId: string, workspace: Workspace) => {
  await openDB().catch(err => {
    throw err;
  });
  /*
  const wsObj: { _id: string; _rev: string } & Workspace = {
    _id: workspaceId,
    _rev: '',
    ...workspace,
  };
  await workspaceDB
    .get(workspaceId)
    .then(oldWS => {
      // Update existing card
      wsObj._rev = oldWS._rev;
    })
    .catch(e => {
      throw new Error(`Error in updateWorkspace: ${e.message}`);
    });

  return workspaceDB
    .put(wsObj)
    .then(res => {
      console.debug(`Workspace saved: ${res.id}`);
    })
    .catch(e => {
      throw new Error(`Error in updateWorkspace: ${e.message}`);
    });
  */
};

const deleteWorkspace = async (workspaceId: string) => {
  await openDB().catch(err => {
    throw err;
  });
  /*
  const workspace = await workspaceDB.get(workspaceId);
  await workspaceDB.remove(workspace).catch(e => {
    throw new Error(`Error in deleteWorkspace: ${e}`);
  });
  */
};

const updateWorkspaceStatus = async () => {
  await openDB().catch(err => {
    throw err;
  });
  /*
  const currentId = await workspaceDB.get('currentId').catch(() => undefined);
  let currentIdRev = '';
  if (currentId) {
    currentIdRev = currentId._rev;
  }
  workspaceDB.put({
    _id: 'currentId',
    _rev: currentIdRev,
    currentId: getCurrentWorkspaceId(),
  });
*/
};

const addAvatarUrl = async (workspaceId: string, avatarUrl: string) => {
  await openDB().catch(err => {
    throw err;
  });
  /*
  const wsObj: { _id: string; _rev: string } & Workspace = {
    _id: workspaceId,
    _rev: '',
    name: '',
    avatars: [avatarUrl],
  };
  await workspaceDB
    .get(workspaceId)
    .then(oldWS => {
      // Update existing card
      const { name, avatars } = (oldWS as unknown) as Workspace;
      wsObj._rev = oldWS._rev;
      wsObj.name = name;
      wsObj.avatars.push(...avatars);
    })
    .catch(e => {
      throw new Error(`Error in addAvatarUrl: ${e}`);
    });

  return workspaceDB
    .put(wsObj)
    .then(res => {
      console.debug(`Workspace saved: ${res.id}`);
    })
    .catch(e => {
      throw new Error(`Error in addAvatarUrl: ${e}`);
    });
    */
};

const deleteAvatarUrl = async (workspaceId: string, avatarUrl: string) => {
  await openDB().catch(err => {
    throw err;
  });
  /*
  const wsObj: { _id: string; _rev: string } & Workspace = {
    _id: workspaceId,
    _rev: '',
    name: '',
    avatars: [],
  };
  const oldWS = await workspaceDB.get(workspaceId).catch(e => {
    throw new Error(`Error in deleteAvatarUrl get: ${e}`);
  });

  // Update existing card
  const { name, avatars } = (oldWS as unknown) as Workspace;
  wsObj._rev = oldWS._rev;
  wsObj.name = name;
  wsObj.avatars = avatars.filter(url => url !== avatarUrl);

  await workspaceDB.put(wsObj).catch(e => {
    throw new Error(`Error in deleteAvatarUrl put: ${e}`);
  });

  console.debug(`Delete avatar: ${avatarUrl}`);
*/
};

const getCardIdList = async (): Promise<string[]> => {
  // returns all card ids.
  await openDB().catch(err => {
    throw err;
  });
  return Promise.resolve([]);
  /*
  return new Promise((resolve, reject) => {
    cardDB
      .allDocs()
      .then(res => {
        resolve(res.rows.map(row => row.id));
      })
      .catch(err => {
        reject(err);
      });
  });
  */
};

const deleteCardData = async (id: string): Promise<string> => {
  // for debug
  // await sleep(60000);
  await openDB().catch(err => {
    throw err;
  });
  return Promise.resolve('');
  /*
  const card = await cardDB.get(id);
  await cardDB.remove(card).catch(e => {
    throw new Error(`Error in deleteCardData: ${e}`);
  });
  return id;
  */
};

const getCardData = async (id: string): Promise<CardProp> => {
  // for debug
  // await sleep(60000);
  await openDB().catch(err => {
    throw err;
  });
  return Promise.resolve(new CardProp());
  /*
  return new Promise((resolve, reject) => {
    cardDB
      .get(id)
      .then(doc => {
        const propsRequired: CardPropSerializable = new CardProp('').toObject();
        // Check versions and compatibility
        let isFirstVersion = false;
        if (!Object.prototype.hasOwnProperty.call(doc, 'version')) {
          isFirstVersion = true;
        }

        if (isFirstVersion) {
          // The first version has no version property.
          propsRequired.version = '1.0';

          const { x, y, z, width, height } = (doc as unknown) as Geometry;
          const geometry: Geometry = { x, y, z, width, height };

          const {
            uiColor,
            backgroundColor,
            opacity,
            zoom,
          } = (doc as unknown) as CardStyle;
          const style: CardStyle = { uiColor, backgroundColor, opacity, zoom };

          const condition: CardCondition = {
            locked: false,
          };

          const { createdDate, modifiedDate } = (doc as unknown) as CardDate;
          const date: CardDate = { createdDate, modifiedDate };

          propsRequired.avatars[getCurrentWorkspaceUrl()] = new TransformableFeature(
            geometry,
            style,
            condition,
            date
          );
        }

        // Checking properties retrieved from database
        for (const key in propsRequired) {
          if (key === 'id') {
            // skip
            // pouchDB does not have id but has _id.
          }
          // Don't use doc.hasOwnProperty(key)
          // See eslint no-prototype-builtins
          else if (!Object.prototype.hasOwnProperty.call(doc, key)) {
            console.warn(`db entry id "${id}" lacks "${key}"`);
          }
          else {
            // Type of doc cannot be resolved by @types/pouchdb-core
            // @ts-ignore
            propsRequired[key] = doc[key];
          }
        }

        const prop = new CardProp(id);
        prop.data = propsRequired.data;
        prop.avatars = propsRequired.avatars;
        console.dir(prop.avatars);
        if (isFirstVersion) {
          this.updateOrCreateCardData(prop);
        }

        resolve(prop);
      })
      .catch(e => {
        reject(e);
      });
  });
*/
};

const updateOrCreateCardData = async (prop: CardProp): Promise<string> => {
  await openDB().catch(err => {
    throw err;
  });
  return Promise.resolve('');
  /*
  console.debug('Saving card...: ' + JSON.stringify(prop.toObject()));
  // In PouchDB, _id must be used instead of id in document.
  // Convert class to Object to serialize.
  const propObj = Object.assign({ _id: prop.id, _rev: '' }, prop.toObject());
  delete propObj.id;

  // for debug
  // await sleep(60000);

  await cardDB
    .get(prop.id)
    .then(oldCard => {
      // Update existing card
      propObj._rev = oldCard._rev;
    })
    .catch(() => {
      // Create new card
    });

  return cardDB
    .put(propObj)
    .then(res => {
      console.debug(`Saved: ${res.id}`);
      return res.id;
    })
    .catch(e => {
      throw new Error(`Error in updateOrCreateCardDate: ${e.message}`);
    });
    */
};

export const exportJSON = async (filepath: string) => {
  await openDB().catch(err => {
    throw err;
  });
  /*
  const cardIdMap: Record<string, string> = {};
  const cardObj = (await cardDB.allDocs({ include_docs: true })).rows.reduce(
    (obj, row) => {
      const newID = 'c' + nanoid();
      cardIdMap[row.id] = newID;
      obj[newID] = row.doc;
      delete obj[newID]._id;
      delete obj[newID]._rev;
      return obj;
    },
    {} as { [id: string]: any }
  );

  const workspaceObj: Record<string, any> = {};
  workspaceObj.version = 0;
  workspaceObj.spaces = (await workspaceDB.allDocs({ include_docs: true })).rows
    .filter(row => row.id !== 'currentId')
    .map(row => {
      const doc = (row.doc as unknown) as Record<
        string,
        string | string[] | number | Record<string, string>
      >;
      const newID = 'w' + nanoid();
      doc.id = newID;
      delete doc._id;
      delete doc._rev;

      const current = getCurrentDateAndTime();
      doc.date = {
        createdDate: current,
        modifiedDate: current,
      };
      doc.version = 0;

      if (row.doc) {
        const avatars = doc.avatars as string[];
        if (avatars) {
          const newAvatarArray = avatars.map(url => {
            const cardId = cardIdMap[getIdFromUrl(url)];

            const oldLocation = getLocationFromUrl(url);
            const newURL = `rxdesktop://local/ws/${newID}/${cardId}/${nanoid(5)}`;

            // @ts-ignore
            const newAvatar = cardObj[cardId].avatars[oldLocation];
            newAvatar.url = newURL;
            return newAvatar;
          });
          doc.avatars = newAvatarArray;
        }
      }
      return doc;
    });

  for (const id in cardObj) {
    cardObj[id].user = 'local';
    cardObj[id].version = 0;
    const current = getCurrentDateAndTime();
    cardObj[id].date = {
      createdDate: current,
      modifiedDate: current,
    };
    for (const url in cardObj[id].avatars) {
      cardObj[id].date = cardObj[id].avatars[url].date;
    }
    cardObj[id].type = 'text/html';
    delete cardObj[id].avatars;
  }

  const newCardObj: Record<string, any> = {};
  newCardObj.version = 0;

  const cardArray = [];
  for (const id in cardObj) {
    cardObj[id].id = id;
    cardArray.push(cardObj[id]);
  }
  newCardObj.cards = cardArray;

  const dataObj = {
    workspace: workspaceObj,
    card: newCardObj,
  };
  fs.writeJSON(filepath, dataObj, { spaces: 2 });
 */
};

export const importJSON = async (filepath: string) => {
  await openDB().catch(err => {
    throw err;
  });
  const jsonObj = JSON.parse(readFileSync(filepath).toLocaleString());
  try {
    // @ts-ignore
    rxdb.collections.workspace.bulkInsert(jsonObj['workspace']['spaces']);
    // @ts-ignore
    rxdb.collections.card.bulkInsert(jsonObj['card']['cards']);
  } catch (e) {
    console.debug(e);
  }
};
