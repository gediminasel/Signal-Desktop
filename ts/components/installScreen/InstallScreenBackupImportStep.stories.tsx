// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../../util/setupI18n';
import { InstallScreenBackupStep } from '../../types/InstallScreen';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './InstallScreenBackupImportStep';
import { InstallScreenBackupImportStep } from './InstallScreenBackupImportStep';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/InstallScreenBackupImportStep',
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = (args: PropsType) => (
  <InstallScreenBackupImportStep
    {...args}
    i18n={i18n}
    onCancel={action('onCancel')}
    onRetry={action('onRetry')}
  />
);

export const NoBytes = Template.bind({});
NoBytes.args = {
  backupStep: InstallScreenBackupStep.Download,
  currentBytes: undefined,
  totalBytes: undefined,
};

export const Bytes = Template.bind({});
Bytes.args = {
  backupStep: InstallScreenBackupStep.Download,
  currentBytes: 500 * 1024,
  totalBytes: 1024 * 1024,
};

export const Full = Template.bind({});
Full.args = {
  backupStep: InstallScreenBackupStep.Download,
  currentBytes: 1024,
  totalBytes: 1024,
};

export const Error = Template.bind({});
Error.args = {
  backupStep: InstallScreenBackupStep.Download,
  currentBytes: 500 * 1024,
  totalBytes: 1024 * 1024,
  hasError: true,
};

export const Processing = Template.bind({});
Processing.args = {
  backupStep: InstallScreenBackupStep.Process,
  currentBytes: 500 * 1024,
  totalBytes: 1024 * 1024,
};
