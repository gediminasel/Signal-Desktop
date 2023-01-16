// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion63(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 63) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE unprocessed ADD COLUMN urgent INTEGER;
      `
    );

    db.pragma('user_version = 63');
  })();

  logger.info('updateToSchemaVersion63: success!');
}
