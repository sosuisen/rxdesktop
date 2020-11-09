import { Geometry } from './schema_avatar';

const actionTypes = ['avatar-position-update', 'avatar-size-update'] as const;
export type ActionType = typeof actionTypes[number];

/**
 * Updated store state is transferred from Main Process to Renderer Process,
 * unless skipTransfer is true.
 */
export type RxDesktopAction = {
  type: ActionType;
  payload: any;
  skipTransfer?: boolean;
};

export interface AvatarPositionUpdateAction extends RxDesktopAction {
  type: 'avatar-position-update';
  payload: {
    url: string;
    geometry: Partial<Geometry>;
  };
}

export interface AvatarSizeUpdateAction extends RxDesktopAction {
  type: 'avatar-size-update';
  payload: {
    url: string;
    geometry: Partial<Geometry>;
  };
}

export type PersistentStoreAction = AvatarPositionUpdateAction | AvatarSizeUpdateAction;
