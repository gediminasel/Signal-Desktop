// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent } from 'react';
import React from 'react';

import type { AttachmentType } from '../../types/Attachment';
import { canBeDownloaded } from '../../types/Attachment';
import type { SizeClassType } from '../emoji/lib';
import { getSizeClass } from '../emoji/lib';
import { AtMentionify } from './AtMentionify';
import { Emojify } from './Emojify';
import { AddNewLines } from './AddNewLines';
import { Linkify } from './Linkify';

import type {
  BodyRangesType,
  LocalizerType,
  RenderTextCallbackType,
} from '../../types/Util';

type OpenConversationActionType = (
  conversationId: string,
  messageId?: string
) => void;

export type Props = {
  direction?: 'incoming' | 'outgoing';
  text: string;
  textAttachment?: Pick<AttachmentType, 'pending' | 'digest' | 'key'>;
  /** If set, all emoji will be the same size. Otherwise, just one emoji will be large. */
  disableJumbomoji?: boolean;
  /** If set, links will be left alone instead of turned into clickable `<a>` tags. */
  disableLinks?: boolean;
  disableMarkdown?: boolean;
  i18n: LocalizerType;
  bodyRanges?: BodyRangesType;
  onIncreaseTextLength?: () => unknown;
  openConversation?: OpenConversationActionType;
  kickOffBodyDownload?: () => void;
};

const renderEmoji = ({
  text,
  key,
  sizeClass,
  renderNonEmoji,
}: {
  i18n: LocalizerType;
  text: string;
  key: number;
  sizeClass?: SizeClassType;
  renderNonEmoji: RenderTextCallbackType;
}) => (
  <Emojify
    key={key}
    text={text}
    sizeClass={sizeClass}
    renderNonEmoji={renderNonEmoji}
  />
);

/**
 * This component makes it very easy to use all three of our message formatting
 * components: `Emojify`, `Linkify`, and `AddNewLines`. Because each of them is fully
 * configurable with their `renderXXX` props, this component will assemble all three of
 * them for you.
 */
export function MessageBody({
  bodyRanges,
  direction,
  disableJumbomoji,
  disableLinks,
  disableMarkdown,
  i18n,
  onIncreaseTextLength,
  openConversation,
  text,
  textAttachment,
  kickOffBodyDownload,
}: Props): JSX.Element {
  const hasReadMore = Boolean(onIncreaseTextLength);
  const textWithSuffix =
    textAttachment?.pending || hasReadMore ? `${text}...` : text;

  const sizeClass = disableJumbomoji ? undefined : getSizeClass(text);
  const processedText = AtMentionify.preprocessMentions(
    textWithSuffix,
    bodyRanges
  );

  const renderMentions = ( innerText: string, innerKey?: number) => (
    <AtMentionify
      key={innerKey}
      direction={direction}
      text={innerText}
      bodyRanges={bodyRanges}
      openConversation={openConversation}
    />
  );

  const markdown: {[symbol: string]: (t: JSX.Element, key: number) => JSX.Element} = {
    '**': (t, key)=><b key={key}>{t}</b>,
    '__': (t, key)=><u key={key}>{t}</u>,
    '//': (t, key)=><i key={key}>{t}</i>,
    '`': (t, key)=><code style={{ fontWeight: 'bold' }} key={key}>{t}</code>,
    '~~': (t, key)=><span style={{ textDecorationLine: 'line-through' }} key={key}>{t}</span>,
    '==': (t, key)=><mark key={key}>{t}</mark>,
  };

  if(text.startsWith('```')) {
    disableMarkdown = true;
  }

  const renderMarkdown = disableMarkdown ? (({ text, key }: { text: string, key?: number }) => {
    return renderMentions(text, key);
  }) : (({ text, key, depth }: { text: string, key?: number, depth?: number }) => {
    depth = depth || 6;
    depth--;
    const res = [];
    let childKey = 1;
    while(text.length > 0) {
      let next_symbol = null;

      if(depth > 0) {
        let next_index = 0;
        for(const symbol in markdown) {
          const index = text.indexOf(symbol);
          if(index === -1)
            continue;
          if(next_symbol === null || index < next_index) {
            next_symbol = symbol;
            next_index = index;
          }
        }
      }

      if(next_symbol === null) {
        break;
      }
      
      const result = text.split(next_symbol, 3);
      res.push(renderMarkdown({text: result[0], key: childKey++, depth}));

      if(result.length == 3) {
        text = text.substring(result[0].length + result[1].length + 2 * next_symbol.length);
        if(result[1].length === 0) {
          res.push(next_symbol.repeat(2));
        } else {
          const f = markdown[next_symbol];
          res.push(f(renderMarkdown({text: result[1], depth}), childKey++));
        }
      } else {
        res.push(next_symbol);
        text = text.substring(result[0].length + next_symbol.length);
      }
    }

    if(text.length > 0){
      res.push(renderMentions(text, childKey++));
    }

    return <React.Fragment key={key}>{res}</React.Fragment>;
  });

  const renderNewLines: RenderTextCallbackType = ({
    text: textWithNewLines,
    key,
  }) => {
    return (
      <AddNewLines
        key={key}
        text={textWithNewLines}
        renderNonNewLine={renderMarkdown}
      />
    );
  };

  let pendingContent: React.ReactNode;
  if (hasReadMore) {
    pendingContent = null;
  } else if (textAttachment?.pending) {
    pendingContent = (
      <span className="MessageBody__highlight"> {i18n('downloading')}</span>
    );
  } else if (
    textAttachment &&
    canBeDownloaded(textAttachment) &&
    kickOffBodyDownload
  ) {
    pendingContent = (
      <span>
        {' '}
        <button
          className="MessageBody__download-body"
          onClick={() => {
            kickOffBodyDownload();
          }}
          onKeyDown={(ev: KeyboardEvent) => {
            if (ev.key === 'Space' || ev.key === 'Enter') {
              kickOffBodyDownload();
            }
          }}
          tabIndex={0}
          type="button"
        >
          {i18n('downloadFullMessage')}
        </button>
      </span>
    );
  }

  return (
    <span>
      {disableLinks ? (
        renderEmoji({
          i18n,
          text: processedText,
          sizeClass,
          key: 0,
          renderNonEmoji: renderNewLines,
        })
      ) : (
        <Linkify
          text={processedText}
          renderNonLink={({ key, text: nonLinkText }) => {
            return renderEmoji({
              i18n,
              text: nonLinkText,
              sizeClass,
              key,
              renderNonEmoji: renderNewLines,
            });
          }}
        />
      )}
      {pendingContent}
      {onIncreaseTextLength ? (
        <button
          className="MessageBody__read-more"
          onClick={() => {
            onIncreaseTextLength();
          }}
          onKeyDown={(ev: KeyboardEvent) => {
            if (ev.key === 'Space' || ev.key === 'Enter') {
              onIncreaseTextLength();
            }
          }}
          tabIndex={0}
          type="button"
        >
          {' '}
          {i18n('MessageBody--read-more')}
        </button>
      ) : null}
    </span>
  );
}
