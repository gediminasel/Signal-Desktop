// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import FocusTrap from 'focus-trap-react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';
import { useSpring, animated, to } from '@react-spring/web';
import type { BodyRangeType, LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { RenderEmojiPickerProps } from './conversation/ReactionPicker';
import type { ReplyStateType } from '../types/Stories';
import type { StoryViewType } from './StoryListItem';
import { AnimatedEmojiGalore } from './AnimatedEmojiGalore';
import { Avatar, AvatarSize } from './Avatar';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenuPopper } from './ContextMenu';
import { Intl } from './Intl';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { StoryImage } from './StoryImage';
import { StoryViewsNRepliesModal } from './StoryViewsNRepliesModal';
import { Theme } from '../util/theme';
import { getAvatarColor } from '../types/Colors';
import { getStoryBackground } from '../util/getStoryBackground';
import { getStoryDuration } from '../util/getStoryDuration';
import { graphemeAwareSlice } from '../util/graphemeAwareSlice';
import { isDownloaded, isDownloading } from '../types/Attachment';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import * as log from '../logging/log';

export type PropsType = {
  conversationId: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  group?: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'color'
    | 'id'
    | 'name'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >;
  hasAllStoriesMuted: boolean;
  i18n: LocalizerType;
  loadStoryReplies: (conversationId: string, messageId: string) => unknown;
  markStoryRead: (mId: string) => unknown;
  onClose: () => unknown;
  onGoToConversation: (conversationId: string) => unknown;
  onHideStory: (conversationId: string) => unknown;
  onNextUserStories: () => unknown;
  onPrevUserStories: () => unknown;
  onSetSkinTone: (tone: number) => unknown;
  onTextTooLong: () => unknown;
  onReactToStory: (emoji: string, story: StoryViewType) => unknown;
  onReplyToStory: (
    message: string,
    mentions: Array<BodyRangeType>,
    timestamp: number,
    story: StoryViewType
  ) => unknown;
  onUseEmoji: (_: EmojiPickDataType) => unknown;
  preferredReactionEmoji: Array<string>;
  queueStoryDownload: (storyId: string) => unknown;
  recentEmojis?: Array<string>;
  renderEmojiPicker: (props: RenderEmojiPickerProps) => JSX.Element;
  replyState?: ReplyStateType;
  skinTone?: number;
  stories: Array<StoryViewType>;
  toggleHasAllStoriesMuted: () => unknown;
  views?: Array<string>;
};

const CAPTION_BUFFER = 20;
const CAPTION_INITIAL_LENGTH = 200;
const CAPTION_MAX_LENGTH = 700;
const MOUSE_IDLE_TIME = 3000;

enum Arrow {
  None,
  Left,
  Right,
}

export const StoryViewer = ({
  conversationId,
  getPreferredBadge,
  group,
  hasAllStoriesMuted,
  i18n,
  loadStoryReplies,
  markStoryRead,
  onClose,
  onGoToConversation,
  onHideStory,
  onNextUserStories,
  onPrevUserStories,
  onReactToStory,
  onReplyToStory,
  onSetSkinTone,
  onTextTooLong,
  onUseEmoji,
  preferredReactionEmoji,
  queueStoryDownload,
  recentEmojis,
  renderEmojiPicker,
  replyState,
  skinTone,
  stories,
  toggleHasAllStoriesMuted,
  views,
}: PropsType): JSX.Element => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyDuration, setStoryDuration] = useState<number | undefined>();
  const [isShowingContextMenu, setIsShowingContextMenu] = useState(false);
  const [hasConfirmHideStory, setHasConfirmHideStory] = useState(false);
  const [referenceElement, setReferenceElement] =
    useState<HTMLButtonElement | null>(null);
  const [reactionEmoji, setReactionEmoji] = useState<string | undefined>();

  const visibleStory = stories[currentStoryIndex];

  const { attachment, canReply, isHidden, messageId, timestamp } = visibleStory;
  const {
    acceptedMessageRequest,
    avatarPath,
    color,
    isMe,
    id,
    firstName,
    name,
    profileName,
    sharedGroupNames,
    title,
  } = visibleStory.sender;

  const [hasReplyModal, setHasReplyModal] = useState(false);

  const onEscape = useCallback(() => {
    if (hasReplyModal) {
      setHasReplyModal(false);
    } else {
      onClose();
    }
  }, [hasReplyModal, onClose]);

  useEscapeHandling(onEscape);

  // Caption related hooks
  const [hasExpandedCaption, setHasExpandedCaption] = useState<boolean>(false);

  const caption = useMemo(() => {
    if (!attachment?.caption) {
      return;
    }

    return graphemeAwareSlice(
      attachment.caption,
      hasExpandedCaption ? CAPTION_MAX_LENGTH : CAPTION_INITIAL_LENGTH,
      CAPTION_BUFFER
    );
  }, [attachment?.caption, hasExpandedCaption]);

  // Reset expansion if messageId changes
  useEffect(() => {
    setHasExpandedCaption(false);
  }, [messageId]);

  // These exist to change currentStoryIndex to the oldest unread story a user
  // has, or set to 0 whenever conversationId changes.
  // We use a ref so that we only depend on conversationId changing, since
  // the stories Array will change once we mark as story as viewed.
  const storiesRef = useRef(stories);

  useEffect(() => {
    const unreadStoryIndex = storiesRef.current.findIndex(
      story => story.isUnread
    );
    log.info('stories.findUnreadStory', {
      unreadStoryIndex,
      stories: storiesRef.current.length,
    });
    setCurrentStoryIndex(unreadStoryIndex < 0 ? 0 : unreadStoryIndex);
  }, [conversationId]);

  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  // Either we show the next story in the current user's stories or we ask
  // for the next user's stories.
  const showNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      setCurrentStoryIndex(0);
      onNextUserStories();
    }
  }, [currentStoryIndex, onNextUserStories, stories.length]);

  // Either we show the previous story in the current user's stories or we ask
  // for the prior user's stories.
  const showPrevStory = useCallback(() => {
    if (currentStoryIndex === 0) {
      onPrevUserStories();
    } else {
      setCurrentStoryIndex(currentStoryIndex - 1);
    }
  }, [currentStoryIndex, onPrevUserStories]);

  useEffect(() => {
    let shouldCancel = false;
    (async function hydrateStoryDuration() {
      if (!attachment) {
        return;
      }
      const duration = await getStoryDuration(attachment);
      if (shouldCancel) {
        return;
      }
      log.info('stories.setStoryDuration', {
        contentType: attachment.textAttachment
          ? 'text'
          : attachment.contentType,
        duration,
      });
      setStoryDuration(duration);
    })();

    return () => {
      shouldCancel = true;
    };
  }, [attachment]);

  const [styles, spring] = useSpring(
    () => ({
      from: { width: 0 },
      to: { width: 100 },
      loop: true,
      onRest: {
        width: ({ value }) => {
          if (value === 100) {
            showNextStory();
          }
        },
      },
    }),
    [showNextStory]
  );

  // We need to be careful about this effect refreshing, it should only run
  // every time a story changes or its duration changes.
  useEffect(() => {
    if (!storyDuration) {
      spring.stop();
      return;
    }

    spring.start({
      config: {
        duration: storyDuration,
      },
      from: { width: 0 },
      to: { width: 100 },
    });

    return () => {
      spring.stop();
    };
  }, [currentStoryIndex, spring, storyDuration]);

  const [pauseStory, setPauseStory] = useState(false);

  const shouldPauseViewing =
    hasConfirmHideStory ||
    hasExpandedCaption ||
    hasReplyModal ||
    isShowingContextMenu ||
    pauseStory ||
    Boolean(reactionEmoji);

  useEffect(() => {
    if (shouldPauseViewing) {
      spring.pause();
    } else {
      spring.resume();
    }
  }, [shouldPauseViewing, spring]);

  useEffect(() => {
    markStoryRead(messageId);
    log.info('stories.markStoryRead', { messageId });
  }, [markStoryRead, messageId]);

  // Queue all undownloaded stories once we're viewing someone's stories
  const storiesToDownload = useMemo(() => {
    return stories
      .filter(
        story =>
          !isDownloaded(story.attachment) && !isDownloading(story.attachment)
      )
      .map(story => story.messageId);
  }, [stories]);
  useEffect(() => {
    storiesToDownload.forEach(storyId => queueStoryDownload(storyId));
  }, [queueStoryDownload, storiesToDownload]);

  const navigateStories = useCallback(
    (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight') {
        showNextStory();
        ev.preventDefault();
        ev.stopPropagation();
      } else if (ev.key === 'ArrowLeft') {
        showPrevStory();
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    [showPrevStory, showNextStory]
  );

  useEffect(() => {
    document.addEventListener('keydown', navigateStories);

    return () => {
      document.removeEventListener('keydown', navigateStories);
    };
  }, [navigateStories]);

  const isGroupStory = Boolean(group?.id);
  useEffect(() => {
    if (!isGroupStory) {
      return;
    }
    loadStoryReplies(conversationId, messageId);
  }, [conversationId, isGroupStory, loadStoryReplies, messageId]);

  const [arrowToShow, setArrowToShow] = useState<Arrow>(Arrow.None);

  useEffect(() => {
    if (arrowToShow === Arrow.None) {
      return;
    }

    let lastMouseMove: number | undefined;

    function updateLastMouseMove() {
      lastMouseMove = Date.now();
    }

    function checkMouseIdle() {
      requestAnimationFrame(() => {
        if (lastMouseMove && Date.now() - lastMouseMove > MOUSE_IDLE_TIME) {
          setArrowToShow(Arrow.None);
        } else {
          checkMouseIdle();
        }
      });
    }
    checkMouseIdle();

    document.addEventListener('mousemove', updateLastMouseMove);

    return () => {
      lastMouseMove = undefined;
      document.removeEventListener('mousemove', updateLastMouseMove);
    };
  }, [arrowToShow]);

  const replies =
    replyState && replyState.messageId === messageId ? replyState.replies : [];

  const viewCount = (views || []).length;
  const replyCount = replies.length;

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="StoryViewer">
        <div
          className="StoryViewer__overlay"
          style={{ background: getStoryBackground(attachment) }}
        />
        <div className="StoryViewer__content">
          <button
            aria-label={i18n('back')}
            className={classNames(
              'StoryViewer__arrow StoryViewer__arrow--left',
              {
                'StoryViewer__arrow--visible': arrowToShow === Arrow.Left,
              }
            )}
            onClick={showPrevStory}
            onMouseMove={() => setArrowToShow(Arrow.Left)}
            type="button"
          />
          <div className="StoryViewer__protection StoryViewer__protection--top" />
          <div className="StoryViewer__container">
            <StoryImage
              attachment={attachment}
              i18n={i18n}
              isPaused={shouldPauseViewing}
              isMuted={hasAllStoriesMuted}
              label={i18n('lightboxImageAlt')}
              moduleClassName="StoryViewer__story"
              queueStoryDownload={queueStoryDownload}
              storyId={messageId}
            >
              {reactionEmoji && (
                <div className="StoryViewer__animated-emojis">
                  <AnimatedEmojiGalore
                    emoji={reactionEmoji}
                    onAnimationEnd={() => {
                      setReactionEmoji(undefined);
                    }}
                  />
                </div>
              )}
            </StoryImage>
            {hasExpandedCaption && (
              <button
                aria-label={i18n('close-popup')}
                className="StoryViewer__caption__overlay"
                onClick={() => setHasExpandedCaption(false)}
                type="button"
              />
            )}
          </div>
          <div className="StoryViewer__meta">
            {caption && (
              <div className="StoryViewer__caption">
                {caption.text}
                {caption.hasReadMore && !hasExpandedCaption && (
                  <button
                    className="MessageBody__read-more"
                    onClick={() => {
                      setHasExpandedCaption(true);
                    }}
                    onKeyDown={(ev: React.KeyboardEvent) => {
                      if (ev.key === 'Space' || ev.key === 'Enter') {
                        setHasExpandedCaption(true);
                      }
                    }}
                    type="button"
                  >
                    ...
                    {i18n('MessageBody--read-more')}
                  </button>
                )}
              </div>
            )}
            <div className="StoryViewer__meta__playback-bar">
              <div>
                <Avatar
                  acceptedMessageRequest={acceptedMessageRequest}
                  avatarPath={avatarPath}
                  badge={undefined}
                  color={getAvatarColor(color)}
                  conversationType="direct"
                  i18n={i18n}
                  isMe={Boolean(isMe)}
                  name={name}
                  profileName={profileName}
                  sharedGroupNames={sharedGroupNames}
                  size={AvatarSize.TWENTY_EIGHT}
                  title={title}
                />
                {group && (
                  <Avatar
                    acceptedMessageRequest={group.acceptedMessageRequest}
                    avatarPath={group.avatarPath}
                    badge={undefined}
                    className="StoryViewer__meta--group-avatar"
                    color={getAvatarColor(group.color)}
                    conversationType="group"
                    i18n={i18n}
                    isMe={false}
                    name={group.name}
                    profileName={group.profileName}
                    sharedGroupNames={group.sharedGroupNames}
                    size={AvatarSize.TWENTY_EIGHT}
                    title={group.title}
                  />
                )}
                <div className="StoryViewer__meta--title">
                  {group
                    ? i18n('Stories__from-to-group', {
                        name: title,
                        group: group.title,
                      })
                    : title}
                </div>
                <MessageTimestamp
                  i18n={i18n}
                  isRelativeTime
                  module="StoryViewer__meta--timestamp"
                  timestamp={timestamp}
                />
              </div>
              <div className="StoryViewer__meta__playback-controls">
                <button
                  aria-label={
                    pauseStory
                      ? i18n('StoryViewer__play')
                      : i18n('StoryViewer__pause')
                  }
                  className={
                    pauseStory ? 'StoryViewer__play' : 'StoryViewer__pause'
                  }
                  onClick={() => setPauseStory(!pauseStory)}
                  type="button"
                />
                <button
                  aria-label={
                    hasAllStoriesMuted
                      ? i18n('StoryViewer__unmute')
                      : i18n('StoryViewer__mute')
                  }
                  className={
                    hasAllStoriesMuted
                      ? 'StoryViewer__unmute'
                      : 'StoryViewer__mute'
                  }
                  onClick={toggleHasAllStoriesMuted}
                  type="button"
                />
                <button
                  aria-label={i18n('MyStories__more')}
                  className="StoryViewer__more"
                  onClick={() => setIsShowingContextMenu(true)}
                  ref={setReferenceElement}
                  type="button"
                />
              </div>
            </div>
            <div className="StoryViewer__progress">
              {stories.map((story, index) => (
                <div
                  className="StoryViewer__progress--container"
                  key={story.messageId}
                >
                  {currentStoryIndex === index ? (
                    <animated.div
                      className="StoryViewer__progress--bar"
                      style={{
                        width: to([styles.width], width => `${width}%`),
                      }}
                    />
                  ) : (
                    <div
                      className="StoryViewer__progress--bar"
                      style={{
                        width: currentStoryIndex < index ? '0%' : '100%',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="StoryViewer__actions">
              {canReply && (
                <button
                  className="StoryViewer__reply"
                  onClick={() => setHasReplyModal(true)}
                  tabIndex={0}
                  type="button"
                >
                  <>
                    {viewCount > 0 || replyCount > 0 ? (
                      <span className="StoryViewer__reply__chevron">
                        {viewCount > 0 &&
                          (viewCount === 1 ? (
                            <Intl
                              i18n={i18n}
                              id="MyStories__views--singular"
                              components={[<strong>{viewCount}</strong>]}
                            />
                          ) : (
                            <Intl
                              i18n={i18n}
                              id="MyStories__views--plural"
                              components={[<strong>{viewCount}</strong>]}
                            />
                          ))}
                        {viewCount > 0 && replyCount > 0 && ' '}
                        {replyCount > 0 &&
                          (replyCount === 1 ? (
                            <Intl
                              i18n={i18n}
                              id="MyStories__replies--singular"
                              components={[<strong>{replyCount}</strong>]}
                            />
                          ) : (
                            <Intl
                              i18n={i18n}
                              id="MyStories__replies--plural"
                              components={[<strong>{replyCount}</strong>]}
                            />
                          ))}
                      </span>
                    ) : null}
                    {!viewCount && !replyCount && (
                      <span className="StoryViewer__reply__arrow">
                        {isGroupStory
                          ? i18n('StoryViewer__reply-group')
                          : i18n('StoryViewer__reply')}
                      </span>
                    )}
                  </>
                </button>
              )}
            </div>
          </div>
          <button
            aria-label={i18n('forward')}
            className={classNames(
              'StoryViewer__arrow StoryViewer__arrow--right',
              {
                'StoryViewer__arrow--visible': arrowToShow === Arrow.Right,
              }
            )}
            onClick={showNextStory}
            onMouseMove={() => setArrowToShow(Arrow.Right)}
            type="button"
          />
          <div className="StoryViewer__protection StoryViewer__protection--bottom" />
          <button
            aria-label={i18n('close')}
            className="StoryViewer__close-button"
            onClick={onClose}
            tabIndex={0}
            type="button"
          />
        </div>
        <ContextMenuPopper
          isMenuShowing={isShowingContextMenu}
          menuOptions={[
            {
              icon: 'StoryListItem__icon--hide',
              label: isHidden
                ? i18n('StoryListItem__unhide')
                : i18n('StoryListItem__hide'),
              onClick: () => {
                if (isHidden) {
                  onHideStory(id);
                } else {
                  setHasConfirmHideStory(true);
                }
              },
            },
            {
              icon: 'StoryListItem__icon--chat',
              label: i18n('StoryListItem__go-to-chat'),
              onClick: () => {
                onGoToConversation(id);
              },
            },
          ]}
          onClose={() => setIsShowingContextMenu(false)}
          referenceElement={referenceElement}
          theme={Theme.Dark}
        />
        {hasReplyModal && canReply && (
          <StoryViewsNRepliesModal
            authorTitle={firstName || title}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            isGroupStory={isGroupStory}
            isMyStory={isMe}
            onClose={() => setHasReplyModal(false)}
            onReact={emoji => {
              onReactToStory(emoji, visibleStory);
              setHasReplyModal(false);
              setReactionEmoji(emoji);
            }}
            onReply={(message, mentions, replyTimestamp) => {
              if (!isGroupStory) {
                setHasReplyModal(false);
              }
              onReplyToStory(message, mentions, replyTimestamp, visibleStory);
            }}
            onSetSkinTone={onSetSkinTone}
            onTextTooLong={onTextTooLong}
            onUseEmoji={onUseEmoji}
            preferredReactionEmoji={preferredReactionEmoji}
            recentEmojis={recentEmojis}
            renderEmojiPicker={renderEmojiPicker}
            replies={replies}
            skinTone={skinTone}
            storyPreviewAttachment={attachment}
            views={[]}
          />
        )}
        {hasConfirmHideStory && (
          <ConfirmationDialog
            actions={[
              {
                action: () => onHideStory(id),
                style: 'affirmative',
                text: i18n('StoryListItem__hide-modal--confirm'),
              },
            ]}
            i18n={i18n}
            onClose={() => {
              setHasConfirmHideStory(false);
            }}
          >
            {i18n('StoryListItem__hide-modal--body', [String(firstName)])}
          </ConfirmationDialog>
        )}
      </div>
    </FocusTrap>
  );
};
