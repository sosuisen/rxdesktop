export const appStateSchema = {
  title: 'App State schema',
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
