import { Geometry } from './schema_avatar';

const actionTypes = ['avatar-position-update', 'avatar-size-update'] as const;
export type ActionType = typeof actionTypes[number];
type Action = {
  type: ActionType;
  payload: any;
};

export interface AvatarPositionUpdateAction extends Action {
  type: 'avatar-position-update';
  payload: {
    url: string;
    geometry: Partial<Geometry>;
  };
}

export interface AvatarSizeUpdateAction extends Action {
  type: 'avatar-size-update';
  payload: {
    url: string;
    geometry: Partial<Geometry>;
  };
}

export type PersistentStoreAction = AvatarPositionUpdateAction | AvatarSizeUpdateAction;
