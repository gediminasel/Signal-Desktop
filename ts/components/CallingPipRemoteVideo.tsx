// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useEffect } from 'react';
import { clamp, maxBy } from 'lodash';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import { Avatar, AvatarSize } from './Avatar';
import { CallBackgroundBlur } from './CallBackgroundBlur';
import { DirectCallRemoteParticipant } from './DirectCallRemoteParticipant';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import type { LocalizerType } from '../types/Util';
import type {
  ActiveCallType,
  GroupCallRemoteParticipantType,
  GroupCallVideoRequest,
} from '../types/Calling';
import { CallMode } from '../types/Calling';
import { AvatarColors } from '../types/Colors';
import type { SetRendererCanvasType } from '../state/ducks/calling';
import { useGetCallingFrameBuffer } from '../calling/useGetCallingFrameBuffer';
import { MAX_FRAME_WIDTH } from '../calling/constants';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { missingCaseError } from '../util/missingCaseError';
import { nonRenderedRemoteParticipant } from '../util/ringrtc/nonRenderedRemoteParticipant';
import { isReconnecting } from '../util/callingIsReconnecting';
import { isGroupOrAdhocActiveCall } from '../util/isGroupOrAdhocCall';
import { assertDev } from '../util/assert';

// This value should be kept in sync with the hard-coded CSS height. It should also be
//   less than `MAX_FRAME_HEIGHT`.

function NoVideo({
  activeCall,
  i18n,
  height,
}: {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
  height: number;
}): JSX.Element {
  const {
    acceptedMessageRequest,
    avatarPath,
    color,
    isMe,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
  } = activeCall.conversation;

  return (
    <div
      className="module-calling-pip__video--remote"
      style={{ height: `${height}px` }}
    >
      <CallBackgroundBlur avatarPath={avatarPath}>
        <div className="module-calling-pip__video--avatar">
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarPath={avatarPath}
            badge={undefined}
            color={color || AvatarColors[0]}
            noteToSelf={false}
            conversationType="direct"
            i18n={i18n}
            isMe={isMe}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
            size={AvatarSize.FORTY_EIGHT}
            sharedGroupNames={sharedGroupNames}
          />
        </div>
      </CallBackgroundBlur>
    </div>
  );
}

export type PropsType = {
  activeCall: ActiveCallType;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  setGroupCallVideoRequest: (
    _: Array<GroupCallVideoRequest>,
    speakerHeight: number
  ) => void;
  setRendererCanvas: (_: SetRendererCanvasType) => void;
  height: number;
};

export function CallingPipRemoteVideo({
  activeCall,
  getGroupCallVideoFrameSource,
  i18n,
  setGroupCallVideoRequest,
  setRendererCanvas,
  height,
}: PropsType): JSX.Element {
  const { conversation } = activeCall;

  const getGroupCallFrameBuffer = useGetCallingFrameBuffer();

  const isPageVisible = usePageVisibility();

  const activeGroupCallSpeaker: undefined | GroupCallRemoteParticipantType =
    useMemo(() => {
      if (!isGroupOrAdhocActiveCall(activeCall)) {
        return undefined;
      }

      return maxBy(activeCall.remoteParticipants, participant =>
        participant.presenting ? Infinity : participant.speakerTime || -Infinity
      );
    }, [activeCall]);

  useEffect(() => {
    if (!isGroupOrAdhocActiveCall(activeCall)) {
      return;
    }

    if (isPageVisible) {
      setGroupCallVideoRequest(
        activeCall.remoteParticipants.map(participant => {
          if (participant === activeGroupCallSpeaker) {
            return {
              demuxId: participant.demuxId,
              width: clamp(
                Math.floor(height * participant.videoAspectRatio),
                1,
                MAX_FRAME_WIDTH
              ),
              height,
            };
          }
          return nonRenderedRemoteParticipant(participant);
        }),
        height
      );
    } else {
      setGroupCallVideoRequest(
        activeCall.remoteParticipants.map(nonRenderedRemoteParticipant),
        0
      );
    }
  }, [
    activeCall,
    activeGroupCallSpeaker,
    isPageVisible,
    setGroupCallVideoRequest,
    height,
  ]);

  switch (activeCall.callMode) {
    case CallMode.Direct: {
      const { hasRemoteVideo } = activeCall.remoteParticipants[0];
      if (!hasRemoteVideo) {
        return <NoVideo activeCall={activeCall} i18n={i18n} height={height} />;
      }
      assertDev(
        conversation.type === 'direct',
        'CallingPipRemoteVideo for direct call must be associated with direct conversation'
      );
      return (
        <div
          className="module-calling-pip__video--remote"
          style={{ height: `${height}px` }}
        >
          <DirectCallRemoteParticipant
            conversation={conversation}
            hasRemoteVideo={hasRemoteVideo}
            i18n={i18n}
            isReconnecting={isReconnecting(activeCall)}
            setRendererCanvas={setRendererCanvas}
          />
        </div>
      );
    }
    case CallMode.Group:
    case CallMode.Adhoc:
      if (!activeGroupCallSpeaker) {
        return <NoVideo activeCall={activeCall} i18n={i18n} height={height} />;
      }
      return (
        <div
          className="module-calling-pip__video--remote"
          style={{ height: `${height}px` }}
        >
          <GroupCallRemoteParticipant
            getFrameBuffer={getGroupCallFrameBuffer}
            getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
            i18n={i18n}
            isInPip
            remoteParticipant={activeGroupCallSpeaker}
            remoteParticipantsCount={activeCall.remoteParticipants.length}
            isActiveSpeakerInSpeakerView={false}
            isCallReconnecting={isReconnecting(activeCall)}
          />
        </div>
      );
    default:
      throw missingCaseError(activeCall);
  }
}
