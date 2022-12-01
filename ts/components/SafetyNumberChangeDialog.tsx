// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import type { ActionSpec } from './ConfirmationDialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import { InContactsIcon } from './InContactsIcon';
import { Modal } from './Modal';

import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { LocalizerType } from '../types/Util';
import { ThemeType } from '../types/Util';
import { isInSystemContacts } from '../util/isInSystemContacts';
import { missingCaseError } from '../util/missingCaseError';
import { ContextMenu } from './ContextMenu';
import { Theme } from '../util/theme';
import { isNotNil } from '../util/isNotNil';
import { MY_STORY_ID } from '../types/Stories';
import type { UUIDStringType } from '../types/UUID';

export enum SafetyNumberChangeSource {
  Calling = 'Calling',
  MessageSend = 'MessageSend',
  Story = 'Story',
}

enum DialogState {
  StartingInReview = 'StartingInReview',
  ExplicitReviewNeeded = 'ExplicitReviewNeeded',
  ExplicitReviewStep = 'ExplicitReviewStep',
  ExplicitReviewComplete = 'ExplicitReviewComplete',
}

export type SafetyNumberProps = {
  contactID: string;
  onClose: () => void;
};

type StoryContacts = {
  story?: {
    name: string;
    // For My Story or custom distribution lists, conversationId will be our own
    conversationId: string;
    // For Group stories, distributionId will not be provided
    distributionId?: string;
  };
  contacts: Array<ConversationType>;
};
export type ContactsByStory = Array<StoryContacts>;

export type Props = Readonly<{
  confirmText?: string;
  contacts: ContactsByStory;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  onCancel: () => void;
  onConfirm: () => void;
  removeFromStory?: (
    distributionId: string,
    uuids: Array<UUIDStringType>
  ) => unknown;
  renderSafetyNumber: (props: SafetyNumberProps) => JSX.Element;
  theme: ThemeType;
}>;

function doesRequireExplicitReviewMode(count: number) {
  return count > 5;
}

function getStartingDialogState(count: number): DialogState {
  if (count === 0) {
    return DialogState.ExplicitReviewComplete;
  }

  if (doesRequireExplicitReviewMode(count)) {
    return DialogState.ExplicitReviewNeeded;
  }

  return DialogState.StartingInReview;
}

export const SafetyNumberChangeDialog = ({
  confirmText,
  contacts,
  getPreferredBadge,
  i18n,
  onCancel,
  onConfirm,
  removeFromStory,
  renderSafetyNumber,
  theme,
}: Props): JSX.Element => {
  const totalCount = contacts.reduce(
    (count, item) => count + item.contacts.length,
    0
  );
  const allVerified = contacts.every(item =>
    item.contacts.every(contact => contact.isVerified)
  );
  const [dialogState, setDialogState] = React.useState<DialogState>(
    getStartingDialogState(totalCount)
  );
  const [selectedContact, setSelectedContact] = React.useState<
    ConversationType | undefined
  >(undefined);
  const cancelButtonRef = React.createRef<HTMLButtonElement>();

  React.useEffect(() => {
    if (cancelButtonRef && cancelButtonRef.current) {
      cancelButtonRef.current.focus();
    }
  }, [cancelButtonRef, contacts]);

  React.useEffect(() => {
    if (
      dialogState === DialogState.ExplicitReviewStep &&
      (totalCount === 0 || allVerified)
    ) {
      setDialogState(DialogState.ExplicitReviewComplete);
    }
  }, [allVerified, dialogState, setDialogState, totalCount]);

  const onClose = selectedContact
    ? () => {
        setSelectedContact(undefined);
      }
    : onCancel;

  if (selectedContact) {
    return (
      <Modal
        modalName="SafetyNumberChangeDialog"
        hasXButton
        i18n={i18n}
        onClose={onClose}
      >
        {renderSafetyNumber({ contactID: selectedContact.id, onClose })}
      </Modal>
    );
  }

  if (
    dialogState === DialogState.StartingInReview ||
    dialogState === DialogState.ExplicitReviewStep
  ) {
    let text: string;
    if (dialogState === DialogState.ExplicitReviewStep) {
      text = i18n('safetyNumberChangeDialog_done');
    } else if (allVerified || totalCount === 0) {
      text = confirmText || i18n('safetyNumberChangeDialog_send');
    } else {
      text = confirmText || i18n('sendAnyway');
    }

    return (
      <ConfirmationDialog
        key="SafetyNumberChangeDialog.reviewing"
        dialogName="SafetyNumberChangeDialog.reviewing"
        actions={[
          {
            action: () => {
              if (dialogState === DialogState.ExplicitReviewStep) {
                setDialogState(DialogState.ExplicitReviewComplete);
              } else {
                onConfirm();
              }
            },
            text,
            style: 'affirmative',
          },
        ]}
        hasXButton
        i18n={i18n}
        moduleClassName="module-SafetyNumberChangeDialog__confirm-dialog"
        noMouseClose
        onCancel={onClose}
        onClose={noop}
      >
        <div className="module-SafetyNumberChangeDialog__shield-icon" />
        <div className="module-SafetyNumberChangeDialog__title">
          {i18n('safetyNumberChanges')}
        </div>
        <div className="module-SafetyNumberChangeDialog__message">
          {i18n('safetyNumberChangeDialog__message')}
        </div>
        {contacts.map((section: StoryContacts) => (
          <ContactSection
            key={section.story?.name || 'default'}
            section={section}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            removeFromStory={removeFromStory}
            setSelectedContact={setSelectedContact}
            theme={theme}
          />
        ))}
      </ConfirmationDialog>
    );
  }

  let text: string;
  if (dialogState === DialogState.ExplicitReviewNeeded) {
    text = confirmText || i18n('sendAnyway');
  } else if (dialogState === DialogState.ExplicitReviewComplete) {
    text = confirmText || i18n('safetyNumberChangeDialog_send');
  } else {
    throw missingCaseError(dialogState);
  }

  const actions: Array<ActionSpec> = [
    {
      action: onConfirm,
      text,
      style: 'affirmative',
    },
  ];

  if (dialogState === DialogState.ExplicitReviewNeeded) {
    actions.unshift({
      action: () => setDialogState(DialogState.ExplicitReviewStep),
      text: i18n('safetyNumberChangeDialog__review'),
    });
  }

  return (
    <ConfirmationDialog
      key="SafetyNumberChangeDialog.manyContacts"
      dialogName="SafetyNumberChangeDialog.manyContacts"
      actions={actions}
      hasXButton
      i18n={i18n}
      moduleClassName="module-SafetyNumberChangeDialog__confirm-dialog"
      noMouseClose
      noDefaultCancelButton={dialogState === DialogState.ExplicitReviewNeeded}
      onCancel={onClose}
      onClose={noop}
    >
      <div className="module-SafetyNumberChangeDialog__shield-icon" />
      <div className="module-SafetyNumberChangeDialog__title">
        {i18n('safetyNumberChanges')}
      </div>
      <div
        className={classNames(
          'module-SafetyNumberChangeDialog__message',
          dialogState === DialogState.ExplicitReviewComplete
            ? 'module-SafetyNumberChangeDialog__message--narrow'
            : undefined
        )}
      >
        {dialogState === DialogState.ExplicitReviewNeeded
          ? i18n('icu:safetyNumberChangeDialog__many-contacts', {
              count: totalCount,
            })
          : i18n('safetyNumberChangeDialog__post-review')}
      </div>
    </ConfirmationDialog>
  );
};

function ContactSection({
  section,
  getPreferredBadge,
  i18n,
  removeFromStory,
  setSelectedContact,
  theme,
}: Readonly<{
  section: StoryContacts;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  removeFromStory?: (
    distributionId: string,
    uuids: Array<UUIDStringType>
  ) => unknown;
  setSelectedContact: (contact: ConversationType) => void;
  theme: ThemeType;
}>) {
  if (section.contacts.length === 0) {
    return null;
  }

  if (!section.story) {
    return (
      <ul className="module-SafetyNumberChangeDialog__contacts">
        {section.contacts.map((contact: ConversationType) => {
          const shouldShowNumber = Boolean(contact.name || contact.profileName);

          return (
            <ContactRow
              key={contact.id}
              contact={contact}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              removeFromStory={removeFromStory}
              setSelectedContact={setSelectedContact}
              shouldShowNumber={shouldShowNumber}
              theme={theme}
            />
          );
        })}
      </ul>
    );
  }

  const { distributionId } = section.story;
  const uuids = section.contacts.map(contact => contact.uuid).filter(isNotNil);
  const sectionName =
    distributionId === MY_STORY_ID ? i18n('Stories__mine') : section.story.name;

  return (
    <div className="module-SafetyNumberChangeDialog__section">
      <div className="module-SafetyNumberChangeDialog__row">
        <div className="module-SafetyNumberChangeDialog__row__story-name">
          {sectionName}
        </div>
        {distributionId && removeFromStory && uuids.length > 1 && (
          <SectionButtonWithMenu
            ariaLabel={i18n('safetyNumberChangeDialog__actions-story', {
              story: sectionName,
            })}
            i18n={i18n}
            memberCount={uuids.length}
            storyName={sectionName}
            theme={theme}
            removeFromStory={() => {
              removeFromStory(distributionId, uuids);
            }}
          />
        )}
      </div>
      <ul className="module-SafetyNumberChangeDialog__contacts">
        {section.contacts.map((contact: ConversationType) => {
          const shouldShowNumber = Boolean(contact.name || contact.profileName);

          return (
            <ContactRow
              key={contact.id}
              contact={contact}
              distributionId={distributionId}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              removeFromStory={removeFromStory}
              setSelectedContact={setSelectedContact}
              shouldShowNumber={shouldShowNumber}
              theme={theme}
            />
          );
        })}
      </ul>
    </div>
  );
}

function SectionButtonWithMenu({
  ariaLabel,
  i18n,
  removeFromStory,
  storyName,
  memberCount,
  theme,
}: Readonly<{
  ariaLabel: string;
  i18n: LocalizerType;
  removeFromStory: () => unknown;
  storyName: string;
  memberCount: number;
  theme: ThemeType;
}>) {
  const [isConfirming, setIsConfirming] = React.useState<boolean>(false);

  return (
    <>
      <ContextMenu
        ariaLabel={ariaLabel}
        i18n={i18n}
        menuOptions={[
          {
            icon: 'module-SafetyNumberChangeDialog__menu-icon--delete',
            label: i18n('safetyNumberChangeDialog__remove-all'),
            onClick: () => setIsConfirming(true),
          },
        ]}
        moduleClassName="module-SafetyNumberChangeDialog__row__chevron"
        theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
      />
      {isConfirming && (
        <ConfirmationDialog
          key="SafetyNumberChangeDialog.confirm-remove-all"
          dialogName="SafetyNumberChangeDialog.confirm-remove-all"
          actions={[
            {
              action: () => {
                removeFromStory();
                setIsConfirming(false);
              },
              text: i18n('safetyNumberChangeDialog__remove-all'),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          noMouseClose
          onCancel={() => setIsConfirming(false)}
          onClose={noop}
        >
          {i18n('icu:safetyNumberChangeDialog__confirm-remove-all', {
            story: storyName,
            count: memberCount,
          })}
        </ConfirmationDialog>
      )}
    </>
  );
}

function ContactRow({
  contact,
  distributionId,
  getPreferredBadge,
  i18n,
  removeFromStory,
  setSelectedContact,
  shouldShowNumber,
  theme,
}: Readonly<{
  contact: ConversationType;
  distributionId?: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  removeFromStory?: (
    distributionId: string,
    uuids: Array<UUIDStringType>
  ) => unknown;
  setSelectedContact: (contact: ConversationType) => void;
  shouldShowNumber: boolean;
  theme: ThemeType;
}>) {
  const { uuid } = contact;

  return (
    <li className="module-SafetyNumberChangeDialog__row" key={contact.id}>
      <Avatar
        acceptedMessageRequest={contact.acceptedMessageRequest}
        avatarPath={contact.avatarPath}
        badge={getPreferredBadge(contact.badges)}
        color={contact.color}
        conversationType="direct"
        i18n={i18n}
        isMe={contact.isMe}
        phoneNumber={contact.phoneNumber}
        profileName={contact.profileName}
        theme={theme}
        title={contact.title}
        sharedGroupNames={contact.sharedGroupNames}
        size={36}
        unblurredAvatarPath={contact.unblurredAvatarPath}
      />
      <div className="module-SafetyNumberChangeDialog__row--wrapper">
        <div className="module-SafetyNumberChangeDialog__row--name">
          {contact.title}
          {isInSystemContacts(contact) && (
            <span>
              {' '}
              <InContactsIcon i18n={i18n} />
            </span>
          )}
        </div>
        {shouldShowNumber || contact.isVerified ? (
          <div className="module-SafetyNumberChangeDialog__row--subtitle">
            {shouldShowNumber && (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                {contact.phoneNumber}
              </span>
            )}
            {shouldShowNumber && contact.isVerified && (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                &nbsp;&middot;&nbsp;
              </span>
            )}
            {contact.isVerified && (
              <span className="module-SafetyNumberChangeDialog__rtl-span">
                {i18n('verified')}
              </span>
            )}
          </div>
        ) : null}
      </div>
      {distributionId && removeFromStory && uuid ? (
        <RowButtonWithMenu
          ariaLabel={i18n('safetyNumberChangeDialog__actions-contact', {
            contact: contact.title,
          })}
          i18n={i18n}
          theme={theme}
          removeFromStory={() => removeFromStory(distributionId, [uuid])}
          verifyContact={() => setSelectedContact(contact)}
        />
      ) : (
        <button
          className="module-SafetyNumberChangeDialog__row__view"
          onClick={() => {
            setSelectedContact(contact);
          }}
          tabIndex={0}
          type="button"
        >
          {i18n('view')}
        </button>
      )}
    </li>
  );
}

function RowButtonWithMenu({
  ariaLabel,
  i18n,
  removeFromStory,
  verifyContact,
  theme,
}: Readonly<{
  ariaLabel: string;
  i18n: LocalizerType;
  removeFromStory: () => unknown;
  verifyContact: () => unknown;
  theme: ThemeType;
}>) {
  return (
    <ContextMenu
      ariaLabel={ariaLabel}
      i18n={i18n}
      menuOptions={[
        {
          icon: 'module-SafetyNumberChangeDialog__menu-icon--verify',
          label: i18n('safetyNumberChangeDialog__verify-number'),
          onClick: verifyContact,
        },
        {
          icon: 'module-SafetyNumberChangeDialog__menu-icon--delete',
          label: i18n('safetyNumberChangeDialog__remove'),
          onClick: removeFromStory,
        },
      ]}
      moduleClassName="module-SafetyNumberChangeDialog__row__chevron"
      theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
    />
  );
}
