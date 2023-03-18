// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import { SmartStoryCreator } from './StoryCreator';
import { Stories } from '../../components/Stories';
import { getMaximumAttachmentSizeInKb } from '../../types/AttachmentSize';
import type { ConfigKeyType } from '../../RemoteConfig';
import { getMe } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import {
  getHasStoryViewReceiptSetting,
  getPreferredLeftPaneWidth,
  getRemoteConfig,
} from '../selectors/items';
import {
  getAddStoryData,
  getSelectedStoryData,
  getStories,
  shouldShowStoriesView,
} from '../selectors/stories';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStoriesActions } from '../ducks/stories';
import { useToastActions } from '../ducks/toast';
import { useAudioPlayerActions } from '../ducks/audioPlayer';

function renderStoryCreator(): JSX.Element {
  return <SmartStoryCreator />;
}

export function SmartStories(): JSX.Element | null {
  const storiesActions = useStoriesActions();
  const {
    retryMessageSend,
    saveAttachment,
    showConversation,
    toggleHideStories,
  } = useConversationsActions();
  const { showStoriesSettings, toggleForwardMessageModal } =
    useGlobalModalActions();
  const { showToast } = useToastActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);

  const isShowingStoriesView = useSelector<StateType, boolean>(
    shouldShowStoriesView
  );

  const preferredWidthFromStorage = useSelector<StateType, number>(
    getPreferredLeftPaneWidth
  );
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);

  const addStoryData = useSelector(getAddStoryData);
  const { hiddenStories, myStories, stories } = useSelector(getStories);

  const me = useSelector(getMe);

  const selectedStoryData = useSelector(getSelectedStoryData);

  const isStoriesSettingsVisible = useSelector(
    (state: StateType) => state.globalModals.isStoriesSettingsVisible
  );

  const hasViewReceiptSetting = useSelector(getHasStoryViewReceiptSetting);

  const remoteConfig = useSelector(getRemoteConfig);
  const maxAttachmentSizeInKb = getMaximumAttachmentSizeInKb(
    (name: ConfigKeyType) => {
      const value = remoteConfig[name]?.value;
      return value ? String(value) : undefined;
    }
  );
  const { pauseVoiceNotePlayer } = useAudioPlayerActions();

  if (!isShowingStoriesView) {
    return null;
  }

  return (
    <Stories
      addStoryData={addStoryData}
      getPreferredBadge={getPreferredBadge}
      hiddenStories={hiddenStories}
      i18n={i18n}
      maxAttachmentSizeInKb={maxAttachmentSizeInKb}
      me={me}
      myStories={myStories}
      onForwardStory={toggleForwardMessageModal}
      onSaveStory={story => {
        if (story.attachment) {
          saveAttachment(story.attachment, story.timestamp);
        }
      }}
      onMediaPlaybackStart={pauseVoiceNotePlayer}
      preferredWidthFromStorage={preferredWidthFromStorage}
      renderStoryCreator={renderStoryCreator}
      retryMessageSend={retryMessageSend}
      showConversation={showConversation}
      showStoriesSettings={showStoriesSettings}
      showToast={showToast}
      stories={stories}
      toggleHideStories={toggleHideStories}
      isViewingStory={selectedStoryData !== undefined}
      isStoriesSettingsVisible={isStoriesSettingsVisible}
      hasViewReceiptSetting={hasViewReceiptSetting}
      {...storiesActions}
    />
  );
}
