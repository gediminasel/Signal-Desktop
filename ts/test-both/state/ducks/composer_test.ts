// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { noop } from 'lodash';

import type { ReduxActions } from '../../../state/types';
import { actions, getEmptyState, reducer } from '../../../state/ducks/composer';
import { noopAction } from '../../../state/ducks/noop';
import { reducer as rootReducer } from '../../../state/reducer';

import { IMAGE_JPEG } from '../../../types/MIME';
import type { AttachmentDraftType } from '../../../types/Attachment';
import { fakeDraftAttachment } from '../../helpers/fakeAttachment';

describe('both/state/ducks/composer', () => {
  const QUOTED_MESSAGE = {
    conversationId: '123',
    id: 'quoted-message-id',
    quote: {
      attachments: [],
      id: 456,
      isViewOnce: false,
      isGiftBadge: false,
      messageId: '789',
      referencedMessageNotFound: false,
      fromGroupName: undefined,
    },
  };

  const getRootStateFunction = (selectedConversationId?: string) => {
    const state = rootReducer(undefined, noopAction());
    return () => ({
      ...state,
      conversations: {
        ...state.conversations,
        selectedConversationId,
      },
    });
  };

  describe('replaceAttachments', () => {
    let oldReduxActions: ReduxActions;
    before(() => {
      oldReduxActions = window.reduxActions;
      window.reduxActions = {
        ...oldReduxActions,
        linkPreviews: {
          ...oldReduxActions?.linkPreviews,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          removeLinkPreview: noop as any,
        },
      };
    });
    after(() => {
      window.reduxActions = oldReduxActions;
    });

    it('replaces the attachments state', () => {
      const { replaceAttachments } = actions;
      const dispatch = sinon.spy();

      const attachments: Array<AttachmentDraftType> = [
        {
          contentType: IMAGE_JPEG,
          pending: true,
          size: 2433,
          path: 'image.jpg',
        },
      ];
      replaceAttachments('123', attachments)(
        dispatch,
        getRootStateFunction('123'),
        null
      );

      const action = dispatch.getCall(0).args[0];
      const state = reducer(getEmptyState(), action);
      assert.deepEqual(state.attachments, attachments);
    });

    it('sets the high quality setting to false when there are no attachments', () => {
      const { replaceAttachments } = actions;
      const dispatch = sinon.spy();
      const attachments: Array<AttachmentDraftType> = [];

      replaceAttachments('123', attachments)(
        dispatch,
        getRootStateFunction('123'),
        null
      );

      const action = dispatch.getCall(0).args[0];
      const state = reducer(
        {
          ...getEmptyState(),
          shouldSendHighQualityAttachments: true,
        },
        action
      );
      assert.deepEqual(state.attachments, attachments);

      assert.deepEqual(state.attachments, attachments);
      assert.isUndefined(state.shouldSendHighQualityAttachments);
    });

    it('does not update redux if the conversation is not selected', () => {
      const { replaceAttachments } = actions;
      const dispatch = sinon.spy();

      const attachments = [fakeDraftAttachment()];
      replaceAttachments('123', attachments)(
        dispatch,
        getRootStateFunction('456'),
        null
      );

      assert.isNull(dispatch.getCall(0));
    });
  });

  describe('resetComposer', () => {
    it('returns composer back to empty state', () => {
      const { resetComposer } = actions;
      const emptyState = getEmptyState();
      const nextState = reducer(
        {
          attachments: [],
          focusCounter: 0,
          isDisabled: false,
          linkPreviewLoading: true,
          messageCompositionId: emptyState.messageCompositionId,
          quotedMessage: QUOTED_MESSAGE,
          shouldSendHighQualityAttachments: true,
        },
        resetComposer()
      );

      assert.deepEqual(nextState, {
        ...getEmptyState(),
        messageCompositionId: nextState.messageCompositionId,
      });
    });
  });

  describe('setMediaQualitySetting', () => {
    it('toggles the media quality setting', () => {
      const { setMediaQualitySetting } = actions;
      const state = getEmptyState();

      assert.isUndefined(state.shouldSendHighQualityAttachments);

      const nextState = reducer(state, setMediaQualitySetting(true));

      assert.isTrue(nextState.shouldSendHighQualityAttachments);

      const nextNextState = reducer(nextState, setMediaQualitySetting(false));

      assert.isFalse(nextNextState.shouldSendHighQualityAttachments);
    });
  });

  describe('setQuotedMessage', () => {
    it('sets the quoted message', () => {
      const { setQuotedMessage } = actions;
      const state = getEmptyState();
      const nextState = reducer(state, setQuotedMessage(QUOTED_MESSAGE));

      assert.equal(nextState.quotedMessage?.conversationId, '123');
      assert.equal(nextState.quotedMessage?.quote?.id, 456);
    });
  });
});
