// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

// TODO: DESKTOP-3694
export default function updateToSchemaVersion60(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 60) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      DROP INDEX expiring_message_by_conversation_and_received_at;

      CREATE INDEX expiring_message_by_conversation_and_received_at
        ON messages
        (
          conversationId,
          storyId,
          expirationStartTimestamp,
          expireTimer,
          received_at
        )
        WHERE isStory IS 0 AND type IS 'incoming';
      `
    );

    db.pragma('user_version = 60');
  })();

  logger.info('updateToSchemaVersion60: success!');
}
