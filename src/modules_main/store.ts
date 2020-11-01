/* eslint-disable dot-notation */
/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla const License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
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
import { CardProp } from '../modules_common/cardprop';
import { getSettings, MESSAGE } from './store_settings';
import { getIdFromUrl } from '../modules_common/avatar_url_utils';
import { getCurrentDateAndTime } from '../modules_common/utils';
import { Workspace, workspaceSchema } from '../modules_common/schema_workspace';
import { Card, cardSchema } from '../modules_common/schema_card';
import { Avatar, avatarSchema } from '../modules_common/schema_avatar';
import { getDocs } from './store_utils';
import { AvatarWindow, createAvatarWindows } from './avatar_window';

// eslint-disable-next-line @typescript-eslint/no-var-requires
addRxPlugin(require('pouchdb-adapter-leveldb'));

let rxdb: RxDatabase;

/**
 * RxDB Collections
 */
const dbName = 'cartadb';
const WORKSPACE_VERSION = 0;

const collectionNames = ['workspace', 'avatar', 'card'] as const;
type CollectionName = typeof collectionNames[number];
interface RxDesktopCollectionCreator extends RxCollectionCreator {
  name: CollectionName;
}
const collections: RxDesktopCollectionCreator[] = [
  {
    name: 'workspace',
    schema: workspaceSchema,
  },
  {
    name: 'avatar',
    schema: avatarSchema,
  },
  {
    name: 'card',
    schema: cardSchema,
  },
];

/**
 * Local Documents
 */
const workspaceLocalDocumentIds = ['currentWorkspace'] as const;
// WorkspaceLocalDocumentIds is union. e.g) 'currentWorkspace' | 'foobar' | ...
// Use it to check type.
// Use below to iterate WorkspaceLocalDocumentIds:
//   for (const id of workspaceLocalDocumentIds) { ... }
type WorkspaceLocalDocumentId = typeof workspaceLocalDocumentIds[number];

type CurrentWorkspace = {
  id: string;
  version: number;
};

type WorkspaceLocalDocument = CurrentWorkspace;

const insertWorkspaceLocalDoc = async (
  id: WorkspaceLocalDocumentId,
  doc: WorkspaceLocalDocument
): Promise<void> => {
  await rxdb.workspace.insertLocal(id, doc);
};

const getWorkspaceLocalDoc = async <T extends WorkspaceLocalDocument>(
  id: WorkspaceLocalDocumentId
): Promise<T | null> => {
  const docRx = await rxdb.workspace.getLocal(id).catch(e => {
    throw new Error(e);
  });
  if (docRx === null) {
    return null;
  }
  return (docRx.toJSON() as unknown) as T;
};

const getAllWorkspaceLocalDocs = async (): Promise<WorkspaceLocalDocument[]> => {
  const documents: WorkspaceLocalDocument[] = [];
  for (const id of workspaceLocalDocumentIds) {
    // eslint-disable-next-line no-await-in-loop, prettierx/options
    documents.push((await rxdb.workspace.getLocal(id))?.toJSON() as unknown as WorkspaceLocalDocument);
  }
  return documents;
};

/**
 * Sync
 */
let syncType = 'coudbDB';
syncType = 'GitHub';
const syncURL = '';

/**
 * Dump RxDB for debug
 */
export const dumpDB = async () => {
  console.debug('************* Workspace Local Documents');
  console.dir(await getAllWorkspaceLocalDocs(), { depth: null });
  console.debug('************* Workspaces');
  console.dir(await getDocs<Workspace>(getCollection('workspace')), { depth: null });
  console.debug('************* Avatars');
  console.dir(await getDocs<Avatar>(getCollection('avatar')), { depth: null });
  console.debug('************* Cards');
  // console.dir(await getDocs<Card>(getCollection('card')), { depth: null });
};

export const openDB = async () => {
  try {
    rxdb = await createRxDatabase({
      name: getSettings().persistent.storage.path + '/' + dbName,
      adapter: leveldown,
    });

    // Create all collections by one line
    await Promise.all(collections.map(collection => rxdb.collection(collection)));
  } catch (e) {
    console.error(e);
    throw e;
  }
};

export const closeDB = () => {
  if (!rxdb) {
    return Promise.resolve();
  }
  return rxdb.destroy();
};

export const prepareDbSync = () => {
  // hooks
  rxdb.workspace.$.subscribe(changeEvent => {
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

const getCollection = (collectionName: CollectionName) => {
  return rxdb[collectionName];
};

// ! Operations for workspace

export const getWorkspaces = async (): Promise<Workspace[]> => {
  return await getDocs<Workspace>(getCollection('workspace'));
};

export const loadCurrentWorkspace = async () => {
  // load cards
  const docOrError: RxDocument | NoWorkspaceIdError = await getCurrentWorkspaceRx().catch(
    e => {
      if (e instanceof NoWorkspaceIdError) {
        return e;
      }
      console.error(e);
      throw new Error(e);
    }
  );
  let currentWorkspaceRx: RxDocument;
  if (docOrError instanceof NoWorkspaceIdError) {
    const newDoc: CurrentWorkspace = {
      id: docOrError.workspaces[0].id,
      version: WORKSPACE_VERSION,
    };
    console.debug('workspaceId does not exist.');
    // eslint-disable-next-line promise/no-nesting
    await insertWorkspaceLocalDoc('currentWorkspace', newDoc).catch(err => {
      throw new Error(err);
    });
    console.debug('Create workspaceId');
    // eslint-disable-next-line promise/no-nesting
    currentWorkspaceRx = await getCurrentWorkspaceRx().catch(err => {
      throw new Error(err);
    });
  }
  else {
    currentWorkspaceRx = docOrError;
  }

  // console.dir(currentWorkspaceRx.toJSON(), { depth: null });

  const avatars: Avatar[] = (((await currentWorkspaceRx.populate(
    'avatars'
  )) as unknown) as RxDocument[]).map(avatarDoc => avatarDoc.toJSON() as Avatar);

  //  console.dir(avatars, { depth: null });

  const cardIds = avatars.map(avatar => getIdFromUrl(avatar.url));
  // Be unique
  const uniqueCardIds = [...new Set(cardIds)];
  const cards = await getDocs<Card>(getCollection('card'), uniqueCardIds).catch(err => {
    throw err;
  });
  const cardMap = new Map<string, Card>();
  uniqueCardIds.forEach(id => {
    const index = cards.findIndex(card => card.id === id);
    if (index >= 0) {
      cardMap.set(id, cards[index]);
    }
  });

  //  console.dir(cards, { depth: null });

  createAvatarWindows(cardMap, avatars);

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

class NoWorkspaceIdError extends Error {
  constructor (public workspaces: Workspace[], e?: string) {
    super(e);
    this.name = 'NoWorkspaceIdError';
  }
}

const getCurrentWorkspaceId = async (): Promise<string> => {
  const currentWorkspaceDoc = await getWorkspaceLocalDoc<CurrentWorkspace>(
    'currentWorkspace'
  ).catch(e => {
    throw new Error(e);
  });
  if (currentWorkspaceDoc === null || !currentWorkspaceDoc.id) {
    const workspaces = await getDocs<Workspace>(getCollection('workspace'));
    if (workspaces.length === 0) {
      throw new Error('No workspace exists.');
    }
    else {
      throw new NoWorkspaceIdError(workspaces, 'No workspaceId exists.');
    }
  }
  return currentWorkspaceDoc.id;
};

export const getCurrentWorkspaceRx = async (): Promise<RxDocument> => {
  const currentWorkspaceId = await getCurrentWorkspaceId().catch(e => {
    throw e;
  });
  console.debug(`Current workspaceId: ${currentWorkspaceId}`);
  const workspaceRx: RxDocument = ((await rxdb.workspace
    .findOne(currentWorkspaceId)
    .exec()) as unknown) as RxDocument;
  if (!workspaceRx) {
    throw new Error('No workspace exist');
  }

  return workspaceRx;
};

export const getCurrentWorkspace = async (): Promise<Workspace> => {
  return (
    await getCurrentWorkspaceRx().catch(e => {
      throw e;
    })
  ).toJSON() as Workspace;
};

const createWorkspace = async (name?: string): Promise<Workspace> => {
  if (!name) {
    const workspaces = getDocs<Workspace>(getCollection('workspace'));
    name = MESSAGE('workspaceName', ((await workspaces).length + 1).toString());
  }
  const newID = 'w' + nanoid();
  const current = getCurrentDateAndTime();
  const newDoc: RxDocument = ((await rxdb.workspace.insert({
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

export const updateWorkspace = async (workspaceId: string, workspace: Workspace) => {
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

export const deleteWorkspace = async (workspaceId: string) => {
  /*
  const workspace = await workspaceDB.get(workspaceId);
  await workspaceDB.remove(workspace).catch(e => {
    throw new Error(`Error in deleteWorkspace: ${e}`);
  });
  */
};

export const updateWorkspaceStatus = async () => {
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

// ! Operations for avatars

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

export const addAvatarUrl = async (workspaceId: string, avatarUrl: string) => {
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

export const deleteAvatarUrl = async (workspaceId: string, avatarUrl: string) => {
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

const getCardIdList = (): Promise<string[]> => {
  // returns all card ids.

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

export const deleteCardData = (id: string): Promise<string> => {
  // for debug
  // await sleep(60000);

  return Promise.resolve('');
  /*
  const card = await cardDB.get(id);
  await cardDB.remove(card).catch(e => {
    throw new Error(`Error in deleteCardData: ${e}`);
  });
  return id;
  */
};

export const getCardProp = (id: string): Promise<CardProp> => {
  // for debug
  // await sleep(60000);

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

          const { createdDate, modifiedDate } = (doc as unknown) as CartaDate;
          const date: CartaDate = { createdDate, modifiedDate };

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

export const updateOrCreateCardData = (prop: CardProp): Promise<string> => {
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
      throw new Error(`Error in updateOrCreateCartaDate: ${e.message}`);
    });
    */
};

export const exportJSON = (filepath: string) => {
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
  console.debug('Start import JSON from ' + filepath);
  const jsonObj = JSON.parse(readFileSync(filepath).toLocaleString());

  const workspaces = (jsonObj['workspace']['spaces'] as { [key: string]: any }[]).map(
    workspace => {
      const newWorkspace = JSON.parse(JSON.stringify(workspace));
      newWorkspace.avatars = (workspace.avatars as { [key: string]: any }[]).map(
        avatar => avatar.url
      );
      return newWorkspace;
    }
  );
  // console.dir(workspaces, { depth: null });

  const avatars: { [key: string]: any } = [];
  (jsonObj['workspace']['spaces'] as { [key: string]: any }[]).forEach(workspace => {
    avatars.push(...workspace.avatars);
  });
  // console.dir(avatars);

  try {
    // @ts-ignore
    await rxdb.workspace.bulkInsert(workspaces);
    // @ts-ignore
    await rxdb.avatar.bulkInsert(avatars);
    // @ts-ignore
    await rxdb.card.bulkInsert(jsonObj['card']['cards']);
  } catch (e) {
    console.debug(e);
  }
  console.debug('Finished');
};
