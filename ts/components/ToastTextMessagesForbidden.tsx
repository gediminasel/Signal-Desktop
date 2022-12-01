// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Toast } from './Toast';

type PropsType = {
  onClose: () => unknown;
};

export function ToastTextMessagesForbidden({
  onClose,
}: PropsType): JSX.Element {
  return <Toast onClose={onClose}>This group is for media only!</Toast>;
}
