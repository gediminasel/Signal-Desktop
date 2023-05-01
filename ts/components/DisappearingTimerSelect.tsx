// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback, useState, useMemo } from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../types/Util';
import * as expirationTimer from '../util/expirationTimer';
import { DurationInSeconds } from '../util/durations';
import { DisappearingTimeDialog } from './DisappearingTimeDialog';

import { Select } from './Select';

const CSS_MODULE = 'module-disappearing-timer-select';

export type Props = {
  i18n: LocalizerType;

  value?: DurationInSeconds;
  onChange(value: DurationInSeconds): void;
};

export function DisappearingTimerSelect(props: Props): JSX.Element {
  const { i18n, value = DurationInSeconds.ZERO, onChange } = props;

  const [isModalOpen, setIsModalOpen] = useState(false);

  let expirationTimerOptions: ReadonlyArray<{
    readonly value: DurationInSeconds;
    readonly text: string;
  }> = useMemo(() => {
    return expirationTimer.DEFAULT_DURATIONS_IN_SECONDS.map(seconds => {
      const text = expirationTimer.format(i18n, seconds, {
        capitalizeOff: true,
      });
      return {
        value: seconds,
        text,
      };
    });
  }, [i18n]);

  const isCustomTimeSelected =
    !expirationTimer.DEFAULT_DURATIONS_SET.has(value);

  const onSelectChange = useCallback(
    (newValue: string) => {
      const intValue = DurationInSeconds.fromSeconds(parseInt(newValue, 10));
      if (intValue === -1) {
        // On Windows we get "change" event followed by "click" (even if
        // the <option/> was selected with keyboard. This click unfortunately
        // closes the modal so we need to delay opening it until after the
        // "click" event.
        setTimeout(() => setIsModalOpen(true), 0);
      } else {
        onChange(intValue);
      }
    },
    [onChange]
  );

  // Custom time...
  expirationTimerOptions = [
    ...expirationTimerOptions,
    {
      value: DurationInSeconds.fromSeconds(-1),
      text: isCustomTimeSelected
        ? i18n('icu:selectedCustomDisappearingTimeOption')
        : i18n('icu:customDisappearingTimeOption'),
    },
  ];

  let modalNode: ReactNode = null;
  if (isModalOpen) {
    modalNode = (
      <DisappearingTimeDialog
        i18n={i18n}
        initialValue={value}
        onSubmit={newValue => {
          setIsModalOpen(false);
          onChange(newValue);
        }}
        onClose={() => setIsModalOpen(false)}
      />
    );
  }

  let info: ReactNode;
  if (isCustomTimeSelected) {
    info = (
      <div className={`${CSS_MODULE}__info`}>
        {expirationTimer.format(i18n, value)}
      </div>
    );
  }

  return (
    <div
      className={classNames(
        CSS_MODULE,
        isCustomTimeSelected ? `${CSS_MODULE}--custom-time` : false
      )}
    >
      <Select
        onChange={onSelectChange}
        value={isCustomTimeSelected ? -1 : value}
        options={expirationTimerOptions}
      />
      {info}
      {modalNode}
    </div>
  );
}
