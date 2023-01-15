// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';
import type {
  AttachmentWithHydratedData,
  TextAttachmentType,
} from '../../types/Attachment';
import type { ConversationModel } from '../../models/conversations';
import type {
  ConversationQueueJobBundle,
  StoryJobData,
} from '../conversationJobQueue';
import type { LoggerType } from '../../types/Logging';
import type { MessageModel } from '../../models/messages';
import type {
  SendState,
  SendStateByConversationId,
} from '../../messages/MessageSendState';
import {
  isSent,
  SendActionType,
  sendStateReducer,
} from '../../messages/MessageSendState';
import type { UUIDStringType } from '../../types/UUID';
import * as Errors from '../../types/errors';
import type { StoryMessageRecipientsType } from '../../types/Stories';
import dataInterface from '../../sql/Client';
import { SignalService as Proto } from '../../protobuf';
import { getMessagesById } from '../../messages/getMessagesById';
import {
  getSendOptions,
  getSendOptionsForRecipients,
} from '../../util/getSendOptions';
import { handleMessageSend } from '../../util/handleMessageSend';
import { handleMultipleSendErrors } from './handleMultipleSendErrors';
import { isGroupV2, isMe } from '../../util/whatTypeOfConversation';
import { ourProfileKeyService } from '../../services/ourProfileKey';
import { sendContentMessageToGroup } from '../../util/sendToGroup';
import { distributionListToSendTarget } from '../../util/distributionListToSendTarget';
import { SendMessageChallengeError } from '../../textsecure/Errors';

export async function sendStory(
  conversation: ConversationModel,
  {
    isFinalAttempt,
    messaging,
    shouldContinue,
    timeRemaining,
    log,
  }: ConversationQueueJobBundle,
  data: StoryJobData
): Promise<void> {
  const { messageIds, timestamp } = data;

  const profileKey = await ourProfileKeyService.get();

  if (!profileKey) {
    log.info('stories.sendStory: no profile key cannot send');
    return;
  }

  // We can send a story to either:
  //   1) the current group, or
  //   2) all selected distribution lists (in queue for our own conversationId)
  if (!isGroupV2(conversation.attributes) && !isMe(conversation.attributes)) {
    log.error(
      'stories.sendStory: Conversation is neither groupV2 nor our own. Cannot send.'
    );
    return;
  }

  const notFound = new Set(messageIds);
  const messages = (await getMessagesById(messageIds)).filter(message => {
    notFound.delete(message.id);

    const distributionId = message.get('storyDistributionListId');
    const logId = `stories.sendStory(${timestamp}/${distributionId})`;

    const messageConversation = message.getConversation();
    if (messageConversation !== conversation) {
      log.error(
        `${logId}: Message conversation ` +
          `'${messageConversation?.idForLogging()}' does not match job ` +
          `conversation ${conversation.idForLogging()}`
      );
      return false;
    }

    if (message.get('timestamp') !== timestamp) {
      log.error(
        `${logId}: Message timestamp ${message.get(
          'timestamp'
        )} does not match job timestamp`
      );
      return false;
    }

    if (message.isErased() || message.get('deletedForEveryone')) {
      log.info(`${logId}: message was erased. Giving up on sending it`);
      return false;
    }

    return true;
  });

  for (const messageId of notFound) {
    log.info(
      `stories.sendStory(${messageId}): message was not found, ` +
        'maybe because it was deleted. Giving up on sending it'
    );
  }

  // We want to generate the StoryMessage proto once at the top level so we
  // can reuse it but first we'll need textAttachment | fileAttachment.
  // This function pulls off the attachment and generates the proto from the
  // first message on the list prior to continuing.
  let originalStoryMessage: Proto.StoryMessage;
  {
    const [originalMessageId] = messageIds;
    const originalMessage = messages.find(
      message => message.id === originalMessageId
    );
    if (!originalMessage) {
      return;
    }

    const attachments = originalMessage.get('attachments') || [];
    const [attachment] = attachments;

    if (!attachment) {
      log.info(
        `stories.sendStory(${timestamp}): original story message does not ` +
          'have any attachments to send. Giving up on sending it'
      );
      return;
    }

    let textAttachment: TextAttachmentType | undefined;
    let fileAttachment: AttachmentWithHydratedData | undefined;

    if (attachment.textAttachment) {
      textAttachment = attachment.textAttachment;
    } else {
      fileAttachment = await window.Signal.Migrations.loadAttachmentData(
        attachment
      );
    }

    const groupV2 = isGroupV2(conversation.attributes)
      ? conversation.getGroupV2Info()
      : undefined;

    // Some distribution lists need allowsReplies false, some need it set to true
    // we create this proto (for the sync message) and also to re-use some of the
    // attributes inside it.
    originalStoryMessage = await messaging.getStoryMessage({
      allowsReplies: true,
      fileAttachment,
      groupV2,
      textAttachment,
      profileKey,
    });
  }

  const canReplyUuids = new Set<string>();
  const recipientsByUuid = new Map<string, Set<string>>();
  const sentConversationIds = new Map<string, SendState>();
  const sentUuids = new Set<string>();

  // This function is used to keep track of all the recipients so once we're
  // done with our send we can build up the storyMessageRecipients object for
  // sending in the sync message.
  function addDistributionListToUuidSent(
    listId: string | undefined,
    uuid: string,
    canReply?: boolean
  ): void {
    if (conversation.get('uuid') === uuid) {
      return;
    }

    const distributionListIds = recipientsByUuid.get(uuid) || new Set<string>();

    if (listId) {
      recipientsByUuid.set(uuid, new Set([...distributionListIds, listId]));
    } else {
      recipientsByUuid.set(uuid, distributionListIds);
    }

    if (canReply) {
      canReplyUuids.add(uuid);
    }
  }

  let isSyncMessageUpdate = false;

  // Note: We capture errors here so we are sure to wait for every send process to
  //   complete, and so we can send a sync message afterwards if we sent the story
  //   successfully to at least one recipient.
  const sendResults = await Promise.allSettled(
    messages.map(async (message: MessageModel): Promise<void> => {
      const distributionId = message.get('storyDistributionListId');
      const logId = `stories.sendStory(${timestamp}/${distributionId})`;

      const listId = message.get('storyDistributionListId');
      const receiverId = isGroupV2(conversation.attributes)
        ? conversation.id
        : listId;

      if (!receiverId) {
        log.info(
          `${logId}: did not get a valid recipient ID for message. Giving up on sending it`
        );
        return;
      }

      const distributionList = isGroupV2(conversation.attributes)
        ? undefined
        : await dataInterface.getStoryDistributionWithMembers(receiverId);

      let messageSendErrors: Array<Error> = [];

      // We don't want to save errors on messages unless we're giving up. If it's our
      //   final attempt, we know upfront that we want to give up. However, we might also
      //   want to give up if (1) we get a 508 from the server, asking us to please stop
      //   (2) we get a 428 from the server, flagging the message for spam (3) some other
      //   reason not known at the time of this writing.
      //
      // This awkward callback lets us hold onto errors we might want to save, so we can
      //   decide whether to save them later on.
      const saveErrors = isFinalAttempt
        ? undefined
        : (errors: Array<Error>) => {
            messageSendErrors = errors;
          };

      if (!shouldContinue) {
        log.info(`${logId}: ran out of time. Giving up on sending it`);
        await markMessageFailed(message, [
          new Error('Message send ran out of time'),
        ]);
        return;
      }

      let originalError: Error | undefined;

      const {
        allRecipientIds,
        allowedReplyByUuid,
        pendingSendRecipientIds,
        sentRecipientIds,
        untrustedUuids,
      } = getMessageRecipients({
        log,
        message,
      });

      try {
        if (untrustedUuids.length) {
          window.reduxActions.conversations.conversationStoppedByMissingVerification(
            {
              conversationId: conversation.id,
              distributionId,
              untrustedUuids,
            }
          );
          throw new Error(
            `${logId}: sending blocked because ${untrustedUuids.length} conversation(s) were untrusted. Failing this attempt.`
          );
        }

        if (!pendingSendRecipientIds.length) {
          allRecipientIds.forEach(uuid =>
            addDistributionListToUuidSent(
              listId,
              uuid,
              allowedReplyByUuid.get(uuid)
            )
          );
          return;
        }

        const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

        const sendOptions = await getSendOptionsForRecipients(
          pendingSendRecipientIds,
          { story: true }
        );

        log.info(
          `stories.sendStory(${timestamp}): sending story to ${receiverId}`
        );

        const storyMessage = new Proto.StoryMessage();
        storyMessage.profileKey = originalStoryMessage.profileKey;
        storyMessage.fileAttachment = originalStoryMessage.fileAttachment;
        storyMessage.textAttachment = originalStoryMessage.textAttachment;
        storyMessage.group = originalStoryMessage.group;
        storyMessage.allowsReplies =
          isGroupV2(conversation.attributes) ||
          Boolean(distributionList?.allowsReplies);

        const sendTarget = distributionList
          ? distributionListToSendTarget(
              distributionList,
              pendingSendRecipientIds
            )
          : conversation.toSenderKeyTarget();

        const contentMessage = new Proto.Content();
        contentMessage.storyMessage = storyMessage;

        const innerPromise = sendContentMessageToGroup({
          contentHint: ContentHint.IMPLICIT,
          contentMessage,
          isPartialSend: false,
          messageId: undefined,
          recipients: pendingSendRecipientIds,
          sendOptions,
          sendTarget,
          sendType: 'story',
          story: true,
          timestamp: message.get('timestamp'),
          urgent: false,
        });

        // Don't send normal sync messages; a story sync is sent at the end of the process
        // eslint-disable-next-line no-param-reassign
        message.doNotSendSyncMessage = true;

        const messageSendPromise = message.send(
          handleMessageSend(innerPromise, {
            messageIds: [message.id],
            sendType: 'story',
          }),
          saveErrors
        );

        // Because message.send swallows and processes errors, we'll await the
        // inner promise to get the SendMessageProtoError, which gives us
        // information upstream processors need to detect certain kinds of situations.
        try {
          await innerPromise;
        } catch (error) {
          if (error instanceof Error) {
            originalError = error;
          } else {
            log.error(
              `${logId}: promiseForError threw something other than an error: ${Errors.toLogFormat(
                error
              )}`
            );
          }
        }

        await messageSendPromise;

        // Track sendState across message sends so that we can update all
        // subsequent messages.
        const sendStateByConversationId =
          message.get('sendStateByConversationId') || {};
        Object.entries(sendStateByConversationId).forEach(
          ([recipientConversationId, sendState]) => {
            if (!isSent(sendState.status)) {
              return;
            }

            sentConversationIds.set(recipientConversationId, sendState);

            const recipient = window.ConversationController.get(
              recipientConversationId
            );
            const uuid = recipient?.get('uuid');
            if (!uuid) {
              return;
            }
            sentUuids.add(uuid);
          }
        );

        allRecipientIds.forEach(uuid => {
          addDistributionListToUuidSent(
            listId,
            uuid,
            allowedReplyByUuid.get(uuid)
          );
        });

        const didFullySend =
          !messageSendErrors.length || didSendToEveryone(message);
        if (!didFullySend) {
          throw new Error(`${logId}: message did not fully send`);
        }
      } catch (thrownError: unknown) {
        const errors = [thrownError, ...messageSendErrors];

        // We need to check for this here because we can only throw one error up to
        //   conversationJobQueue.
        errors.forEach(error => {
          if (error instanceof SendMessageChallengeError) {
            void window.Signal.challengeHandler?.register(
              {
                conversationId: conversation.id,
                createdAt: Date.now(),
                retryAt: error.retryAt,
                token: error.data?.token,
                reason:
                  'conversationJobQueue.run(' +
                  `${conversation.idForLogging()}, story, ${timestamp}/${distributionId})`,
              },
              error.data
            );
          }
        });

        await handleMultipleSendErrors({
          errors,
          isFinalAttempt,
          log,
          markFailed: () => markMessageFailed(message, messageSendErrors),
          timeRemaining,
          // In the case of a failed group send thrownError will not be
          // SentMessageProtoError, but we should have been able to harvest
          // the original error. In the Note to Self send case, thrownError
          // will be the error we care about, and we won't have an originalError.
          toThrow: originalError || thrownError,
        });
      } finally {
        isSyncMessageUpdate = sentRecipientIds.length > 0;
      }
    })
  );

  // Some contacts are duplicated across lists and we don't send duplicate
  // messages but we still want to make sure that the sendStateByConversationId
  // is kept in sync across all messages.
  await Promise.all(
    messages.map(async message => {
      const oldSendStateByConversationId =
        message.get('sendStateByConversationId') || {};

      const newSendStateByConversationId = Object.keys(
        oldSendStateByConversationId
      ).reduce((acc, conversationId) => {
        const sendState = sentConversationIds.get(conversationId);
        if (sendState) {
          return {
            ...acc,
            [conversationId]: sendState,
          };
        }

        const oldSendState = {
          ...oldSendStateByConversationId[conversationId],
        };
        if (!oldSendState) {
          return acc;
        }

        const recipient = window.ConversationController.get(conversationId);
        if (!recipient) {
          return acc;
        }

        if (isMe(recipient.attributes)) {
          return acc;
        }

        if (recipient.isEverUnregistered()) {
          if (!isSent(oldSendState.status)) {
            // We should have filtered this out on initial send, but we'll drop them from
            //   send list here if needed.
            return acc;
          }

          // If a previous send to them did succeed, we'll keep that status around
          return {
            ...acc,
            [conversationId]: oldSendState,
          };
        }

        return {
          ...acc,
          [conversationId]: sendStateReducer(oldSendState, {
            type: SendActionType.Failed,
            updatedAt: Date.now(),
          }),
        };
      }, {} as SendStateByConversationId);

      if (isEqual(oldSendStateByConversationId, newSendStateByConversationId)) {
        return;
      }

      message.set('sendStateByConversationId', newSendStateByConversationId);
      return window.Signal.Data.saveMessage(message.attributes, {
        ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
      });
    })
  );

  // Remove any unsent recipients
  recipientsByUuid.forEach((_value, uuid) => {
    if (sentUuids.has(uuid)) {
      return;
    }

    recipientsByUuid.delete(uuid);
  });

  // Build up the sync message's storyMessageRecipients and send it
  const storyMessageRecipients: StoryMessageRecipientsType = [];
  recipientsByUuid.forEach((distributionListIds, destinationUuid) => {
    storyMessageRecipients.push({
      destinationUuid,
      distributionListIds: Array.from(distributionListIds),
      isAllowedToReply: canReplyUuids.has(destinationUuid),
    });
  });

  if (storyMessageRecipients.length === 0) {
    log.warn(
      'No successful sends; will not send a sync message for this attempt'
    );
  } else {
    const options = await getSendOptions(conversation.attributes, {
      syncMessage: true,
    });

    await messaging.sendSyncMessage({
      // Note: these two fields will be undefined if we're sending to a group
      destination: conversation.get('e164'),
      destinationUuid: conversation.get('uuid'),
      storyMessage: originalStoryMessage,
      storyMessageRecipients,
      expirationStartTimestamp: null,
      isUpdate: isSyncMessageUpdate,
      options,
      timestamp,
      urgent: false,
    });
  }

  // We can only throw one Error up to conversationJobQueue to fail the send
  const sendErrors: Array<PromiseRejectedResult> = [];
  sendResults.forEach(result => {
    if (result.status === 'rejected') {
      sendErrors.push(result);
    }
  });
  if (sendErrors.length) {
    throw sendErrors[0].reason;
  }
}

function getMessageRecipients({
  log,
  message,
}: Readonly<{
  log: LoggerType;
  message: MessageModel;
}>): {
  allRecipientIds: Array<string>;
  allowedReplyByUuid: Map<string, boolean>;
  pendingSendRecipientIds: Array<string>;
  sentRecipientIds: Array<string>;
  untrustedUuids: Array<UUIDStringType>;
} {
  const allRecipientIds: Array<string> = [];
  const allowedReplyByUuid = new Map<string, boolean>();
  const pendingSendRecipientIds: Array<string> = [];
  const sentRecipientIds: Array<string> = [];
  const untrustedUuids: Array<UUIDStringType> = [];

  Object.entries(message.get('sendStateByConversationId') || {}).forEach(
    ([recipientConversationId, sendState]) => {
      const recipient = window.ConversationController.get(
        recipientConversationId
      );
      if (!recipient) {
        return;
      }

      const isRecipientMe = isMe(recipient.attributes);
      if (isRecipientMe) {
        return;
      }

      if (recipient.isUntrusted()) {
        const uuid = recipient.get('uuid');
        if (!uuid) {
          log.error(
            `stories.sendStory/getMessageRecipients: Untrusted conversation ${recipient.idForLogging()} missing UUID.`
          );
          return;
        }
        untrustedUuids.push(uuid);
        return;
      }
      if (recipient.isUnregistered()) {
        return;
      }

      const recipientSendTarget = recipient.getSendTarget();
      if (!recipientSendTarget) {
        return;
      }

      allowedReplyByUuid.set(
        recipientSendTarget,
        Boolean(sendState.isAllowedToReplyToStory)
      );
      allRecipientIds.push(recipientSendTarget);

      if (sendState.isAlreadyIncludedInAnotherDistributionList) {
        return;
      }

      if (isSent(sendState.status)) {
        sentRecipientIds.push(recipientSendTarget);
        return;
      }

      pendingSendRecipientIds.push(recipientSendTarget);
    }
  );

  return {
    allRecipientIds,
    allowedReplyByUuid,
    pendingSendRecipientIds,
    sentRecipientIds,
    untrustedUuids,
  };
}

async function markMessageFailed(
  message: MessageModel,
  errors: Array<Error>
): Promise<void> {
  message.markFailed();
  void message.saveErrors(errors, { skipSave: true });
  await window.Signal.Data.saveMessage(message.attributes, {
    ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
  });
}

function didSendToEveryone(message: Readonly<MessageModel>): boolean {
  const sendStateByConversationId =
    message.get('sendStateByConversationId') || {};
  return Object.values(sendStateByConversationId).every(
    sendState =>
      sendState.isAlreadyIncludedInAnotherDistributionList ||
      isSent(sendState.status)
  );
}
