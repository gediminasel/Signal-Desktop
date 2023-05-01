// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from '../types/Util';
import { CallMode } from '../types/Calling';
import { missingCaseError } from './missingCaseError';
import * as log from '../logging/log';
import type { ConversationType } from '../state/ducks/conversations';

type DirectCallNotificationType = {
  callMode: CallMode.Direct;
  activeCallConversationId?: string;
  wasIncoming: boolean;
  wasVideoCall: boolean;
  wasDeclined: boolean;
  acceptedTime?: number;
  endedTime?: number;
};

type GroupCallNotificationType = {
  activeCallConversationId?: string;
  callMode: CallMode.Group;
  conversationId: string;
  creator?: ConversationType;
  ended: boolean;
  deviceCount: number;
  maxDevices: number;
  startedTime: number;
};

export type CallingNotificationType =
  | DirectCallNotificationType
  | GroupCallNotificationType;

function getDirectCallNotificationText(
  {
    wasIncoming,
    wasVideoCall,
    wasDeclined,
    acceptedTime,
  }: DirectCallNotificationType,
  i18n: LocalizerType
): string {
  const wasAccepted = Boolean(acceptedTime);

  if (wasIncoming) {
    if (wasDeclined) {
      if (wasVideoCall) {
        return i18n('icu:declinedIncomingVideoCall');
      }
      return i18n('icu:declinedIncomingAudioCall');
    }
    if (wasAccepted) {
      if (wasVideoCall) {
        return i18n('icu:acceptedIncomingVideoCall');
      }
      return i18n('icu:acceptedIncomingAudioCall');
    }
    if (wasVideoCall) {
      return i18n('icu:missedIncomingVideoCall');
    }
    return i18n('icu:missedIncomingAudioCall');
  }
  if (wasAccepted) {
    if (wasVideoCall) {
      return i18n('icu:acceptedOutgoingVideoCall');
    }
    return i18n('icu:acceptedOutgoingAudioCall');
  }
  if (wasVideoCall) {
    return i18n('icu:missedOrDeclinedOutgoingVideoCall');
  }
  return i18n('icu:missedOrDeclinedOutgoingAudioCall');
}

function getGroupCallNotificationText(
  notification: GroupCallNotificationType,
  i18n: LocalizerType
): string {
  if (notification.ended) {
    return i18n('icu:calling__call-notification__ended');
  }
  if (!notification.creator) {
    return i18n('icu:calling__call-notification__started-by-someone');
  }
  if (notification.creator.isMe) {
    return i18n('icu:calling__call-notification__started-by-you');
  }
  return i18n('icu:calling__call-notification__started', {
    name: notification.creator.systemGivenName ?? notification.creator.title,
  });
}

export function getCallingNotificationText(
  notification: CallingNotificationType,
  i18n: LocalizerType
): string {
  switch (notification.callMode) {
    case CallMode.Direct:
      return getDirectCallNotificationText(notification, i18n);
    case CallMode.Group:
      return getGroupCallNotificationText(notification, i18n);
    default:
      log.error(
        `getCallingNotificationText: missing case ${missingCaseError(
          notification
        )}`
      );
      return '';
  }
}

type CallingIconType =
  | 'audio-incoming'
  | 'audio-missed'
  | 'audio-outgoing'
  | 'phone'
  | 'video'
  | 'video-incoming'
  | 'video-missed'
  | 'video-outgoing';

function getDirectCallingIcon({
  wasIncoming,
  wasVideoCall,
  acceptedTime,
}: DirectCallNotificationType): CallingIconType {
  const wasAccepted = Boolean(acceptedTime);

  // video
  if (wasVideoCall) {
    if (wasAccepted) {
      return wasIncoming ? 'video-incoming' : 'video-outgoing';
    }
    return 'video-missed';
  }

  if (wasAccepted) {
    return wasIncoming ? 'audio-incoming' : 'audio-outgoing';
  }

  return 'audio-missed';
}

export function getCallingIcon(
  notification: CallingNotificationType
): CallingIconType {
  switch (notification.callMode) {
    case CallMode.Direct:
      return getDirectCallingIcon(notification);
    case CallMode.Group:
      return 'video';
    default:
      log.error(
        `getCallingNotificationText: missing case ${missingCaseError(
          notification
        )}`
      );
      return 'phone';
  }
}
