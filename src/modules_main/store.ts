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
  RxCollection,
  RxCollectionCreator,
  RxDatabase,
  RxDocument,
  RxLocalDocument,
} from 'rxdb';
import leveldown from 'leveldown';
import { AvatarPropSerializable, CardProp } from '../modules_common/cardprop';
import { getSettings, MESSAGE } from './store_settings';
import { getIdFromUrl } from '../modules_common/avatar_url_utils';
import { getCurrentDateAndTime } from '../modules_common/utils';
import { Workspace, workspaceSchema } from '../modules_common/schema_workspace';
import { Card, cardSchema } from '../modules_common/schema_card';
import { Avatar, avatarSchema } from '../modules_common/schema_avatar';
import { CartaDate } from '../modules_common/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
addRxPlugin(require('pouchdb-adapter-leveldb'));

let rxdb: RxDatabase;

/**
 * Local Documents
 */
const workspaceLocalDocumentIds = ['currentWorkspace'];
// WorkspaceLocalDocumentIds is union. e.g) 'currentWorkspace' | 'foobar' | ...
// Use it to check type.
// Use below to iterate WorkspaceLocalDocumentIds:
//   for (const id of workspaceLocalDocumentIds) { ... }
type WorkspaceLocalDocumentIds = typeof workspaceLocalDocumentIds[number];

type CurrentWorkspace = {
  id: string;
  version: number;
};

/**
 * RxDB Collections
 */
const WORKSPACE_VERSION = 0;

type CartaCollection = RxCollectionCreator & { sync: boolean };
const collections: CartaCollection[] = [
  {
    name: 'workspace',
    schema: workspaceSchema,
    sync: true,
  },
  {
    name: 'avatar',
    schema: avatarSchema,
    sync: true,
  },
  {
    name: 'card',
    schema: cardSchema,
    sync: true,
  },
];

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
  console.dir(await getWorkspaceLocalDocuments(), { depth: null });
  console.debug('************* Workspaces');
  console.dir(await getWorkspaces(), { depth: null });
  console.debug('************* Avatars');
  console.dir(await getAvatars(), { depth: null });
  console.debug('************* Cards');
  // console.dir(await getCards(), { depth: null });
};

export const openDB = async () => {
  rxdb = await createRxDatabase({
    name: getSettings().persistent.storage.path + '/cartadb',
    adapter: leveldown,
  }).catch(err => {
    console.error(err);
    throw err;
  });

  // Create all collections by one line
  await Promise.all(collections.map(collection => rxdb.collection(collection))).catch(
    err => {
      console.error(err);
      throw err;
    }
  );
};

export const closeDB = () => {
  if (!rxdb) {
    return Promise.resolve();
  }
  return rxdb.destroy();
};

export const prepareDbSync = () => {
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
  const currentWorkspaceRxDoc: RxDocument = await getCurrentWorkspaceRxDoc().catch(err => {
    throw err;
  });
  console.dir(currentWorkspaceRxDoc.toJSON(), { depth: null });

  const avatars: Avatar[] = (((await currentWorkspaceRxDoc.populate(
    'avatars'
  )) as unknown) as RxDocument[]).map(avatarDoc => avatarDoc.toJSON() as Avatar);

  console.dir(avatars, { depth: null });

  const cardIds = avatars.map(avatar => getIdFromUrl(avatar.url));
  // Be unique
  const uniqueCardIds = [...new Set(cardIds)];
  const cards = await getCards(uniqueCardIds).catch(err => {
    throw err;
  });

  //  console.dir(cards, { depth: null });

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

const sortByCartaDate = function (a: any, b: any) {
  if (a.date.createdDate > b.date.createdDate) {
    return 1;
  }
  else if (a.date.createdDate < b.date.createdDate) {
    return -1;
  }
  return 0;
};

const getSelectedCardsRxDoc = async (cardIds: string[]) => {
  const cardDocsMap = (await rxdb.collections.card.findByIds(cardIds)) as Map<
    string,
    RxDocument
  >;
  return [...cardDocsMap.values()];
};

const getCardsRxDoc = async (cardIds?: string[]): Promise<RxDocument[]> => {
  let cards: RxDocument[];
  if (cardIds === undefined) {
    // All cards
    cards = await rxdb.collections.card.find().exec();
  }
  else {
    cards = await getSelectedCardsRxDoc(cardIds);
  }
  return cards.sort(sortByCartaDate);
};

const getCards = async (cardIds?: string[]): Promise<Card[]> => {
  let cards: Card[];
  if (cardIds === undefined) {
    // All cards
    cards = ((await rxdb.collections.card.dump()).docs as unknown) as Card[];
  }
  else {
    cards = (await getSelectedCardsRxDoc(cardIds)).map(cardDoc => cardDoc.toJSON() as Card);
  }
  return cards.sort(sortByCartaDate);
};

const getSelectedAvatarsRxDoc = async (avatarIds: string[]) => {
  const avatarDocsMap = (await rxdb.collections.avatar.findByIds(avatarIds)) as Map<
    string,
    RxDocument
  >;
  return [...avatarDocsMap.values()];
};

const getAvatarsRxDoc = async (avatarIds?: string[]): Promise<RxDocument[]> => {
  let avatars: RxDocument[];
  if (avatarIds === undefined) {
    // All cards
    avatars = await rxdb.collections.avatar.find().exec();
  }
  else {
    avatars = await getSelectedAvatarsRxDoc(avatarIds);
  }
  return avatars.sort(sortByCartaDate);
};

const getAvatars = async (avatarIds?: string[]): Promise<Avatar[]> => {
  let avatars: Avatar[];
  if (avatarIds === undefined) {
    // All cards
    avatars = ((await rxdb.collections.card.dump()).docs as unknown) as Avatar[];
  }
  else {
    avatars = (await getSelectedAvatarsRxDoc(avatarIds)).map(
      avatarDoc => avatarDoc.toJSON() as Avatar
    );
  }
  return avatars.sort(sortByCartaDate);
};

const getSelectedWorkspacesRxDoc = async (workspaceIds: string[]) => {
  // Selected workspaces
  const workspaceDocsMap = (await rxdb.collections.workspace.findByIds(
    workspaceIds
  )) as Map<string, RxDocument>;
  return [...workspaceDocsMap.values()];
};

export const getWorkspacesRxDoc = async (
  workspaceIds?: string[]
): Promise<RxDocument[]> => {
  let workspaces: RxDocument[];
  if (workspaceIds === undefined) {
    // All workspaces
    workspaces = await rxdb.collections.workspace.find().exec();
  }
  else {
    workspaces = await getSelectedWorkspacesRxDoc(workspaceIds);
  }

  return workspaces.sort(sortByCartaDate);
};

export const getWorkspaces = async (workspaceIds?: string[]): Promise<Workspace[]> => {
  let workspaces: Workspace[];
  if (workspaceIds === undefined) {
    // All workspaces
    workspaces = ((await rxdb.collections.workspace.dump()).docs as unknown) as Workspace[];
  }
  else {
    // Selected workspaces
    workspaces = (await getSelectedWorkspacesRxDoc(workspaceIds)).map(
      workspaceDoc => workspaceDoc.toJSON() as Workspace
    );
  }

  return workspaces.sort(sortByCartaDate);
};

const getCurrentWorkspaceId = async (): Promise<string> => {
  const docId: WorkspaceLocalDocumentIds = 'currentWorkspace';

  const currentWorkspaceDoc = (
    await rxdb.collections.workspace.getLocal(docId)
  )?.toJSON() as CurrentWorkspace;
  if (!currentWorkspaceDoc || !currentWorkspaceDoc.id) {
    const workspaces = await getWorkspaces();
    if (workspaces.length === 0) {
      throw new Error('No workspace exist.');
    }
    const currentWorkspaceId = workspaces[0].id;

    const newDoc: CurrentWorkspace = {
      id: currentWorkspaceId,
      version: WORKSPACE_VERSION,
    };
    await rxdb.collections.workspace.insertLocal(docId, newDoc);

    return currentWorkspaceId;
  }

  return currentWorkspaceDoc.id;
};

export const getCurrentWorkspaceRxDoc = async (): Promise<RxDocument> => {
  const currentWorkspaceId = await getCurrentWorkspaceId().catch(err => {
    console.error(err);
    return '';
  });
  console.debug(`Current workspaceId: ${currentWorkspaceId}`);
  const workspace: RxDocument = ((await rxdb.collections.workspace
    .findOne(currentWorkspaceId)
    .exec()) as unknown) as RxDocument;
  if (!workspace) {
    throw new Error('No workspace exist');
  }

  return workspace;
};

export const getCurrentWorkspace = async (): Promise<Workspace> => {
  return (await getCurrentWorkspaceRxDoc()).toJSON() as Workspace;
};

const getWorkspaceLocalDocuments = async () => {
  const documents: { [key: string]: any } = {};
  for (const id of workspaceLocalDocumentIds) {
    // eslint-disable-next-line no-await-in-loop, prettierx/options
    documents[id] = (await rxdb.collections.workspace.getLocal(id))?.toJSON();
  }
  return documents;
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
    await rxdb.collections.workspace.bulkInsert(workspaces);
    // @ts-ignore
    await rxdb.collections.avatar.bulkInsert(avatars);
    // @ts-ignore
    await rxdb.collections.card.bulkInsert(jsonObj['card']['cards']);
  } catch (e) {
    console.debug(e);
  }
  console.debug('Finished');
};
