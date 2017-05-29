/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const ZHelper = require('../lib/zhelper');

describe('ZHelper', () => {
  it('should create an instance of ZHelper', () => {
    const zHelper = new ZHelper();
    assert.instanceOf(zHelper, ZHelper);
  });

  it('should return public IPv4 interface data', () => {
    const ifdata = ZHelper.getIfData();
    assert.propertyVal(ifdata, 'family', 'IPv4');
    assert.property(ifdata, 'broadcast');
  });

  it('should return a free TCP port', (done) => {
    const ifdata = ZHelper.getIfData();
    const p = 49152;
    ZHelper.getFreePort(ifdata.address, p).then((port) => {
      assert.isAtLeast(port, p);
      done();
    });
  });
});
