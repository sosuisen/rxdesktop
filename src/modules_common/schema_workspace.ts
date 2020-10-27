import { AvatarPropSerializable } from './cardprop';

// For TypeScript
export type Workspace = {
  id: string;
  name: string;
  date: {
    createdDate: string;
    modifiedDate: string;
  };
  version: number;
  avatars: AvatarPropSerializable[];
};

// For RxDB
export const workspaceSchema = {
  title: 'Workspace Schema',
  description: 'RxSchema for workspaces of RxDesktop',
  version: 0,
  type: 'object',
  properties: {
    id: {
      type: 'string',
      primary: true,
    },
    name: {
      type: 'string',
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
    },
    avatars: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
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
          url: {
            type: 'string',
          },
        },
      },
    },
  },
};
