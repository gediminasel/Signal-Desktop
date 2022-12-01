// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

import { GroupTitleInput } from './GroupTitleInput';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/GroupTitleInput',
};

function Wrapper({
  disabled,
  startingValue = '',
}: {
  disabled?: boolean;
  startingValue?: string;
}) {
  const [value, setValue] = useState(startingValue);

  return (
    <GroupTitleInput
      disabled={disabled}
      i18n={i18n}
      onChangeValue={setValue}
      value={value}
    />
  );
}

export function Default(): JSX.Element {
  return <Wrapper />;
}

export function Disabled(): JSX.Element {
  return (
    <>
      <Wrapper disabled />
      <br />
      <Wrapper disabled startingValue="Has a value" />
    </>
  );
}
