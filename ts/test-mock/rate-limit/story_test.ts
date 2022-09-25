// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import createDebug from 'debug';
import { Proto, StorageState } from '@signalapp/mock-server';

import * as durations from '../../util/durations';
import { uuidToBytes } from '../../util/uuidToBytes';
import { MY_STORIES_ID } from '../../types/Stories';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:rate-limit');

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

describe('rate-limit/story', function needsName() {
  this.timeout(durations.MINUTE);

  let bootstrap: Bootstrap;
  let app: App;

  beforeEach(async () => {
    bootstrap = new Bootstrap({
      contactCount: 0,
      contactsWithoutProfileKey: 40,
    });
    await bootstrap.init();

    const { phone } = bootstrap;

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
      givenName: phone.profileName,
      hasSetMyStoriesPrivacy: true,
    });

    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORIES_ID),
          isBlockList: true,
          name: MY_STORIES_ID,
          recipientUuids: [],
        },
      },
    });
    phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function after() {
    if (this.currentTest?.state !== 'passed') {
      await bootstrap.saveLogs(app);
    }

    await app.close();
    await bootstrap.teardown();
  });

  it('should request challenge and accept solution', async () => {
    const {
      server,
      contactsWithoutProfileKey: contacts,
      phone,
      desktop,
    } = bootstrap;

    for (const contact of contacts) {
      server.rateLimit({ source: desktop.uuid, target: contact.device.uuid });
    }

    const window = await app.getWindow();

    debug('Posting a new story');
    {
      const storiesPane = window.locator('.Stories');

      await window.locator('button.module-main-header__stories-icon').click();

      await storiesPane
        .locator('button.Stories__pane__add-story__button')
        .click();
      await storiesPane
        .locator(
          '.ContextMenu__popper .Stories__pane__add-story__option--title ' +
            '>> "Text story"'
        )
        .click();

      debug('Focusing textarea');
      await storiesPane.locator('.TextAttachment__story').click();

      debug('Entering text');
      await storiesPane.locator('.TextAttachment__text__textarea').type('123');

      debug('Clicking "Next"');
      await storiesPane
        .locator('.StoryCreator__toolbar button >> "Next"')
        .click();

      debug('Selecting "My Stories"');
      await window
        .locator('.SendStoryModal__distribution-list__name >> "My Stories"')
        .click();

      debug('Hitting Send');
      await window.locator('button.SendStoryModal__send').click();
    }

    debug('Waiting for challenge');
    const request = await app.waitForChallenge();

    debug('Checking for presence of captcha modal');
    await window
      .locator('.module-Modal__title >> "Verify to continue messaging"')
      .waitFor();

    debug('Removing rate-limiting');
    for (const contact of contacts) {
      const failedMessages = server.stopRateLimiting({
        source: desktop.uuid,
        target: contact.device.uuid,
      });
      assert.isAtMost(failedMessages ?? 0, 1);
    }

    debug('Solving challenge');
    app.solveChallenge({
      seq: request.seq,
      data: { captcha: 'anything' },
    });

    debug('Verifying that all contacts received story');
    await Promise.all(
      contacts.map(async contact => {
        const { storyMessage } = await contact.waitForStory();
        assert.isTrue(
          phone.profileKey
            .serialize()
            .equals(storyMessage.profileKey ?? new Uint8Array(0))
        );
        assert.strictEqual(storyMessage.textAttachment?.text, '123');
      })
    );
  });
});
