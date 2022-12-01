// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import moment from 'moment';

import { AttachmentSection } from './AttachmentSection';
import { EmptyState } from './EmptyState';
import { groupMediaItemsByDate } from './groupMediaItemsByDate';
import type { ItemClickEvent } from './types/ItemClickEvent';
import { missingCaseError } from '../../../util/missingCaseError';
import type { LocalizerType } from '../../../types/Util';
import { getMessageTimestamp } from '../../../util/getMessageTimestamp';

import type { MediaItemType } from '../../../types/MediaItem';

export type Props = {
  documents: (page: number) => Promise<[Array<MediaItemType>, boolean]>;
  i18n: LocalizerType;
  media: (page: number) => Promise<[Array<MediaItemType>, boolean]>;

  onItemClick?: (event: ItemClickEvent) => void;
};

type State = {
  selectedTab: 'media' | 'documents';
  page: number;
  items: Array<MediaItemType>;
  hasMoreItems: boolean;
  loading: boolean;
};

const MONTH_FORMAT = 'MMMM YYYY';

type TabSelectEvent = {
  type: 'media' | 'documents';
};

function Tab({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect?: (event: TabSelectEvent) => void;
  type: 'media' | 'documents';
}) {
  const handleClick = onSelect
    ? () => {
        onSelect({ type });
      }
    : undefined;

  return (
    // Has key events handled elsewhere
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      className={classNames(
        'module-media-gallery__tab',
        isSelected ? 'module-media-gallery__tab--active' : null
      )}
      onClick={handleClick}
      role="tab"
      tabIndex={0}
    >
      {label}
    </div>
  );
}

export class MediaGallery extends React.Component<Props, State> {
  public readonly focusRef: React.RefObject<HTMLDivElement> = React.createRef();

  constructor(props: Props) {
    super(props);
    this.state = {
      selectedTab: 'media',
      page: 0,
      items: [],
      loading: true,
      hasMoreItems: false,
    };
  }

  public override componentDidMount(): void {
    // When this component is created, it's initially not part of the DOM, and then it's
    //   added off-screen and animated in. This ensures that the focus takes.
    setTimeout(() => {
      if (this.focusRef.current) {
        this.focusRef.current.focus();
      }
    });
    this.loadMediaItems(null, 0);
  }

  public override componentDidUpdate(prevProps: Props): void {
    const { media, documents } = this.props;
    const { page } = this.state;
    if (media !== prevProps.media || documents !== prevProps.documents) {
      this.loadMediaItems(null, page);
    }
  }

  public override render(): JSX.Element {
    const { i18n } = this.props;
    const { selectedTab } = this.state;

    return (
      <div className="module-media-gallery" tabIndex={-1} ref={this.focusRef}>
        <div className="module-media-gallery__tab-container">
          <Tab
            label={i18n('media')}
            type="media"
            isSelected={selectedTab === 'media'}
            onSelect={this.handleTabSelect}
          />
          <Tab
            label={i18n('documents')}
            type="documents"
            isSelected={selectedTab === 'documents'}
            onSelect={this.handleTabSelect}
          />
        </div>
        <div className="module-media-gallery__content">
          {this.renderSections()}
        </div>
      </div>
    );
  }

  private readonly loadMediaItems = async (
    selectedTab: State['selectedTab'] | null,
    page: number
  ): Promise<void> => {
    const { selectedTab: selectedTabInState } = this.state;
    const tabToLoad = selectedTab || selectedTabInState;
    this.setState({ selectedTab: tabToLoad, page, loading: true, items: [] });
    const { media, documents } = this.props;
    const loadMediaItems = tabToLoad === 'media' ? media : documents;
    if (!loadMediaItems) {
      this.setState({ loading: false, items: [] });
      return;
    }
    try {
      const [items, hasMoreItems] = await loadMediaItems(page);
      this.setState({ loading: false, items, hasMoreItems });
    } catch (e) {
      this.setState({ loading: false, items: [], hasMoreItems: false });
    }
  };

  private readonly handleTabSelect = (event: TabSelectEvent): void => {
    const { selectedTab } = this.state;
    if (event.type !== selectedTab) {
      this.loadMediaItems(event.type, 0);
    }
  };

  private readonly nextPage = (): void => {
    const { page } = this.state;
    this.loadMediaItems(null, page + 1);
  };

  private readonly prevPage = (): void => {
    const { page } = this.state;
    if (page > 0) {
      this.loadMediaItems(null, page - 1);
    }
  };

  private readonly onItemClick = (event: Omit<ItemClickEvent, 'items'>) => {
    const { onItemClick } = this.props;
    const { items } = this.state;
    onItemClick?.({ ...event, items });
  };

  private renderSections() {
    const { i18n, onItemClick } = this.props;
    const { selectedTab, page, items, loading, hasMoreItems } = this.state;

    const type = selectedTab;

    if (loading) {
      return <EmptyState data-test="EmptyState" label={i18n('loading')} />;
    }

    if (!items || items.length === 0) {
      const label = (() => {
        switch (type) {
          case 'media':
            return i18n('mediaEmptyState');

          case 'documents':
            return i18n('documentsEmptyState');

          default:
            throw missingCaseError(type);
        }
      })();

      if (page > 0) {
        return (
          <div className="module-media-gallery__sections">
            <button type="button" onClick={this.prevPage}>
              prev
            </button>
            <EmptyState data-test="EmptyState" label={label} />
          </div>
        );
      }
      return <EmptyState data-test="EmptyState" label={label} />;
    }

    const now = Date.now();
    const sections = groupMediaItemsByDate(now, items).map(section => {
      const first = section.mediaItems[0];
      const { message } = first;
      const date = moment(getMessageTimestamp(message));
      const header =
        section.type === 'yearMonth'
          ? date.format(MONTH_FORMAT)
          : i18n(section.type);

      return (
        <AttachmentSection
          key={header}
          header={header}
          i18n={i18n}
          type={type}
          mediaItems={section.mediaItems}
          onItemClick={onItemClick && this.onItemClick}
        />
      );
    });

    return (
      <div className="module-media-gallery__sections">
        {sections}
        <div style={{ display: 'flex' }}>
          {page > 0 ? (
            <button style={{ flex: 1 }} type="button" onClick={this.prevPage}>
              prev
            </button>
          ) : null}
          {hasMoreItems ? (
            <button style={{ flex: 1 }} type="button" onClick={this.nextPage}>
              next
            </button>
          ) : null}
        </div>
      </div>
    );
  }
}
