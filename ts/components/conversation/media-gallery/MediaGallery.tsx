// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';

import moment from 'moment';

import type { ItemClickEvent } from './types/ItemClickEvent';
import type { LocalizerType } from '../../../types/Util';
import type { MediaItemType } from '../../../types/MediaItem';
import type { SaveAttachmentActionCreatorType } from '../../../state/ducks/conversations';
import { AttachmentSection } from './AttachmentSection';
import { EmptyState } from './EmptyState';
import { Tabs } from '../../Tabs';
import { getMessageTimestamp } from '../../../util/getMessageTimestamp';
import { groupMediaItemsByDate } from './groupMediaItemsByDate';
import { missingCaseError } from '../../../util/missingCaseError';

enum TabViews {
  Media = 'Media',
  Documents = 'Documents',
}

export type Props = {
  conversationId: string;
  documents: Array<MediaItemType>;
  i18n: LocalizerType;
  loadMediaItems: (id: string, page: number) => unknown;
  media: Array<MediaItemType>;
  saveAttachment: SaveAttachmentActionCreatorType;
  showLightboxWithMedia: (
    selectedIndex: number,
    media: Array<MediaItemType>
  ) => void;
};

const MONTH_FORMAT = 'MMMM YYYY';

function MediaSection({
  type,
  i18n,
  media,
  documents,
  saveAttachment,
  showLightboxWithMedia,
  prevPage,
  nextPage,
}: Pick<
  Props,
  'i18n' | 'media' | 'documents' | 'showLightboxWithMedia' | 'saveAttachment'
> & {
  type: 'media' | 'documents';
  prevPage?: () => void;
  nextPage?: () => void;
}): JSX.Element {
  const mediaItems = type === 'media' ? media : documents;

  if (!mediaItems || mediaItems.length === 0) {
    const label = (() => {
      switch (type) {
        case 'media':
          return i18n('icu:mediaEmptyState');

        case 'documents':
          return i18n('icu:documentsEmptyState');

        default:
          throw missingCaseError(type);
      }
    })();

    return (
      <EmptyState data-test="EmptyState" label={label}>
        {prevPage ? (
          <div>
            &nbsp;
            <button type="button" onClick={prevPage}>
              back
            </button>
          </div>
        ) : null}
      </EmptyState>
    );
  }

  const now = Date.now();
  const sections = groupMediaItemsByDate(now, mediaItems).map(section => {
    const first = section.mediaItems[0];
    const { message } = first;
    const date = moment(getMessageTimestamp(message));

    function getHeader(): string {
      switch (section.type) {
        case 'yearMonth':
          return date.format(MONTH_FORMAT);
        case 'today':
          return i18n('icu:today');
        case 'yesterday':
          return i18n('icu:yesterday');
        case 'thisWeek':
          return i18n('icu:thisWeek');
        case 'thisMonth':
          return i18n('icu:thisMonth');
        default:
          throw missingCaseError(section);
      }
    }

    const header = getHeader();

    return (
      <AttachmentSection
        key={message.id}
        header={header}
        i18n={i18n}
        type={type}
        mediaItems={section.mediaItems}
        onItemClick={(event: ItemClickEvent) => {
          switch (event.type) {
            case 'documents': {
              saveAttachment(event.attachment, event.message.sent_at);
              break;
            }

            case 'media': {
              showLightboxWithMedia(event.index, media);
              break;
            }

            default:
              throw new TypeError(`Unknown attachment type: '${event.type}'`);
          }
        }}
      />
    );
  });

  return (
    <div className="module-media-gallery__sections">
      {sections}
      <div style={{ display: 'flex' }}>
        {prevPage ? (
          <button style={{ flex: 1 }} type="button" onClick={prevPage}>
            prev
          </button>
        ) : null}
        {nextPage ? (
          <button style={{ flex: 1 }} type="button" onClick={nextPage}>
            next
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MediaGallery({
  conversationId,
  documents,
  i18n,
  loadMediaItems,
  media,
  saveAttachment,
  showLightboxWithMedia,
}: Props): JSX.Element {
  const focusRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  useEffect(() => {
    loadMediaItems(conversationId, page);
  }, [conversationId, loadMediaItems, page]);

  const prevPage = useCallback(() => setPage(Math.max(0, page - 1)), [page]);
  const nextPage = useCallback(() => setPage(page + 1), [page]);

  return (
    <div className="module-media-gallery" tabIndex={-1} ref={focusRef}>
      <Tabs
        initialSelectedTab={TabViews.Media}
        tabs={[
          {
            id: TabViews.Media,
            label: i18n('icu:media'),
          },
          {
            id: TabViews.Documents,
            label: i18n('icu:documents'),
          },
        ]}
        onTabChange={() => setPage(0)}
      >
        {({ selectedTab }) => (
          <div className="module-media-gallery__content">
            {selectedTab === TabViews.Media && (
              <MediaSection
                documents={documents}
                i18n={i18n}
                media={media}
                saveAttachment={saveAttachment}
                showLightboxWithMedia={showLightboxWithMedia}
                prevPage={page > 0 ? prevPage : undefined}
                nextPage={media.length > 0 ? nextPage : undefined}
                type="media"
              />
            )}
            {selectedTab === TabViews.Documents && (
              <MediaSection
                documents={documents}
                i18n={i18n}
                media={media}
                saveAttachment={saveAttachment}
                showLightboxWithMedia={showLightboxWithMedia}
                prevPage={page > 0 ? prevPage : undefined}
                nextPage={documents.length > 0 ? nextPage : undefined}
                type="documents"
              />
            )}
          </div>
        )}
      </Tabs>
    </div>
  );
}
