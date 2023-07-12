// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import { pick } from 'lodash';
import type { ConversationType } from '../ducks/conversations';
import type { StateType } from '../reducer';
import {
  ConversationHeader,
  OutgoingCallButtonStyle,
} from '../../components/conversation/ConversationHeader';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getConversationByUuidSelector,
  getConversationSelector,
  getConversationTitle,
  isMissingRequiredProfileSharing,
} from '../selectors/conversations';
import { CallMode } from '../../types/Calling';
import {
  getActiveCall,
  isAnybodyElseInGroupCall,
  useCallingActions,
} from '../ducks/calling';
import {
  getConversationCallMode,
  useConversationsActions,
} from '../ducks/conversations';
import { getHasStoriesSelector } from '../selectors/stories2';
import { getOwn } from '../../util/getOwn';
import { getUserACI, getIntl, getTheme } from '../selectors/user';
import { isConversationSMSOnly } from '../../util/isConversationSMSOnly';
import { missingCaseError } from '../../util/missingCaseError';
import { strictAssert } from '../../util/assert';
import { isSignalConversation } from '../../util/isSignalConversation';
import { useSearchActions } from '../ducks/search';
import { useStoriesActions } from '../ducks/stories';
import { getCannotLeaveBecauseYouAreLastAdmin } from '../../components/conversation/conversation-details/ConversationDetails';
import { getGroupMemberships } from '../../util/getGroupMemberships';

export type OwnProps = {
  id: string;
};

const getOutgoingCallButtonStyle = (
  conversation: ConversationType,
  state: StateType
): OutgoingCallButtonStyle => {
  const { calling } = state;
  const ourACI = getUserACI(state);
  strictAssert(ourACI, 'getOutgoingCallButtonStyle missing our uuid');

  if (getActiveCall(calling)) {
    return OutgoingCallButtonStyle.None;
  }

  const conversationCallMode = getConversationCallMode(conversation);
  switch (conversationCallMode) {
    case CallMode.None:
      return OutgoingCallButtonStyle.None;
    case CallMode.Direct:
      return OutgoingCallButtonStyle.Both;
    case CallMode.Group: {
      const call = getOwn(calling.callsByConversation, conversation.id);
      if (
        call?.callMode === CallMode.Group &&
        isAnybodyElseInGroupCall(call.peekInfo, ourACI)
      ) {
        return OutgoingCallButtonStyle.Join;
      }
      return OutgoingCallButtonStyle.JustVideo;
    }
    default:
      throw missingCaseError(conversationCallMode);
  }
};

export function SmartConversationHeader({ id }: OwnProps): JSX.Element {
  const conversationSelector = useSelector(getConversationSelector);
  const conversation = conversationSelector(id);
  if (!conversation) {
    throw new Error('Could not find conversation');
  }
  const isAdmin = Boolean(conversation.areWeAdmin);
  const hasStoriesSelector = useSelector(getHasStoriesSelector);
  const hasStories = hasStoriesSelector(id);

  const badgeSelector = useSelector(getPreferredBadgeSelector);
  const badge = badgeSelector(conversation.badges);
  const conversationTitle = useSelector(getConversationTitle);
  const i18n = useSelector(getIntl);
  const showBackButton = useSelector<StateType, boolean>(
    state => state.conversations.targetedConversationPanels.length > 0
  );
  const outgoingCallButtonStyle = useSelector<
    StateType,
    OutgoingCallButtonStyle
  >(state => getOutgoingCallButtonStyle(conversation, state));
  const theme = useSelector(getTheme);

  const {
    destroyMessages,
    leaveGroup,
    onArchive,
    onMarkUnread,
    onMoveToInbox,
    popPanelForConversation,
    pushPanelForConversation,
    setDisappearingMessages,
    setMuteExpiration,
    setPinned,
    toggleSelectMode,
    jumpToDate,
  } = useConversationsActions();
  const {
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
  } = useCallingActions();
  const { searchInConversation } = useSearchActions();
  const { viewUserStories } = useStoriesActions();

  const conversationByUuidSelector = useSelector(getConversationByUuidSelector);
  const groupMemberships = getGroupMemberships(
    conversation,
    conversationByUuidSelector
  );
  const cannotLeaveBecauseYouAreLastAdmin =
    getCannotLeaveBecauseYouAreLastAdmin(groupMemberships.memberships, isAdmin);

  return (
    <ConversationHeader
      {...pick(conversation, [
        'acceptedMessageRequest',
        'announcementsOnly',
        'areWeAdmin',
        'avatarPath',
        'canChangeTimer',
        'color',
        'expireTimer',
        'groupVersion',
        'isArchived',
        'isMe',
        'isPinned',
        'isVerified',
        'left',
        'markedUnread',
        'muteExpiresAt',
        'name',
        'phoneNumber',
        'profileName',
        'sharedGroupNames',
        'title',
        'type',
        'unblurredAvatarPath',
      ])}
      badge={badge}
      cannotLeaveBecauseYouAreLastAdmin={cannotLeaveBecauseYouAreLastAdmin}
      conversationTitle={conversationTitle}
      destroyMessages={destroyMessages}
      hasStories={hasStories}
      i18n={i18n}
      id={id}
      isMissingMandatoryProfileSharing={isMissingRequiredProfileSharing(
        conversation
      )}
      isSignalConversation={isSignalConversation(conversation)}
      isSMSOnly={isConversationSMSOnly(conversation)}
      leaveGroup={leaveGroup}
      onArchive={onArchive}
      onMarkUnread={onMarkUnread}
      onMoveToInbox={onMoveToInbox}
      jumpToDate={jumpToDate}
      onOutgoingAudioCallInConversation={onOutgoingAudioCallInConversation}
      onOutgoingVideoCallInConversation={onOutgoingVideoCallInConversation}
      outgoingCallButtonStyle={outgoingCallButtonStyle}
      popPanelForConversation={popPanelForConversation}
      pushPanelForConversation={pushPanelForConversation}
      searchInConversation={searchInConversation}
      setDisappearingMessages={setDisappearingMessages}
      setMuteExpiration={setMuteExpiration}
      setPinned={setPinned}
      showBackButton={showBackButton}
      theme={theme}
      toggleSelectMode={toggleSelectMode}
      viewUserStories={viewUserStories}
    />
  );
}
