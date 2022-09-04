// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';

import {
  createPreparedMediaItems,
  createRandomDocuments,
  createRandomMedia,
  days,
  now,
} from './AttachmentSection.stories';
import type { Props } from './MediaGallery';
import { MediaGallery } from './MediaGallery';
import type { MediaItemType } from '../../../types/MediaItem';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MediaGallery/MediaGallery',
};

export type PartialProps = Omit<Omit<Partial<Props>, 'media'>, 'documents'> & {
  documents?: Array<MediaItemType>;
  media?: Array<MediaItemType>;
};

const createProps = (overrideProps: PartialProps = {}): Props => ({
  i18n,
  onItemClick: action('onItemClick'),
  documents: async () => [overrideProps.documents || [], false],
  media: async () => [overrideProps.media || [], false],
});

export const Populated = (): JSX.Element => {
  const documents = createRandomDocuments(now, days(1)).slice(0, 1);
  const media = createPreparedMediaItems(createRandomMedia);
  const props = createProps({ documents, media });

  return <MediaGallery {...props} />;
};

export const NoDocuments = (): JSX.Element => {
  const media = createPreparedMediaItems(createRandomMedia);
  const props = createProps({ media });

  return <MediaGallery {...props} />;
};

export const NoMedia = (): JSX.Element => {
  const documents = createPreparedMediaItems(createRandomDocuments);
  const props = createProps({ documents });

  return <MediaGallery {...props} />;
};

export const OneEach = (): JSX.Element => {
  const media = createRandomMedia(now, days(1)).slice(0, 1);
  const documents = createRandomDocuments(now, days(1)).slice(0, 1);

  const props = createProps({ documents, media });

  return <MediaGallery {...props} />;
};

export const Empty = (): JSX.Element => {
  const props = createProps();

  return <MediaGallery {...props} />;
};
