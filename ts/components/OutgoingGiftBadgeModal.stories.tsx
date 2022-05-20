// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './OutgoingGiftBadgeModal';
import { OutgoingGiftBadgeModal } from './OutgoingGiftBadgeModal';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { BadgeCategory } from '../badges/BadgeCategory';

const i18n = setupI18n('en', enMessages);

const getPreferredBadge = () => ({
  category: BadgeCategory.Donor,
  descriptionTemplate: 'This is a description of the badge',
  id: 'BOOST-3',
  images: [
    {
      transparent: {
        localPath: '/fixtures/orange-heart.svg',
        url: 'http://someplace',
      },
    },
  ],
  name: 'heart',
});

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  recipientTitle: text(
    'recipientTitle',
    overrideProps.recipientTitle || 'Default Name'
  ),
  badgeId: text('badgeId', overrideProps.badgeId || 'heart'),
  getPreferredBadge,
  hideOutgoingGiftBadgeModal: action('hideOutgoingGiftBadgeModal'),
  i18n,
});

const story = storiesOf('Components/OutgoingGiftBadgeModal', module);

story.add('Normal', () => {
  return <OutgoingGiftBadgeModal {...createProps()} />;
});

story.add('Missing badge', () => {
  const props = {
    ...createProps(),
    getPreferredBadge: () => undefined,
  };

  return <OutgoingGiftBadgeModal {...props} />;
});
