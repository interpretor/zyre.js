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
      mailbox: 51409,
      ifaceData: ZHelper.getIfData(),
      zyrePeers: new ZyrePeers(),
    });

    assert.instanceOf(zBeacon, ZBeacon);
  });

  it('should start broadcasting the zre beacon, listen to foreign beacons and stop when a beacon is received', (done) => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);
    const zyrePeers = new ZyrePeers();
    const zBeacon = new ZBeacon({
      identity,
      mailbox: 51409,
      ifaceData: ZHelper.getIfData(),
      zyrePeers,
    });

    const identity2 = Buffer.alloc(16);
    uuid.v4(null, identity2, 0);
    const zBeacon2 = new ZBeacon({
      identity: identity2,
      mailbox: 51410,
      ifaceData: ZHelper.getIfData(),
      zyrePeers: new ZyrePeers(),
    });

    zyrePeers.on('new', (peer) => {
      assert.equal(peer._identity, identity2.toString('hex'));
      zBeacon.stop();
      zBeacon2.stop();
      done();
    });

    zBeacon.startListening().then(() => {
      zBeacon2.startBroadcasting();
    });
  });
});
