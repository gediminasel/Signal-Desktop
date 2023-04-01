// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import type {
  ForwardMessagePropsType,
  ForwardMessagesPropsType,
} from '../ducks/globalModals';
import type { StateType } from '../reducer';
import * as log from '../../logging/log';
import { ForwardMessagesModal } from '../../components/ForwardMessagesModal';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import * as Errors from '../../types/errors';
import type { GetConversationByIdType } from '../selectors/conversations';
import {
  getAllComposableConversations,
  getConversationSelector,
} from '../selectors/conversations';
import { getIntl, getTheme, getRegionCode } from '../selectors/user';
import { getLinkPreview } from '../selectors/linkPreviews';
import { getMessageById } from '../../messages/getMessageById';
import { getPreferredBadgeSelector } from '../selectors/badges';
import type {
  ForwardMessageData,
  MessageForwardDraft,
} from '../../util/maybeForwardMessages';
import { maybeForwardMessages } from '../../util/maybeForwardMessages';
import {
  maybeGrabLinkPreview,
  resetLinkPreview,
} from '../../services/LinkPreview';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useLinkPreviewActions } from '../ducks/linkPreviews';
import { processBodyRanges } from '../selectors/message';
import { getTextWithMentions } from '../../util/getTextWithMentions';
import { SmartCompositionTextArea } from './CompositionTextArea';
import { useToastActions } from '../ducks/toast';

function renderMentions(
  message: ForwardMessagePropsType,
  conversationSelector: GetConversationByIdType
): string | undefined {
  const { text } = message;

  if (!text) {
    return text;
  }

  const bodyRanges = processBodyRanges(message, {
    conversationSelector,
  });

  if (bodyRanges && bodyRanges.length) {
    return getTextWithMentions(bodyRanges, text);
  }

  return text;
}

export function SmartForwardMessagesModal(): JSX.Element | null {
  const forwardMessagesProps = useSelector<
    StateType,
    ForwardMessagesPropsType | undefined
  >(state => state.globalModals.forwardMessagesProps);
  const candidateConversations = useSelector(getAllComposableConversations);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const getConversation = useSelector(getConversationSelector);
  const i18n = useSelector(getIntl);
  const linkPreviewForSource = useSelector(getLinkPreview);
  const regionCode = useSelector(getRegionCode);
  const theme = useSelector(getTheme);

  const { removeLinkPreview } = useLinkPreviewActions();
  const { toggleForwardMessagesModal } = useGlobalModalActions();
  const { showToast } = useToastActions();

  const [drafts, setDrafts] = useState<ReadonlyArray<MessageForwardDraft>>(
    () => {
      return (
        forwardMessagesProps?.messages.map((props): MessageForwardDraft => {
          return {
            originalMessageId: props.id,
            attachments: props.attachments ?? [],
            messageBody: renderMentions(props, getConversation),
            isSticker: Boolean(props.isSticker),
            hasContact: Boolean(props.contact),
            previews: props.previews ?? [],
          };
        }) ?? []
      );
    }
  );

  if (!drafts.length) {
    return null;
  }

  function closeModal() {
    resetLinkPreview();
    toggleForwardMessagesModal();
  }

  return (
    <ForwardMessagesModal
      drafts={drafts}
      candidateConversations={candidateConversations}
      doForwardMessages={async (conversationIds, finalDrafts) => {
        try {
          const messages = await Promise.all(
            finalDrafts.map(async (draft): Promise<ForwardMessageData> => {
              const message = await getMessageById(draft.originalMessageId);
              if (message == null) {
                throw new Error('No message found');
              }
              return {
                draft,
                originalMessage: message.attributes,
              };
            })
          );

          const didForwardSuccessfully = await maybeForwardMessages(
            messages,
            conversationIds
          );

          if (didForwardSuccessfully) {
            closeModal();
            forwardMessagesProps?.onForward?.();
          }
        } catch (err) {
          log.warn('doForwardMessage', Errors.toLogFormat(err));
        }
      }}
      linkPreviewForSource={linkPreviewForSource}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      onClose={closeModal}
      onChange={(updatedDrafts, caretLocation) => {
        setDrafts(updatedDrafts);
        const isLonelyDraft = updatedDrafts.length === 1;
        const lonelyDraft = isLonelyDraft ? updatedDrafts[0] : null;
        if (lonelyDraft == null) {
          return;
        }
        const attachmentsLength = lonelyDraft.attachments?.length ?? 0;
        if (attachmentsLength === 0) {
          maybeGrabLinkPreview(
            lonelyDraft.messageBody ?? '',
            LinkPreviewSourceType.ForwardMessageModal,
            { caretLocation }
          );
        }
      }}
      regionCode={regionCode}
      RenderCompositionTextArea={SmartCompositionTextArea}
      removeLinkPreview={removeLinkPreview}
      showToast={showToast}
      theme={theme}
    />
  );
}
