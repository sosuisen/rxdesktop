import { Geometry2D } from './schema_avatar';

const actionTypes = ['avatar-position-update', 'avatar-size-update'] as const;
export type ActionType = typeof actionTypes[number];

/**
 * Updated store state is transferred from Main Process to Renderer Process,
 * unless SkipForward is true.
 */
export type RxDesktopAction = {
  type: ActionType;
  payload: any;
  skipForward?: boolean;
};

export interface AvatarPositionUpdateAction extends RxDesktopAction {
  type: 'avatar-position-update';
  payload: {
    url: string;
    geometry: Partial<Geometry2D>;
  };
}

export interface AvatarSizeUpdateAction extends RxDesktopAction {
  type: 'avatar-size-update';
  payload: {
    url: string;
    geometry: Partial<Geometry2D>;
  };
}

export type PersistentStoreAction = AvatarPositionUpdateAction | AvatarSizeUpdateAction;

export const avatarPositionUpdateActionCreator = (
  url: string,
  geometry: Geometry2D,
  skipForward?: boolean
) => {
  const action: AvatarPositionUpdateAction = {
    type: 'avatar-position-update',
    payload: {
      url,
      geometry,
    },
    skipForward: skipForward ?? false,
  };
  return action;
};

export const avatarSizeUpdateActionCreator = (
  url: string,
  geometry: Geometry2D,
  skipForward?: boolean
) => {
  const action: AvatarSizeUpdateAction = {
    type: 'avatar-size-update',
    payload: {
      url,
      geometry,
    },
    skipForward: skipForward ?? false,
  };
  return action;
};
