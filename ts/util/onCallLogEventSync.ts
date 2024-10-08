// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallLogEventSyncEvent } from '../textsecure/messageReceiverEvents';
import * as log from '../logging/log';
import { DataWriter } from '../sql/Client';
import type { CallLogEventTarget } from '../types/CallDisposition';
import { CallLogEvent } from '../types/CallDisposition';
import { missingCaseError } from './missingCaseError';
import { strictAssert } from './assert';
import { updateDeletedMessages } from './callDisposition';

export async function onCallLogEventSync(
  syncEvent: CallLogEventSyncEvent
): Promise<void> {
  const { data, confirm } = syncEvent;
  const { type, peerId, callId, timestamp } = data.callLogEventDetails;

  const target: CallLogEventTarget = {
    peerId,
    callId,
    timestamp,
  };

  log.info(
    `onCallLogEventSync: Processing event (Event: ${type}, CallId: ${callId}, Timestamp: ${timestamp})`
  );

  if (type === CallLogEvent.Clear) {
    log.info('onCallLogEventSync: Clearing call history');
    try {
      const messageIds = await DataWriter.clearCallHistory(target);
      updateDeletedMessages(messageIds);
    } finally {
      // We want to reset the call history even if the clear fails.
      window.reduxActions.callHistory.resetCallHistory();
    }
    confirm();
  } else if (type === CallLogEvent.MarkedAsRead) {
    log.info('onCallLogEventSync: Marking call history read');
    try {
      const count = await DataWriter.markAllCallHistoryRead(target);
      log.info(
        `onCallLogEventSync: Marked ${count} call history messages read`
      );
    } finally {
      window.reduxActions.callHistory.updateCallHistoryUnreadCount();
    }
    confirm();
  } else if (type === CallLogEvent.MarkedAsReadInConversation) {
    log.info('onCallLogEventSync: Marking call history read in conversation');
    try {
      strictAssert(peerId, 'Missing peerId');
      const count =
        await DataWriter.markAllCallHistoryReadInConversation(target);
      log.info(
        `onCallLogEventSync: Marked ${count} call history messages read`
      );
    } finally {
      window.reduxActions.callHistory.updateCallHistoryUnreadCount();
    }
    confirm();
  } else {
    throw missingCaseError(type);
  }
}
