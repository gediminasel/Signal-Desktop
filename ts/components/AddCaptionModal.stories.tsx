// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, Story } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import type { Props } from './AddCaptionModal';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea';
import { AddCaptionModal } from './AddCaptionModal';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import enMessages from '../../_locales/en/messages.json';
import { setupI18n } from '../util/setupI18n';
import { CompositionTextArea } from './CompositionTextArea';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/AddCaptionModal',
  component: AddCaptionModal,
  argTypes: {
    i18n: {
      defaultValue: i18n,
    },
    RenderCompositionTextArea: {
      defaultValue: (props: SmartCompositionTextAreaProps) => (
        <CompositionTextArea
          {...props}
          i18n={i18n}
          onPickEmoji={action('onPickEmoji')}
          onChange={action('onChange')}
          onTextTooLong={action('onTextTooLong')}
          onSetSkinTone={action('onSetSkinTone')}
          getPreferredBadge={() => undefined}
        />
      ),
    },
  },
} as Meta;

const Template: Story<Props> = args => (
  <AddCaptionModal {...args} theme={React.useContext(StorybookThemeContext)} />
);

export const Modal = Template.bind({});
Modal.args = {
  draftText: 'Some caption text',
};
