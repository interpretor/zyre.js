/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const { assert } = require('chai');
const uuid = require('uuid');
const zeromq = require('zeromq');
const ZyrePeers = require('../lib/zyre_peers');

describe('ZyrePeers', () => {
  let msgHit = 0;

  // ZreMsg mock
  class Msg {
    send(socket) {
      msgHit += 1;
      this.socket = socket;
      assert.instanceOf(this.socket, zeromq.Socket);
      return new Promise((resolve) => {
        resolve(1);
      });
    }
  }

  it('should create an instance of ZyrePeers', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new ZyrePeers({ identity });

    assert.instanceOf(zyrePeers, ZyrePeers);
  });

  it('should create a new ZyrePeer on push and disconnect it afterwards', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new ZyrePeers({ identity });

    let hit = false;

    zyrePeers.on('new', () => {
      hit = true;
    });

    const zyrePeer = zyrePeers.push({
      identity: '12345',
      sequence: 1,
      address: '127.0.0.1',
      mailbox: 54321,
    });

    assert.property(zyrePeer, 'connect');
    assert.property(zyrePeer, 'update');
    assert.isTrue(hit);
    assert.isTrue(zyrePeers.exists('12345'));
    assert.isNotTrue(zyrePeers.exists('56789'));
    assert.equal(zyrePeers.getPeer('12345'), zyrePeer);

    zyrePeers.getPeer('12345').disconnect();
    assert.isNotTrue(zyrePeers.exists('12345'));

    zyrePeers.push({ identity: '123' });
    zyrePeers.push({ identity: '456' });
    zyrePeers.disconnectAll();
    assert.isNotTrue(zyrePeers.exists('123'));
    assert.isNotTrue(zyrePeers.exists('456'));
  });

  it('should send a message to all peers', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new ZyrePeers({ identity });
    const zreMsg = new Msg();

    const peer1 = zyrePeers.push({ identity: '123', endpoint: 'tcp://127.0.0.1:54678' });
    const peer2 = zyrePeers.push({ identity: '456', endpoint: 'tcp://127.0.0.1:54679' });

    peer1.connect();
    peer2.connect();
    zyrePeers.send(zreMsg);
    assert.equal(msgHit, 2);

    zyrePeers.disconnectAll();
  });

  it('should return the public peers object', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new ZyrePeers({ identity });

    zyrePeers.push({ identity: '123' });
    zyrePeers.push({ identity: '456' });

    assert.property(zyrePeers.toObj(), '123');
    assert.property(zyrePeers.toObj(), '456');

    zyrePeers.disconnectAll();
  });

  it('should add events to the created peers', (done) => {
    const evasive = 100;
    const expired = 200;

    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new ZyrePeers({ identity, evasive, expired });

    let hit1 = false;
    let hit2 = false;

    zyrePeers.on('expired', () => {
      hit1 = true;
    });

    zyrePeers.on('disconnect', () => {
      hit2 = true;
    });

    zyrePeers.push({ identity: '12345', endpoint: 'tcp://127.0.0.1:56789' });

    setTimeout(() => {
      zyrePeers.push({ identity: '12345' });
      zyrePeers.push({ identity: '12345', address: '127.0.0.1', mailbox: 0 });
      assert.isNotTrue(zyrePeers.exists('12345'));
      zyrePeers.disconnectAll();
      if (hit1 && hit2) done();
    }, expired + 50);
  });
});
