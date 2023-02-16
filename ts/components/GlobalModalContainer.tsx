// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type {
  ContactModalStateType,
  ForwardMessagePropsType,
  UserNotFoundModalStateType,
  SafetyNumberChangedBlockingDataType,
} from '../state/ducks/globalModals';
import type { LocalizerType, ThemeType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';

import { ButtonVariant } from './Button';
import { ConfirmationDialog } from './ConfirmationDialog';
import { SignalConnectionsModal } from './SignalConnectionsModal';
import { WhatsNewModal } from './WhatsNewModal';

// NOTE: All types should be required for this component so that the smart
// component gives you type errors when adding/removing props.
export type PropsType = {
  i18n: LocalizerType;
  theme: ThemeType;
  // AddUserToAnotherGroupModal
  addUserToAnotherGroupModalContactId: string | undefined;
  renderAddUserToAnotherGroup: () => JSX.Element;
  // ContactModal
  contactModalState: ContactModalStateType | undefined;
  renderContactModal: () => JSX.Element;
  // ErrorModal
  errorModalProps: { description?: string; title?: string } | undefined;
  renderErrorModal: (opts: {
    description?: string;
    title?: string;
  }) => JSX.Element;
  // ForwardMessageModal
  forwardMessageProps: ForwardMessagePropsType | undefined;
  renderForwardMessageModal: () => JSX.Element;
  // ProfileEditor
  isProfileEditorVisible: boolean;
  renderProfileEditor: () => JSX.Element;
  // SafetyNumberModal
  safetyNumberModalContactId: string | undefined;
  renderSafetyNumber: () => JSX.Element;
  // ShortcutGuideModal
  isShortcutGuideModalVisible: boolean;
  renderShortcutGuideModal: () => JSX.Element;
  // SignalConnectionsModal
  isSignalConnectionsVisible: boolean;
  toggleSignalConnectionsModal: () => unknown;
  // StickerPackPreviewModal
  stickerPackPreviewId: string | undefined;
  renderStickerPreviewModal: () => JSX.Element | null;
  // StoriesSettings
  isStoriesSettingsVisible: boolean;
  renderStoriesSettings: () => JSX.Element;
  // SendAnywayDialog
  hasSafetyNumberChangeModal: boolean;
  safetyNumberChangedBlockingData:
    | SafetyNumberChangedBlockingDataType
    | undefined;
  renderSendAnywayDialog: () => JSX.Element;
  // UserNotFoundModal
  hideUserNotFoundModal: () => unknown;
  userNotFoundModalState: UserNotFoundModalStateType | undefined;
  // WhatsNewModal
  isWhatsNewVisible: boolean;
  hideWhatsNewModal: () => unknown;
};

export function GlobalModalContainer({
  i18n,
  // AddUserToAnotherGroupModal
  addUserToAnotherGroupModalContactId,
  renderAddUserToAnotherGroup,
  // ContactModal
  contactModalState,
  renderContactModal,
  // ErrorModal
  errorModalProps,
  renderErrorModal,
  // ForwardMessageModal
  forwardMessageProps,
  renderForwardMessageModal,
  // ProfileEditor
  isProfileEditorVisible,
  renderProfileEditor,
  // SafetyNumberModal
  safetyNumberModalContactId,
  renderSafetyNumber,
  // ShortcutGuideModal
  isShortcutGuideModalVisible,
  renderShortcutGuideModal,
  // SignalConnectionsModal
  isSignalConnectionsVisible,
  toggleSignalConnectionsModal,
  // StickerPackPreviewModal
  stickerPackPreviewId,
  renderStickerPreviewModal,
  // StoriesSettings
  isStoriesSettingsVisible,
  renderStoriesSettings,
  // SendAnywayDialog
  hasSafetyNumberChangeModal,
  safetyNumberChangedBlockingData,
  renderSendAnywayDialog,
  // UserNotFoundModal
  hideUserNotFoundModal,
  userNotFoundModalState,
  // WhatsNewModal
  hideWhatsNewModal,
  isWhatsNewVisible,
}: PropsType): JSX.Element | null {
  // We want the following dialogs to show in this order:
  // 1. Errors
  // 2. Safety Number Changes
  // 3. The Rest (in no particular order, but they're ordered alphabetically)

  // Errors
  if (errorModalProps) {
    return renderErrorModal(errorModalProps);
  }

  // Safety Number
  if (hasSafetyNumberChangeModal || safetyNumberChangedBlockingData) {
    return renderSendAnywayDialog();
  }

  // The Rest

  if (addUserToAnotherGroupModalContactId) {
    return renderAddUserToAnotherGroup();
  }

  if (contactModalState) {
    return renderContactModal();
  }

  if (forwardMessageProps) {
    return renderForwardMessageModal();
  }

  if (isProfileEditorVisible) {
    return renderProfileEditor();
  }

  if (isShortcutGuideModalVisible) {
    return renderShortcutGuideModal();
  }

  if (isSignalConnectionsVisible) {
    return (
      <SignalConnectionsModal
        i18n={i18n}
        onClose={toggleSignalConnectionsModal}
      />
    );
  }

  if (isStoriesSettingsVisible) {
    return renderStoriesSettings();
  }

  if (isWhatsNewVisible) {
    return <WhatsNewModal hideWhatsNewModal={hideWhatsNewModal} i18n={i18n} />;
  }

  if (safetyNumberModalContactId) {
    return renderSafetyNumber();
  }

  if (stickerPackPreviewId) {
    return renderStickerPreviewModal();
  }

  if (userNotFoundModalState) {
    let content: string;
    if (userNotFoundModalState.type === 'phoneNumber') {
      content = i18n('startConversation--phone-number-not-found', {
        phoneNumber: userNotFoundModalState.phoneNumber,
      });
    } else if (userNotFoundModalState.type === 'username') {
      content = i18n('startConversation--username-not-found', {
        atUsername: userNotFoundModalState.username,
      });
    } else {
      throw missingCaseError(userNotFoundModalState);
    }

    return (
      <ConfirmationDialog
        dialogName="GlobalModalContainer.userNotFound"
        cancelText={i18n('ok')}
        cancelButtonVariant={ButtonVariant.Secondary}
        i18n={i18n}
        onClose={hideUserNotFoundModal}
      >
        {content}
      </ConfirmationDialog>
    );
  }

  return null;
}
