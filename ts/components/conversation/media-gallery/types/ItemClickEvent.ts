// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageAttributesType } from '../../../../model-types.d';
import type { AttachmentType } from '../../../../types/Attachment';
import { MediaItemType } from '../../../../types/MediaItem';

export type ItemClickEvent = {
  message: Pick<MessageAttributesType, 'sent_at'>;
  attachment: AttachmentType;
  type: 'media' | 'documents';
  items: MediaItemType[]
};
