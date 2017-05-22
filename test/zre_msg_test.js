/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const ZreMsg = require('../lib/zre_msg');

describe('ZreMsg', () => {
  it('should create an instance of ZreMsg', () => {
    const zreMsg = new ZreMsg(6, { sequence: 1 });
    assert.instanceOf(zreMsg, ZreMsg);
  });
});
