// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable no-console */

import createDebug from 'debug';

import { Bootstrap } from '../bootstrap';

export const debug = createDebug('mock:benchmarks');

export { Bootstrap };
export { App } from '../playwright';

export const RUN_COUNT = process.env.RUN_COUNT
  ? parseInt(process.env.RUN_COUNT, 10)
  : 100;

export const GROUP_SIZE = process.env.GROUP_SIZE
  ? parseInt(process.env.GROUP_SIZE, 10)
  : 8;

export const DISCARD_COUNT = process.env.DISCARD_COUNT
  ? parseInt(process.env.DISCARD_COUNT, 10)
  : 5;

// Can happen if electron exits prematurely
process.on('unhandledRejection', reason => {
  console.error('Unhandled rejection:');
  console.error(reason);
  process.exit(1);
});
