/*
 * Copyright (c) 2017 Sebastian Rager
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const assert = require('chai').assert;
const zyre = require('../lib/zyre');
const ZyrePeer = require('../lib/zyre_peer');

describe('Zyre', () => {
  it('should create a new instance of Zyre', () => {
    const z1 = zyre.new();
    assert.instanceOf(z1, zyre);
  });

  it('should inform about expired peers', function (done) {
    // Set higher timeout to test expired peers
    this.timeout(ZyrePeer.PEER_EXPIRED + 1000);

    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    z1.on('expired', (id, name) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      z2.stop().then(() => {
        z1.stop().then(() => {
          setTimeout(() => { done(); }, 100);
        });
      });
    });

    z1.start().then(() => {
      z2.start();
    });

    setTimeout(() => {
      clearInterval(z1._zBeacon._broadcastTimer);
      clearInterval(z2._zBeacon._broadcastTimer);
      clearTimeout(z1._zyrePeers._peers[z2.getIdentity()]._evasiveTimeout);
      clearTimeout(z2._zyrePeers._peers[z1.getIdentity()]._evasiveTimeout);
    }, 100);
  });

  it('should inform about peers that are back from being expired', function (done) {
    // Set higher timeout to test expired peers
    this.timeout(ZyrePeer.PEER_EXPIRED + 1000);

    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    z1.on('back', (id, name) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      z2.stop().then(() => {
        z1.stop().then(() => {
          setTimeout(() => { done(); }, 100);
        });
      });
    });

    z1.start().then(() => {
      z2.start();
    });

    setTimeout(() => {
      clearInterval(z1._zBeacon._broadcastTimer);
      clearInterval(z2._zBeacon._broadcastTimer);
      clearTimeout(z1._zyrePeers._peers[z2.getIdentity()]._evasiveTimeout);
      clearTimeout(z2._zyrePeers._peers[z1.getIdentity()]._evasiveTimeout);
    }, 100);

    setTimeout(() => {
      z2._zBeacon.startBroadcasting();
    }, ZyrePeer.PEER_EXPIRED + 100);
  });

  it('should inform about disconnected peers', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    z1.on('disconnect', (id, name) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      z1.stop().then(() => {
        setTimeout(() => { done(); }, 100);
      });
    });

    z1.start().then(() => {
      z2.start();
    });

    setTimeout(() => {
      z2.stop();
    }, 100);
  });

  it('should inform about connected peers', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    z1.on('connect', (id, name) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      z2.stop().then(() => {
        z1.stop().then(() => {
          setTimeout(() => { done(); }, 100);
        });
      });
    });

    z1.start().then(() => {
      z2.start();
    });
  });

  it('should communicate with WHISPER messages', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    z1.on('whisper', (id, name, message) => {
      assert.equal(id, z2.getIdentity());
      assert.equal(name, 'z2');
      assert.equal(message, 'Hey!');
      z2.stop().then(() => {
        z1.stop().then(() => {
          setTimeout(() => { done(); }, 100);
        });
      });
    });

    z2.on('whisper', (id, name, message) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(message, 'Hello World!');
      z2.whisper(z1.getIdentity(), 'Hey!');
    });

    z1.start().then(() => {
      z2.start();
    });

    setTimeout(() => {
      z1.whisper(z2.getIdentity(), 'Hello World!');
    }, 100);
  });

  it('should communicate with SHOUT messages', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });
    const z3 = zyre.new({ name: 'z3' });

    let hit1 = false;
    let hit2 = false;

    z2.on('shout', (id, name, message, group) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(message, 'Hello World!');
      assert.equal(group, 'CHAT');
      hit1 = true;
    });

    z3.on('shout', (id, name, message, group) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(message, 'Hello World!');
      assert.equal(group, 'CHAT');
      hit2 = true;
    });

    z1.start().then(() => {
      z1.join('CHAT');
      z2.start().then(() => {
        z2.join('CHAT');
        z3.start().then(() => {
          z3.join('CHAT');
        });
      });
    });

    setTimeout(() => {
      z1.shout('CHAT', 'Hello World!');
    }, 100);

    setTimeout(() => {
      z3.stop().then(() => {
        z2.stop().then(() => {
          z1.stop().then(() => {
            if (hit1 && hit2) setTimeout(() => { done(); }, 100);
          });
        });
      });
    }, 200);
  });

  it('should join a group and send JOIN messages', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    z2.on('join', (id, name, group) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(group, 'CHAT');
      assert.property(z2.getGroup('CHAT'), z1.getIdentity());
      z1.stop().then(() => {
        z2.stop().then(() => {
          setTimeout(() => { done(); }, 100);
        });
      });
    });

    z1.start().then(() => {
      z2.start();
    });

    setTimeout(() => {
      z1.join('CHAT');
    }, 100);
  });

  it('should leave a group and send LEAVE messages', (done) => {
    const z1 = zyre.new({ name: 'z1' });
    const z2 = zyre.new({ name: 'z2' });

    z2.on('leave', (id, name, group) => {
      assert.equal(id, z1.getIdentity());
      assert.equal(name, 'z1');
      assert.equal(group, 'CHAT');
      assert.isNotObject(z2.getGroup(name));
      z1.stop().then(() => {
        z2.stop().then(() => {
          setTimeout(() => { done(); }, 100);
        });
      });
    });

    z1.start().then(() => {
      z2.start();
    });

    setTimeout(() => {
      z1.join('CHAT');
    }, 100);

    setTimeout(() => {
      z1.leave('CHAT');
    }, 200);
  });
});
