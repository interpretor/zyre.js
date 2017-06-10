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

describe('ZyrePeers', () => {
  it('should create an instance of ZyrePeers', () => {
    const identity = Buffer.alloc(16);
    uuid.v4(null, identity, 0);

    const zyrePeers = new ZyrePeers({ identity });

    assert.instanceOf(zyrePeers, ZyrePeers);
  });
});
