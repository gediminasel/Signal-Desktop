// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import formatFileSize from 'filesize';

import { isBeta } from '../util/version';
import { DialogType } from '../types/Dialogs';
import type { LocalizerType } from '../types/Util';
import { Intl } from './Intl';
import { LeftPaneDialog } from './LeftPaneDialog';
import type { WidthBreakpoint } from './_util';

export type PropsType = {
  containerWidthBreakpoint: WidthBreakpoint;
  dialogType: DialogType;
  dismissDialog: () => void;
  downloadSize?: number;
  downloadedSize?: number;
  i18n: LocalizerType;
  snoozeUpdate: () => void;
  startUpdate: () => void;
  version?: string;
  currentVersion: string;
};

const PRODUCTION_DOWNLOAD_URL = 'https://signal.org/download/';
const BETA_DOWNLOAD_URL = 'https://support.signal.org/beta';

export function DialogUpdate({
  containerWidthBreakpoint,
  dialogType,
  dismissDialog,
  downloadSize,
  downloadedSize,
  i18n,
  snoozeUpdate,
  startUpdate,
  version,
  currentVersion,
}: PropsType): JSX.Element | null {
  if (dialogType === DialogType.Cannot_Update) {
    const url = isBeta(currentVersion)
      ? BETA_DOWNLOAD_URL
      : PRODUCTION_DOWNLOAD_URL;
    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        title={i18n('cannotUpdate')}
      >
        <span>
          <Intl
            components={{
              retry: (
                <button
                  className="LeftPaneDialog__retry"
                  key="signal-retry"
                  onClick={startUpdate}
                  type="button"
                >
                  {i18n('autoUpdateRetry')}
                </button>
              ),
              url: (
                <a
                  key="signal-download"
                  href={url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {url}
                </a>
              ),
              support: (
                <a
                  key="signal-support"
                  href="https://support.signal.org/hc/en-us/requests/new?desktop"
                  rel="noreferrer"
                  target="_blank"
                >
                  {i18n('autoUpdateContactSupport')}
                </a>
              ),
            }}
            i18n={i18n}
            id="cannotUpdateDetail"
          />
        </span>
      </LeftPaneDialog>
    );
  }

  if (dialogType === DialogType.Cannot_Update_Require_Manual) {
    const url = isBeta(currentVersion)
      ? BETA_DOWNLOAD_URL
      : PRODUCTION_DOWNLOAD_URL;
    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        type="warning"
        title={i18n('cannotUpdate')}
      >
        <span>
          <Intl
            components={{
              url: (
                <a
                  key="signal-download"
                  href={url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {url}
                </a>
              ),
              support: (
                <a
                  key="signal-support"
                  href="https://support.signal.org/hc/en-us/requests/new?desktop"
                  rel="noreferrer"
                  target="_blank"
                >
                  {i18n('autoUpdateContactSupport')}
                </a>
              ),
            }}
            i18n={i18n}
            id="cannotUpdateRequireManualDetail"
          />
        </span>
      </LeftPaneDialog>
    );
  }

  if (dialogType === DialogType.MacOS_Read_Only) {
    return (
      <LeftPaneDialog
        closeLabel={i18n('close')}
        containerWidthBreakpoint={containerWidthBreakpoint}
        hasXButton
        onClose={dismissDialog}
        title={i18n('cannotUpdate')}
        type="warning"
      >
        <span>
          <Intl
            components={{
              app: <strong key="app">Signal.app</strong>,
              folder: <strong key="folder">/Applications</strong>,
            }}
            i18n={i18n}
            id="readOnlyVolume"
          />
        </span>
      </LeftPaneDialog>
    );
  }

  if (dialogType === DialogType.UnsupportedOS) {
    // Displayed as UnsupportedOSDialog in LeftPane
    return null;
  }

  const versionTitle = version
    ? i18n('DialogUpdate--version-available', [version])
    : undefined;

  if (dialogType === DialogType.Downloading) {
    const width = Math.ceil(
      ((downloadedSize || 1) / (downloadSize || 1)) * 100
    );

    return (
      <LeftPaneDialog
        containerWidthBreakpoint={containerWidthBreakpoint}
        icon="update"
        title={i18n('icu:DialogUpdate__downloading')}
        hoverText={versionTitle}
      >
        <div className="LeftPaneDialog__progress--container">
          <div
            className="LeftPaneDialog__progress--bar"
            style={{ transform: `translateX(${width - 100}%)` }}
          />
        </div>
      </LeftPaneDialog>
    );
  }

  let title = i18n('autoUpdateNewVersionTitle');

  if (
    downloadSize &&
    (dialogType === DialogType.DownloadReady ||
      dialogType === DialogType.FullDownloadReady)
  ) {
    title += ` (${formatFileSize(downloadSize, { round: 0 })})`;
  }

  let clickLabel = i18n('autoUpdateNewVersionMessage');
  let type: 'warning' | undefined;
  if (dialogType === DialogType.DownloadReady) {
    clickLabel = i18n('downloadNewVersionMessage');
  } else if (dialogType === DialogType.FullDownloadReady) {
    clickLabel = i18n('downloadFullNewVersionMessage');
    type = 'warning';
  } else if (dialogType === DialogType.DownloadedUpdate) {
    title = i18n('icu:DialogUpdate__downloaded');
  }

  return (
    <LeftPaneDialog
      containerWidthBreakpoint={containerWidthBreakpoint}
      icon="update"
      type={type}
      title={title}
      hoverText={versionTitle}
      hasAction
      onClick={startUpdate}
      clickLabel={clickLabel}
      hasXButton
      onClose={snoozeUpdate}
      closeLabel={i18n('autoUpdateIgnoreButtonLabel')}
    />
  );
}
