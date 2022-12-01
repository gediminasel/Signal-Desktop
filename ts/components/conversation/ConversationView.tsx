// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { join } from 'path';
import { SignalContext } from '../../windows/context';

export type PropsType = {
  id: string;
  renderCompositionArea: () => JSX.Element;
  renderConversationHeader: () => JSX.Element;
  renderTimeline: () => JSX.Element;
};

export const ConversationView = ({
  id,
  renderCompositionArea,
  renderConversationHeader,
  renderTimeline,
}: PropsType): JSX.Element => {
  const url = encodeURIComponent(
    join(SignalContext.config.userDataPath, 'bgs', `${id}.png`)
  );
  return (
    <div className="ConversationView">
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
    </div>
  );
}
