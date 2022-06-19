// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import enMessages from '../../_locales/en/messages.json';
import { AvatarColors } from '../types/Colors';
import type { PropsType } from './BetterAvatarBubble';
import { BetterAvatarBubble } from './BetterAvatarBubble';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  children: overrideProps.children,
  color: overrideProps.color,
  i18n,
  isSelected: Boolean(overrideProps.isSelected),
  onDelete: action('onDelete'),
  onSelect: action('onSelect'),
  style: overrideProps.style,
});

export default {
  title: 'Components/BetterAvatarBubble',
};

export const Children = (): JSX.Element => (
  <BetterAvatarBubble
    {...createProps({
      children: <div>HI</div>,
      color: AvatarColors[8],
    })}
  />
);

export const Selected = (): JSX.Element => (
  <BetterAvatarBubble
    {...createProps({
      color: AvatarColors[1],
      isSelected: true,
    })}
  />
);

export const Style = (): JSX.Element => (
  <BetterAvatarBubble
    {...createProps({
      style: {
        height: 120,
        width: 120,
      },
      color: AvatarColors[2],
    })}
  />
);
