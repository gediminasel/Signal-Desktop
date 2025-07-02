// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { groupBy, orderBy } from 'lodash';
import { useMemo } from 'react';

import type { Reaction } from '../components/conversation/ReactionViewer';
import {
  isEmojiVariantValue,
  getEmojiVariantKeyByValue,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
  type EmojiVariantKey,
} from '../components/fun/data/emojis';
import { isNotNil } from './isNotNil';
import { useFunEmojiLocalizer } from '../components/fun/useFunEmojiLocalizer';

type ReactionWithEmojiData = Reaction & {
  short_name: string | undefined;
  short_names: Array<string>;
  sheet_x: number;
  sheet_y: number;
  variantKey: EmojiVariantKey;
};

export function useGroupedAndOrderedReactions(
  reactions: ReadonlyArray<Reaction> | undefined,
  groupByKey: string = 'variantKey'
): Array<Array<ReactionWithEmojiData>> {
  const emojiLocalization = useFunEmojiLocalizer();

  return useMemo(() => {
    if (!reactions || reactions.length === 0) {
      return [];
    }

    const reactionsWithEmojiData: Array<ReactionWithEmojiData> = reactions
      .map(reaction => {
        if (!isEmojiVariantValue(reaction.emoji)) {
          return undefined;
        }

        try {
          const variantKey = getEmojiVariantKeyByValue(reaction.emoji);
          const parentKey = getEmojiParentKeyByVariantKey(variantKey);
          const variant = getEmojiVariantByKey(variantKey);

          const shortName = emojiLocalization.getLocaleShortName(variantKey);

          return {
            ...reaction,
            short_name: shortName,
            short_names: [shortName].filter(isNotNil),
            variantKey,
            parentKey,
            sheet_x: variant.sheetX,
            sheet_y: variant.sheetY,
          };
        } catch {
          return undefined;
        }
      })
      .filter(isNotNil);

    const groupedReactions = Object.values(
      groupBy(reactionsWithEmojiData, groupByKey)
    ).map(groupedReaction =>
      orderBy(
        groupedReaction,
        [reaction => reaction.from.isMe, 'timestamp'],
        ['desc', 'desc']
      )
    );

    return orderBy(
      groupedReactions,
      ['length', ([{ timestamp }]) => timestamp],
      ['desc', 'desc']
    );
  }, [reactions, groupByKey, emojiLocalization]);
}
