/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const uuid = require('uuid');
const ZyreGroups = require('../lib/zyre_groups');
const ZyreGroup = require('../lib/zyre_group');
const ZyrePeer = require('../lib/zyre_peer');

describe('ZyreGroups', () => {
  it('should create an instance of ZyreGroups', () => {
    const zyreGroups = new ZyreGroups();
    assert.instanceOf(zyreGroups, ZyreGroups);
  });

  it('should create a new ZyreGroup instance on push', () => {
    const zyreGroups = new ZyreGroups();

    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeer = new ZyrePeer({
      identity: 'qwertz',
      originID: identity,
    });

    const groupName = 'CHAT';

    zyreGroups.push(groupName, zyrePeer);

    assert.instanceOf(zyreGroups.getGroup(groupName), ZyreGroup);
  });
});
