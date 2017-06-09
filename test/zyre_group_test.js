/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const EventEmitter = require('events');
const ZyreGroup = require('../lib/zyre_group');

describe('ZyreGroup', () => {
  // ZyrePeer mock
  class Peer extends EventEmitter {
    constructor(identity) {
      super();

      this.identity = identity;
      this.groups = {};
    }

    getIdentity() {
      return this.identity;
    }

    addToGroup(group) {
      if (typeof this.groups[group.getName()] === 'undefined') {
        this.groups[group.getName()] = group;
        group.add(this);
      }
    }

    removeFromGroup(group) {
      if (typeof this.groups[group.getName()] !== 'undefined') {
        delete this.groups[group.getName()];
        group.remove(this);
      }
    }

    send(msg) {
      this.emit('msg', msg);
    }

    toObj() {
      return {
        groups: this.groups,
      };
    }
  }

  // ZreMsg mock
  class Msg {
    setGroup(group) {
      this.group = group;
    }
  }

  it('should create an instance of ZyreGroup', () => {
    const zyreGroup = new ZyreGroup('CHAT');
    assert.instanceOf(zyreGroup, ZyreGroup);
    assert.equal(zyreGroup.getName(), 'CHAT');
  });

  it('should add/remove a peer to/from the ZyreGroup', () => {
    const zyrePeer = new Peer('foobar');
    const zyreGroup = new ZyreGroup('TEST');

    zyreGroup.add(zyrePeer);

    assert.equal(zyreGroup.amountOfPeers(), 1);
    assert.property(zyrePeer.groups, 'TEST');

    zyreGroup.remove(zyrePeer);

    assert.equal(zyreGroup.amountOfPeers(), 0);
    assert.deepEqual(zyrePeer.groups, {});
  });

  it('should return the public group object', () => {
    const zyrePeer = new Peer('foobar');
    const zyreGroup = new ZyreGroup('TEST');

    zyreGroup.add(zyrePeer);

    assert.property(zyreGroup.toObj(), 'foobar');
  });

  it('should send a message to all group members', (done) => {
    const zyrePeer1 = new Peer('foobar1');
    const zyrePeer2 = new Peer('foobar2');
    const zreMsg = new Msg();
    const zyreGroup = new ZyreGroup('TEST');

    zyreGroup.add(zyrePeer1);
    zyreGroup.add(zyrePeer2);

    let hit1 = false;
    let hit2 = false;

    zyrePeer1.on('msg', (msg) => {
      assert.equal(msg, zreMsg);
      hit1 = true;
    });

    zyrePeer2.on('msg', (msg) => {
      assert.equal(msg, zreMsg);
      hit2 = true;
    });

    zyreGroup.send(zreMsg);

    if (hit1 && hit2) done();
  });
});
