// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import {
  ToastInternalError,
  ToastInternalErrorKind,
} from './ToastInternalError';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  i18n,
  onClose: action('onClose'),
  onShowDebugLog: action('onShowDebugLog'),
};

export default {
  title: 'Components/ToastInternalError',
};

export const ToastDecryptionError = (): JSX.Element => (
  <ToastInternalError
    kind={ToastInternalErrorKind.DecryptionError}
    deviceId={3}
    name="Someone Somewhere"
    {...defaultProps}
  />
);

ToastDecryptionError.story = {
  name: 'ToastDecryptionError',
};

export const ToastCDSMirroringError = (): JSX.Element => (
  <ToastInternalError
    kind={ToastInternalErrorKind.CDSMirroringError}
    {...defaultProps}
  />
);

ToastDecryptionError.story = {
  name: 'ToastCDSMirroringError',
};
