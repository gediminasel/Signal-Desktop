// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { ServiceIdKind, StorageState, Proto } from '@signalapp/mock-server';
import type { PrimaryDevice } from '@signalapp/mock-server';
import createDebug from 'debug';

import * as durations from '../../util/durations';
import { generatePni, toUntaggedPni } from '../../types/ServiceId';
import { Bootstrap } from '../bootstrap';
import type { App } from '../bootstrap';

export const debug = createDebug('mock:test:pni-change');

describe('pnp/PNI Change', function needsName() {
  this.timeout(durations.MINUTE);
  this.retries(4);

  let bootstrap: Bootstrap;
  let app: App;
  let contactA: PrimaryDevice;
  let contactB: PrimaryDevice;

  beforeEach(async () => {
    bootstrap = new Bootstrap();
    await bootstrap.init();

    const { server, phone } = bootstrap;

    contactA = await server.createPrimaryDevice({
      profileName: 'contactA',
    });
    contactB = await server.createPrimaryDevice({
      profileName: 'contactB',
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      e164: phone.device.number,
    });

    state = state.addContact(
      contactA,
      {
        whitelisted: true,
        serviceE164: contactA.device.number,
        identityKey: contactA.getPublicKey(ServiceIdKind.PNI).serialize(),
        pni: toUntaggedPni(contactA.device.pni),
        givenName: 'ContactA',
      },
      ServiceIdKind.PNI
    );

    // Just to make PNI Contact visible in the left pane
    state = state.pin(contactA, ServiceIdKind.PNI);

    await phone.setStorageState(state);

    app = await bootstrap.link();
  });

  afterEach(async function after() {
    await bootstrap.maybeSaveLogs(this.currentTest, app);
    await app.close();
    await bootstrap.teardown();
  });

  it('shows no identity change if identity key is the same', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('#LeftPane');

      await leftPane
        .locator(
          `[data-testid="${contactA.device.getServiceIdByKind(
            ServiceIdKind.PNI
          )}"]`
        )
        .click();

      await window.locator('.module-conversation-hero').waitFor();
    }

    debug('Verify starting state');
    {
      // No messages
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 0, 'message count');

      // No notifications
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }

    debug('Send message to contactA');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('message to contactA');
      await compositionInput.press('Enter');
    }

    debug('Wait for the message to contactA');
    {
      const { source, body } = await contactA.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(
        body,
        'message to contactA',
        'message must have correct body'
      );
    }

    debug('Update pni on contactA via storage service');
    {
      const updatedPni = generatePni();

      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.pni === toUntaggedPni(contactA.device.pni)
          )
          .addContact(
            contactA,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: toUntaggedPni(updatedPni),
              identityKey: contactA.getPublicKey(ServiceIdKind.PNI).serialize(),
            },
            ServiceIdKind.PNI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Verify final state');
    {
      // One sent message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');

      // No notifications - PNI changed, but identity key is the same
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }
  });

  it('shows identity change if identity key has changed', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('#LeftPane');

      await leftPane
        .locator(
          `[data-testid="${contactA.device.getServiceIdByKind(
            ServiceIdKind.PNI
          )}"]`
        )
        .click();

      await window.locator('.module-conversation-hero').waitFor();
    }

    debug('Verify starting state');
    {
      // No messages
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 0, 'message count');

      // No notifications
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }

    debug('Send message to contactA');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('message to contactA');
      await compositionInput.press('Enter');
    }

    debug('Wait for the message to contactA');
    {
      const { source, body } = await contactA.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(
        body,
        'message to contactA',
        'message must have correct body'
      );
    }

    debug('Switch e164 to contactB via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.pni === toUntaggedPni(contactA.device.pni)
          )
          .addContact(
            contactB,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: toUntaggedPni(contactB.device.pni),

              // Key change - different identity key
              identityKey: contactB.publicKey.serialize(),
            },
            ServiceIdKind.PNI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Verify final state');
    {
      // One sent message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 1, 'message count');

      // One notification - the safety number change
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 1, 'notification count');

      const first = await notifications.first();
      assert.match(await first.innerText(), /Safety Number has changed/);
    }
  });

  it('shows identity change when sending to contact', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('#LeftPane');

      await leftPane
        .locator(
          `[data-testid="${contactA.device.getServiceIdByKind(
            ServiceIdKind.PNI
          )}"]`
        )
        .click();

      await window.locator('.module-conversation-hero').waitFor();
    }

    debug('Verify starting state');
    {
      // No messages
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 0, 'message count');

      // No notifications
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }

    debug('Send message to contactA');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('message to contactA');
      await compositionInput.press('Enter');
    }

    debug('Wait for the message to contactA');
    {
      const { source, body } = await contactA.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(
        body,
        'message to contactA',
        'message must have correct body'
      );
    }

    debug('Switch e164 to contactB via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.pni === toUntaggedPni(contactA.device.pni)
          )
          .addContact(
            contactB,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: toUntaggedPni(contactB.device.pni),

              // Note: No identityKey key provided here!
            },
            ServiceIdKind.PNI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Send message to contactB');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('message to contactB');
      await compositionInput.press('Enter');

      // We get a safety number change warning, because we get a different identity key!
      await window
        .locator('.module-SafetyNumberChangeDialog__confirm-dialog')
        .waitFor();

      await window.locator('.module-Button--primary').click();
    }

    debug('Wait for the message to contactB');
    {
      const { source, body } = await contactB.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(
        body,
        'message to contactB',
        'message must have correct body'
      );
    }

    debug('Verify final state');
    {
      // First message and second message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 2, 'message count');

      // One notification - the safety number change
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 1, 'notification count');

      const first = await notifications.first();
      assert.match(await first.innerText(), /Safety Number has changed/);
    }
  });

  it('Sends with no warning when key is the same', async () => {
    const { desktop, phone } = bootstrap;

    const window = await app.getWindow();

    debug('Open conversation with contactA');
    {
      const leftPane = window.locator('#LeftPane');

      await leftPane
        .locator(
          `[data-testid="${contactA.device.getServiceIdByKind(
            ServiceIdKind.PNI
          )}"]`
        )
        .click();

      await window.locator('.module-conversation-hero').waitFor();
    }

    debug('Verify starting state');
    {
      // No messages
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 0, 'message count');

      // No notifications
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }

    debug('Send message to contactA');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('message to contactA');
      await compositionInput.press('Enter');
    }

    debug('Wait for the message to contactA');
    {
      const { source, body } = await contactA.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(
        body,
        'message to contactA',
        'message must have correct body'
      );
    }

    debug('Switch e164 to contactB via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.pni === toUntaggedPni(contactA.device.pni)
          )
          .addContact(
            contactB,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: toUntaggedPni(contactB.device.pni),

              // Note: No identityKey key provided here!
            },
            ServiceIdKind.PNI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Switch e164 back to contactA via storage service');
    {
      const state = await phone.expectStorageState('consistency check');
      const updated = await phone.setStorageState(
        state
          .removeRecord(
            item =>
              item.record.contact?.pni === toUntaggedPni(contactB.device.pni)
          )
          .addContact(
            contactB,
            {
              identityState: Proto.ContactRecord.IdentityState.DEFAULT,
              whitelisted: true,
              serviceE164: contactA.device.number,
              pni: toUntaggedPni(contactA.device.pni),
            },
            ServiceIdKind.PNI
          )
      );

      const updatedStorageVersion = updated.version;

      await phone.sendFetchStorage({
        timestamp: bootstrap.getTimestamp(),
      });

      await app.waitForManifestVersion(updatedStorageVersion);
    }

    debug('Send message to contactA');
    {
      const compositionInput = await app.waitForEnabledComposer();

      await compositionInput.type('second message to contactA');
      await compositionInput.press('Enter');
    }

    debug('Wait for the message to contactA');
    {
      const { source, body } = await contactA.waitForMessage();

      assert.strictEqual(
        source,
        desktop,
        'first message must have valid source'
      );
      assert.strictEqual(
        body,
        'second message to contactA',
        'message must have correct body'
      );
    }

    debug('Verify final state');
    {
      // First message and second message
      const messages = window.locator('.module-message__text');
      assert.strictEqual(await messages.count(), 2, 'message count');

      // No notifications - the key is the same
      const notifications = window.locator('.SystemMessage');
      assert.strictEqual(await notifications.count(), 0, 'notification count');
    }
  });
});
