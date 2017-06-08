/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const uuid = require('uuid');
const ZHelper = require('../lib/zhelper');
const ZBeacon = require('../lib/zbeacon');
const ZyrePeers = require('../lib/zyre_peers');

describe('ZBeacon', () => {
  it('should create an instance of ZBeacon', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zBeacon = new ZBeacon({
      identity,
      address: ZHelper.getIfData().address,
      mailbox: 51409,
      zyrePeers: new ZyrePeers(identity),
    });

    assert.instanceOf(zBeacon, ZBeacon);
  });

  it('should start broadcasting the zre beacon, listen to foreign beacons and push discovered peers', (done) => {
    const address = ZHelper.getIfData().address;

    // Peer 1
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new ZyrePeers(identity);

    const zBeacon = new ZBeacon({
      identity,
      address,
      mailbox: 51409,
      zyrePeers,
    });

    // Peer 2
    const identity2 = Buffer.alloc(16);
    uuid.v4(null, identity2, 0);

    const mailbox2 = 51410;

    const zBeacon2 = new ZBeacon({
      identity: identity2,
      address,
      mailbox: mailbox2,
      zyrePeers: new ZyrePeers(identity2),
    });

    zyrePeers.on('new', (peer) => {
      assert.equal(peer.getIdentity(), identity2.toString('hex'));
      assert.equal(peer._endpoint, `tcp://${address}:${mailbox2}`);
      zBeacon.stop().then(() => {
        zBeacon2.stop().then(() => {
          zyrePeers.closeAll();
          setTimeout(() => { done(); }, 200);
        });
      });
    });

    zBeacon.startListening().then(() => {
      zBeacon2.startBroadcasting();
    });
  });
});
