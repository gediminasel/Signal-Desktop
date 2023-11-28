// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';

import type { MessageModel } from '../models/messages';
import type { MessageAttributesType } from '../model-types.d';
import type { SendStateByConversationId } from '../messages/MessageSendState';
import { isOutgoing, isStory } from '../state/selectors/message';
import { getOwn } from '../util/getOwn';
import { missingCaseError } from '../util/missingCaseError';
import { createWaitBatcher } from '../util/waitBatcher';
import type { ServiceIdString } from '../types/ServiceId';
import * as Errors from '../types/errors';
import {
  SendActionType,
  SendStatus,
  sendStateReducer,
} from '../messages/MessageSendState';
import type { DeleteSentProtoRecipientOptionsType } from '../sql/Interface';
import dataInterface from '../sql/Client';
import * as log from '../logging/log';
import { getSourceServiceId } from '../messages/helpers';
import { queueUpdateMessage } from '../util/messageBatcher';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp';
import { getMessageIdForLogging } from '../util/idForLogging';
import { generateCacheKey } from './generateCacheKey';

const { deleteSentProtoRecipient } = dataInterface;

export enum MessageReceiptType {
  Delivery = 'Delivery',
  Read = 'Read',
  View = 'View',
}

export type MessageReceiptAttributesType = {
  envelopeId: string;
  messageSentAt: number;
  receiptTimestamp: number;
  removeFromMessageReceiverCache: () => unknown;
  sourceConversationId: string;
  sourceDevice: number;
  sourceServiceId: ServiceIdString;
  type: MessageReceiptType;
  wasSentEncrypted: boolean;
};

const receipts = new Map<string, MessageReceiptAttributesType>();

const deleteSentProtoBatcher = createWaitBatcher({
  name: 'deleteSentProtoBatcher',
  wait: 250,
  maxSize: 30,
  async processBatch(items: Array<DeleteSentProtoRecipientOptionsType>) {
    log.info(
      `MessageReceipts: Batching ${items.length} sent proto recipients deletes`
    );
    const { successfulPhoneNumberShares } = await deleteSentProtoRecipient(
      items
    );

    for (const serviceId of successfulPhoneNumberShares) {
      const convo = window.ConversationController.get(serviceId);
      if (!convo) {
        continue;
      }

      log.info(
        'MessageReceipts: unsetting shareMyPhoneNumber ' +
          `for ${convo.idForLogging()}`
      );

      // `deleteSentProtoRecipient` has already updated the database so there
      // is no need in calling `updateConversation`
      convo.unset('shareMyPhoneNumber');
    }
  },
});

function remove(receipt: MessageReceiptAttributesType): void {
  receipts.delete(
    generateCacheKey({
      sender: receipt.sourceServiceId,
      timestamp: receipt.messageSentAt,
    })
  );
  receipt.removeFromMessageReceiverCache();
}

async function getTargetMessage(
  sourceId: string,
  serviceId: ServiceIdString,
  messages: ReadonlyArray<MessageAttributesType>
): Promise<MessageModel | null> {
  if (messages.length === 0) {
    return null;
  }
  const message = messages.find(
    item =>
      (isOutgoing(item) || isStory(item)) && sourceId === item.conversationId
  );
  if (message) {
    return window.MessageCache.__DEPRECATED$register(
      message.id,
      message,
      'MessageReceipts.getTargetMessage 1'
    );
  }

  const groups = await window.Signal.Data.getAllGroupsInvolvingServiceId(
    serviceId
  );

  const ids = groups.map(item => item.id);
  ids.push(sourceId);

  const target = messages.find(
    item =>
      (isOutgoing(item) || isStory(item)) && ids.includes(item.conversationId)
  );
  if (!target) {
    return null;
  }

  return window.MessageCache.__DEPRECATED$register(
    target.id,
    target,
    'MessageReceipts.getTargetMessage 2'
  );
}

const wasDeliveredWithSealedSender = (
  conversationId: string,
  message: MessageModel
): boolean =>
  (message.get('unidentifiedDeliveries') || []).some(
    identifier =>
      window.ConversationController.getConversationId(identifier) ===
      conversationId
  );

const shouldDropReceipt = (
  receipt: MessageReceiptAttributesType,
  message: MessageModel
): boolean => {
  const { type } = receipt;
  switch (type) {
    case MessageReceiptType.Delivery:
      return false;
    case MessageReceiptType.Read:
      return !window.storage.get('read-receipt-setting');
    case MessageReceiptType.View:
      if (isStory(message.attributes)) {
        return !window.Events.getStoryViewReceiptsEnabled();
      }
      return !window.storage.get('read-receipt-setting');
    default:
      throw missingCaseError(type);
  }
};

export function forMessage(
  message: MessageModel
): Array<MessageReceiptAttributesType> {
  if (!isOutgoing(message.attributes) && !isStory(message.attributes)) {
    return [];
  }

  const logId = `MessageReceipts.forMessage(${getMessageIdForLogging(
    message.attributes
  )})`;

  const ourAci = window.textsecure.storage.user.getCheckedAci();
  const sourceServiceId = getSourceServiceId(message.attributes);
  if (ourAci !== sourceServiceId) {
    return [];
  }

  const receiptValues = Array.from(receipts.values());

  const sentAt = getMessageSentTimestamp(message.attributes, { log });
  const result = receiptValues.filter(item => item.messageSentAt === sentAt);
  if (result.length > 0) {
    log.info(`${logId}: found early receipts for message ${sentAt}`);
    result.forEach(receipt => {
      remove(receipt);
    });
  }

  return result.filter(receipt => {
    if (shouldDropReceipt(receipt, message)) {
      log.info(
        `${logId}: Dropping an early receipt ${receipt.type} for message ${sentAt}`
      );
      return false;
    }

    return true;
  });
}

function getNewSendStateByConversationId(
  oldSendStateByConversationId: SendStateByConversationId,
  receipt: MessageReceiptAttributesType
): SendStateByConversationId {
  const { receiptTimestamp, sourceConversationId, type } = receipt;

  const oldSendState = getOwn(
    oldSendStateByConversationId,
    sourceConversationId
  ) ?? { status: SendStatus.Sent, updatedAt: undefined };

  let sendActionType: SendActionType;
  switch (type) {
    case MessageReceiptType.Delivery:
      sendActionType = SendActionType.GotDeliveryReceipt;
      break;
    case MessageReceiptType.Read:
      sendActionType = SendActionType.GotReadReceipt;
      break;
    case MessageReceiptType.View:
      sendActionType = SendActionType.GotViewedReceipt;
      break;
    default:
      throw missingCaseError(type);
  }

  const newSendState = sendStateReducer(oldSendState, {
    type: sendActionType,
    updatedAt: receiptTimestamp,
  });

  return {
    ...oldSendStateByConversationId,
    [sourceConversationId]: newSendState,
  };
}

async function updateMessageSendState(
  receipt: MessageReceiptAttributesType,
  message: MessageModel
): Promise<void> {
  const { messageSentAt } = receipt;
  const logId = `MessageReceipts.updateMessageSendState(sentAt=${receipt.messageSentAt})`;

  if (shouldDropReceipt(receipt, message)) {
    log.info(
      `${logId}: Dropping a receipt ${receipt.type} for message ${messageSentAt}`
    );
    return;
  }

  let hasChanges = false;

  const conversationId = message.get('conversationId');
  const editHistory = message.get('editHistory') ?? [];
  const newEditHistory = editHistory?.map(edit => {
    if (messageSentAt !== edit.timestamp) {
      return edit;
    }

    const oldSendStateByConversationId = edit.sendStateByConversationId ?? {};
    const newSendStateByConversationId = getNewSendStateByConversationId(
      oldSendStateByConversationId,
      receipt
    );

    return {
      ...edit,
      sendStateByConversationId: newSendStateByConversationId,
    };
  });
  if (!isEqual(newEditHistory, editHistory)) {
    message.set('editHistory', newEditHistory);
    hasChanges = true;
  }

  const editMessageTimestamp = message.get('editMessageTimestamp');
  if (
    (!editMessageTimestamp && messageSentAt === message.get('timestamp')) ||
    messageSentAt === editMessageTimestamp
  ) {
    const oldSendStateByConversationId =
      message.get('sendStateByConversationId') ?? {};
    const newSendStateByConversationId = getNewSendStateByConversationId(
      oldSendStateByConversationId,
      receipt
    );

    // The send state may not change. For example, this can happen if we get a read
    //   receipt before a delivery receipt.
    if (!isEqual(oldSendStateByConversationId, newSendStateByConversationId)) {
      message.set('sendStateByConversationId', newSendStateByConversationId);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    queueUpdateMessage(message.attributes);

    // notify frontend listeners
    const conversation = window.ConversationController.get(conversationId);
    const updateLeftPane = conversation
      ? conversation.debouncedUpdateLastMessage
      : undefined;
    if (updateLeftPane) {
      updateLeftPane();
    }
  }

  const { sourceConversationId, type } = receipt;

  if (
    (type === MessageReceiptType.Delivery &&
      wasDeliveredWithSealedSender(sourceConversationId, message) &&
      receipt.wasSentEncrypted) ||
    type === MessageReceiptType.Read
  ) {
    const recipient = window.ConversationController.get(sourceConversationId);
    const recipientServiceId = recipient?.getServiceId();
    const deviceId = receipt.sourceDevice;

    if (type === MessageReceiptType.Read) {
      if (recipient) {
        await recipient.updateLastSeenMessage(message, conversationId);
      } else {
        log.warn(
          `MessageReceipts.onReceipt: Missing recipient or ${conversationId} for read receipt`
        );
      }
    }

    if (recipientServiceId && deviceId) {
      await Promise.all([
        deleteSentProtoBatcher.add({
          timestamp: messageSentAt,
          recipientServiceId,
          deviceId,
        }),

        // We want the above call to not be delayed when testing with
        // CI.
        window.SignalCI
          ? deleteSentProtoBatcher.flushAndWait()
          : Promise.resolve(),
      ]);
    } else {
      log.warn(
        `${logId}: Missing serviceId or deviceId for deliveredTo ${sourceConversationId}`
      );
    }
  }
}

export async function onReceipt(
  receipt: MessageReceiptAttributesType
): Promise<void> {
  receipts.set(
    generateCacheKey({
      sender: receipt.sourceServiceId,
      timestamp: receipt.messageSentAt,
    }),
    receipt
  );

  const { messageSentAt, sourceConversationId, sourceServiceId, type } =
    receipt;

  const logId = `MessageReceipts.onReceipt(sentAt=${receipt.messageSentAt})`;

  try {
    const messages = await window.Signal.Data.getMessagesBySentAt(
      messageSentAt
    );

    const message = await getTargetMessage(
      sourceConversationId,
      sourceServiceId,
      messages
    );

    if (message) {
      await updateMessageSendState(receipt, message);
    } else {
      // We didn't find any messages but maybe it's a story sent message
      const targetMessages = messages.filter(
        item =>
          item.storyDistributionListId &&
          item.sendStateByConversationId &&
          !item.deletedForEveryone &&
          Boolean(item.sendStateByConversationId[sourceConversationId])
      );

      // Nope, no target message was found
      if (!targetMessages.length) {
        log.info(
          `${logId}: No message for receipt`,
          type,
          sourceConversationId,
          sourceServiceId
        );
        return;
      }

      await Promise.all(
        targetMessages.map(msg => {
          const model = window.MessageCache.__DEPRECATED$register(
            msg.id,
            msg,
            'MessageReceipts.onReceipt'
          );
          return updateMessageSendState(receipt, model);
        })
      );
    }

    remove(receipt);
  } catch (error) {
    remove(receipt);
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
