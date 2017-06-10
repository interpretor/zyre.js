/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const ZyreGroups = require('../lib/zyre_groups');
const ZyreGroup = require('../lib/zyre_group');

describe('ZyreGroups', () => {
  // ZyrePeer mock
  class Peer {
    constructor(identity) {
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

    toObj() {
      return {
        groups: this.groups,
      };
    }
  }

  it('should create an instance of ZyreGroups', () => {
    const zyreGroups = new ZyreGroups();
    assert.instanceOf(zyreGroups, ZyreGroups);
  });

  it('should create a new ZyreGroup instance on push and remove an empty ZyreGroup', () => {
    const zyreGroups = new ZyreGroups();
    const zyrePeer = new Peer('foobar');
    const groupName = 'CHAT';

    zyreGroups.push(groupName, zyrePeer);
    assert.instanceOf(zyreGroups.getGroup(groupName), ZyreGroup);

    zyreGroups.remove(groupName, zyrePeer);
    assert.isFalse(zyreGroups.exists(groupName));
  });

  it('should add multiple peers to the already created ZyreGroup', () => {
    const zyreGroups = new ZyreGroups();
    const zyrePeer1 = new Peer('foo');
    const zyrePeer2 = new Peer('bar');
    const groupName = 'CHAT';

    zyreGroups.push(groupName, zyrePeer1);
    zyreGroups.push(groupName, zyrePeer2);
    assert.equal(zyreGroups.getGroup(groupName).amountOfPeers(), 2);
    assert.property(zyrePeer1.groups, groupName);
    assert.property(zyrePeer2.groups, groupName);

    zyreGroups.remove(groupName, zyrePeer2);
    assert.exists(groupName);
  });

  it('should return the public groups object', () => {
    const zyreGroups = new ZyreGroups();
    const zyrePeer = new Peer('foobar');
    const groupName = 'CHAT';

    zyreGroups.push(groupName, zyrePeer);
    assert.property(zyreGroups.toObj().CHAT, 'foobar');
  });
});
