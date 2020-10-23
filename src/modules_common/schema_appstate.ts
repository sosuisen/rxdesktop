export const appStateSchema = {
  title: 'App State schema',
  description: 'RxSchema for app state of RxDesktop',
  version: 0,
  type: 'object',
  properties: {
    name: {
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
