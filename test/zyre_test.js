/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const zyre = require('../lib/zyre');

describe('Zyre', () => {
  it('should create a new instance of Zyre', () => {
    const z1 = zyre.new();
    assert.instanceOf(z1, zyre);
  });
});
