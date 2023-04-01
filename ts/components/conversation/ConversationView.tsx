// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { join } from 'path';
import { SignalContext } from '../../windows/context';
import { useEscapeHandling } from '../../hooks/useEscapeHandling';

export type PropsType = {
  conversationId: string;
  hasOpenModal: boolean;
  isSelectMode: boolean;
  onExitSelectMode: () => void;
  processAttachments: (options: {
    conversationId: string;
    files: ReadonlyArray<File>;
  }) => void;
  renderCompositionArea: () => JSX.Element;
  renderConversationHeader: () => JSX.Element;
  renderTimeline: () => JSX.Element;
  renderPanel: () => JSX.Element | undefined;
};

export function ConversationView({
  conversationId,
  hasOpenModal,
  isSelectMode,
  onExitSelectMode,
  processAttachments,
  renderCompositionArea,
  renderConversationHeader,
  renderTimeline,
  renderPanel,
}: PropsType): JSX.Element {
  const url = encodeURIComponent(
    join(SignalContext.config.userDataPath, 'bgs', `${conversationId}.png`)
  );
  const onDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer) {
        return;
      }

      if (event.dataTransfer.types[0] !== 'Files') {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      const { files } = event.dataTransfer;
      processAttachments({
        conversationId,
        files: Array.from(files),
      });
    },
    [conversationId, processAttachments]
  );

  const onPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!event.clipboardData) {
        return;
      }
      const { items } = event.clipboardData;

      const anyImages = [...items].some(
        item => item.type.split('/')[0] === 'image'
      );
      if (!anyImages) {
        return;
      }

      event.stopPropagation();
      event.preventDefault();

      const files: Array<File> = [];
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type.split('/')[0] === 'image') {
          const file = items[i].getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      processAttachments({
        conversationId,
        files,
      });
    },
    [conversationId, processAttachments]
  );

  useEscapeHandling(
    isSelectMode && !hasOpenModal ? onExitSelectMode : undefined
  );

  return (
    <div className="ConversationView" onDrop={onDrop} onPaste={onPaste}>
      <div className="ConversationView__header">
        {renderConversationHeader()}
      </div>
      <div
        className="ConversationView__pane main panel"
        style={{
          backgroundImage: `url('file:///${url}')`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="ConversationView__timeline--container">
          <div aria-live="polite" className="ConversationView__timeline">
            {renderTimeline()}
          </div>
        </div>
        <div className="ConversationView__composition-area">
          {renderCompositionArea()}
        </div>
      </div>
      {renderPanel()}
    </div>
  );
}
