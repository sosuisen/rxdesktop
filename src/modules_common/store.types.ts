import { Geometry } from './schema_avatar';

export type AvatarGeometryUpdateAction = {
  type: 'avatar-geometry-update';
  payload: {
    url: string;
    geometry: Partial<Geometry>;
  };
};

export type PersistentStoreAction = AvatarGeometryUpdateAction;
