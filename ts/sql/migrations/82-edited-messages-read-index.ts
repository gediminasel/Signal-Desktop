// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion82(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 82) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE edited_messages DROP COLUMN fromId;
      ALTER TABLE edited_messages ADD COLUMN conversationId STRING;

      CREATE INDEX edited_messages_unread ON edited_messages (readStatus, conversationId);
    `);

    db.pragma('user_version = 82');
  })();

  logger.info('updateToSchemaVersion82: success!');
}
