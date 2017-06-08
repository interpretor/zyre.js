/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const uuid = require('uuid');
const ZyreGroup = require('../lib/zyre_group');
const ZyrePeer = require('../lib/zyre_peer');

describe('ZyreGroup', () => {
  it('should create an instance of ZyreGroup', () => {
    const zyreGroup = new ZyreGroup('CHAT');
    assert.instanceOf(zyreGroup, ZyreGroup);
  });

  it('should add a new ZyrePeer to the ZyreGroup', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: 'qwertz',
      originID: identity,
    });

    const groups = ['TEST'];

    const zyreGroup = new ZyreGroup(groups[0]);
    zyreGroup.add(zyrePeer);

    assert.sameMembers(zyreGroup.toObj().qwertz.groups, groups);
  });

  it('should remove a ZyrePeer from the ZyreGroup', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: 'qwertz',
      originID: identity,
    });

    const groups = ['TEST'];

    const zyreGroup = new ZyreGroup(groups[0]);
    zyreGroup.add(zyrePeer);
    assert.sameMembers(zyreGroup.toObj().qwertz.groups, groups);

    zyreGroup.remove(zyrePeer);
    assert.deepEqual(zyreGroup.toObj(), {});
    assert.deepEqual(zyrePeer._groups, {});
  });

  it('should return the current amount of peers in the group', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: 'qwertz',
      originID: identity,
    });

    const zyreGroup = new ZyreGroup('TEST');
    zyreGroup.add(zyrePeer);

    assert.equal(zyreGroup.amountOfPeers(), 1);
  });

  it('should return the public group object', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: 'qwertz',
      originID: identity,
    });

    const zyreGroup = new ZyreGroup('TEST');
    zyreGroup.add(zyrePeer);

    assert.property(zyreGroup.toObj(), 'qwertz');
  });
});
