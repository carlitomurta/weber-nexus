import { Provider } from '@nestjs/common';

import { createDatabase } from '@weber-nexus/database';

import { DB_TOKEN } from './database.constants';

export const DatabaseProvider: Provider = {
  provide: DB_TOKEN,

  useFactory: () => {
    return createDatabase('./db/nexus.db');
  },
};
