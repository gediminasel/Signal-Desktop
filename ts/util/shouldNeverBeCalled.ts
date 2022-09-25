// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assertDev } from './assert';

export function shouldNeverBeCalled(..._args: ReadonlyArray<unknown>): void {
  assertDev(false, 'This should never be called. Doing nothing');
}

export async function asyncShouldNeverBeCalled(
  ..._args: ReadonlyArray<unknown>
): Promise<undefined> {
  shouldNeverBeCalled();

  return undefined;
}
