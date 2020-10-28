import { CardCondition, CardStyle, Geometry } from './cardprop';
import { CartaDate } from './types';

// For TypeScript
export type Avatar = {
  url: string;
  data: string;
  geometry: Geometry;
  style: CardStyle;
  condition: CardCondition;
  date: CartaDate;
  version: number;
};

// For RxDB
export const avatarSchema = {
  title: 'Avatar Schema',
  description: 'RxSchema for avatars of RxDesktop',
  version: 0,
  type: 'object',
  properties: {
    url: {
      primary: true,
      type: 'string',
    },
    geometry: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
        },
        y: {
          type: 'number',
        },
        z: {
          type: 'number',
        },
        width: {
          type: 'number',
        },
        height: {
          type: 'number',
        },
      },
    },
    style: {
      type: 'object',
      properties: {
        uiColor: {
          type: 'string',
        },
        backgroundColor: {
          type: 'string',
        },
        opacity: {
          type: 'number',
        },
        zoom: {
          type: 'number',
        },
      },
    },
    condition: {
      type: 'object',
      properties: {
        locked: {
          type: 'boolean',
        },
      },
    },
    date: {
      type: 'object',
      properties: {
        createdDate: {
          type: 'string',
        },
        modifiedDate: {
          type: 'string',
        },
      },
    },
    version: {
      type: 'number',
      default: 0,
    },
  },
};
