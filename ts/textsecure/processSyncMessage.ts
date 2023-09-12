// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { SignalService as Proto } from '../protobuf';
import type { ServiceIdString } from '../types/ServiceId';
import { normalizeServiceId } from '../types/ServiceId';
import type { ProcessedSent, ProcessedSyncMessage } from './Types.d';

type ProtoServiceId = Readonly<{
  destinationServiceId?: string | null;
}>;

function processProtoWithDestinationServiceId<Input extends ProtoServiceId>(
  input: Input
): Omit<Input, keyof ProtoServiceId> & {
  destinationServiceId?: ServiceIdString;
} {
  const { destinationServiceId, ...remaining } = input;

  return {
    ...remaining,

    destinationServiceId: destinationServiceId
      ? normalizeServiceId(destinationServiceId, 'processSyncMessage')
      : undefined,
  };
}

function processSent(
  sent?: Proto.SyncMessage.ISent | null
): ProcessedSent | undefined {
  if (!sent) {
    return undefined;
  }

  const {
    destinationServiceId,
    unidentifiedStatus,
    storyMessageRecipients,
    ...remaining
  } = sent;

  return {
    ...remaining,

    destinationServiceId: destinationServiceId
      ? normalizeServiceId(destinationServiceId, 'processSent')
      : undefined,
    unidentifiedStatus: unidentifiedStatus
      ? unidentifiedStatus.map(processProtoWithDestinationServiceId)
      : undefined,
    storyMessageRecipients: storyMessageRecipients
      ? storyMessageRecipients.map(processProtoWithDestinationServiceId)
      : undefined,
  };
}

export function processSyncMessage(
  syncMessage: Proto.ISyncMessage
): ProcessedSyncMessage {
  return {
    ...syncMessage,
    sent: processSent(syncMessage.sent),
  };
}
