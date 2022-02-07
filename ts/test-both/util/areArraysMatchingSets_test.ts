// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { areArraysMatchingSets } from '../../util/areArraysMatchingSets';

describe('areArraysMatchingSets', () => {
  it('returns true if arrays are both empty', () => {
    const left: Array<string> = [];
    const right: Array<string> = [];

    assert.isTrue(areArraysMatchingSets(left, right));
  });

  it('returns true if arrays are equal', () => {
    const left = [1, 2, 3];
    const right = [1, 2, 3];

    assert.isTrue(areArraysMatchingSets(left, right));
  });

  it('returns true if arrays are equal but out of order', () => {
    const left = [1, 2, 3];
    const right = [3, 1, 2];

    assert.isTrue(areArraysMatchingSets(left, right));
  });

  it('returns true if arrays are equal but one has duplicates', () => {
    const left = [1, 2, 3, 1];
    const right = [1, 2, 3];

    assert.isTrue(areArraysMatchingSets(left, right));
  });

  it('returns false if first array has missing elements', () => {
    const left = [1, 2];
    const right = [1, 2, 3];

    assert.isFalse(areArraysMatchingSets(left, right));
  });

  it('returns false if second array has missing elements', () => {
    const left = [1, 2, 3];
    const right = [1, 2];

    assert.isFalse(areArraysMatchingSets(left, right));
  });

  it('returns false if second array is empty', () => {
    const left = [1, 2, 3];
    const right: Array<number> = [];

    assert.isFalse(areArraysMatchingSets(left, right));
  });
});
