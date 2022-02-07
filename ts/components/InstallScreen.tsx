// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps, ReactElement } from 'react';
import React from 'react';

import { missingCaseError } from '../util/missingCaseError';
import { InstallScreenErrorStep } from './installScreen/InstallScreenErrorStep';
import { InstallScreenChoosingDeviceNameStep } from './installScreen/InstallScreenChoosingDeviceNameStep';
import { InstallScreenLinkInProgressStep } from './installScreen/InstallScreenLinkInProgressStep';
import { InstallScreenQrCodeNotScannedStep } from './installScreen/InstallScreenQrCodeNotScannedStep';

export enum InstallScreenStep {
  Error,
  QrCodeNotScanned,
  ChoosingDeviceName,
  LinkInProgress,
}

// We can't always use destructuring assignment because of the complexity of this props
//   type.
/* eslint-disable react/destructuring-assignment */
type PropsType =
  | {
      step: InstallScreenStep.Error;
      screenSpecificProps: ComponentProps<typeof InstallScreenErrorStep>;
    }
  | {
      step: InstallScreenStep.QrCodeNotScanned;
      screenSpecificProps: ComponentProps<
        typeof InstallScreenQrCodeNotScannedStep
      >;
    }
  | {
      step: InstallScreenStep.ChoosingDeviceName;
      screenSpecificProps: ComponentProps<
        typeof InstallScreenChoosingDeviceNameStep
      >;
    }
  | {
      step: InstallScreenStep.LinkInProgress;
      screenSpecificProps: ComponentProps<
        typeof InstallScreenLinkInProgressStep
      >;
    };

export function InstallScreen(props: Readonly<PropsType>): ReactElement {
  switch (props.step) {
    case InstallScreenStep.Error:
      return <InstallScreenErrorStep {...props.screenSpecificProps} />;
    case InstallScreenStep.QrCodeNotScanned:
      return (
        <InstallScreenQrCodeNotScannedStep {...props.screenSpecificProps} />
      );
    case InstallScreenStep.ChoosingDeviceName:
      return (
        <InstallScreenChoosingDeviceNameStep {...props.screenSpecificProps} />
      );
    case InstallScreenStep.LinkInProgress:
      return <InstallScreenLinkInProgressStep {...props.screenSpecificProps} />;
    default:
      throw missingCaseError(props);
  }
}
