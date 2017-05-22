/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const ZyreGroup = require('../lib/zyre_group');

describe('ZyreGroup', () => {
  it('should create an instance of ZyreGroup', () => {
    const zyreGroup = new ZyreGroup('CHAT', { getIdentity() { return 'foo'; } });
    assert.instanceOf(zyreGroup, ZyreGroup);
  });
});
