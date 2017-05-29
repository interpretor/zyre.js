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

  it('should do basic group communication', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    z1.on('message', (id, name, message, group) => {
      assert.equal(name, 'z2');
      assert.equal(message, 'Hello World!');
      assert.equal(group, 'CHAT');
      z1.shout('CHAT', 'Hey!');
    });

    z2.on('message', (id, name, message, group) => {
      assert.equal(name, 'z1');
      assert.equal(message, 'Hey!');
      assert.equal(group, 'CHAT');
      done();
    });

    z1.start().then(() => {
      z1.join('CHAT');
      z2.start().then(() => {
        z2.join('CHAT');
      });
    });

    setTimeout(() => {
      z2.shout('CHAT', 'Hello World!');
    }, 1500);
  });
});
