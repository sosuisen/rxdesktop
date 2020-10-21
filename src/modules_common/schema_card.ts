export const cardSchema = {
  title: 'card schema',
  description: 'RxSchema for cards of RxDesktop',
  version: 0,
  type: 'object',
  properties: {
    id: {
      type: 'string',
      primary: true,
    },
    type: {
      type: 'string',
    },
    user: {
      type: 'string',
    },
    data: {
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
  },
};
