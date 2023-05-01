// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';

import type { OSType } from '../util/os/shared';
import { isProduction } from '../util/version';

const MIN_WINDOWS_VERSION = '8.0.0';

export enum AudioNotificationSupport {
  None,
  Native,
  Custom,
}

export function getAudioNotificationSupport(
  OS: OSType
): AudioNotificationSupport {
  if (OS.isWindows(MIN_WINDOWS_VERSION) || OS.isMacOS()) {
    return AudioNotificationSupport.Native;
  }
  if (OS.isLinux()) {
    return AudioNotificationSupport.Custom;
  }
  return AudioNotificationSupport.None;
}

export const isAudioNotificationSupported = (OS: OSType): boolean =>
  getAudioNotificationSupport(OS) !== AudioNotificationSupport.None;

// Using `Notification::tag` has a bug on Windows 7:
// https://github.com/electron/electron/issues/11189
export const isNotificationGroupingSupported = (OS: OSType): boolean =>
  !OS.isWindows() || OS.isWindows(MIN_WINDOWS_VERSION);

// Login item settings are only supported on macOS and Windows, according to [Electron's
//   docs][0].
// [0]: https://www.electronjs.org/docs/api/app#appsetloginitemsettingssettings-macos-windows
export const isAutoLaunchSupported = (OS: OSType): boolean =>
  OS.isWindows() || OS.isMacOS();

// the "hide menu bar" option is specific to Windows and Linux
export const isHideMenuBarSupported = (OS: OSType): boolean => !OS.isMacOS();

// the "draw attention on notification" option is specific to Windows and Linux
export const isDrawAttentionSupported = (OS: OSType): boolean => !OS.isMacOS();

/**
 * Returns `true` if you can minimize the app to the system tray. Users can override this
 * option with a command line flag, but that is not officially supported.
 */
export const isSystemTraySupported = (
  OS: OSType,
  appVersion: string
): boolean =>
  // We eventually want to support Linux in production.
  OS.isWindows() || (OS.isLinux() && !isProduction(appVersion));

// On Windows minimize and start in system tray is default when app is selected
// to launch at login, because we can provide `['--start-in-tray']` args.
export const isMinimizeToAndStartInSystemTraySupported = (
  OS: OSType,
  appVersion: string
): boolean => !OS.isWindows() && isSystemTraySupported(OS, appVersion);

export const isAutoDownloadUpdatesSupported = (OS: OSType): boolean =>
  OS.isWindows() || OS.isMacOS();

export const shouldHideExpiringMessageBody = (
  OS: OSType,
  release: string
): boolean => OS.isWindows() || (OS.isMacOS() && semver.lt(release, '21.1.0'));
