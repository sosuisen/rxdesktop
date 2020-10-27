// For TypeScript
export type Appstate = {
  key: string;
  value: string;
  version: string;
};

// For RxDB
export const appstateSchema = {
  title: 'App State Schema',
  description: 'RxSchema for app state of RxDesktop',
  version: 0,
  type: 'object',
  properties: {
    key: {
      type: 'string',
      primary: true,
    },
    value: {
      type: 'string',
    },
    version: {
      type: 'number',
    },
  },
};
