/**
 * @license Reactive Desktop
 * Copyright (c) Hidekazu Kubota
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Common part
 */
import { nanoid } from 'nanoid';
import fs from 'fs-extra';
import {
  addRxPlugin,
  createRxDatabase,
  RxCollectionCreator,
  RxDatabase,
  RxDocument,
} from 'rxdb';
import leveldown from 'leveldown';
import {
  CardAvatars,
  CardCondition,
  CardDate,
  CardProp,
  CardPropSerializable,
  CardStyle,
  Geometry,
  TransformableFeature,
} from '../modules_common/cardprop';
import { ICardIO } from '../modules_common/types';
import { getSettings, MESSAGE } from './store_settings';
import {
  getCurrentWorkspaceId,
  getCurrentWorkspaceUrl,
  setCurrentWorkspaceId,
  Workspace,
  workspaces,
} from './store_workspaces';
import {
  getIdFromUrl,
  getLocationFromUrl,
  getWorkspaceIdFromUrl,
} from '../modules_common/avatar_url_utils';
import { getCurrentDateAndTime } from '../modules_common/utils';
import { workspaceSchema } from '../modules_common/schema_workspace';
import { cardSchema } from '../modules_common/schema_card';

/**
 * Module specific part
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
addRxPlugin(require('pouchdb-adapter-leveldb'));

let syncType = 'coudbDB';
syncType = 'GitHub';

type CartaCollection = RxCollectionCreator & { sync: boolean };

class CardIOClass implements ICardIO {
  // @ts-ignore
  rxdb: RxDatabase;
  syncURL = '';

  private _openDB = async () => {
    if (this.rxdb) {
      return;
    }

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
    ];

    this.rxdb = await createRxDatabase({
      name: getSettings().persistent.storage.path + '/cartadb',
      adapter: leveldown,
    });

    // Create all collections by one line
    await Promise.all(collections.map(collection => this.rxdb.collection(collection)));

    // hooks
    this.rxdb.collections.workspace.$.subscribe(changeEvent => {
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
          const remoteURL = this.syncURL + colName + '/';
          console.debug(remoteURL);
          const state = this.rxdb[colName].sync({
            remote: remoteURL,
          });
          state.change$.subscribe(change => console.dir(change, 3));
          state.docs$.subscribe(docData => console.dir(docData, 3));
          state.active$.subscribe(active =>
            console.debug(`[${colName}] active: ${active}`)
          );
          state.alive$.subscribe(alive => console.debug(`[${colName}] alive: ${alive}`));
          state.error$.subscribe(error => console.dir(error));
        });
    }
    else if (syncType === 'GitHub') {
    }
  };

  public close = () => {
    if (!this.rxdb) {
      return Promise.resolve();
    }
    return this.rxdb.destroy();
  };

  public loadOrCreateWorkspaces = async () => {
    await this._openDB();

    /*
    (await workspaceDB.allDocs({ include_docs: true })).rows.forEach(row => {
      if (row.id === 'currentId') {
        const { currentId } = (row.doc as unknown) as { currentId: string };
        setCurrentWorkspaceId(currentId);
      }
      else {
        const { name, avatars } = (row.doc as unknown) as Workspace;
        const workspace: Workspace = { name, avatars };
        workspaces.set(row.id, workspace);
      }
    });
    if (workspaces.size === 0) {
      // Initialize or rebuild workspaces if workspaceDB folder does not exist.
      const cardDocs = await cardDB.allDocs({ include_docs: true }).catch(() => undefined);
      if (cardDocs && cardDocs.rows.length > 0) {
        let lastWorkspaceId = '0';
        // Rebuild workspaces
        cardDocs.rows.forEach(row => {
          const doc = row.doc;
          if (!Object.prototype.hasOwnProperty.call(doc, 'version')) {
            // Old version
            const workspaceId = getCurrentWorkspaceId();
            if (workspaces.has(workspaceId)) {
              workspaces
                .get(workspaceId)!
                .avatars.push('reactivedt://local/avatar/0/' + doc!._id);
            }
            else {
              workspaces.set(workspaceId, {
                name: MESSAGE('workspaceName', `${parseInt(workspaceId, 10) + 1}`),
                avatars: ['reactivedt://local/avatar/0/' + doc!._id],
              });
            }
          }
          else {
            // Parse avatars and register it to its workspace.
            const { avatars } = (doc as unknown) as { avatars: CardAvatars };
            Object.keys(avatars).forEach(avatarLocation => {
              const workspaceId = getWorkspaceIdFromUrl(avatarLocation);
              if (parseInt(workspaceId, 10) > parseInt(lastWorkspaceId, 10)) {
                lastWorkspaceId = workspaceId;
              }
              if (workspaces.has(workspaceId)) {
                workspaces.get(workspaceId)!.avatars!.push(avatarLocation + doc!._id);
              }
              else {
                workspaces.set(workspaceId, {
                  name: MESSAGE('workspaceName', `${parseInt(workspaceId, 10) + 1}`),
                  avatars: [avatarLocation + doc!._id],
                });
              }
            });
          }
        });
      }
      else {
        // Create initial workspace
        const workspaceId = getCurrentWorkspaceId();
        workspaces.set(workspaceId, {
          name: MESSAGE('workspaceName', `${parseInt(workspaceId, 10) + 1}`),
          avatars: [],
        });
      }

      workspaces.forEach((workspace, workspaceId) =>
        this.createWorkspace(workspaceId, workspace)
      );
      this.updateWorkspaceStatus();
    }
    */
  };

  public createWorkspace = (workspaceId: string, workspace: Workspace) => {
    // Save new workspace
    const wsObj = {
      _id: workspaceId,
      _rev: '',
      ...workspace,
    };
    return Promise.resolve();
    /*
    await workspaceDB
      .put(wsObj)
      .then(res => {
        console.debug(`Workspace saved: ${res.id}`);
        return res.id;
      })
      .catch(e => {
        throw new Error(`Error in createWorkspace()): ${e.message}`);
      });
      */
  };

  public updateWorkspace = async (workspaceId: string, workspace: Workspace) => {
    await this._openDB();
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

  public deleteWorkspace = async (workspaceId: string) => {
    await this._openDB();
    /*
    const workspace = await workspaceDB.get(workspaceId);
    await workspaceDB.remove(workspace).catch(e => {
      throw new Error(`Error in deleteWorkspace: ${e}`);
    });
    */
  };

  public updateWorkspaceStatus = async () => {
    await this._openDB();
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

  public addAvatarUrl = async (workspaceId: string, avatarUrl: string) => {
    await this._openDB();
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

  public deleteAvatarUrl = async (workspaceId: string, avatarUrl: string) => {
    await this._openDB();
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

  public getCardIdList = async (): Promise<string[]> => {
    // returns all card ids.
    await this._openDB();
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

  public deleteCardData = async (id: string): Promise<string> => {
    // for debug
    // await sleep(60000);
    await this._openDB();
    return Promise.resolve('');
    /*
    const card = await cardDB.get(id);
    await cardDB.remove(card).catch(e => {
      throw new Error(`Error in deleteCardData: ${e}`);
    });
    return id;
    */
  };

  public getCardData = async (id: string): Promise<CardProp> => {
    // for debug
    // await sleep(60000);
    await this._openDB();
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

  public updateOrCreateCardData = async (prop: CardProp): Promise<string> => {
    await this._openDB();
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

  public export = async (filepath: string) => {
    await this._openDB();
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
              newAvatar.id = newURL;
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
}

export const CardIO = new CardIOClass();
