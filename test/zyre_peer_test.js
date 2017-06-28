/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const uuid = require('uuid');
const zeromq = require('zeromq');
const ZyrePeer = require('../lib/zyre_peer');

describe('ZyrePeer', () => {
  // ZyreGroup mock
  class Group {
    constructor(name) {
      this.name = name;
      this.peers = {};
    }

    getName() {
      return this.name;
    }

    add(zyrePeer) {
      if (typeof this.peers[zyrePeer.getIdentity()] === 'undefined') {
        this.peers[zyrePeer.getIdentity()] = zyrePeer;
        zyrePeer.addToGroup(this);
      }
    }

    remove(zyrePeer) {
      if (typeof this.peers[zyrePeer.getIdentity()] !== 'undefined') {
        delete this.peers[zyrePeer.getIdentity()];
        zyrePeer.removeFromGroup(this);
      }
    }
  }

  let msgHit = 0;

  // ZreMsg mock
  class Msg {
    setSequence(sequence) {
      this.sequence = sequence;
      assert.equal(this.sequence, 1);
    }

    send(socket) {
      msgHit += 1;
      this.socket = socket;
      assert.instanceOf(this.socket, zeromq.Socket);
      return new Promise((resolve) => {
        resolve(1);
      });
    }
  }

  it('should create an instance of ZyrePeer', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
      originID: identity,
    });

    assert.instanceOf(zyrePeer, ZyrePeer);
    assert.isDefined(zyrePeer._evasive);
    assert.isDefined(zyrePeer._expired);
    assert.equal(zyrePeer.getIdentity(), '12345');

    const evasive = 1000;
    const expired = 2000;

    const zyrePeer2 = new ZyrePeer({
      identity: '56789',
      originID: identity,
      evasive,
      expired,
    });

    assert.instanceOf(zyrePeer2, ZyrePeer);
    assert.equal(zyrePeer2._evasive, evasive);
    assert.equal(zyrePeer2._expired, expired);
    assert.equal(zyrePeer2.getIdentity(), '56789');
  });

  it('should add/remove the ZyrePeer to/from a group', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
      originID: identity,
    });

    const zyreGroup = new Group('CHAT');

    zyrePeer.addToGroup(zyreGroup);
    assert.property(zyreGroup.peers, '12345');
    assert.property(zyrePeer._groups, 'CHAT');

    zyrePeer.removeFromGroup(zyreGroup);
    assert.deepEqual(zyreGroup.peers, {});
    assert.deepEqual(zyrePeer._groups, {});
  });

  it('should create a new zeromq dealer socket on connect and close it on disconnect', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
      originID: identity,
    });

    const zyreGroup = new Group('CHAT');
    zyrePeer._setEndpoint('tcp://127.0.0.1:42321');

    let hit = false;

    zyrePeer.on('disconnect', () => {
      hit = true;
    });

    zyrePeer.addToGroup(zyreGroup);
    zyrePeer.connect();
    assert.instanceOf(zyrePeer._socket, zeromq.Socket);
    zyrePeer.disconnect();
    assert.isNotObject(zyrePeer._socket);
    assert.deepEqual(zyrePeer._groups, {});
    assert.isTrue(hit);
  });

  it('should send a message to the peer', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
      originID: identity,
    });

    const zreMsg = new Msg();
    zyrePeer._setEndpoint('tcp://127.0.0.1:42321');

    zyrePeer.connect();
    zyrePeer.send(zreMsg);
    assert.equal(msgHit, 1);

    zyrePeer.disconnect();
  });

  it('should update the peers information', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
      originID: identity,
    });

    let hit = false;

    zyrePeer.on('disconnect', () => {
      hit = true;
    });

    zyrePeer.update({ sequence: 1 });
    assert.equal(zyrePeer._sequenceIn, 1);
    assert.isNotObject(zyrePeer.update({ sequence: 3 }));
    assert.isTrue(hit);
    hit = false;

    zyrePeer.update({ address: '127.0.0.1', mailbox: 54321 });
    assert.equal(zyrePeer._endpoint, 'tcp://127.0.0.1:54321');
    zyrePeer.update({ address: '0.0.0.0' });
    assert.equal(zyrePeer._endpoint, 'tcp://127.0.0.1:54321');
    zyrePeer.update({ mailbox: 56123 });
    assert.equal(zyrePeer._endpoint, 'tcp://127.0.0.1:54321');
    zyrePeer.update({ endpoint: 'tcp://127.0.0.42:57142' });
    assert.equal(zyrePeer._endpoint, 'tcp://127.0.0.42:57142');
    assert.isNotObject(zyrePeer.update({ address: '0.0.0.0', mailbox: 0 }));
    assert.isTrue(hit);

    zyrePeer.update({ status: 5 });
    assert.equal(zyrePeer._status, 5);

    zyrePeer.update({ name: 'foobar' });
    assert.equal(zyrePeer.getName(), 'foobar');

    zyrePeer.update({ headers: { foo: 'bar' } });
    assert.deepEqual(zyrePeer.getHeaders(), { foo: 'bar' });

    zyrePeer._clearTimeouts();
  });

  it('should mark an evasive peer', (done) => {
    const evasive = 100;
    const expired = 200;

    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
      originID: identity,
      evasive,
      expired,
    });

    zyrePeer.update({
      sequence: 1,
    });

    setTimeout(() => {
      zyrePeer._clearTimeouts();
      if (zyrePeer._evasiveAt > 0) done();
    }, evasive + 50);
  });

  it('should mark an expired peer', (done) => {
    const evasive = 100;
    const expired = 200;

    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
      originID: identity,
      evasive,
      expired,
    });

    zyrePeer.update({
      sequence: 1,
    });

    zyrePeer.on('expired', () => {
      done();
    });
  });

  it('should return the public peer object', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: '12345',
      originID: identity,
    });

    const zyreGroup = new Group('CHAT');

    const name = 'foobar';
    const endpoint = 'tcp://127.0.0.1:54321';
    const headers = {
      foo: 'bar',
      bob: 'omb',
    };

    zyrePeer.update({
      name,
      endpoint,
      headers,
    });

    zyrePeer.addToGroup(zyreGroup);

    const obj = zyrePeer.toObj();

    assert.equal(obj.name, name);
    assert.equal(obj.endpoint, endpoint);
    assert.deepEqual(obj.headers, headers);
    assert.sameMembers(obj.groups, ['CHAT']);
    assert.isNotTrue(obj.evasive);
    assert.isNotTrue(obj.expired);

    zyrePeer._clearTimeouts();
  });
});
