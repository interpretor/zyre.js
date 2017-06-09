/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const uuid = require('uuid');
const dgram = require('dgram');
const EventEmitter = require('events');
const ZHelper = require('../lib/zhelper');
const ZBeacon = require('../lib/zbeacon');

describe('ZBeacon', () => {
  // ZyrePeers mock
  class Peers extends EventEmitter {
    push({ identity, address, mailbox }) {
      this.emit('new', identity, address, mailbox);
    }
  }

  it('should create an instance of ZBeacon', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zBeacon = new ZBeacon({
      identity,
      mailbox: 51409,
      broadcast: ZHelper.getIfData().broadcast,
      zyrePeers: new Peers(),
    });

    assert.instanceOf(zBeacon, ZBeacon);
  });

  it('should start broadcasting the zre beacon, listen to foreign beacons and push discovered peers', (done) => {
    const ifData = ZHelper.getIfData();
    const address = ifData.address; // The local address, which is the sender of the udp package
    const broadcast = ifData.broadcast;

    // Init Peer 1
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);
    const mailbox = 51409;
    const zyrePeers = new Peers();

    const zBeacon = new ZBeacon({
      identity,
      mailbox,
      broadcast,
      zyrePeers,
    });

    // Init Peer 2
    const identity2 = Buffer.alloc(16);
    uuid.v4(null, identity2, 0);
    const mailbox2 = 51410;
    const zyrePeers2 = new Peers();

    const zBeacon2 = new ZBeacon({
      identity: identity2,
      mailbox: mailbox2,
      broadcast,
      zyrePeers: zyrePeers2,
    });

    // Init test
    let hit = false;

    zyrePeers.on('new', (id, addr, mb) => {
      assert.equal(id, identity2.toString('hex'));
      assert.equal(addr, address);
      assert.equal(mb, mailbox2);
      hit = true;
    });

    const stopAll = () => {
      zBeacon.stop().then(() => {
        zBeacon2.stop().then(() => {
          if (hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    zBeacon.start().then(() => {
      zBeacon2.start().then(() => {
        setTimeout(stopAll, 100);
      });
    });
  });

  it('should discard corrupted udp packages', (done) => {
    const ifData = ZHelper.getIfData();
    const broadcast = ifData.broadcast;
    const port = 5670;

    // Init Peer
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);
    const mailbox = 51409;
    const zyrePeers = new Peers();

    const zBeacon = new ZBeacon({
      identity,
      mailbox,
      broadcast,
      port,
      zyrePeers,
    });

    // Init socket
    const socket = dgram.createSocket('udp4');

    // Init test
    let hit = false;

    zyrePeers.on('new', () => {
      hit = true;
    });

    const broadcastWrongLength = () => {
      const buf = Buffer.alloc(18);
      buf.fill('a');
      socket.send(buf, port, broadcast);
    };

    const broadcastWrongHeader = () => {
      const buf = Buffer.alloc(22);
      buf.fill('a');
      socket.send(buf, port, broadcast);
    };

    const stopAll = () => {
      zBeacon.stop().then(() => {
        socket.close(() => {
          if (!hit) setTimeout(() => { done(); }, 100);
        });
      });
    };

    zBeacon.start().then(() => {
      socket.bind(() => {
        socket.setBroadcast(true);
        setTimeout(broadcastWrongLength, 100);
        setTimeout(broadcastWrongHeader, 200);
        setTimeout(stopAll, 300);
      });
    });
  });
});
