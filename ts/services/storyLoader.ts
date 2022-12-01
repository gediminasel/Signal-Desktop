// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pick } from 'lodash';
import type { MessageAttributesType } from '../model-types.d';
import type { StoryDataType } from '../state/ducks/stories';
import * as durations from '../util/durations';
import * as log from '../logging/log';
import dataInterface from '../sql/Client';
import {
  getAttachmentsForMessage,
  getPropsForAttachment,
} from '../state/selectors/message';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import { isNotNil } from '../util/isNotNil';
import { strictAssert } from '../util/assert';
import { dropNull } from '../util/dropNull';
import { DurationInSeconds } from '../util/durations';
import { SIGNAL_ACI } from '../types/SignalConversation';

let storyData:
  | Array<
      MessageAttributesType & {
        hasReplies?: boolean;
        hasRepliesFromSelf?: boolean;
      }
    >
  | undefined;

export async function loadStories(): Promise<void> {
  const stories = await dataInterface.getAllStories({});

  storyData = await Promise.all(
    stories.map(async story => {
      const [hasReplies, hasRepliesFromSelf] = await Promise.all([
        dataInterface.hasStoryReplies(story.id),
        dataInterface.hasStoryRepliesFromSelf(story.id),
      ]);

      return {
        ...story,
        hasReplies,
        hasRepliesFromSelf,
      };
    })
  );

  await repairUnexpiredStories();
}

export function getStoryDataFromMessageAttributes(
  message: MessageAttributesType & {
    hasReplies?: boolean;
    hasRepliesFromSelf?: boolean;
  }
): StoryDataType | undefined {
  const { attachments, deletedForEveryone } = message;
  const unresolvedAttachment = attachments ? attachments[0] : undefined;
  if (!unresolvedAttachment && !deletedForEveryone) {
    log.warn(
      `getStoryDataFromMessageAttributes: ${message.id} does not have an attachment`
    );
    return;
  }

  let [attachment] =
    unresolvedAttachment && unresolvedAttachment.path
      ? getAttachmentsForMessage(message)
      : [unresolvedAttachment];

  let preview: LinkPreviewType | undefined;
  if (message.preview?.length) {
    strictAssert(
      message.preview.length === 1,
      'getStoryDataFromMessageAttributes: story can have only one preview'
    );
    [preview] = message.preview;

    strictAssert(
      attachment?.textAttachment,
      'getStoryDataFromMessageAttributes: story must have a ' +
        'textAttachment with preview'
    );
    attachment = {
      ...attachment,
      textAttachment: {
        ...attachment.textAttachment,
        preview: {
          ...preview,
          image: preview.image && getPropsForAttachment(preview.image),
        },
      },
    };
  } else if (attachment) {
    attachment = getPropsForAttachment(attachment);
  }

  return {
    attachment,
    messageId: message.id,
    ...pick(message, [
      'canReplyToStory',
      'conversationId',
      'deletedForEveryone',
      'hasReplies',
      'hasRepliesFromSelf',
      'reactions',
      'readAt',
      'readStatus',
      'sendStateByConversationId',
      'source',
      'sourceUuid',
      'storyDistributionListId',
      'storyRecipientsVersion',
      'timestamp',
      'type',
    ]),
    expireTimer: message.expireTimer,
    expirationStartTimestamp: dropNull(message.expirationStartTimestamp),
  };
}

export function getStoriesForRedux(): Array<StoryDataType> {
  strictAssert(storyData, 'storyData has not been loaded');

  const stories = storyData
    .map(getStoryDataFromMessageAttributes)
    .filter(isNotNil);

  storyData = undefined;

  return stories;
}

async function repairUnexpiredStories(): Promise<void> {
  strictAssert(storyData, 'Could not load stories');

  const DAY_AS_SECONDS = DurationInSeconds.fromDays(1);

  const storiesWithExpiry = storyData
    .filter(
      story =>
        story.sourceUuid !== SIGNAL_ACI &&
        (!story.expirationStartTimestamp ||
          !story.expireTimer ||
          story.expireTimer > DAY_AS_SECONDS)
    )
    .map(story => ({
      ...story,
      expirationStartTimestamp: Math.min(story.timestamp, Date.now()),
      expireTimer: DurationInSeconds.fromMillis(
        Math.min(
          Math.floor(story.timestamp + durations.DAY - Date.now()),
          durations.DAY
        )
      ),
    }));

  if (!storiesWithExpiry.length) {
    return;
  }

  log.info(
    'repairUnexpiredStories: repairing number of stories',
    storiesWithExpiry.length
  );

  await Promise.all(
    storiesWithExpiry.map(messageAttributes => {
      return window.Signal.Data.saveMessage(messageAttributes, {
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      });
    })
  );
}
