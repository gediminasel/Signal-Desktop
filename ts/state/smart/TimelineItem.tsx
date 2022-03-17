// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';
import React from 'react';
import { connect } from 'react-redux';

import { mapDispatchToProps } from '../actions';
import type { StateType } from '../reducer';

import { TimelineItem } from '../../components/conversation/TimelineItem';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getInteractionMode, getTheme } from '../selectors/user';
import {
  getConversationSelector,
  getMessageSelector,
  getSelectedMessage,
} from '../selectors/conversations';
import type { UnreadIndicatorPlacement } from '../../util/timelineUtil';

import { SmartContactName } from './ContactName';
import { SmartUniversalTimerNotification } from './UniversalTimerNotification';

type ExternalProps = {
  containerElementRef: RefObject<HTMLElement>;
  conversationId: string;
  isOldestTimelineItem: boolean;
  messageId: string;
  nextMessageId: undefined | string;
  previousMessageId: undefined | string;
  unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
};

function renderContact(conversationId: string): JSX.Element {
  return <SmartContactName conversationId={conversationId} />;
}

function renderUniversalTimerNotification(): JSX.Element {
  return <SmartUniversalTimerNotification />;
}

const mapStateToProps = (state: StateType, props: ExternalProps) => {
  const {
    containerElementRef,
    conversationId,
    isOldestTimelineItem,
    messageId,
    nextMessageId,
    previousMessageId,
    unreadIndicatorPlacement,
  } = props;

  const messageSelector = getMessageSelector(state);

  const item = messageSelector(messageId);
  const previousItem = previousMessageId
    ? messageSelector(previousMessageId)
    : undefined;
  const nextItem = nextMessageId ? messageSelector(nextMessageId) : undefined;

  const selectedMessage = getSelectedMessage(state);
  const isSelected = Boolean(
    selectedMessage && messageId === selectedMessage.id
  );

  const conversation = getConversationSelector(state)(conversationId);

  return {
    item,
    previousItem,
    nextItem,
    id: messageId,
    containerElementRef,
    conversationId,
    conversationColor: conversation?.conversationColor,
    customColor: conversation?.customColor,
    getPreferredBadge: getPreferredBadgeSelector(state),
    isOldestTimelineItem,
    isSelected,
    renderContact,
    renderUniversalTimerNotification,
    i18n: getIntl(state),
    interactionMode: getInteractionMode(state),
    theme: getTheme(state),
    unreadIndicatorPlacement,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartTimelineItem = smart(TimelineItem);
