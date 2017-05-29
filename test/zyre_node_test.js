/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const uuid = require('uuid');
const ZyrePeers = require('../lib/zyre_peers');
const ZyreGroups = require('../lib/zyre_groups');
const ZyreNode = require('../lib/zyre_node');
const ZHelper = require('../lib/zhelper');

describe('ZyreNode', () => {
  it('should create an instance of ZyreNode', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, this._identity, 0);

    const zyreNode = new ZyreNode({
      identity,
      name: 'foo',
      address: ZHelper.getIfData().address,
      mailbox: 54321,
      zyrePeers: new ZyrePeers(identity),
      zyreGroups: new ZyreGroups(),
    });

    assert.instanceOf(zyreNode, ZyreNode);
  });
});
