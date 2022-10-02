// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ConversationType } from '../../../state/ducks/conversations';
import type { LocalizerType } from '../../../types/Util';
import { Avatar } from '../../Avatar';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';
import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';

type Props = {
  contactId: string;
  i18n: LocalizerType;
  groupsInCommon: Array<ConversationType>;
  toggleAddUserToAnotherGroupModal: (contactId?: string) => void;
};

export const ConversationDetailsGroups = ({
  contactId,
  i18n,
  groupsInCommon,
  toggleAddUserToAnotherGroupModal,
}: Props): JSX.Element => {
  const [showAllGroups, setShowAllGroups] = React.useState(false);

  const maxShownGroupCount = 5;
  const isMoreThanMaxShown = groupsInCommon.length - maxShownGroupCount > 1;
  const groupsToShow = showAllGroups
    ? groupsInCommon.length
    : maxShownGroupCount;

  return (
    <PanelSection
      title={i18n('ConversationDetailsGroups--title', {
        number: groupsInCommon.length,
      })}
    >
      <PanelRow
        icon={<div className="ConversationDetails-groups__add-to-group-icon" />}
        label={i18n('ConversationDetailsGroups--add-to-group')}
        onClick={() => toggleAddUserToAnotherGroupModal(contactId)}
      />
      {groupsInCommon.slice(0, groupsToShow).map(group => (
        <PanelRow
          key={group.id}
          icon={
            <Avatar
              conversationType="group"
              badge={undefined}
              i18n={i18n}
              size={32}
              {...group}
            />
          }
          label={group.title}
        />
      ))}
      {!showAllGroups && isMoreThanMaxShown && (
        <PanelRow
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('ConversationDetailsGroups--show-all')}
              icon={IconType.down}
            />
          }
          onClick={() => setShowAllGroups(true)}
          label={i18n('ConversationDetailsGroups--show-all')}
        />
      )}
    </PanelSection>
  );
};
