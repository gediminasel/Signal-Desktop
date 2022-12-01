// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, useState } from 'react';
import { noop, sortBy } from 'lodash';

import { SearchInput } from './SearchInput';
import { filterAndSortConversationsByRecent } from '../util/filterAndSortConversations';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { PropsType as StoriesSettingsModalPropsType } from './StoriesSettingsModal';
import {
  getI18nForMyStory,
  getListViewers,
  DistributionListSettingsModal,
  EditDistributionListModal,
  EditMyStoryPrivacy,
  Page as StoriesSettingsPage,
} from './StoriesSettingsModal';
import type { StoryDistributionListWithMembersDataType } from '../types/Stories';
import type { UUIDStringType } from '../types/UUID';
import { Alert } from './Alert';
import { Avatar, AvatarSize } from './Avatar';
import { Button, ButtonSize, ButtonVariant } from './Button';
import { Checkbox } from './Checkbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';

import { MY_STORY_ID, getStoryDistributionListName } from '../types/Stories';
import type { RenderModalPage, ModalPropsType } from './Modal';
import { PagedModal, ModalPage } from './Modal';
import { StoryDistributionListName } from './StoryDistributionListName';
import { Theme } from '../util/theme';
import { isNotNil } from '../util/isNotNil';
import { StoryImage } from './StoryImage';
import type { AttachmentType } from '../types/Attachment';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard';
import { getStoryBackground } from '../util/getStoryBackground';
import { makeObjectUrl, revokeObjectUrl } from '../types/VisualAttachment';

export type PropsType = {
  draftAttachment: AttachmentType;
  candidateConversations: Array<ConversationType>;
  distributionLists: Array<StoryDistributionListWithMembersDataType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  groupConversations: Array<ConversationType>;
  groupStories: Array<ConversationType>;
  hasFirstStoryPostExperience: boolean;
  ourConversationId: string | undefined;
  i18n: LocalizerType;
  me: ConversationType;
  onClose: () => unknown;
  onDeleteList: (listId: string) => unknown;
  onDistributionListCreated: (
    name: string,
    viewerUuids: Array<UUIDStringType>
  ) => unknown;
  onSelectedStoryList: (options: {
    conversationId: string;
    distributionId: string | undefined;
    uuids: Array<UUIDStringType>;
  }) => unknown;
  onSend: (
    listIds: Array<UUIDStringType>,
    conversationIds: Array<string>
  ) => unknown;
  signalConnections: Array<ConversationType>;
  toggleGroupsForStorySend: (cids: Array<string>) => unknown;
  mostRecentActiveStoryTimestampByGroupOrDistributionList: Record<
    string,
    number
  >;
} & Pick<
  StoriesSettingsModalPropsType,
  | 'onHideMyStoriesFrom'
  | 'onRemoveMembers'
  | 'onRepliesNReactionsChanged'
  | 'onViewersUpdated'
  | 'setMyStoriesToAllSignalConnections'
  | 'toggleSignalConnectionsModal'
>;

enum SendStoryPage {
  ChooseGroups = 'ChooseGroups',
  EditingDistributionList = 'EditingDistributionList',
  SendStory = 'SendStory',
  SetMyStoriesPrivacy = 'SetMyStoriesPrivacy',
}

const Page = {
  ...SendStoryPage,
  ...StoriesSettingsPage,
};

type PageType = SendStoryPage | StoriesSettingsPage;

function getListMemberUuids(
  list: StoryDistributionListWithMembersDataType,
  signalConnections: Array<ConversationType>
): Array<UUIDStringType> {
  const memberUuids = list.members.map(({ uuid }) => uuid).filter(isNotNil);

  if (list.id === MY_STORY_ID && list.isBlockList) {
    const excludeUuids = new Set<string>(memberUuids);
    return signalConnections
      .map(conversation => conversation.uuid)
      .filter(isNotNil)
      .filter(uuid => !excludeUuids.has(uuid));
  }

  return memberUuids;
}

export function SendStoryModal({
  draftAttachment,
  candidateConversations,
  distributionLists,
  getPreferredBadge,
  groupConversations,
  groupStories,
  hasFirstStoryPostExperience,
  i18n,
  me,
  ourConversationId,
  onClose,
  onDeleteList,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onSelectedStoryList,
  onSend,
  onViewersUpdated,
  setMyStoriesToAllSignalConnections,
  signalConnections,
  toggleGroupsForStorySend,
  mostRecentActiveStoryTimestampByGroupOrDistributionList,
  toggleSignalConnectionsModal,
}: PropsType): JSX.Element {
  const [page, setPage] = useState<PageType>(Page.SendStory);

  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard(i18n);

  const [selectedListIds, setSelectedListIds] = useState<Set<UUIDStringType>>(
    new Set()
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const selectedStoryNames = useMemo(
    () =>
      distributionLists
        .filter(list => selectedListIds.has(list.id))
        .map(list => list.name)
        .concat(
          groupStories
            .filter(group => selectedGroupIds.has(group.id))
            .map(group => group.title)
        ),
    [distributionLists, groupStories, selectedGroupIds, selectedListIds]
  );

  const [searchTerm, setSearchTerm] = useState('');

  const [filteredConversations, setFilteredConversations] = useState(
    filterAndSortConversationsByRecent(
      groupConversations,
      searchTerm,
      undefined
    )
  );

  const normalizedSearchTerm = searchTerm.trim();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterAndSortConversationsByRecent(
          groupConversations,
          normalizedSearchTerm,
          undefined
        )
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [groupConversations, normalizedSearchTerm, setFilteredConversations]);

  const [chosenGroupIds, setChosenGroupIds] = useState<Set<string>>(
    new Set<string>()
  );

  const chosenGroupNames = useMemo(
    () =>
      filteredConversations
        .filter(group => chosenGroupIds.has(group.id))
        .map(group => group.title),
    [filteredConversations, chosenGroupIds]
  );

  const [selectedContacts, setSelectedContacts] = useState<
    Array<ConversationType>
  >([]);

  const [hasAnnouncementsOnlyAlert, setHasAnnouncementsOnlyAlert] =
    useState(false);
  const [confirmRemoveGroupId, setConfirmRemoveGroupId] = useState<
    string | undefined
  >();
  const [confirmDeleteList, setConfirmDeleteList] = useState<
    { id: string; name: string } | undefined
  >();

  const [listIdToEdit, setListIdToEdit] = useState<string | undefined>();

  useEffect(() => {
    if (listIdToEdit) {
      setPage(Page.EditingDistributionList);
    } else {
      setPage(Page.SendStory);
    }
  }, [listIdToEdit]);

  const listToEdit = useMemo(() => {
    if (!listIdToEdit) {
      return;
    }

    return distributionLists.find(list => list.id === listIdToEdit);
  }, [distributionLists, listIdToEdit]);

  // myStoriesPrivacy, myStoriesPrivacyUuids, and myStories are only used
  // during the first time posting to My Stories experience where we have
  // to select the privacy settings.
  const ogMyStories = useMemo(
    () => distributionLists.find(list => list.id === MY_STORY_ID),
    [distributionLists]
  );

  const initialMyStories: StoryDistributionListWithMembersDataType = useMemo(
    () => ({
      allowsReplies: true,
      id: MY_STORY_ID,
      name: i18n('Stories__mine'),
      isBlockList: ogMyStories?.isBlockList ?? true,
      members: ogMyStories?.members || [],
    }),
    [i18n, ogMyStories]
  );

  const initialMyStoriesMemberUuids = useMemo(
    () => (ogMyStories?.members || []).map(({ uuid }) => uuid).filter(isNotNil),
    [ogMyStories]
  );

  const [stagedMyStories, setStagedMyStories] =
    useState<StoryDistributionListWithMembersDataType>(initialMyStories);

  const [stagedMyStoriesMemberUuids, setStagedMyStoriesMemberUuids] = useState<
    Array<UUIDStringType>
  >(initialMyStoriesMemberUuids);

  let selectedNames: string | undefined;
  if (page === Page.ChooseGroups) {
    selectedNames = chosenGroupNames.join(', ');
  } else {
    selectedNames = selectedStoryNames
      .map(listName => getStoryDistributionListName(i18n, listName, listName))
      .join(', ');
  }

  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let url: undefined | string;

    if (draftAttachment.url) {
      setObjectUrl(draftAttachment.url);
    } else if (draftAttachment.data) {
      url = makeObjectUrl(draftAttachment.data, draftAttachment.contentType);
      setObjectUrl(url);
    }
    return () => {
      if (url) {
        revokeObjectUrl(url);
      }
    };
  }, [setObjectUrl, draftAttachment]);

  const modalCommonProps: Pick<ModalPropsType, 'hasXButton' | 'i18n'> = {
    hasXButton: true,
    i18n,
  };

  let modal: RenderModalPage;
  if (page === Page.SetMyStoriesPrivacy) {
    const footer = (
      <>
        <div />
        <div>
          <Button
            onClick={() => setPage(Page.SendStory)}
            variant={ButtonVariant.Secondary}
          >
            {i18n('cancel')}
          </Button>
          <Button
            onClick={() => {
              if (stagedMyStories.isBlockList) {
                if (stagedMyStories.members.length) {
                  onHideMyStoriesFrom(stagedMyStoriesMemberUuids);
                } else {
                  setMyStoriesToAllSignalConnections();
                }
              } else {
                onViewersUpdated(MY_STORY_ID, stagedMyStoriesMemberUuids);
              }

              setSelectedContacts([]);
              setPage(Page.SendStory);
            }}
            variant={ButtonVariant.Primary}
          >
            {i18n('save')}
          </Button>
        </div>
      </>
    );

    modal = handleClose => (
      <ModalPage
        modalName="SendStoryModal__my-stories-privacy"
        title={i18n('SendStoryModal__my-stories-privacy')}
        modalFooter={footer}
        onClose={handleClose}
        {...modalCommonProps}
      >
        <EditMyStoryPrivacy
          hasDisclaimerAbove
          i18n={i18n}
          learnMore="SendStoryModal__privacy-disclaimer"
          myStories={stagedMyStories}
          signalConnectionsCount={signalConnections.length}
          onClickExclude={() => {
            let nextSelectedContacts = stagedMyStories.members;

            if (!stagedMyStories.isBlockList) {
              setStagedMyStories(myStories => ({
                ...myStories,
                isBlockList: true,
                members: [],
              }));
              nextSelectedContacts = [];
            }

            setSelectedContacts(nextSelectedContacts);

            setPage(Page.HideStoryFrom);
          }}
          onClickOnlyShareWith={() => {
            if (!stagedMyStories.isBlockList) {
              setSelectedContacts(stagedMyStories.members);
            } else {
              setStagedMyStories(myStories => ({
                ...myStories,
                isBlockList: false,
                members: [],
              }));
            }

            setPage(Page.AddViewer);
          }}
          setSelectedContacts={setSelectedContacts}
          setMyStoriesToAllSignalConnections={() => {
            setStagedMyStories(myStories => ({
              ...myStories,
              isBlockList: true,
              members: [],
            }));
            setSelectedContacts([]);
          }}
          toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        />
      </ModalPage>
    );
  } else if (page === Page.EditingDistributionList && listToEdit) {
    modal = handleClose => (
      <DistributionListSettingsModal
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        listToEdit={listToEdit}
        signalConnectionsCount={signalConnections.length}
        onRemoveMembers={onRemoveMembers}
        onRepliesNReactionsChanged={onRepliesNReactionsChanged}
        setConfirmDeleteList={setConfirmDeleteList}
        setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
        setPage={setPage}
        setSelectedContacts={setSelectedContacts}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        onBackButtonClick={() =>
          confirmDiscardIf(selectedContacts.length > 0, () =>
            setListIdToEdit(undefined)
          )
        }
        onClose={handleClose}
      />
    );
  } else if (
    page === Page.ChooseViewers ||
    page === Page.NameStory ||
    page === Page.AddViewer ||
    page === Page.HideStoryFrom
  ) {
    modal = handleClose => (
      <EditDistributionListModal
        candidateConversations={candidateConversations}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        onCreateList={(name, uuids) => {
          setSelectedContacts([]);
          onDistributionListCreated(name, uuids);
          setPage(Page.SendStory);
        }}
        onViewersUpdated={uuids => {
          if (listIdToEdit && page === Page.AddViewer) {
            onViewersUpdated(listIdToEdit, uuids);
            setPage(Page.EditingDistributionList);
          } else if (page === Page.ChooseViewers) {
            setPage(Page.NameStory);
          } else if (listIdToEdit && page === Page.HideStoryFrom) {
            onHideMyStoriesFrom(uuids);
            setPage(Page.SendStory);
          } else if (page === Page.HideStoryFrom || page === Page.AddViewer) {
            setStagedMyStoriesMemberUuids(uuids);
            setPage(Page.SetMyStoriesPrivacy);
          } else {
            setPage(Page.SendStory);
          }
        }}
        page={page}
        onClose={handleClose}
        onBackButtonClick={() =>
          confirmDiscardIf(selectedContacts.length > 0, () => {
            if (listIdToEdit) {
              if (
                page === Page.AddViewer ||
                page === Page.HideStoryFrom ||
                page === Page.ChooseViewers
              ) {
                setPage(Page.EditingDistributionList);
              } else {
                setListIdToEdit(undefined);
              }
            } else if (page === Page.HideStoryFrom || page === Page.AddViewer) {
              setSelectedContacts([]);
              setStagedMyStories(initialMyStories);
              setStagedMyStoriesMemberUuids(initialMyStoriesMemberUuids);
              setPage(Page.SetMyStoriesPrivacy);
            } else if (page === Page.ChooseViewers) {
              setSelectedContacts([]);
              setPage(Page.SendStory);
            } else if (page === Page.NameStory) {
              setPage(Page.ChooseViewers);
            }
          })
        }
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
      />
    );
  } else if (page === Page.ChooseGroups) {
    const footer = (
      <>
        <div className="SendStoryModal__selected-lists">{selectedNames}</div>
        {selectedNames.length > 0 && (
          <button
            aria-label={i18n('ok')}
            className="SendStoryModal__ok"
            disabled={!chosenGroupIds.size}
            onClick={() => {
              toggleGroupsForStorySend(Array.from(chosenGroupIds));
              setChosenGroupIds(new Set());
              setPage(Page.SendStory);
            }}
            type="button"
          />
        )}
      </>
    );

    modal = handleClose => (
      <ModalPage
        modalName="SendStoryModal__choose-groups"
        title={i18n('SendStoryModal__choose-groups')}
        moduleClassName="SendStoryModal"
        modalFooter={footer}
        onClose={handleClose}
        {...modalCommonProps}
      >
        <SearchInput
          disabled={groupConversations.length === 0}
          i18n={i18n}
          placeholder={i18n('contactSearchPlaceholder')}
          moduleClassName="StoriesSettingsModal__search"
          onChange={event => {
            setSearchTerm(event.target.value);
          }}
          value={searchTerm}
        />
        {filteredConversations.length ? (
          filteredConversations.map(group => (
            <Checkbox
              checked={chosenGroupIds.has(group.id)}
              key={group.id}
              label={group.title}
              moduleClassName="SendStoryModal__distribution-list"
              name="SendStoryModal__distribution-list"
              onChange={(value: boolean) => {
                if (group.announcementsOnly && !group.areWeAdmin) {
                  setHasAnnouncementsOnlyAlert(true);
                  return;
                }

                setChosenGroupIds(groupIds => {
                  if (value) {
                    groupIds.add(group.id);
                  } else {
                    groupIds.delete(group.id);
                  }
                  return new Set([...groupIds]);
                });
              }}
            >
              {({ id, checkboxNode }) => (
                <>
                  <label
                    className="SendStoryModal__distribution-list__label"
                    htmlFor={id}
                  >
                    <Avatar
                      acceptedMessageRequest={group.acceptedMessageRequest}
                      avatarPath={group.avatarPath}
                      badge={undefined}
                      color={group.color}
                      conversationType={group.type}
                      i18n={i18n}
                      isMe={false}
                      sharedGroupNames={[]}
                      size={AvatarSize.THIRTY_SIX}
                      title={group.title}
                    />

                    <div className="SendStoryModal__distribution-list__info">
                      <div className="SendStoryModal__distribution-list__name">
                        {group.title}
                      </div>

                      <div className="SendStoryModal__distribution-list__description">
                        {i18n('icu:ConversationHero--members', {
                          count: group.membersCount,
                        })}
                      </div>
                    </div>
                  </label>
                  {checkboxNode}
                </>
              )}
            </Checkbox>
          ))
        ) : (
          <div className="module-ForwardMessageModal__no-candidate-contacts">
            {i18n('noGroupsFound')}
          </div>
        )}
      </ModalPage>
    );
  } else {
    const footer = (
      <>
        <div className="SendStoryModal__selected-lists">{selectedNames}</div>
        {selectedNames.length > 0 && (
          <button
            aria-label={i18n('SendStoryModal__send')}
            className="SendStoryModal__send"
            disabled={!selectedListIds.size && !selectedGroupIds.size}
            onClick={() => {
              onSend(Array.from(selectedListIds), Array.from(selectedGroupIds));
            }}
            type="button"
          />
        )}
      </>
    );

    const attachment = {
      ...draftAttachment,
      url: objectUrl,
    };

    // my stories always first, the rest sorted by recency
    const fullList = sortBy(
      [...groupStories, ...distributionLists],
      listOrGroup => {
        if (listOrGroup.id === MY_STORY_ID) {
          return Number.NEGATIVE_INFINITY;
        }
        return (
          (mostRecentActiveStoryTimestampByGroupOrDistributionList[
            listOrGroup.id
          ] ?? 0) * -1
        );
      }
    );

    const renderDistributionList = (
      list: StoryDistributionListWithMembersDataType
    ): JSX.Element => {
      return (
        <Checkbox
          checked={selectedListIds.has(list.id)}
          key={list.id}
          label={getStoryDistributionListName(i18n, list.id, list.name)}
          moduleClassName="SendStoryModal__distribution-list"
          name="SendStoryModal__distribution-list"
          onChange={(value: boolean) => {
            if (
              list.id === MY_STORY_ID &&
              hasFirstStoryPostExperience &&
              value
            ) {
              setPage(Page.SetMyStoriesPrivacy);
              return;
            }

            setSelectedListIds(listIds => {
              if (value) {
                listIds.add(list.id);
              } else {
                listIds.delete(list.id);
              }
              return new Set([...listIds]);
            });
            if (value && ourConversationId) {
              onSelectedStoryList({
                conversationId: ourConversationId,
                distributionId: list.id,
                uuids: getListMemberUuids(list, signalConnections),
              });
            }
          }}
        >
          {({ id, checkboxNode }) => (
            <ContextMenu
              i18n={i18n}
              menuOptions={
                list.id === MY_STORY_ID
                  ? [
                      {
                        label: i18n('StoriesSettings__context-menu'),
                        icon: 'SendStoryModal__icon--delete',
                        onClick: () => setListIdToEdit(list.id),
                      },
                    ]
                  : [
                      {
                        label: i18n('StoriesSettings__context-menu'),
                        icon: 'SendStoryModal__icon--settings',
                        onClick: () => setListIdToEdit(list.id),
                      },
                      {
                        label: i18n('SendStoryModal__delete-story'),
                        icon: 'SendStoryModal__icon--delete',
                        onClick: () => setConfirmDeleteList(list),
                      },
                    ]
              }
              moduleClassName="SendStoryModal__distribution-list-context"
              onClick={noop}
              popperOptions={{
                placement: 'bottom',
                strategy: 'absolute',
              }}
              theme={Theme.Dark}
            >
              <label
                className="SendStoryModal__distribution-list__label"
                htmlFor={id}
              >
                {list.id === MY_STORY_ID ? (
                  <Avatar
                    acceptedMessageRequest={me.acceptedMessageRequest}
                    avatarPath={me.avatarPath}
                    badge={undefined}
                    color={me.color}
                    conversationType={me.type}
                    i18n={i18n}
                    isMe
                    sharedGroupNames={me.sharedGroupNames}
                    size={AvatarSize.THIRTY_SIX}
                    title={me.title}
                  />
                ) : (
                  <span className="StoriesSettingsModal__list__avatar--custom" />
                )}

                <div className="SendStoryModal__distribution-list__info">
                  <div className="SendStoryModal__distribution-list__name">
                    <StoryDistributionListName
                      i18n={i18n}
                      id={list.id}
                      name={list.name}
                    />
                  </div>

                  <div className="SendStoryModal__distribution-list__description">
                    {hasFirstStoryPostExperience && list.id === MY_STORY_ID ? (
                      i18n('SendStoryModal__choose-who-can-view')
                    ) : (
                      <>
                        <span className="SendStoryModal__rtl-span">
                          {list.id === MY_STORY_ID
                            ? getI18nForMyStory(list, i18n)
                            : i18n('SendStoryModal__custom-story')}
                        </span>
                        <span className="SendStoryModal__rtl-span">
                          &nbsp;&middot;&nbsp;
                        </span>
                        <span className="SendStoryModal__rtl-span">
                          {list.isBlockList && list.members.length > 0
                            ? i18n('icu:SendStoryModal__excluded', {
                                count: list.members.length,
                              })
                            : getListViewers(list, i18n, signalConnections)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </label>
              {checkboxNode}
            </ContextMenu>
          )}
        </Checkbox>
      );
    };

    const renderGroup = (group: ConversationType) => {
      return (
        <Checkbox
          checked={selectedGroupIds.has(group.id)}
          key={group.id}
          label={group.title}
          moduleClassName="SendStoryModal__distribution-list"
          name="SendStoryModal__distribution-list"
          onChange={(value: boolean) => {
            if (!group.memberships) {
              return;
            }

            if (group.announcementsOnly && !group.areWeAdmin) {
              setHasAnnouncementsOnlyAlert(true);
              return;
            }

            setSelectedGroupIds(groupIds => {
              if (value) {
                groupIds.add(group.id);
              } else {
                groupIds.delete(group.id);
              }
              return new Set([...groupIds]);
            });
            if (value) {
              onSelectedStoryList({
                conversationId: group.id,
                distributionId: undefined,
                uuids: group.memberships.map(({ uuid }) => uuid),
              });
            }
          }}
        >
          {({ id, checkboxNode }) => (
            <ContextMenu
              i18n={i18n}
              menuOptions={[
                {
                  label: i18n('SendStoryModal__delete-story'),
                  icon: 'SendStoryModal__icon--delete',
                  onClick: () => setConfirmRemoveGroupId(group.id),
                },
              ]}
              moduleClassName="SendStoryModal__distribution-list-context"
              onClick={noop}
              popperOptions={{
                placement: 'bottom',
                strategy: 'absolute',
              }}
              theme={Theme.Dark}
            >
              <label
                className="SendStoryModal__distribution-list__label"
                htmlFor={id}
              >
                <Avatar
                  acceptedMessageRequest={group.acceptedMessageRequest}
                  avatarPath={group.avatarPath}
                  badge={undefined}
                  color={group.color}
                  conversationType={group.type}
                  i18n={i18n}
                  isMe={false}
                  sharedGroupNames={[]}
                  size={AvatarSize.THIRTY_SIX}
                  title={group.title}
                />

                <div className="SendStoryModal__distribution-list__info">
                  <div className="SendStoryModal__distribution-list__name">
                    {group.title}
                  </div>

                  <div className="SendStoryModal__distribution-list__description">
                    <span className="SendStoryModal__rtl-span">
                      {i18n('SendStoryModal__group-story')}
                    </span>
                    <span className="SendStoryModal__rtl-span">
                      &nbsp;&middot;&nbsp;
                    </span>
                    <span className="SendStoryModal__rtl-span">
                      {i18n('icu:ConversationHero--members', {
                        count: group.membersCount,
                      })}
                    </span>
                  </div>
                </div>
              </label>
              {checkboxNode}
            </ContextMenu>
          )}
        </Checkbox>
      );
    };

    modal = handleClose => (
      <ModalPage
        modalName="SendStoryModal__title"
        title={i18n('SendStoryModal__title')}
        moduleClassName="SendStoryModal"
        modalFooter={footer}
        onClose={handleClose}
        {...modalCommonProps}
      >
        <div
          className="SendStoryModal__story-preview"
          style={{ backgroundImage: getStoryBackground(attachment) }}
        >
          <StoryImage
            i18n={i18n}
            firstName={i18n('you')}
            queueStoryDownload={noop}
            storyId="story-id"
            label="label"
            moduleClassName="SendStoryModal__story"
            attachment={attachment}
          />
        </div>
        <div className="SendStoryModal__top-bar">
          {i18n('stories')}
          <ContextMenu
            aria-label={i18n('SendStoryModal__new')}
            i18n={i18n}
            menuOptions={[
              {
                label: i18n('SendStoryModal__new-custom--title'),
                description: i18n('SendStoryModal__new-custom--description'),
                icon: 'SendStoryModal__icon--custom',
                onClick: () => setPage(Page.ChooseViewers),
              },
              {
                label: i18n('SendStoryModal__new-group--title'),
                description: i18n('SendStoryModal__new-group--description'),
                icon: 'SendStoryModal__icon--group',
                onClick: () => setPage(Page.ChooseGroups),
              },
            ]}
            moduleClassName="SendStoryModal__new-story"
            popperOptions={{
              placement: 'bottom',
              strategy: 'absolute',
            }}
            theme={Theme.Dark}
          >
            {({ openMenu, onKeyDown, ref, menuNode }) => (
              <div>
                <Button
                  ref={ref}
                  className="SendStoryModal__new-story__button"
                  variant={ButtonVariant.Secondary}
                  size={ButtonSize.Small}
                  onClick={openMenu}
                  onKeyDown={onKeyDown}
                >
                  {i18n('SendStoryModal__new')}
                </Button>
                {menuNode}
              </div>
            )}
          </ContextMenu>
        </div>
        {fullList.map(listOrGroup =>
          // only group has a type field
          'type' in listOrGroup
            ? renderGroup(listOrGroup)
            : renderDistributionList(listOrGroup)
        )}
      </ModalPage>
    );
  }

  return (
    <>
      {!confirmDiscardModal && (
        <PagedModal
          modalName="SendStoryModal"
          theme={Theme.Dark}
          onClose={() => confirmDiscardIf(selectedContacts.length > 0, onClose)}
        >
          {modal}
        </PagedModal>
      )}
      {hasAnnouncementsOnlyAlert && (
        <Alert
          body={i18n('SendStoryModal__announcements-only')}
          i18n={i18n}
          onClose={() => setHasAnnouncementsOnlyAlert(false)}
          theme={Theme.Dark}
        />
      )}
      {confirmRemoveGroupId && (
        <ConfirmationDialog
          dialogName="SendStoryModal.confirmRemoveGroupId"
          actions={[
            {
              action: () => {
                toggleGroupsForStorySend([confirmRemoveGroupId]);
                setConfirmRemoveGroupId(undefined);
              },
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveGroupId(undefined);
          }}
          theme={Theme.Dark}
        >
          {i18n('SendStoryModal__confirm-remove-group')}
        </ConfirmationDialog>
      )}
      {confirmDeleteList && (
        <ConfirmationDialog
          dialogName="SendStoryModal.confirmDeleteList"
          actions={[
            {
              action: () => {
                onDeleteList(confirmDeleteList.id);
                setConfirmDeleteList(undefined);
              },
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmDeleteList(undefined);
          }}
          theme={Theme.Dark}
        >
          {i18n('StoriesSettings__delete-list--confirm', [
            confirmDeleteList.name,
          ])}
        </ConfirmationDialog>
      )}
      {confirmDiscardModal}
    </>
  );
}
